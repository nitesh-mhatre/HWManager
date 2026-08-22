/**
 * Web Scraper Service for Hot Wheels Data
 *
 * Multi-source scraper that fetches real data from:
 * 1. DuckDuckGo (primary search)
 * 2. Google (fallback search)
 * 3. Bing (second fallback search)
 * 4. Direct Hot Wheels collector databases
 * 5. eBay sold listings
 *
 * Each source is tried in order. If one fails, the next is used.
 * All fetched pages are parsed for year, price, and identification data.
 */

// ─── Types ────────────────────────────────────────────────────

export interface ScrapedResult {
  title: string;
  url: string;
  snippet: string;
  content: string; // full page text extraction
  yearHits: number[];
  priceHits: { price: number; currency: string }[];
}

export interface ScraperConfig {
  maxSearchResults: number;
  maxPagesToFetch: number;
  timeoutMs: number;
  userAgent: string;
}

const DEFAULT_CONFIG: ScraperConfig = {
  maxSearchResults: 10,
  maxPagesToFetch: 8,
  timeoutMs: 8000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Search the web and scrape content from results.
 * Tries multiple search engines and collector databases.
 */
export async function scrapeWebData(
  model: string,
  toyNumber: string,
  series: string,
  color: string,
  config: Partial<ScraperConfig> = {}
): Promise<ScrapedResult[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const queries = buildQueries(model, toyNumber, series, color);

  console.log(`[Scraper] ${queries.length} queries to run`);

  // ── Phase 1: Search across multiple engines ──
  const allUrls: { url: string; title: string; snippet: string }[] = [];

  for (const query of queries) {
    // Try DuckDuckGo first
    let results = await searchDuckDuckGo(query, cfg);
    if (results.length === 0) {
      // Fallback to Google
      results = await searchGoogle(query, cfg);
    }
    if (results.length === 0) {
      // Fallback to Bing
      results = await searchBing(query, cfg);
    }

    for (const r of results) {
      if (!allUrls.some((u) => u.url === r.url)) {
        allUrls.push(r);
      }
    }

    console.log(`[Scraper] Query "${query.substring(0, 40)}..." → ${results.length} results (total: ${allUrls.length})`);

    // Rate limit between queries
    await delay(300);
  }

  // ── Phase 2: Direct collector database lookups ──
  try {
    const directResults = await scrapeCollectorDatabases(model, toyNumber, cfg);
    for (const r of directResults) {
      if (!allUrls.some((u) => u.url === r.url)) {
        allUrls.push(r);
      }
    }
  } catch (e) {
    console.log(`[Scraper] Collector DB scrape failed: ${e}`);
  }

  console.log(`[Scraper] Total URLs to scrape: ${allUrls.length}`);

  // ── Phase 3: Fetch and parse each page ──
  const scraped: ScrapedResult[] = [];
  const limit = Math.min(allUrls.length, cfg.maxPagesToFetch);

  for (let i = 0; i < limit; i++) {
    const entry = allUrls[i];
    try {
      const content = await fetchPageContent(entry.url, cfg);
      const fullText = `${entry.title} ${entry.snippet} ${content}`;

      const yearHits = extractYears(fullText);
      const priceHits = extractPrices(fullText);

      scraped.push({
        title: entry.title,
        url: entry.url,
        snippet: entry.snippet,
        content: content.substring(0, 2000),
        yearHits,
        priceHits,
      });

      console.log(`[Scraper] Scraped [${i + 1}/${limit}]: ${entry.title.substring(0, 40)} → years: ${yearHits.length}, prices: ${priceHits.length}`);
    } catch (e) {
      console.log(`[Scraper] Failed to scrape ${entry.url}: ${e}`);
    }

    await delay(200);
  }

  // ── Phase 4: Boost results from known collector domains ──
  scraped.sort((a, b) => scoreCollectorSource(a.url) - scoreCollectorSource(b.url));

  return scraped;
}

// ─── Query Builder ────────────────────────────────────────────

function buildQueries(model: string, toyNumber: string, series: string, color: string): string[] {
  const m = model.replace(/[^\w\s]/g, '').trim();
  const queries: string[] = [];

  // Most specific first
  if (toyNumber) {
    queries.push(`Hot Wheels ${m} ${toyNumber}`);
    queries.push(`Hot Wheels ${m} ${toyNumber} year price`);
  }

  if (m) {
    queries.push(`${m} hot wheels release year`);
    queries.push(`${m} hot wheels price value`);
    queries.push(`hotwheels wiki ${m}`);
    queries.push(`hotwheelsdb.com ${m}`);
  }

  if (m && color) {
    queries.push(`Hot Wheels ${m} ${color} price`);
  }

  if (m && series) {
    queries.push(`Hot Wheels ${m} ${series}`);
  }

  // Generic fallback
  if (m) {
    queries.push(`"hot wheels" "${m}" year price collectible`);
  }

  return queries.slice(0, 8);
}

// ─── Search Engine: DuckDuckGo ────────────────────────────────

async function searchDuckDuckGo(
  query: string,
  cfg: ScraperConfig
): Promise<{ url: string; title: string; snippet: string }[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encoded}`,
      { headers: { 'User-Agent': cfg.userAgent } },
      cfg.timeoutMs
    );

    const html = await res.text();
    return parseDuckDuckGoHtml(html, cfg.maxSearchResults);
  } catch (e) {
    console.log(`[DDG] Failed: ${e}`);
    return [];
  }
}

function parseDuckDuckGoHtml(html: string, limit: number): { url: string; title: string; snippet: string }[] {
  const results: { url: string; title: string; snippet: string }[] = [];

  // Find all result links using global regex on full HTML
  // DDG wraps each result in: <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=...">Title</a>
  const linkPattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null && results.length < limit) {
    let href = match[1];
    const titleHtml = match[2];

    // Decode DDG redirect URLs (protocol-relative or full)
    if (href.includes('uddg=')) {
      try {
        const fullUrl = href.startsWith('//') ? 'https:' + href : href;
        const u = new URL(fullUrl);
        href = decodeURIComponent(u.searchParams.get('uddg') || href);
      } catch {}
    }
    if (href.startsWith('//')) {
      href = 'https:' + href;
    }

    const title = cleanText(titleHtml);

    // Skip DDG internal links
    if (!href || !title || href.includes('duckduckgo.com')) continue;

    // Find the snippet for this result (appears after the link)
    let snippet = '';
    const snippetPattern = /class="result__snippet"[^>]*>([\s\S]*?)<\/a?/gi;
    const snippetMatch = snippetPattern.exec(html);
    if (snippetMatch && snippetMatch.index > match.index) {
      snippet = cleanText(snippetMatch[1]);
    }

    results.push({ url: href, title, snippet });
  }

  return results;
}

// ─── Search Engine: Google ────────────────────────────────────

async function searchGoogle(
  query: string,
  cfg: ScraperConfig
): Promise<{ url: string; title: string; snippet: string }[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetchWithTimeout(
      `https://www.google.com/search?q=${encoded}&num=${cfg.maxSearchResults}&hl=en`,
      {
        headers: {
          'User-Agent': cfg.userAgent,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      cfg.timeoutMs
    );

    const html = await res.text();
    return parseGoogleHtml(html, cfg.maxSearchResults);
  } catch (e) {
    console.log(`[Google] Failed: ${e}`);
    return [];
  }
}

function parseGoogleHtml(html: string, limit: number): { url: string; title: string; snippet: string }[] {
  const results: { url: string; title: string; snippet: string }[] = [];

  // Google wraps results in <div class="g"> blocks
  const blocks = html.split(/<div class="g"|"class="g" /);

  for (let i = 1; i < blocks.length && results.length < limit; i++) {
    const block = blocks[i];

    // Extract URL - Google uses /url?q= redirects
    let url = '';
    const urlMatch =
      block.match(/\/url\?q=(https?:\/\/[^&"]+)/i) ||
      block.match(/href="(https?:\/\/(?!google|youtube\.com\/results)[^"]+)"/i);

    if (urlMatch) {
      url = decodeURIComponent(urlMatch[1]);
    }

    // Extract title from <h3> tag
    let title = '';
    const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/is);
    if (titleMatch) {
      title = cleanText(titleMatch[1]);
    }

    // Extract snippet
    let snippet = '';
    const snippetMatch =
      block.match(/<span[^>]*class="[^"]*"[^>]*>(.*?)<\/span>/is) ||
      block.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>(.*?)<\/div>/is);
    if (snippetMatch) {
      snippet = cleanText(snippetMatch[1]);
    }

    if (url && title && !url.includes('google.com') && !url.includes('googleapis')) {
      results.push({ url, title, snippet });
    }
  }

  return results;
}

// ─── Search Engine: Bing ──────────────────────────────────────

async function searchBing(
  query: string,
  cfg: ScraperConfig
): Promise<{ url: string; title: string; snippet: string }[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetchWithTimeout(
      `https://www.bing.com/search?q=${encoded}&count=${cfg.maxSearchResults}`,
      { headers: { 'User-Agent': cfg.userAgent } },
      cfg.timeoutMs
    );

    const html = await res.text();
    return parseBingHtml(html, cfg.maxSearchResults);
  } catch (e) {
    console.log(`[Bing] Failed: ${e}`);
    return [];
  }
}

function parseBingHtml(html: string, limit: number): { url: string; title: string; snippet: string }[] {
  const results: { url: string; title: string; snippet: string }[] = [];

  // Bing uses <li class="b_algo"> for results
  const blocks = html.split(/<li class="b_algo"/);

  for (let i = 1; i < blocks.length && results.length < limit; i++) {
    const block = blocks[i];

    // Extract URL
    let url = '';
    const urlMatch = block.match(/href="(https?:\/\/[^"]+)"/i);
    if (urlMatch) {
      url = urlMatch[1];
    }

    // Extract title from <h2> tag
    let title = '';
    const titleMatch = block.match(/<h2[^>]*>(.*?)<\/h2>/is);
    if (titleMatch) {
      title = cleanText(titleMatch[1]);
    }

    // Extract snippet from <p> or <div class="b_caption">
    let snippet = '';
    const snippetMatch =
      block.match(/<p[^>]*>(.*?)<\/p>/is) ||
      block.match(/<div class="b_caption"[^>]*>(.*?)<\/div>/is);
    if (snippetMatch) {
      snippet = cleanText(snippetMatch[1]);
    }

    if (url && title && !url.includes('bing.com')) {
      results.push({ url, title, snippet });
    }
  }

  return results;
}

// ─── Direct Collector Database Scraping ───────────────────────

async function scrapeCollectorDatabases(
  model: string,
  toyNumber: string,
  cfg: ScraperConfig
): Promise<{ url: string; title: string; snippet: string }[]> {
  const results: { url: string; title: string; snippet: string }[] = [];
  const m = model.replace(/[^\w\s]/g, '').trim();

  // Hot Wheels Fandom Wiki - has structured year/price data
  const fandomSlug = m.toLowerCase().replace(/\s+/g, '_');
  const fandomUrls = [
    `https://hotwheels.fandom.com/wiki/${fandomSlug}`,
    `https://hotwheels.fandom.com/wiki/${encodeURIComponent(m)}`,
  ];

  for (const url of fandomUrls) {
    try {
      const content = await fetchPageContent(url, cfg);
      if (content.length > 200) {
        results.push({
          url,
          title: `Hot Wheels Wiki - ${m}`,
          snippet: content.substring(0, 500),
        });
        console.log(`[Scraper] Fandom wiki found: ${url}`);
        break;
      }
    } catch {}
    await delay(200);
  }

  // Hot Wheels Database (hotwheelsdb.com)
  const dbUrls = [
    `https://www.hotwheelsdb.com/model/${fandomSlug}`,
    `https://www.hotwheelsdb.com/search?q=${encodeURIComponent(m)}`,
  ];

  for (const url of dbUrls) {
    try {
      const content = await fetchPageContent(url, cfg);
      if (content.length > 200) {
        results.push({
          url,
          title: `Hot Wheels DB - ${m}`,
          snippet: content.substring(0, 500),
        });
        console.log(`[Scraper] HotWheelsDB found: ${url}`);
        break;
      }
    } catch {}
    await delay(200);
  }

  // eBay search for sold listings (price data)
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=hot+wheels+${encodeURIComponent(m)}${toyNumber ? '+' + encodeURIComponent(toyNumber) : ''}&LH_Complete=1&LH_Sold=1&_sop=13`;
  try {
    const content = await fetchPageContent(ebayUrl, cfg);
    if (content.length > 200) {
      results.push({
        url: ebayUrl,
        title: `eBay Sold - Hot Wheels ${m}`,
        snippet: content.substring(0, 500),
      });
      console.log(`[Scraper] eBay sold listings found`);
    }
  } catch {}

  return results;
}

// ─── Page Content Fetcher ─────────────────────────────────────

async function fetchPageContent(url: string, cfg: ScraperConfig): Promise<string> {
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': cfg.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    },
    cfg.timeoutMs
  );

  const html = await res.text();
  return extractStructuredContent(html);
}

/**
 * Extract meaningful text from HTML.
 * Handles: JSON-LD, meta tags, script data, table data, and body text.
 */
function extractStructuredContent(html: string): string {
  const parts: string[] = [];

  // 1. Extract JSON-LD structured data ( richest source )
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      const text = flattenJsonLd(data);
      if (text) parts.push(`[STRUCTURED] ${text}`);
    } catch {}
  }

  // 2. Extract meta description and og:description
  const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  if (metaDesc) parts.push(`[META] ${decodeEntities(metaDesc[1])}`);

  const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
  if (ogDesc) parts.push(`[OG] ${decodeEntities(ogDesc[1])}`);

  // 3. Extract title tag
  const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleTag) parts.push(`[TITLE] ${cleanText(titleTag[1])}`);

  // 4. Extract table data (collector sites often use tables for specs)
  const tableData = extractTableData(html);
  if (tableData) parts.push(`[TABLE] ${tableData}`);

  // 5. Extract list items (wiki infoboxes)
  const listData = extractListData(html);
  if (listData) parts.push(`[LIST] ${listData}`);

  // 6. Extract any visible text from paragraphs and headings
  const bodyText = extractBodyText(html);
  if (bodyText) parts.push(bodyText);

  // 7. Extract data from common collector site patterns
  const collectorData = extractCollectorPatterns(html);
  if (collectorData) parts.push(`[COLLECTOR] ${collectorData}`);

  return parts.join('\n\n').substring(0, 6000);
}

function flattenJsonLd(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data;

  const parts: string[] = [];

  if (data.name) parts.push(`Name: ${data.name}`);
  if (data.description) parts.push(`Description: ${data.description}`);
  if (data.datePublished) parts.push(`Published: ${data.datePublished}`);
  if (data.dateCreated) parts.push(`Created: ${data.dateCreated}`);
  if (data.brand?.name) parts.push(`Brand: ${data.brand.name}`);
  if (data.model) parts.push(`Model: ${data.model}`);
  if (data.sku) parts.push(`SKU: ${data.sku}`);
  if (data.offers?.price) parts.push(`Price: ${data.offers.price} ${data.offers.priceCurrency || ''}`);
  if (data.aggregateRating?.ratingValue) parts.push(`Rating: ${data.aggregateRating.ratingValue}`);

  // Handle arrays
  if (Array.isArray(data)) {
    for (const item of data.slice(0, 5)) {
      const text = flattenJsonLd(item);
      if (text) parts.push(text);
    }
  }

  return parts.join(' | ');
}

function extractTableData(html: string): string {
  const parts: string[] = [];

  // Look for infobox-style tables (wiki sites)
  const tableRegex = /<table[^>]*class="[^"]*(?:infobox|wikitable|specs|details|product)[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[1];
    const rows = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

    for (const row of rows) {
      const cells = row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      const cellTexts: string[] = [];

      for (const cell of cells) {
        cellTexts.push(cleanText(cell[1]));
      }

      if (cellTexts.length >= 2) {
        parts.push(cellTexts.join(': '));
      }
    }
  }

  // Also look for definition lists
  const dlRegex = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  while ((match = dlRegex.exec(html)) !== null) {
    const dtMatches = match[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/gi);
    const ddMatches = match[1].matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/gi);

    const dts = [...dtMatches].map((m) => cleanText(m[1]));
    const dds = [...ddMatches].map((m) => cleanText(m[1]));

    for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
      parts.push(`${dts[i]}: ${dds[i]}`);
    }
  }

  return parts.join(' | ');
}

function extractListData(html: string): string {
  const parts: string[] = [];

  // Wiki-style infobox uses <ul> with <li> items
  const ulRegex = /<ul[^>]*class="[^"]*(?:infobox|sidebar|specs)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  let match;

  while ((match = ulRegex.exec(html)) !== null) {
    const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    for (const li of liMatches) {
      const text = cleanText(li[1]);
      if (text.length > 2 && text.length < 200) {
        parts.push(text);
      }
    }
  }

  return parts.join(' | ');
}

function extractBodyText(html: string): string {
  // Remove scripts, styles, nav, header, footer
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  // Extract paragraphs and headings
  const textParts: string[] = [];

  const pMatches = cleaned.matchAll(/<(?:p|h[1-6])[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi);
  for (const match of pMatches) {
    const text = cleanText(match[1]);
    if (text.length > 10 && text.length < 500) {
      textParts.push(text);
    }
  }

  return textParts.join(' ').substring(0, 3000);
}

function extractCollectorPatterns(html: string): string {
  const parts: string[] = [];
  const text = html.replace(/<[^>]+>/g, ' ');

  // Year patterns specific to collector databases
  const yearPatterns = [
    /(?:released?|year|edition|series)\s*(?:was|in|of|:)?\s*(20[0-2]\d)/gi,
    /(20[0-2]\d)\s*(?:release|edition|series|mainline|casting)/gi,
    /©\s*(20[0-2]\d)\s*Mattel/gi,
    /first\s+(?:released|introduced|made|produced)\s+(?:in\s+)?(20[0-2]\d)/gi,
  ];

  for (const pattern of yearPatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      parts.push(`Year: ${m[1]} (context: ${m[0].substring(0, 60)})`);
    }
  }

  // Price patterns
  const pricePatterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)/g,
    /₹\s*([\d,]+(?:\.\d{2})?)/g,
    /£\s*([\d,]+(?:\.\d{2})?)/g,
    /EUR\s*([\d,]+(?:\.\d{2})?)/g,
  ];

  for (const pattern of pricePatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const price = parseFloat(m[1].replace(/,/g, ''));
      if (price > 0.5 && price < 50000) {
        parts.push(`Price: ${m[0].trim()}`);
      }
    }
  }

  // Series / toy number patterns
  const seriesMatch = text.match(/(?:series|line)\s*[:=]?\s*([A-Z][\w\s-]{2,30})/i);
  if (seriesMatch) parts.push(`Series: ${seriesMatch[1].trim()}`);

  const toyNumMatch = text.match(/(\d{1,3}\/\d{2,3})/);
  if (toyNumMatch) parts.push(`Toy Number: ${toyNumMatch[1]}`);

  return parts.join(' | ');
}

// ─── Year Extraction ──────────────────────────────────────────

function extractYears(text: string): number[] {
  const years: number[] = [];
  const seen = new Set<string>();

  const patterns = [
    /©\s*(20[0-2]\d)\s*Mattel/gi,
    /(?:released?|release year|edition year|introduced|launched|debuted|created|first made)\s*(?:in|:|was)?\s*(20[0-2]\d)/gi,
    /(20[0-2]\d)\s*(?:release|edition|series|mainline|casting|version)/gi,
    /hot\s*wheels[^.]{0,50}?(20[0-2]\d)/gi,
    /(20[0-2]\d)\s*[-–]\s*(20[0-2]\d)/g,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const year = parseInt(m[1]);
      const key = `${year}-${m.index}`;
      if (!seen.has(key) && year >= 1968 && year <= 2030) {
        years.push(year);
        seen.add(key);
      }
      // For year ranges, also add the second year
      if (m[2]) {
        const year2 = parseInt(m[2]);
        const key2 = `${year2}-${m.index}`;
        if (!seen.has(key2) && year2 >= 1968 && year2 <= 2030) {
          years.push(year2);
          seen.add(key2);
        }
      }
    }
  }

  // Standalone years as last resort
  const standalonePattern = /\b(20[1-2]\d)\b/g;
  let m;
  while ((m = standalonePattern.exec(text)) !== null) {
    const year = parseInt(m[1]);
    const key = `${year}-${m.index}`;
    if (!seen.has(key) && year >= 2000 && year <= 2030) {
      years.push(year);
      seen.add(key);
    }
  }

  return years;
}

// ─── Price Extraction ─────────────────────────────────────────

function extractPrices(text: string): { price: number; currency: string }[] {
  const prices: { price: number; currency: string }[] = [];

  const patterns: [RegExp, string][] = [
    [/\$\s*([\d,]+(?:\.\d{2})?)/g, 'USD'],
    [/₹\s*([\d,]+(?:\.\d{2})?)/g, 'INR'],
    [/£\s*([\d,]+(?:\.\d{2})?)/g, 'GBP'],
    [/€\s*([\d,]+(?:\.\d{2})?)/g, 'EUR'],
    [/A\$\s*([\d,]+(?:\.\d{2})?)/g, 'AUD'],
    [/C\$\s*([\d,]+(?:\.\d{2})?)/g, 'CAD'],
  ];

  for (const [pattern, currency] of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const price = parseFloat(m[1].replace(/,/g, ''));
      if (price > 0.25 && price < 100000) {
        prices.push({ price, currency });
      }
    }
  }

  return prices;
}

// ─── Source Scoring ───────────────────────────────────────────

function scoreCollectorSource(url: string): number {
  // Lower = better (for sorting)
  if (url.includes('hotwheels.fandom.com')) return 0;
  if (url.includes('hotwheelsdb.com')) return 1;
  if (url.includes('hobbydb.com')) return 2;
  if (url.includes('hallsguide.com')) return 3;
  if (url.includes('southtexasdiecast.com')) return 4;
  if (url.includes('hwcforums.com')) return 5;
  if (url.includes('ebay.com') && url.includes('Sold')) return 6;
  if (url.includes('ebay.com')) return 7;
  if (url.includes('walmart.com')) return 8;
  if (url.includes('amazon.com')) return 9;
  return 10;
}

// ─── Utilities ────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

function cleanText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

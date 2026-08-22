/**
 * Hot Wheels Internet Research Service
 * 
 * This service searches the internet for real Hot Wheels information
 * to verify release year and collectible pricing.
 * 
 * Flow:
 * 1. Generate search queries from identification
 * 2. Search the web
 * 3. Extract release year from multiple sources
 * 4. Extract pricing from multiple sources
 * 5. Cross-validate results
 * 6. Return verified information with sources
 */

import { NvidiaSettings } from '../types';

// ─── Types ────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface YearResearch {
  year: number | null;
  confidence: number; // 0-1
  sources: { title: string; url: string; year: number }[];
  status: 'CONFIRMED' | 'AMBIGUOUS' | 'NO_DATA';
  notes: string;
}

export interface PriceDataPoint {
  price: number;
  currency: string;
  condition: string; // MOC, Loose, etc.
  source: string;
  url: string;
  isSold: boolean; // true = sold/completed, false = active listing
}

export interface PriceResearch {
  low: number | null;
  median: number | null;
  high: number | null;
  currency: string;
  confidence: number; // 0-1
  salesCount: number;
  sources: { title: string; url: string; price: number; isSold: boolean }[];
  status: 'VERIFIED' | 'INSUFFICIENT_DATA' | 'NO_DATA';
  notes: string;
}

export interface ResearchResult {
  identification: {
    model: string;
    series: string;
    toyNumber: string;
    color: string;
    confidence: number;
  };
  release: YearResearch;
  market: PriceResearch;
  condition: {
    card: string;
    blister: string;
    car: string;
    score: number;
    notes: string[];
  };
  estimatedValue: {
    low: number | null;
    high: number | null;
    currency: string;
  };
  researchSources: { title: string; url: string; type: 'year' | 'price' | 'both' }[];
  lastResearched: string;
  status: string;
}

// ─── Exchange Rate Cache ──────────────────────────────────────

let cachedExchangeRate: { rate: number; timestamp: number } | null = null;

async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  
  // Check cache (refresh daily)
  if (cachedExchangeRate && Date.now() - cachedExchangeRate.timestamp < 86400000) {
    return cachedExchangeRate.rate;
  }

  try {
    // Use exchangerate-api.com (free tier)
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    const data = await res.json();
    const rate = data.rates?.[to] || (from === 'USD' && to === 'INR' ? 85 : 1);
    cachedExchangeRate = { rate, timestamp: Date.now() };
    return rate;
  } catch {
    // Fallback rates
    if (from === 'USD' && to === 'INR') return 85;
    if (from === 'GBP' && to === 'INR') return 107;
    if (from === 'EUR' && to === 'INR') return 92;
    return 1;
  }
}

// ─── Query Generation ─────────────────────────────────────────

export function generateSearchQueries(
  model: string,
  series: string,
  toyNumber: string,
  color: string,
  year: string
): string[] {
  const queries: string[] = [];
  const modelClean = model.replace(/[^\w\s]/g, '').trim();

  // High priority: toy number (most specific)
  if (toyNumber) {
    queries.push(`Hot Wheels ${modelClean} ${toyNumber}`);
    queries.push(`Hot Wheels ${modelClean} ${toyNumber} release year price`);
  }

  // Model + year queries
  if (modelClean && year) {
    queries.push(`Hot Wheels ${modelClean} ${year}`);
    queries.push(`Hot Wheels ${modelClean} ${year} value price`);
  }

  // Model + color
  if (modelClean && color) {
    queries.push(`Hot Wheels ${modelClean} ${color} price value`);
  }

  // Model only - broader searches
  if (modelClean) {
    queries.push(`Hot Wheels ${modelClean} release year`);
    queries.push(`Hot Wheels ${modelClean} price value`);
    queries.push(`"${modelClean}" hot wheels year`);
  }

  // Series-based
  if (modelClean && series) {
    queries.push(`Hot Wheels ${modelClean} ${series} year`);
  }

  // Collector database searches (site: works well for specific databases)
  if (toyNumber) {
    queries.push(`hotwheels.fandom.com ${toyNumber}`);
  }
  queries.push(`hotwheels.fandom.com ${modelClean}`);
  queries.push(`hotwheelsdb.com ${modelClean}`);

  return queries.slice(0, 10); // More queries = more evidence
}

// ─── Web Search ───────────────────────────────────────────────

export async function searchWeb(query: string): Promise<SearchResult[]> {
  // Try DuckDuckGo HTML endpoint (more stable than lite)
  const results = await searchDuckDuckGoHtml(query);
  if (results.length > 0) return results;

  // Fallback: try DuckDuckGo Lite
  return searchDuckDuckGoLite(query);
}

async function searchDuckDuckGoHtml(query: string): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const html = await res.text();
    return parseDuckDuckGoHtml(html);
  } catch (error) {
    console.error('DuckDuckGo HTML search failed:', error);
    return [];
  }
}

async function searchDuckDuckGoLite(query: string): Promise<SearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await res.text();
    return parseDuckDuckGoLite(html);
  } catch (error) {
    console.error('DuckDuckGo Lite search failed:', error);
    return [];
  }
}

function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Split by result blocks
  const resultBlocks = html.split('class="result"');

  for (let i = 1; i < resultBlocks.length; i++) {
    const block = resultBlocks[i];

    // Extract link URL - try multiple patterns
    let linkUrl = '';
    const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/i)
      || block.match(/<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]+)"/i)
      || block.match(/href="(https?:\/\/[^"\s]+)"/i);

    if (linkMatch) {
      linkUrl = decodeHtmlEntities(linkMatch[1]);
      // DuckDuckGo redirect URLs
      if (linkUrl.includes('uddg=')) {
        try {
          const parsed = new URL(linkUrl);
          linkUrl = decodeURIComponent(parsed.searchParams.get('uddg') || linkUrl);
        } catch {}
      }
    }

    // Extract title
    let title = '';
    const titleMatch = block.match(/class="result__a"[^>]*>(.*?)<\/a>/is)
      || block.match(/<a[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)<\/a>/is);
    if (titleMatch) {
      title = cleanHtmlText(titleMatch[1]);
    }

    // Extract snippet
    let snippet = '';
    const snippetMatch = block.match(/class="result__snippet"[^>]*>(.*?)<\/a?>/is)
      || block.match(/class="[^"]*snippet[^"]*"[^>]*>(.*?)<\/td>/is);
    if (snippetMatch) {
      snippet = cleanHtmlText(snippetMatch[1]);
    }

    if (linkUrl && title) {
      results.push({ title, url: linkUrl, snippet });
    }

    if (results.length >= 8) break;
  }

  return results;
}

function parseDuckDuckGoLite(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo Lite uses table-based layout
  // Links are in <a> tags with class "result-link"
  const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  let match;
  const links: { url: string; title: string }[] = [];
  const snippets: string[] = [];

  while ((match = linkRegex.exec(html)) !== null) {
    links.push({ url: match[1], title: match[2].trim() });
  }

  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
  }

  for (let i = 0; i < Math.min(links.length, 5); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  // Fallback: generic link extraction if structured parse found nothing
  if (results.length === 0) {
    const genericLinkRegex = /<a[^>]*href="(https?:\/\/duckduckgo\.com\/l\/\?uddg=[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    while ((match = genericLinkRegex.exec(html)) !== null) {
      let url = match[1];
      try {
        const parsed = new URL(url);
        url = decodeURIComponent(parsed.searchParams.get('uddg') || url);
      } catch {}
      results.push({ title: match[2].trim(), url, snippet: '' });
      if (results.length >= 5) break;
    }
  }

  return results;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function cleanHtmlText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ─── Content Extraction ───────────────────────────────────────

export async function extractPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const html = await res.text();
    
    // Simple text extraction - remove HTML tags
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 5000); // Limit content length
  } catch {
    return '';
  }
}

// ─── Year Extraction ──────────────────────────────────────────

export function extractYearFromText(text: string): { year: number; context: string }[] {
  const years: { year: number; context: string }[] = [];
  
  // Pattern 1: ©20XX Mattel
  const copyrightPattern = /©\s*(20[0-2]\d)\s*Mattel/gi;
  let match;
  while ((match = copyrightPattern.exec(text)) !== null) {
    years.push({ year: parseInt(match[1]), context: match[0] });
  }
  
  // Pattern 2: 20XX release
  const releasePattern = /(20[0-2]\d)\s*(?:release|edition|series|mainline)/gi;
  while ((match = releasePattern.exec(text)) !== null) {
    years.push({ year: parseInt(match[1]), context: match[0] });
  }
  
  // Pattern 3: Year in Hot Wheels context
  const hwYearPattern = /hot\s*wheels.*?(20[0-2]\d)/gi;
  while ((match = hwYearPattern.exec(text)) !== null) {
    years.push({ year: parseInt(match[1]), context: match[0] });
  }
  
  // Pattern 4: Standalone year (less reliable)
  const standalonePattern = /\b(20[0-2]\d)\b/g;
  while ((match = standalonePattern.exec(text)) !== null) {
    years.push({ year: parseInt(match[1]), context: match[0] });
  }
  
  return years;
}

// ─── Price Extraction ─────────────────────────────────────────

export function extractPricesFromText(text: string): PriceDataPoint[] {
  const prices: PriceDataPoint[] = [];
  
  // Pattern 1: ₹ price
  const inrPattern = /₹\s*([\d,]+(?:\.\d{2})?)/g;
  let match;
  while ((match = inrPattern.exec(text)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 0 && price < 1000000) {
      prices.push({
        price,
        currency: 'INR',
        condition: 'Unknown',
        source: '',
        url: '',
        isSold: text.toLowerCase().includes('sold') || text.toLowerCase().includes('completed'),
      });
    }
  }
  
  // Pattern 2: $ price
  const usdPattern = /\$\s*([\d,]+(?:\.\d{2})?)/g;
  while ((match = usdPattern.exec(text)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 0 && price < 100000) {
      prices.push({
        price,
        currency: 'USD',
        condition: 'Unknown',
        source: '',
        url: '',
        isSold: text.toLowerCase().includes('sold') || text.toLowerCase().includes('completed'),
      });
    }
  }
  
  // Pattern 3: £ price
  const gbpPattern = /£\s*([\d,]+(?:\.\d{2})?)/g;
  while ((match = gbpPattern.exec(text)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 0 && price < 100000) {
      prices.push({
        price,
        currency: 'GBP',
        condition: 'Unknown',
        source: '',
        url: '',
        isSold: text.toLowerCase().includes('sold') || text.toLowerCase().includes('completed'),
      });
    }
  }
  
  return prices;
}

// ─── Main Research Pipeline ───────────────────────────────────

export async function researchHotWheel(
  identification: {
    model: string;
    series: string;
    toyNumber: string;
    color: string;
    year: string;
  },
  conditionScore: number,
  conditionNotes: string[]
): Promise<ResearchResult> {
  const queries = generateSearchQueries(
    identification.model,
    identification.series,
    identification.toyNumber,
    identification.color,
    identification.year
  );

  const allResults: SearchResult[] = [];
  const yearData: { year: number; context: string; source: string; url: string }[] = [];
  const priceData: { price: number; currency: string; source: string; url: string; isSold: boolean }[] = [];

  // Search and collect data
  for (const query of queries) {
    try {
      const results = await searchWeb(query);
      allResults.push(...results);

      // Extract year and price from each result
      for (const result of results) {
        const content = await extractPageContent(result.url);
        const fullText = `${result.title} ${result.snippet} ${content}`;

        // Extract years
        const years = extractYearFromText(fullText);
        for (const y of years) {
          yearData.push({ ...y, source: result.title, url: result.url });
        }

        // Extract prices
        const prices = extractPricesFromText(fullText);
        for (const p of prices) {
          priceData.push({ ...p, source: result.title, url: result.url });
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // Continue with other queries
    }
  }

  // ─── Analyze Year Data ──────────────────────────────────────
  const yearResearch = analyzeYearData(yearData, identification.year);

  // ─── Analyze Price Data ─────────────────────────────────────
  const priceResearch = await analyzePriceData(priceData, conditionScore);

  // ─── Calculate Condition-Adjusted Value ─────────────────────
  const estimatedValue = calculateConditionAdjustedValue(
    priceResearch,
    conditionScore
  );

  // ─── Build Research Sources ─────────────────────────────────
  const researchSources = buildResearchSources(yearData, priceData);

  // ─── Determine Status ───────────────────────────────────────
  let status = 'IDENTIFIED';
  if (yearResearch.status === 'NO_DATA' && priceResearch.status === 'NO_DATA') {
    status = 'NO_RESEARCH_DATA';
  } else if (yearResearch.status === 'AMBIGUOUS') {
    status = 'AMBIGUOUS_YEAR';
  }

  return {
    identification: {
      model: identification.model,
      series: identification.series,
      toyNumber: identification.toyNumber,
      color: identification.color,
      confidence: 0.8,
    },
    release: yearResearch,
    market: priceResearch,
    condition: {
      card: conditionScore >= 85 ? 'Mint' : conditionScore >= 70 ? 'Near Mint' : conditionScore >= 50 ? 'Good' : 'Poor',
      blister: conditionScore >= 80 ? 'Excellent' : conditionScore >= 60 ? 'Good' : 'Fair',
      car: conditionScore >= 90 ? 'Mint' : conditionScore >= 70 ? 'Good' : 'Fair',
      score: conditionScore,
      notes: conditionNotes,
    },
    estimatedValue,
    researchSources,
    lastResearched: new Date().toISOString(),
    status,
  };
}

// ─── Analysis Helpers ─────────────────────────────────────────

function analyzeYearData(
  yearData: { year: number; context: string; source: string; url: string }[],
  visibleYear: string
): YearResearch {
  if (yearData.length === 0) {
    return {
      year: visibleYear ? parseInt(visibleYear) : null,
      confidence: visibleYear ? 0.5 : 0,
      sources: [],
      status: visibleYear ? 'CONFIRMED' : 'NO_DATA',
      notes: visibleYear ? 'Year from card only - no internet verification' : 'No year data found',
    };
  }

  // Count year occurrences
  const yearCounts: Record<number, number> = {};
  for (const y of yearData) {
    yearCounts[y.year] = (yearCounts[y.year] || 0) + 1;
  }

  // Find most common year
  const sortedYears = Object.entries(yearCounts)
    .sort((a, b) => b[1] - a[1]);

  const topYear = parseInt(sortedYears[0][0]);
  const topCount = sortedYears[0][1];
  const totalSources = yearData.length;

  // Check if sources agree
  const uniqueYears = sortedYears.length;
  
  if (uniqueYears === 1 || (uniqueYears === 2 && sortedYears[1][1] <= 1)) {
    // Strong agreement
    return {
      year: topYear,
      confidence: Math.min(0.95, 0.7 + (topCount / totalSources) * 0.3),
      sources: yearData
        .filter(y => y.year === topYear)
        .map(y => ({ title: y.source, url: y.url, year: y.year })),
      status: 'CONFIRMED',
      notes: `Confirmed by ${topCount} sources`,
    };
  } else if (uniqueYears <= 3 && sortedYears[1][1] >= sortedYears[0][1] * 0.5) {
    // Some disagreement
    return {
      year: topYear,
      confidence: 0.5,
      sources: yearData
        .filter(y => y.year === topYear)
        .map(y => ({ title: y.source, url: y.url, year: y.year })),
      status: 'AMBIGUOUS',
      notes: `Multiple years found: ${sortedYears.map(s => `${s[0]} (${s[1]} sources)`).join(', ')}`,
    };
  } else {
    // Clear majority
    return {
      year: topYear,
      confidence: Math.min(0.85, 0.6 + (topCount / totalSources) * 0.4),
      sources: yearData
        .filter(y => y.year === topYear)
        .map(y => ({ title: y.source, url: y.url, year: y.year })),
      status: 'CONFIRMED',
      notes: `Majority of sources indicate ${topYear}`,
    };
  }
}

async function analyzePriceData(
  priceData: { price: number; currency: string; source: string; url: string; isSold: boolean }[],
  conditionScore: number
): Promise<PriceResearch> {
  if (priceData.length === 0) {
    return {
      low: null,
      median: null,
      high: null,
      currency: 'INR',
      confidence: 0,
      salesCount: 0,
      sources: [],
      status: 'NO_DATA',
      notes: 'No price data found from internet research',
    };
  }

  // Convert all prices to INR
  const inrPrices: { price: number; source: string; url: string; isSold: boolean }[] = [];
  
  for (const p of priceData) {
    let inrPrice = p.price;
    if (p.currency === 'USD') {
      inrPrice = p.price * await getExchangeRate('USD', 'INR');
    } else if (p.currency === 'GBP') {
      inrPrice = p.price * await getExchangeRate('GBP', 'INR');
    } else if (p.currency === 'EUR') {
      inrPrice = p.price * await getExchangeRate('EUR', 'INR');
    }
    
    inrPrices.push({
      price: Math.round(inrPrice),
      source: p.source,
      url: p.url,
      isSold: p.isSold,
    });
  }

  // Prefer sold prices over active listings
  const soldPrices = inrPrices.filter(p => p.isSold);
  const pricesToUse = soldPrices.length >= 2 ? soldPrices : inrPrices;

  // Sort prices
  const sorted = pricesToUse.sort((a, b) => a.price - b.price);
  
  // Calculate statistics
  const low = sorted[0]?.price || null;
  const high = sorted[sorted.length - 1]?.price || null;
  const median = sorted[Math.floor(sorted.length / 2)]?.price || null;

  // Remove outliers (beyond 1.5x IQR)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]?.price || low;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]?.price || high;
  const iqr = (q3 || 0) - (q1 || 0);
  const filtered = sorted.filter(p => 
    p.price >= (q1 || 0) - iqr * 1.5 && 
    p.price <= (q3 || 0) + iqr * 1.5
  );

  const filteredMedian = filtered[Math.floor(filtered.length / 2)]?.price || median;

  // Confidence based on data quantity and quality
  let confidence = 0;
  if (soldPrices.length >= 3) confidence = 0.9;
  else if (soldPrices.length >= 2) confidence = 0.8;
  else if (soldPrices.length >= 1) confidence = 0.7;
  else if (pricesToUse.length >= 3) confidence = 0.6;
  else confidence = 0.4;

  const status = pricesToUse.length >= 2 ? 'VERIFIED' : 'INSUFFICIENT_DATA';

  return {
    low: filtered[0]?.price || low,
    median: filteredMedian,
    high: filtered[filtered.length - 1]?.price || high,
    currency: 'INR',
    confidence,
    salesCount: soldPrices.length,
    sources: pricesToUse.slice(0, 10).map(p => ({
      title: p.source,
      url: p.url,
      price: p.price,
      isSold: p.isSold,
    })),
    status,
    notes: soldPrices.length > 0
      ? `Based on ${soldPrices.length} sold/completed sales`
      : `Based on ${pricesToUse.length} active listings (sold data preferred)`,
  };
}

function calculateConditionAdjustedValue(
  priceResearch: PriceResearch,
  conditionScore: number
): { low: number | null; high: number | null; currency: string } {
  if (!priceResearch.median) {
    return { low: null, high: null, currency: 'INR' };
  }

  // Condition multiplier: 100 = 1.0x, 80 = 0.9x, 60 = 0.75x, 40 = 0.5x
  const conditionMultiplier = Math.max(0.3, conditionScore / 100);

  return {
    low: Math.round((priceResearch.low || priceResearch.median) * conditionMultiplier),
    high: Math.round((priceResearch.high || priceResearch.median) * conditionMultiplier),
    currency: 'INR',
  };
}

function buildResearchSources(
  yearData: { year: number; context: string; source: string; url: string }[],
  priceData: { price: number; currency: string; source: string; url: string; isSold: boolean }[]
): { title: string; url: string; type: 'year' | 'price' | 'both' }[] {
  const sourceMap = new Map<string, { title: string; url: string; type: 'year' | 'price' | 'both' }>();

  for (const y of yearData) {
    const key = y.url;
    const existing = sourceMap.get(key);
    if (existing) {
      existing.type = 'both';
    } else {
      sourceMap.set(key, { title: y.source, url: y.url, type: 'year' });
    }
  }

  for (const p of priceData) {
    const key = p.url;
    const existing = sourceMap.get(key);
    if (existing) {
      existing.type = 'both';
    } else {
      sourceMap.set(key, { title: p.source, url: p.url, type: 'price' });
    }
  }

  return Array.from(sourceMap.values()).slice(0, 15);
}

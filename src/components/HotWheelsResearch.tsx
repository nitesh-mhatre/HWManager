/**
 * HotWheelsResearch Component
 *
 * Uses the multi-source web scraper to find year + price data,
 * then sends enriched evidence to NVIDIA for final verification.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getSettings } from '../services/storage';
import { scrapeWebData, ScrapedResult } from '../services/web-scraper';

// ─── Types ────────────────────────────────────────────────────

type ResearchResult = {
  model: string | null;
  release_year: number | null;
  year_confidence: number;
  price_low: number | null;
  price_average: number | null;
  price_high: number | null;
  currency: string | null;
  price_confidence: number;
  explanation: string;
  sources: { title: string; url: string; snippet: string }[];
  localYearHits: number;
  localPriceHits: number;
};

type Props = {
  model: string;
  toyNumber?: string;
  series?: string;
  color?: string;
  year?: string;
};

// ─── Local Analysis ───────────────────────────────────────────

function analyzeYears(allHits: number[]): {
  year: number | null;
  confidence: number;
  count: number;
} {
  if (allHits.length === 0) return { year: null, confidence: 0, count: 0 };

  const counts: Record<number, number> = {};
  for (const y of allHits) {
    counts[y] = (counts[y] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .map(([y, c]) => ({ year: parseInt(y), count: c }))
    .sort((a, b) => b.count - a.count);

  const top = sorted[0];
  const total = allHits.length;
  const confidence = Math.min(0.95, 0.5 + (top.count / Math.max(total, 1)) * 0.5);

  return { year: top.year, confidence, count: top.count };
}

function analyzeAllPrices(
  allHits: { price: number; currency: string }[]
): {
  low: number | null;
  average: number | null;
  high: number | null;
  currency: string;
  confidence: number;
} {
  if (allHits.length === 0) {
    return { low: null, average: null, high: null, currency: 'USD', confidence: 0 };
  }

  // Group by currency
  const byCurrency: Record<string, number[]> = {};
  for (const p of allHits) {
    if (!byCurrency[p.currency]) byCurrency[p.currency] = [];
    byCurrency[p.currency].push(p.price);
  }

  // Pick the currency with most data points
  const mainCurrency = Object.entries(byCurrency).sort((a, b) => b[1].length - a[1].length)[0][0];
  const sorted = byCurrency[mainCurrency].sort((a, b) => a - b);

  // Remove outliers (3x IQR)
  const q1 = sorted[Math.floor(sorted.length * 0.25)] || sorted[0];
  const q3 = sorted[Math.floor(sorted.length * 0.75)] || sorted[sorted.length - 1];
  const iqr = q3 - q1;
  const clean = sorted.filter((p) => p >= q1 - iqr * 3 && p <= q3 + iqr * 3);

  const low = clean[0];
  const high = clean[clean.length - 1];
  const average = Math.round(clean.reduce((a, b) => a + b, 0) / clean.length * 100) / 100;
  const confidence = Math.min(0.9, 0.3 + clean.length * 0.08);

  return { low, average, high, currency: mainCurrency, confidence };
}

// ─── Component ────────────────────────────────────────────────

export default function HotWheelsResearch({
  model,
  toyNumber,
  series,
  color,
  year,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log('[Research]', msg);
    setDebugLog((prev) => [...prev, msg]);
  };

  async function performWebResearch() {
    setLoading(true);
    setError('');
    setResult(null);
    setDebugLog([]);

    try {
      const settings = await getSettings();
      if (!settings) {
        throw new Error('API not configured. Go to Settings → add your NVIDIA API key.');
      }

      // ── Step 1: Scrape the web ──
      log('Starting multi-source web scrape...');
      const scraped = await scrapeWebData(model, toyNumber || '', series || '', color || '');

      log(`Scraped ${scraped.length} pages total`);
      if (scraped.length === 0) {
        throw new Error('No data found from any source. Check your internet connection.');
      }

      // ── Step 2: Aggregate local year + price data ──
      const allYearHits: number[] = [];
      const allPriceHits: { price: number; currency: string }[] = [];
      const sourceList: { title: string; url: string; snippet: string }[] = [];

      for (const page of scraped) {
        allYearHits.push(...page.yearHits);
        allPriceHits.push(...page.priceHits);
        sourceList.push({ title: page.title, url: page.url, snippet: page.snippet });

        if (page.yearHits.length > 0) {
          log(`  ${page.title.substring(0, 40)} → years: [${page.yearHits.join(', ')}]`);
        }
        if (page.priceHits.length > 0) {
          const priceStr = page.priceHits.map((p) => `${p.currency} ${p.price}`).join(', ');
          log(`  ${page.title.substring(0, 40)} → prices: [${priceStr}]`);
        }
      }

      const yearAnalysis = analyzeYears(allYearHits);
      const priceAnalysis = analyzeAllPrices(allPriceHits);

      log(`Year: ${yearAnalysis.year} (confidence: ${(yearAnalysis.confidence * 100).toFixed(0)}%, hits: ${allYearHits.length})`);
      log(`Price: ${priceAnalysis.low}-${priceAnalysis.average}-${priceAnalysis.high} ${priceAnalysis.currency} (confidence: ${(priceAnalysis.confidence * 100).toFixed(0)}%, hits: ${allPriceHits.length})`);

      // ── Step 3: Send to NVIDIA for verification (optional but improves accuracy) ──
      let aiResult: any = null;

      try {
        log('Sending to NVIDIA for AI verification...');

        // Build a compact evidence summary
        const evidenceSummary = scraped
          .slice(0, 10)
          .map(
            (r, i) =>
              `[${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content.substring(0, 300)}`
          )
          .join('\n\n');

        const yearHint = yearAnalysis.year
          ? `\nLocal scan found year ${yearAnalysis.year} from ${yearAnalysis.count} sources.`
          : '';
        const priceHint = priceAnalysis.average
          ? `\nLocal scan found prices: ${priceAnalysis.currency} ${priceAnalysis.low}-${priceAnalysis.average}-${priceAnalysis.high}.`
          : '';

        const prompt = `You are verifying Hot Wheels collector data. Analyze the evidence below.

CAR: ${model} | Toy#: ${toyNumber || 'N/A'} | Series: ${series || 'N/A'} | Color: ${color || 'N/A'}
${yearHint}${priceHint}

RULES:
- Use ONLY the evidence below. Do not invent data.
- Copyright year ≠ release year. Find the actual release year.
- For price: prefer sold/completed listings over asking prices.
- If evidence is thin, return your best estimate with low confidence (0.3-0.5).
- Convert all prices to USD.

Return ONLY JSON:
{"model":"name","release_year":2024,"year_confidence":0.8,"price_low":1.5,"price_average":3.0,"price_high":8.0,"currency":"USD","price_confidence":0.7,"explanation":"brief reasoning"}

EVIDENCE:
${evidenceSummary}
`;

        const aiResponse = await callNvidia(settings.apiKey, settings.baseUrl, settings.model, prompt);
        aiResult = extractJson(aiResponse);
        log('NVIDIA verification complete');
      } catch (aiErr: any) {
        log(`NVIDIA call failed (using local data only): ${aiErr?.message || 'unknown error'}`);
      }

      // ── Step 4: Merge local + AI results ──
      const finalYear =
        aiResult?.release_year > 0 ? aiResult.release_year : yearAnalysis.year;
      const finalYearConf = Math.max(
        aiResult?.year_confidence || 0,
        yearAnalysis.confidence
      );
      const finalPriceLow =
        typeof aiResult?.price_low === 'number' ? aiResult.price_low : priceAnalysis.low;
      const finalPriceAvg =
        typeof aiResult?.price_average === 'number' ? aiResult.price_average : priceAnalysis.average;
      const finalPriceHigh =
        typeof aiResult?.price_high === 'number' ? aiResult.price_high : priceAnalysis.high;
      const finalPriceConf = Math.max(
        aiResult?.price_confidence || 0,
        priceAnalysis.confidence
      );
      const finalCurrency = aiResult?.currency || priceAnalysis.currency || 'USD';

      log('--- RESULT ---');
      log(`Year: ${finalYear ?? 'N/A'} (${(finalYearConf * 100).toFixed(0)}%)`);
      log(`Price: ${finalPriceLow ?? '-'} / ${finalPriceAvg ?? '-'} / ${finalPriceHigh ?? '-'} ${finalCurrency}`);

      setResult({
        model: aiResult?.model || model,
        release_year: finalYear,
        year_confidence: finalYearConf,
        price_low: finalPriceLow,
        price_average: finalPriceAvg,
        price_high: finalPriceHigh,
        currency: finalCurrency,
        price_confidence: finalPriceConf,
        explanation: aiResult?.explanation || 'Data extracted from web sources.',
        sources: sourceList,
        localYearHits: allYearHits.length,
        localPriceHits: allPriceHits.length,
      });
    } catch (e: any) {
      console.error('Research error:', e);
      setError(e?.message || 'Unable to research this Hot Wheels.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="web" size={28} color="#4da6ff" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Internet Research</Text>
            <Text style={styles.headerSub}>Multi-source web scraping + AI verification</Text>
          </View>
        </View>
      </View>

      {/* Car info */}
      <View style={styles.carBox}>
        <View style={styles.carBoxHeader}>
          <MaterialCommunityIcons name="car" size={16} color="#4da6ff" />
          <Text style={styles.carBoxLabel}>Detected Model</Text>
        </View>
        <Text style={styles.model}>{model}</Text>
        <View style={styles.metaRow}>
          {toyNumber ? (
            <View style={styles.metaTag}>
              <MaterialCommunityIcons name="barcode" size={12} color="#888" />
              <Text style={styles.metaText}>#{toyNumber}</Text>
            </View>
          ) : null}
          {series ? (
            <View style={styles.metaTag}>
              <MaterialIcons name="collections-bookmark" size={12} color="#888" />
              <Text style={styles.metaText}>{series}</Text>
            </View>
          ) : null}
          {color ? (
            <View style={styles.metaTag}>
              <MaterialIcons name="palette" size={12} color="#888" />
              <Text style={styles.metaText}>{color}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Button */}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={performWebResearch}
        disabled={loading}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}>Scraping the web...</Text>
          </View>
        ) : (
          <View style={styles.loadingRow}>
            <MaterialIcons name="public" size={20} color="#fff" />
            <Text style={styles.buttonText}>Research Internet</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Debug log */}
      {debugLog.length > 0 && (
        <View style={styles.debugBox}>
          <View style={styles.debugHeader}>
            <MaterialIcons name="bug-report" size={14} color="#888" />
            <Text style={styles.debugTitle}>Debug Log ({debugLog.length} entries)</Text>
          </View>
          <ScrollView style={styles.debugScroll}>
            {debugLog.map((msg, i) => (
              <Text key={i} style={styles.debugLine}>{msg}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={18} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Results */}
      {result ? (
        <View style={styles.resultBox}>
          {/* Identification */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="robot" size={16} color="#4da6ff" />
              <Text style={styles.sectionTitle}>Identification</Text>
            </View>
            <Text style={styles.resultModel}>{result.model || model}</Text>

            <View style={styles.resultRow}>
              <MaterialIcons name="calendar-today" size={14} color="#888" />
              <Text style={styles.resultLabel}>Release Year</Text>
              <Text style={styles.resultValue}>{result.release_year ?? 'N/A'}</Text>
            </View>
            <Text style={styles.confidence}>
              Confidence: {Math.round(result.year_confidence * 100)}%
              {result.localYearHits > 0 ? ` (${result.localYearHits} web hits)` : ''}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Price */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="show-chart" size={16} color="#4caf50" />
              <Text style={[styles.sectionTitle, { color: '#4caf50' }]}>Collectible Value</Text>
            </View>

            {result.price_average !== null ? (
              <>
                <Text style={styles.priceDisplay}>
                  {result.currency} {result.price_average}
                </Text>
                <View style={styles.priceRange}>
                  <View style={styles.priceBox}>
                    <Text style={styles.priceLabel}>Low</Text>
                    <Text style={styles.priceValue}>{result.price_low ?? '-'}</Text>
                  </View>
                  <View style={styles.priceBox}>
                    <Text style={styles.priceLabel}>Average</Text>
                    <Text style={[styles.priceValue, { color: '#4caf50' }]}>{result.price_average}</Text>
                  </View>
                  <View style={styles.priceBox}>
                    <Text style={styles.priceLabel}>High</Text>
                    <Text style={styles.priceValue}>{result.price_high ?? '-'}</Text>
                  </View>
                </View>
                <Text style={styles.confidence}>
                  Confidence: {Math.round(result.price_confidence * 100)}%
                  {result.localPriceHits > 0 ? ` (${result.localPriceHits} price hits)` : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.unavailable}>No reliable price data found.</Text>
            )}
          </View>

          {/* Explanation */}
          {result.explanation ? (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="info-outline" size={16} color="#FFD700" />
                  <Text style={[styles.sectionTitle, { color: '#FFD700' }]}>Research Notes</Text>
                </View>
                <Text style={styles.explanation}>{result.explanation}</Text>
              </View>
            </>
          ) : null}

          {/* Sources */}
          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="link" size={16} color="#4da6ff" />
              <Text style={styles.sectionTitle}>Sources ({result.sources.length})</Text>
            </View>
            {result.sources.map((source, index) => (
              <TouchableOpacity
                key={`${source.url}-${index}`}
                style={styles.source}
                onPress={() => Linking.openURL(source.url)}
              >
                <View style={styles.sourceLeft}>
                  <Text style={styles.sourceIndex}>{index + 1}</Text>
                  <View style={styles.sourceInfo}>
                    <Text style={styles.sourceTitle} numberOfLines={1}>{source.title}</Text>
                    <Text style={styles.sourceUrl} numberOfLines={1}>{source.url}</Text>
                  </View>
                </View>
                <MaterialIcons name="open-in-new" size={14} color="#4da6ff" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── NVIDIA API ───────────────────────────────────────────────

async function callNvidia(apiKey: string, baseUrl: string, model: string, prompt: string): Promise<string> {
  const base = baseUrl || 'https://integrate.api.nvidia.com/v1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NVIDIA ${res.status}: ${text.substring(0, 100)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): any | null {
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) { try { return JSON.parse(text.substring(start, end + 1)); } catch {} }
  return null;
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  carBox: { padding: 16, borderRadius: 14, backgroundColor: '#1a1a2e', marginBottom: 14, borderWidth: 1, borderColor: '#2a2a4a' },
  carBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  carBoxLabel: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase' },
  model: { fontSize: 20, fontWeight: '700', color: '#fff' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metaTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0f0f23', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaText: { fontSize: 12, color: '#aaa' },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e63946', marginBottom: 16 },
  buttonDisabled: { backgroundColor: '#333' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  debugBox: { backgroundColor: '#111', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#333', maxHeight: 250 },
  debugHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  debugTitle: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  debugScroll: { maxHeight: 200 },
  debugLine: { fontSize: 10, color: '#666', fontFamily: 'monospace', lineHeight: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255, 107, 107, 0.1)', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)' },
  errorText: { color: '#ff6b6b', flex: 1, fontSize: 13 },
  resultBox: { padding: 18, borderRadius: 14, backgroundColor: '#1a1a2e', marginBottom: 30, borderWidth: 1, borderColor: '#2a2a4a' },
  section: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase' },
  resultModel: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 14 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  resultLabel: { fontSize: 15, color: '#ccc', flex: 1 },
  resultValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
  confidence: { fontSize: 12, color: '#666', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#2a2a4a', marginVertical: 18 },
  priceDisplay: { fontSize: 30, fontWeight: '900', color: '#4caf50', marginBottom: 12 },
  priceRange: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  priceBox: { alignItems: 'center', flex: 1 },
  priceLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  priceValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 4 },
  unavailable: { fontSize: 15, color: '#666' },
  explanation: { fontSize: 14, color: '#ccc', lineHeight: 21 },
  source: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#2a2a4a' },
  sourceLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceIndex: { fontSize: 12, fontWeight: '700', color: '#4da6ff', width: 20, textAlign: 'center' },
  sourceInfo: { flex: 1 },
  sourceTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sourceUrl: { fontSize: 11, color: '#555', marginTop: 2 },
});

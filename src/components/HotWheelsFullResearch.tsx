/**
 * HotWheelsFullResearch — AI-First Research Pipeline
 *
 * FLOW:
 * 1. AI reads the IMAGE → extracts EVERY detail (name, toy#, series, color, wheels, tampos)
 * 2. Uses ALL those details → builds precise search queries
 * 3. Scrapes web with those queries (DuckDuckGo + Google + Bing + direct DBs)
 * 4. AI processes ALL scraped data → determines exact year + price
 *
 * This is a 2-AI-call approach:
 *   Call 1: Vision → extract details
 *   Call 2: Text → analyze scraped evidence for year/price
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
  Image,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getSettings } from '../services/storage';
import { scrapeWebData, ScrapedResult } from '../services/web-scraper';
import * as FileSystem from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────────

type CarDetails = {
  casting_name: string;
  real_vehicle: string;
  toy_number: string;
  series: string;
  body_color: string;
  wheel_type: string;
  tampos: string[];
  special_features: string[];
  year_on_card: string;
  image_quality: string;
};

type ResearchResult = {
  car_name: string;
  release_year: number | null;
  year_confidence: number;
  year_reasoning: string;
  price_low: number | null;
  price_average: number | null;
  price_high: number | null;
  currency: string;
  price_confidence: number;
  price_reasoning: string;
  sources: { title: string; url: string }[];
};

type Step = 'pick' | 'identifying' | 'searching' | 'analyzing' | 'result' | 'error';

// ─── AI Vision Prompt — Extract EVERY Detail ──────────────────

const EXTRACT_ALL_DETAILS_PROMPT = `You are an expert Hot Wheels card reader and collector database. Your job is to extract EVERY possible detail from this Hot Wheels car photo.

Look VERY carefully at:

1. CASTING NAME: The large bold text at the TOP of the card (e.g., "'67 Custom Camaro", "Nissan Skyline GT-R", "Toyota Supra")

2. REAL VEHICLE NAME: The actual car model this Hot Wheels is based on (e.g., "1967 Chevrolet Camaro", "Nissan Skyline GT-R (R34)")

3. TOY NUMBER: The fraction number near the barcode area (e.g., "123/250", "45/250"). This is CRITICAL for identification.

4. SERIES NAME: The collection/line name (e.g., "HW J-Import", "Fast & Furious", "HW Drag Race", "HW Rescue", "Zamac")

5. BODY COLOR: What color is the actual car body? (e.g., "Blue", "Red", "Black", "Silver", "Spectraflame Green")

6. WHEEL TYPE: The wheel design code if visible (e.g., "10SP", "MC5", "OH5", "PR5", "J5", "RR10SP")

7. TAMPOS/DECOS: Any logos, graphics, numbers, or text painted on the car body

8. SPECIAL FEATURES: Look for:
   - Treasure Hunt flame symbol (circle flame on card or car)
   - "TH" or "STH" text
   - Spectraflame paint (shiny metallic)
   - Metal/metal base
   - Rubber tires (Real Riders)
   - Any "Super Treasure Hunt" indicators

9. YEAR ON CARD: The copyright year near the barcode (e.g., "©2024 Mattel"). This is NOT the release year, but helps narrow it down.

10. ANY OTHER TEXT: Read every single word visible on the card front and back.

Return ONLY valid JSON:
{
  "casting_name": "the Hot Wheels casting name from top of card",
  "real_vehicle": "the real car model name",
  "toy_number": "123/250 or null if not visible",
  "series": "series name or null",
  "body_color": "car body color",
  "wheel_type": "wheel code or null",
  "tampos": ["list", "of", "visible", "decorations"],
  "special_features": ["treasure hunt", "super th", "real riders", etc],
  "year_on_card": "2024 or null",
  "card_text_all": "EVERY other text visible on the card",
  "image_quality": "clear or acceptable or poor",
  "confidence": 0.9
}`;

// ─── AI Analysis Prompt — Year + Price from Evidence ──────────

const ANALYZE_EVIDENCE_PROMPT = `You are an expert Hot Wheels collector and market analyst. You have scraped web data about a specific Hot Wheels car. Your job is to determine the EXACT release year and current market value.

IMPORTANT RULES:
1. The copyright year on the card (©2024) is NOT the release year. The release year is when this SPECIFIC casting/version was first made available.
2. A casting can be released in many different years with different colors/series.
3. The TOY NUMBER is the most reliable identifier — it pinpoints the exact release.
4. For prices: prefer SOLD/COMPLETED listings over asking prices. Active listings are asking prices, not market value.
5. If multiple years are mentioned, the year this specific version was RELEASED is what matters.
6. If you cannot determine something with confidence, say so — do NOT guess.

CAR DETAILS:
- Casting Name: {CASTING_NAME}
- Real Vehicle: {REAL_VEHICLE}
- Toy Number: {TOY_NUMBER}
- Series: {SERIES}
- Body Color: {BODY_COLOR}
- Year on Card (copyright): {YEAR_ON_CARD}

WEB EVIDENCE (scraped from collector databases, search results, and eBay):
{EVIDENCE}

Based on ALL the evidence above, determine:

1. RELEASE YEAR: When was this specific version (same toy number, same color, same series) first released?
2. MARKET VALUE: What is this car worth in today's collector market (USD)?

Return ONLY valid JSON:
{
  "release_year": 2024,
  "year_confidence": 0.85,
  "year_reasoning": "explain which sources confirmed this year and why",
  "price_low": 1.50,
  "price_average": 3.50,
  "price_high": 8.00,
  "currency": "USD",
  "price_confidence": 0.75,
  "price_reasoning": "explain price sources and market analysis"
}`;

// ─── Component ────────────────────────────────────────────────

export default function HotWheelsFullResearch() {
  const [step, setStep] = useState<Step>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [carDetails, setCarDetails] = useState<CarDetails | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log('[FullResearch]', msg);
    setDebugLog((prev) => [...prev, msg]);
  };

  // ── Pick Image ──
  const pickImage = async (useCamera: boolean) => {
    try {
      let pickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Camera permission required');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      }
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setImageUri(pickerResult.assets[0].uri);
        startFullResearch(pickerResult.assets[0].uri);
      }
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  // ── Full Pipeline ──
  const startFullResearch = async (uri: string) => {
    setDebugLog([]);
    try {
      const settings = await getSettings();
      if (!settings) {
        throw new Error('API not configured. Go to Settings → add your NVIDIA API key.');
      }

      // ════════════════════════════════════════════════════════════
      // STEP 1: AI reads the image → extracts ALL details
      // ════════════════════════════════════════════════════════════
      setStep('identifying');
      log('STEP 1: AI reading image for ALL details...');

      const base64 = await imageToBase64(uri);
      log(`Image converted to base64 (${(base64.length / 1024).toFixed(0)}KB)`);

      const detailsResponse = await callNvidiaVision(
        settings.apiKey,
        settings.baseUrl,
        settings.model,
        EXTRACT_ALL_DETAILS_PROMPT,
        base64
      );

      const detailsJson = extractJson(detailsResponse);
      if (!detailsJson) {
        throw new Error('AI could not read the image. Try a clearer photo.');
      }

      const details: CarDetails = {
        casting_name: detailsJson.casting_name || detailsJson.model_text || '',
        real_vehicle: detailsJson.real_vehicle || '',
        toy_number: detailsJson.toy_number || '',
        series: detailsJson.series || detailsJson.series_text || '',
        body_color: detailsJson.body_color || '',
        wheel_type: detailsJson.wheel_type || '',
        tampos: detailsJson.tampos || [],
        special_features: detailsJson.special_features || [],
        year_on_card: detailsJson.year_on_card || detailsJson.year_text_visible || '',
        image_quality: detailsJson.image_quality || 'unknown',
      };

      setCarDetails(details);

      log(`Car: ${details.casting_name}`);
      log(`Vehicle: ${details.real_vehicle}`);
      log(`Toy#: ${details.toy_number || 'N/A'}`);
      log(`Series: ${details.series || 'N/A'}`);
      log(`Color: ${details.body_color || 'N/A'}`);
      log(`Wheels: ${details.wheel_type || 'N/A'}`);
      log(`Tampos: ${details.tampos.join(', ') || 'N/A'}`);
      log(`Special: ${details.special_features.join(', ') || 'N/A'}`);
      log(`Card year: ${details.year_on_card || 'N/A'}`);

      // ════════════════════════════════════════════════════════════
      // STEP 2: Build precise search queries from ALL details
      // ════════════════════════════════════════════════════════════
      log('STEP 2: Building search queries from extracted details...');

      const queries = buildSmartQueries(details);
      log(`${queries.length} search queries generated`);

      // ════════════════════════════════════════════════════════════
      // STEP 3: Scrape the web
      // ════════════════════════════════════════════════════════════
      setStep('searching');
      log('STEP 3: Scraping web with precise queries...');

      const scraped = await scrapeWebData(
        details.casting_name,
        details.toy_number,
        details.series,
        details.body_color
      );

      log(`Scraped ${scraped.length} pages`);

      // ════════════════════════════════════════════════════════════
      // STEP 4: AI analyzes ALL scraped evidence → year + price
      // ════════════════════════════════════════════════════════════
      setStep('analyzing');
      log('STEP 4: AI analyzing scraped evidence for year + price...');

      // Build evidence text for AI
      const evidenceParts: string[] = [];
      for (let i = 0; i < Math.min(scraped.length, 12); i++) {
        const r = scraped[i];
        evidenceParts.push(
          `[SOURCE ${i + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nContent:\n${r.content.substring(0, 600)}`
        );
      }

      const evidence = evidenceParts.join('\n\n---\n\n');
      log(`Evidence built: ${evidence.length} chars from ${Math.min(scraped.length, 12)} sources`);

      // Fill in the prompt template
      const prompt = ANALYZE_EVIDENCE_PROMPT
        .replace('{CASTING_NAME}', details.casting_name)
        .replace('{REAL_VEHICLE}', details.real_vehicle)
        .replace('{TOY_NUMBER}', details.toy_number || 'unknown')
        .replace('{SERIES}', details.series || 'unknown')
        .replace('{BODY_COLOR}', details.body_color || 'unknown')
        .replace('{YEAR_ON_CARD}', details.year_on_card || 'unknown')
        .replace('{EVIDENCE}', evidence);

      const analysisResponse = await callNvidiaText(
        settings.apiKey,
        settings.baseUrl,
        settings.model,
        prompt
      );

      const analysisJson = extractJson(analysisResponse);
      if (!analysisJson) {
        throw new Error('AI could not analyze the evidence. Response was invalid JSON.');
      }

      log(`Year: ${analysisJson.release_year} (confidence: ${(analysisJson.year_confidence * 100).toFixed(0)}%)`);
      log(`Price: $${analysisJson.price_low}-$${analysisJson.price_average}-$${analysisJson.price_high}`);
      log(`Year reasoning: ${analysisJson.year_reasoning}`);
      log(`Price reasoning: ${analysisJson.price_reasoning}`);

      // ════════════════════════════════════════════════════════════
      // DONE — Show results
      // ════════════════════════════════════════════════════════════
      setResult({
        car_name: details.casting_name || details.real_vehicle || 'Unknown',
        release_year: analysisJson.release_year || null,
        year_confidence: analysisJson.year_confidence || 0,
        year_reasoning: analysisJson.year_reasoning || '',
        price_low: analysisJson.price_low || null,
        price_average: analysisJson.price_average || null,
        price_high: analysisJson.price_high || null,
        currency: analysisJson.currency || 'USD',
        price_confidence: analysisJson.price_confidence || 0,
        price_reasoning: analysisJson.price_reasoning || '',
        sources: scraped.slice(0, 10).map((r) => ({ title: r.title, url: r.url })),
      });

      setStep('result');
      log('DONE — Results displayed');
    } catch (e: any) {
      console.error('Full research error:', e);
      setError(e?.message || 'Research failed');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('pick');
    setImageUri(null);
    setCarDetails(null);
    setResult(null);
    setError('');
    setDebugLog([]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="magnify-scan" size={28} color="#4da6ff" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Full AI Research</Text>
            <Text style={styles.headerSub}>Image → AI details → Web scrape → AI analysis</Text>
          </View>
        </View>
      </View>

      {/* ── STEP INDICATOR ── */}
      <View style={styles.stepsBar}>
        {(['identifying', 'searching', 'analyzing', 'result'] as Step[]).map((s, i) => {
          const stepNames: Record<string, string> = {
            identifying: 'AI Read',
            searching: 'Scrape',
            analyzing: 'AI Analyze',
            result: 'Done',
          };
          const isCurrent = step === s;
          const isDone =
            (s === 'identifying' && ['searching', 'analyzing', 'result'].includes(step)) ||
            (s === 'searching' && ['analyzing', 'result'].includes(step)) ||
            (s === 'analyzing' && step === 'result');
          return (
            <View key={s} style={styles.stepContainer}>
              <View
                style={[
                  styles.stepDot,
                  isDone && styles.stepDotDone,
                  isCurrent && styles.stepDotActive,
                ]}
              >
                {isDone ? (
                  <MaterialIcons name="check" size={12} color="#fff" />
                ) : (
                  <Text style={styles.stepNum}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isDone && styles.stepLabelDone,
                  isCurrent && styles.stepLabelActive,
                ]}
              >
                {stepNames[s]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── IMAGE PICKER ── */}
      {step === 'pick' && (
        <View style={styles.pickSection}>
          <Text style={styles.pickTitle}>📸 Take or pick a photo of the Hot Wheels card</Text>
          <Text style={styles.pickSub}>
            AI will read every detail, search the web, and find the exact year + price
          </Text>
          <View style={styles.pickRow}>
            <TouchableOpacity style={styles.pickCard} onPress={() => pickImage(true)}>
              <View style={[styles.pickIcon, { backgroundColor: 'rgba(230,57,70,0.15)' }]}>
                <MaterialIcons name="camera-alt" size={28} color="#e63946" />
              </View>
              <Text style={styles.pickLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickCard} onPress={() => pickImage(false)}>
              <View style={[styles.pickIcon, { backgroundColor: 'rgba(77,166,255,0.15)' }]}>
                <MaterialIcons name="photo-library" size={28} color="#4da6ff" />
              </View>
              <Text style={styles.pickLabel}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── LOADING ── */}
      {(step === 'identifying' || step === 'searching' || step === 'analyzing') && (
        <View style={styles.loadingCard}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}
          <ActivityIndicator size="large" color="#4da6ff" style={{ marginTop: 16 }} />
          <Text style={styles.loadingTitle}>
            {step === 'identifying'
              ? '🤖 AI is reading the card...'
              : step === 'searching'
              ? '🌐 Scraping collector databases...'
              : '🧠 AI is analyzing year + price...'}
          </Text>
          <Text style={styles.loadingSub}>
            {step === 'identifying'
              ? 'Extracting casting name, toy number, series, color...'
              : step === 'searching'
              ? 'Searching Hot Wheels DB, Fandom Wiki, eBay...'
              : 'Cross-referencing all sources for exact data...'}
          </Text>
        </View>
      )}

      {/* ── ERROR ── */}
      {step === 'error' && (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={40} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reset}>
            <MaterialIcons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── DEBUG LOG ── */}
      {debugLog.length > 0 && (
        <View style={styles.debugBox}>
          <View style={styles.debugHeader}>
            <MaterialIcons name="bug-report" size={14} color="#888" />
            <Text style={styles.debugTitle}>Process Log ({debugLog.length})</Text>
          </View>
          <ScrollView style={styles.debugScroll} nestedScrollEnabled>
            {debugLog.map((msg, i) => (
              <Text key={i} style={styles.debugLine}>{msg}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ═══ RESULTS ═══ */}
      {step === 'result' && result && (
        <View style={styles.resultCard}>
          {/* Car Info from AI */}
          {carDetails && (
            <View style={styles.carInfoBox}>
              <View style={styles.carInfoHeader}>
                <MaterialCommunityIcons name="robot" size={16} color="#4da6ff" />
                <Text style={styles.carInfoTitle}>AI Identified Details</Text>
              </View>
              <Text style={styles.carName}>{result.car_name}</Text>
              <View style={styles.detailGrid}>
                {carDetails.real_vehicle ? <DetailRow label="Vehicle" value={carDetails.real_vehicle} /> : null}
                {carDetails.toy_number ? <DetailRow label="Toy#" value={carDetails.toy_number} /> : null}
                {carDetails.series ? <DetailRow label="Series" value={carDetails.series} /> : null}
                {carDetails.body_color ? <DetailRow label="Color" value={carDetails.body_color} /> : null}
                {carDetails.wheel_type ? <DetailRow label="Wheels" value={carDetails.wheel_type} /> : null}
                {carDetails.tampos.length > 0 ? (
                  <DetailRow label="Tampos" value={carDetails.tampos.join(', ')} />
                ) : null}
                {carDetails.special_features.length > 0 ? (
                  <DetailRow label="Special" value={carDetails.special_features.join(', ')} />
                ) : null}
                {carDetails.year_on_card ? <DetailRow label="Card ©" value={carDetails.year_on_card} /> : null}
              </View>
            </View>
          )}

          {/* Year Result */}
          <View style={styles.resultSection}>
            <View style={styles.resultSectionHeader}>
              <MaterialIcons name="calendar-today" size={16} color="#FFD700" />
              <Text style={styles.resultSectionTitle}>Release Year</Text>
            </View>
            <Text style={styles.yearDisplay}>{result.release_year ?? 'N/A'}</Text>
            <Text style={styles.confBadge}>
              Confidence: {Math.round(result.year_confidence * 100)}%
            </Text>
            {result.year_reasoning ? (
              <Text style={styles.reasoning}>{result.year_reasoning}</Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Price Result */}
          <View style={styles.resultSection}>
            <View style={styles.resultSectionHeader}>
              <MaterialIcons name="show-chart" size={16} color="#4caf50" />
              <Text style={[styles.resultSectionTitle, { color: '#4caf50' }]}>Market Value</Text>
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
                    <Text style={styles.priceLabel}>Avg</Text>
                    <Text style={[styles.priceValue, { color: '#4caf50' }]}>{result.price_average}</Text>
                  </View>
                  <View style={styles.priceBox}>
                    <Text style={styles.priceLabel}>High</Text>
                    <Text style={styles.priceValue}>{result.price_high ?? '-'}</Text>
                  </View>
                </View>
                <Text style={styles.confBadge}>
                  Confidence: {Math.round(result.price_confidence * 100)}%
                </Text>
                {result.price_reasoning ? (
                  <Text style={styles.reasoning}>{result.price_reasoning}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.unavailable}>No market data found</Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* Sources */}
          <View style={styles.resultSection}>
            <View style={styles.resultSectionHeader}>
              <MaterialIcons name="link" size={16} color="#4da6ff" />
              <Text style={styles.resultSectionTitle}>Sources ({result.sources.length})</Text>
            </View>
            {result.sources.map((s, i) => (
              <TouchableOpacity
                key={`${s.url}-${i}`}
                style={styles.sourceRow}
                onPress={() => Linking.openURL(s.url)}
              >
                <Text style={styles.sourceIdx}>{i + 1}</Text>
                <Text style={styles.sourceName} numberOfLines={1}>{s.title}</Text>
                <MaterialIcons name="open-in-new" size={12} color="#4da6ff" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Retry */}
          <TouchableOpacity style={styles.retryFullBtn} onPress={reset}>
            <MaterialIcons name="camera-alt" size={18} color="#fff" />
            <Text style={styles.retryFullBtnText}>Scan Another Car</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Smart Query Builder ──────────────────────────────────────

function buildSmartQueries(d: CarDetails): string[] {
  const q: string[] = [];
  const name = d.casting_name || d.real_vehicle;
  const toy = d.toy_number;

  // Most specific: toy number (guarantees exact match)
  if (toy) {
    q.push(`hot wheels ${toy} year price`);
    q.push(`hotwheels.fandom.com ${toy}`);
    q.push(`hotwheelsdb.com ${toy}`);
    q.push(`"${toy}" hot wheels value`);
  }

  // Casting name + year + price
  if (name) {
    q.push(`hot wheels ${name} release year`);
    q.push(`hot wheels ${name} price value collectible`);
    q.push(`hotwheels wiki ${name}`);
  }

  // Casting + series
  if (name && d.series) {
    q.push(`hot wheels ${name} ${d.series} year`);
  }

  // Casting + color
  if (name && d.body_color) {
    q.push(`hot wheels ${name} ${d.body_color} price`);
  }

  // eBay sold search
  if (name) {
    q.push(`ebay sold hot wheels ${name} ${toy || ''}`);
  }

  return q.slice(0, 10);
}

// ─── NVIDIA API Calls ─────────────────────────────────────────

async function callNvidiaVision(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
  base64Image: string
): Promise<string> {
  const base = baseUrl || 'https://integrate.api.nvidia.com/v1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
        temperature: 0.0,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`NVIDIA Vision ${res.status}: ${t.substring(0, 200)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

async function callNvidiaText(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string
): Promise<string> {
  const base = baseUrl || 'https://integrate.api.nvidia.com/v1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`NVIDIA ${res.status}: ${t.substring(0, 200)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ─── Helpers ──────────────────────────────────────────────────

async function imageToBase64(uri: string): Promise<string> {
  try {
    // Use expo-file-system to read as base64
    const encoding = 'base64' as any;
    return await (FileSystem as any).readAsStringAsync(uri, { encoding });
  } catch {
    // Fallback: fetch as blob
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve((reader.result as string).split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
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

// ─── Sub-components ───────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
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

  // Steps bar
  stepsBar: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, paddingHorizontal: 10 },
  stepContainer: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: '#4caf50' },
  stepDotActive: { backgroundColor: '#4da6ff' },
  stepNum: { fontSize: 12, color: '#888', fontWeight: '700' },
  stepLabel: { fontSize: 10, color: '#555', fontWeight: '600' },
  stepLabelDone: { color: '#4caf50' },
  stepLabelActive: { color: '#4da6ff' },

  // Pick
  pickSection: { alignItems: 'center', paddingVertical: 20 },
  pickTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  pickSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20 },
  pickRow: { flexDirection: 'row', gap: 16 },
  pickCard: { alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, width: 140, borderWidth: 1, borderColor: '#2a2a4a' },
  pickIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  pickLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Loading
  loadingCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a' },
  miniPreview: { width: '100%', height: 140, borderRadius: 12, backgroundColor: '#111' },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16 },
  loadingSub: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },

  // Error
  errorCard: { backgroundColor: '#2a1a1a', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#4a2222' },
  errorText: { fontSize: 14, color: '#ff6b6b', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e63946', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  retryBtnText: { color: '#fff', fontWeight: '700' },

  // Debug
  debugBox: { backgroundColor: '#111', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#333', maxHeight: 200 },
  debugHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  debugTitle: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  debugScroll: { maxHeight: 150 },
  debugLine: { fontSize: 10, color: '#666', fontFamily: 'monospace', lineHeight: 16 },

  // Result
  resultCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2a4a', marginBottom: 30 },
  carInfoBox: { backgroundColor: '#0f0f23', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#4da6ff' },
  carInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  carInfoTitle: { fontSize: 13, fontWeight: '700', color: '#4da6ff', textTransform: 'uppercase' },
  carName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 10 },
  detailGrid: {},
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  detailLabel: { fontSize: 12, color: '#888' },
  detailValue: { fontSize: 12, color: '#fff', fontWeight: '600', flex: 1, textAlign: 'right' },

  resultSection: { marginBottom: 4 },
  resultSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  resultSectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', textTransform: 'uppercase' },
  yearDisplay: { fontSize: 40, fontWeight: '900', color: '#FFD700' },
  confBadge: { fontSize: 12, color: '#666', marginTop: 4 },
  reasoning: { fontSize: 13, color: '#aaa', marginTop: 8, lineHeight: 20, fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: '#2a2a4a', marginVertical: 16 },

  priceDisplay: { fontSize: 34, fontWeight: '900', color: '#4caf50', marginBottom: 12 },
  priceRange: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  priceBox: { alignItems: 'center', flex: 1 },
  priceLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  priceValue: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 4 },
  unavailable: { fontSize: 15, color: '#666' },

  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  sourceIdx: { fontSize: 12, fontWeight: '700', color: '#4da6ff', width: 20, textAlign: 'center' },
  sourceName: { fontSize: 13, color: '#ccc', flex: 1 },

  retryFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#e63946', borderRadius: 12, padding: 16, marginTop: 16 },
  retryFullBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

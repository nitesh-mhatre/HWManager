/**
 * HotWheelsResearchManual — No-AI Research
 *
 * Flow:
 * 1. User picks/takes a photo
 * 2. User fills in what they know (name, toy#, series, color)
 * 3. Scrapes the web with those details
 * 4. Shows found year + price data
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { scrapeWebData, ScrapedResult } from '../services/web-scraper';

// ─── Types ────────────────────────────────────────────────────

type Step = 'pick' | 'details' | 'searching' | 'result' | 'error';

type FoundYear = {
  year: number;
  count: number;
  contexts: string[];
};

type FoundPrice = {
  price: number;
  currency: string;
  context: string;
};

type ResearchResult = {
  years: FoundYear[];
  prices: FoundPrice[];
  sources: { title: string; url: string; snippet: string }[];
  rawContent: string[];
};

type Props = {
  buyPrice?: string;
  expectedPrice?: string;
  year?: string;
  onSaved?: (data: { buyPrice: number; expectedPrice: number; year: string }) => void;
};

// ─── Component ────────────────────────────────────────────────

export default function HotWheelsResearchManual({ buyPrice: initBuyPrice, expectedPrice: initExpectedPrice, year: initYear, onSaved }: Props = {}) {
  const [step, setStep] = useState<Step>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);

  // User inputs
  const [carName, setCarName] = useState('');
  const [toyNumber, setToyNumber] = useState('');
  const [series, setSeries] = useState('');
  const [color, setColor] = useState('');
  const [yearHint, setYearHint] = useState(initYear || '');
  const [buyPrice, setBuyPrice] = useState(initBuyPrice || '');
  const [expectedSellPrice, setExpectedSellPrice] = useState(initExpectedPrice || '');

  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log('[Research]', msg);
    setLog((prev) => [...prev, msg]);
  };

  // ── Pick Image ──
  const pickImage = async (useCamera: boolean) => {
    try {
      let res;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      }
      if (!res.canceled && res.assets[0]) {
        setImageUri(res.assets[0].uri);
        setStep('details');
      }
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  // ── Search ──
  const startSearch = async () => {
    if (!carName.trim()) {
      setError('Please enter at least the car name');
      setStep('error');
      return;
    }

    setStep('searching');
    setLog([]);
    setResult(null);

    try {
      addLog(`Searching for: ${carName}${toyNumber ? ' #' + toyNumber : ''}${series ? ' [' + series + ']' : ''}${color ? ' ' + color : ''}`);
      if (yearHint) addLog(`User year: ${yearHint}`);
      if (buyPrice) addLog(`User buy price: ₹${buyPrice}`);
      if (expectedSellPrice) addLog(`User expected sell: ₹${expectedSellPrice}`);

      const scraped = await scrapeWebData(
        carName.trim(),
        toyNumber.trim(),
        series.trim(),
        color.trim()
      );

      addLog(`Scraped ${scraped.length} pages`);

      // Aggregate year + price data
      const yearMap: Record<number, { count: number; contexts: string[] }> = {};
      const allPrices: FoundPrice[] = [];
      const sources: { title: string; url: string; snippet: string }[] = [];
      const rawContent: string[] = [];

      for (const page of scraped) {
        sources.push({ title: page.title, url: page.url, snippet: page.snippet });
        rawContent.push(page.content);

        // Years
        for (const y of page.yearHits) {
          if (!yearMap[y]) yearMap[y] = { count: 0, contexts: [] };
          yearMap[y].count++;
          if (yearMap[y].contexts.length < 3) {
            yearMap[y].contexts.push(page.title.substring(0, 60));
          }
        }

        // Prices
        for (const p of page.priceHits) {
          allPrices.push({ ...p, context: page.title.substring(0, 60) });
        }

        if (page.yearHits.length > 0) {
          addLog(`  ${page.title.substring(0, 40)} → years: [${page.yearHits.join(', ')}]`);
        }
        if (page.priceHits.length > 0) {
          addLog(`  ${page.title.substring(0, 40)} → prices: [${page.priceHits.map((p) => p.currency + ' ' + p.price).join(', ')}]`);
        }
      }

      // Sort years by count
      const years = Object.entries(yearMap)
        .map(([y, data]) => ({ year: parseInt(y), ...data }))
        .sort((a, b) => b.count - a.count);

      // Group prices by currency
      const pricesByCurrency: Record<string, number[]> = {};
      for (const p of allPrices) {
        if (!pricesByCurrency[p.currency]) pricesByCurrency[p.currency] = [];
        pricesByCurrency[p.currency].push(p.price);
      }

      // Build price summary per currency
      const priceSummary: FoundPrice[] = [];
      for (const [currency, prices] of Object.entries(pricesByCurrency)) {
        const sorted = prices.sort((a, b) => a - b);
        const low = sorted[0];
        const high = sorted[sorted.length - 1];
        const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length * 100) / 100;
        priceSummary.push({ price: avg, currency, context: `Average of ${sorted.length} hits (${low}-${high})` });
      }

      addLog(`Found ${years.length} unique years, ${allPrices.length} price hits`);

      setResult({
        years,
        prices: priceSummary.sort((a, b) => b.price - a.price),
        sources,
        rawContent,
      });

      setStep('result');
    } catch (e: any) {
      setError(e.message || 'Search failed');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('pick');
    setImageUri(null);
    setCarName('');
    setToyNumber('');
    setSeries('');
    setColor('');
    setYearHint(initYear || '');
    setBuyPrice(initBuyPrice || '');
    setExpectedSellPrice(initExpectedPrice || '');
    setResult(null);
    setError('');
    setLog([]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="magnify-scan" size={28} color="#4da6ff" />
            <View>
              <Text style={styles.headerTitle}>Research Car</Text>
              <Text style={styles.headerSub}>Photo → Enter details → Find year + price</Text>
            </View>
          </View>
        </View>

        {/* ═══ STEP 1: PICK PHOTO ═══ */}
        {step === 'pick' && (
          <View style={styles.section}>
            <Text style={styles.sectionBigTitle}>📸 Step 1: Take or pick a photo</Text>
            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickCard} onPress={() => pickImage(true)}>
                <MaterialIcons name="camera-alt" size={32} color="#e63946" />
                <Text style={styles.pickLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickCard} onPress={() => pickImage(false)}>
                <MaterialIcons name="photo-library" size={32} color="#4da6ff" />
                <Text style={styles.pickLabel}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══ STEP 2: ENTER DETAILS ═══ */}
        {step === 'details' && (
          <View style={styles.section}>
            <Text style={styles.sectionBigTitle}>✏️ Step 2: Enter what you see on the card</Text>

            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            )}

            <Text style={styles.inputHint}>
              Fill in whatever you can read on the card. More details = better results.
            </Text>

            {/* Car Name — REQUIRED */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialIcons name="directions-car" size={14} color="#e63946" />
                <Text style={[styles.inputLabel, { color: '#e63946' }]}>Car Name * (required)</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputRequired]}
                placeholder='e.g. "Skyline GT-R" or "67 Camaro"'
                placeholderTextColor="#555"
                value={carName}
                onChangeText={setCarName}
              />
            </View>

            {/* Toy Number */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialCommunityIcons name="barcode" size={14} color="#888" />
                <Text style={styles.inputLabel}>Toy Number</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder='e.g. "45/250" (near barcode)'
                placeholderTextColor="#555"
                value={toyNumber}
                onChangeText={setToyNumber}
              />
            </View>

            {/* Series */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialIcons name="collections-bookmark" size={14} color="#888" />
                <Text style={styles.inputLabel}>Series / Line</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder='e.g. "HW J-Import", "Fast & Furious"'
                placeholderTextColor="#555"
                value={series}
                onChangeText={setSeries}
              />
            </View>

            {/* Color */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialIcons name="palette" size={14} color="#888" />
                <Text style={styles.inputLabel}>Body Color</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder='e.g. "Blue", "Red", "Black"'
                placeholderTextColor="#555"
                value={color}
                onChangeText={setColor}
              />
            </View>

            {/* Year hint */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialIcons name="calendar-today" size={14} color="#888" />
                <Text style={styles.inputLabel}>Year (if you know it)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder='e.g. "2024" (year on card)'
                placeholderTextColor="#555"
                value={yearHint}
                onChangeText={setYearHint}
                keyboardType="number-pad"
              />
            </View>

            {/* Buy Price */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialIcons name="attach-money" size={14} color="#888" />
                <Text style={styles.inputLabel}>Buy Price (₹)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder='e.g. "179" or "5.99" (what you paid)'
                placeholderTextColor="#555"
                value={buyPrice}
                onChangeText={setBuyPrice}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Expected Sell Price */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <MaterialIcons name="trending-up" size={14} color="#888" />
                <Text style={styles.inputLabel}>Expected Sell Price (₹)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder='e.g. "350" or "0" if unknown'
                placeholderTextColor="#555"
                value={expectedSellPrice}
                onChangeText={setExpectedSellPrice}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={reset}>
                <MaterialIcons name="arrow-back" size={18} color="#888" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.searchBtn, !carName.trim() && styles.searchBtnDisabled]}
                onPress={startSearch}
                disabled={!carName.trim()}
              >
                <MaterialIcons name="search" size={20} color="#fff" />
                <Text style={styles.searchBtnText}>Search Web</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══ STEP 3: SEARCHING ═══ */}
        {step === 'searching' && (
          <View style={styles.section}>
            <View style={styles.loadingCard}>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}
              <ActivityIndicator size="large" color="#4da6ff" style={{ marginTop: 16 }} />
              <Text style={styles.loadingTitle}>🌐 Searching collector databases...</Text>
              <Text style={styles.loadingSub}>DuckDuckGo → Google → Bing → Fandom Wiki → eBay</Text>
            </View>

            {log.length > 0 && (
              <View style={styles.debugBox}>
                <Text style={styles.debugTitle}>Progress</Text>
                {log.map((msg, i) => (
                  <Text key={i} style={styles.debugLine}>{msg}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ═══ STEP 4: RESULTS ═══ */}
        {step === 'result' && result && (
          <View style={styles.section}>
            <Text style={styles.sectionBigTitle}>✅ Results for "{carName}"</Text>

            {/* Image thumbnail */}
            {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}

            {/* Your Prices (user-entered) */}
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <MaterialIcons name="account-circle" size={16} color="#9C27B0" />
                <Text style={[styles.resultCardTitle, { color: '#9C27B0' }]}>Your Prices</Text>
              </View>
              {yearHint ? (
                <View style={styles.priceRow}>
                  <Text style={{ fontSize: 13, color: '#888', width: 80 }}>Year</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFD700', flex: 1 }}>{yearHint}</Text>
                </View>
              ) : null}
              {buyPrice ? (
                <View style={styles.priceRow}>
                  <Text style={{ fontSize: 13, color: '#888', width: 80 }}>Buy</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#4da6ff', flex: 1 }}>₹{parseFloat(buyPrice).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
              {expectedSellPrice ? (
                <View style={styles.priceRow}>
                  <Text style={{ fontSize: 13, color: '#888', width: 80 }}>Expected</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#4caf50', flex: 1 }}>₹{parseFloat(expectedSellPrice).toLocaleString('en-IN')}</Text>
                </View>
              ) : null}
              {buyPrice && expectedSellPrice && parseFloat(buyPrice) > 0 ? (
                <View style={styles.priceRow}>
                  <Text style={{ fontSize: 13, color: '#888', width: 80 }}>ROI</Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '800',
                      color: parseFloat(expectedSellPrice) >= parseFloat(buyPrice) ? '#4caf50' : '#e63946',
                      flex: 1,
                    }}
                  >
                    {(((parseFloat(expectedSellPrice) - parseFloat(buyPrice)) / parseFloat(buyPrice)) * 100).toFixed(1)}%
                  </Text>
                </View>
              ) : null}
              {!buyPrice && !expectedSellPrice && !yearHint ? (
                <Text style={styles.noData}>No prices entered by user</Text>
              ) : null}
            </View>

            {/* Year results */}
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <MaterialIcons name="calendar-today" size={16} color="#FFD700" />
                <Text style={styles.resultCardTitle}>Release Years Found</Text>
              </View>
              {result.years.length > 0 ? (
                result.years.slice(0, 8).map((y) => (
                  <View key={y.year} style={styles.yearRow}>
                    <Text style={styles.yearValue}>{y.year}</Text>
                    <View style={styles.yearBar}>
                      <View
                        style={[
                          styles.yearBarFill,
                          { width: `${Math.min(100, (y.count / Math.max(result.years[0].count, 1)) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.yearCount}>{y.count} hits</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noData}>No year data found in web sources</Text>
              )}
              {result.years.length > 0 && (
                <Text style={styles.bestGuess}>
                  🎯 Most likely year: <Text style={styles.bestGuessYear}>{result.years[0].year}</Text>
                  {' '}({result.years[0].count} sources agree)
                </Text>
              )}
            </View>

            {/* Price results */}
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <MaterialIcons name="show-chart" size={16} color="#4caf50" />
                <Text style={[styles.resultCardTitle, { color: '#4caf50' }]}>Market Prices Found</Text>
              </View>
              {result.prices.length > 0 ? (
                result.prices.map((p) => (
                  <View key={p.currency} style={styles.priceRow}>
                    <Text style={styles.priceCurrency}>{p.currency}</Text>
                    <Text style={styles.priceAvg}>{p.price}</Text>
                    <Text style={styles.priceContext}>{p.context}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noData}>No price data found in web sources</Text>
              )}
            </View>

            {/* Sources */}
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <MaterialIcons name="link" size={16} color="#4da6ff" />
                <Text style={styles.resultCardTitle}>Sources ({result.sources.length})</Text>
              </View>
              {result.sources.slice(0, 12).map((s, i) => (
                <TouchableOpacity
                  key={`${s.url}-${i}`}
                  style={styles.sourceRow}
                  onPress={() => Linking.openURL(s.url)}
                >
                  <Text style={styles.sourceIdx}>{i + 1}</Text>
                  <View style={styles.sourceInfo}>
                    <Text style={styles.sourceName} numberOfLines={1}>{s.title}</Text>
                    {s.snippet ? (
                      <Text style={styles.sourceSnippet} numberOfLines={2}>{s.snippet}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="open-in-new" size={12} color="#4da6ff" />
                </TouchableOpacity>
              ))}
            </View>

            {/* Debug log */}
            {log.length > 0 && (
              <View style={styles.debugBox}>
                <Text style={styles.debugTitle}>Search Log</Text>
                {log.map((msg, i) => (
                  <Text key={i} style={styles.debugLine}>{msg}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <MaterialIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.resetBtnText}>Search Another Car</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ ERROR ═══ */}
        {step === 'error' && (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={40} color="#ff6b6b" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={reset}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },

  section: { marginBottom: 16 },
  sectionBigTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 14 },

  // Pick
  pickRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  pickCard: {
    alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16,
    padding: 28, width: 140, borderWidth: 1, borderColor: '#2a2a4a', gap: 10,
  },
  pickLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Preview
  preview: {
    width: '100%', height: 220, borderRadius: 14,
    backgroundColor: '#1a1a2e', marginBottom: 16, borderWidth: 1, borderColor: '#2a2a4a',
  },
  miniPreview: {
    width: '100%', height: 140, borderRadius: 14,
    backgroundColor: '#1a1a2e', marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },

  // Inputs
  inputHint: { fontSize: 13, color: '#888', marginBottom: 14, lineHeight: 18 },
  inputGroup: { marginBottom: 12 },
  inputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase' },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 10, borderWidth: 1, borderColor: '#333',
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15,
  },
  inputRequired: { borderColor: '#e63946' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#222',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
  searchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e63946', borderRadius: 12, paddingVertical: 14,
  },
  searchBtnDisabled: { backgroundColor: '#333' },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Loading
  loadingCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16 },
  loadingSub: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },

  // Results
  resultCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  resultCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  resultCardTitle: { fontSize: 15, fontWeight: '700', color: '#FFD700', textTransform: 'uppercase' },

  // Year
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  yearValue: { fontSize: 16, fontWeight: '800', color: '#fff', width: 50 },
  yearBar: { flex: 1, height: 8, backgroundColor: '#222', borderRadius: 4, overflow: 'hidden' },
  yearBarFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 4 },
  yearCount: { fontSize: 11, color: '#888', width: 50, textAlign: 'right' },
  bestGuess: { fontSize: 14, color: '#aaa', marginTop: 10 },
  bestGuessYear: { fontSize: 20, fontWeight: '900', color: '#FFD700' },

  // Price
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#222',
  },
  priceCurrency: { fontSize: 13, fontWeight: '700', color: '#4da6ff', width: 40 },
  priceAvg: { fontSize: 18, fontWeight: '800', color: '#4caf50', flex: 1 },
  priceContext: { fontSize: 11, color: '#666', flex: 1, textAlign: 'right' },

  noData: { fontSize: 14, color: '#666', fontStyle: 'italic' },

  // Sources
  sourceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#222',
  },
  sourceIdx: { fontSize: 12, fontWeight: '700', color: '#4da6ff', width: 20, textAlign: 'center' },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  sourceSnippet: { fontSize: 11, color: '#666', marginTop: 2 },

  // Debug
  debugBox: {
    backgroundColor: '#111', borderRadius: 10, padding: 10,
    marginTop: 8, borderWidth: 1, borderColor: '#333',
  },
  debugTitle: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  debugLine: { fontSize: 10, color: '#666', fontFamily: 'monospace', lineHeight: 16 },

  // Error
  errorCard: {
    backgroundColor: '#2a1a1a', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#4a2222',
  },
  errorText: { fontSize: 14, color: '#ff6b6b', marginTop: 8, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#e63946', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16,
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e63946', borderRadius: 12, padding: 16, marginTop: 8,
  },
  resetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

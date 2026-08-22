/**
 * Hot Wheels Research Service
 * 
 * Coordinates the complete research pipeline:
 * 1. Extract visual evidence (NVIDIA)
 * 2. Search internet for release year
 * 3. Search internet for pricing
 * 4. Cross-validate across sources
 * 5. Calculate condition-adjusted value
 * 
 * Includes caching to avoid redundant searches.
 */

import { NvidiaSettings, ScanResult } from '../types';
import { extractEvidence, analyzeCondition } from './identification';
import {
  researchHotWheel,
  ResearchResult,
  YearResearch,
  PriceResearch,
} from './web-search';

// ─── Cache ────────────────────────────────────────────────────

interface CacheEntry {
  result: ScanResult;
  research: ResearchResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for release info
const PRICE_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours for prices

function getCacheKey(model: string, toyNumber: string, color: string): string {
  return `hotwheels:${model.toLowerCase().replace(/\s+/g, '-')}:${toyNumber}:${color.toLowerCase()}`;
}

function getCachedResult(key: string): { result: ScanResult; research: ResearchResult } | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  
  // Check if price data needs refresh (shorter cache)
  const priceAge = age;
  const needsPriceRefresh = priceAge > PRICE_CACHE_DURATION;
  
  // Check if release data needs refresh (longer cache)
  const releaseAge = age;
  const needsReleaseRefresh = releaseAge > CACHE_DURATION;

  if (needsReleaseRefresh) {
    // Full refresh needed
    return null;
  }

  // Return cached data, noting if prices may be stale
  return {
    result: entry.result,
    research: {
      ...entry.research,
      status: needsPriceRefresh ? 'PRICES_STALE' : entry.research.status,
    },
  };
}

function setCachedResult(key: string, result: ScanResult, research: ResearchResult): void {
  cache.set(key, {
    result,
    research,
    timestamp: Date.now(),
  });
}

// ─── Main Research Function ───────────────────────────────────

export async function researchHotWheelComplete(
  settings: NvidiaSettings,
  imageUri: string,
  forceRefresh: boolean = false
): Promise<{ result: ScanResult; research: ResearchResult }> {
  // Step 1: Extract evidence from image
  const evidence = await extractEvidence(settings, imageUri);

  // Step 2: Check cache (unless force refresh)
  const cacheKey = getCacheKey(
    evidence.model_text || evidence.casting_name_visible || '',
    evidence.toy_number || '',
    evidence.body_color || ''
  );

  if (!forceRefresh) {
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Step 3: Analyze condition
  const condition = await analyzeCondition(settings, imageUri);

  // Step 4: Internet research
  const research = await researchHotWheel(
    {
      model: evidence.model_text || evidence.casting_name_visible || 'Unknown',
      series: evidence.series_text || '',
      toyNumber: evidence.toy_number || '',
      color: evidence.body_color || '',
      year: evidence.year_text_visible || '',
    },
    condition.condition_score,
    condition.condition_notes
  );

  // Step 5: Build final ScanResult
  const result = buildScanResult(evidence, condition, research);

  // Step 6: Cache the result
  setCachedResult(cacheKey, result, research);

  return { result, research };
}

// ─── Build ScanResult from Research ───────────────────────────

function buildScanResult(
  evidence: any,
  condition: any,
  research: ResearchResult
): ScanResult {
  // Determine year - prefer researched year over visible year
  let year = 'Unknown';
  if (research.release.year) {
    year = String(research.release.year);
  } else if (evidence.year_text_visible) {
    year = evidence.year_text_visible;
  }

  // Determine price - prefer researched price
  let priceRange = { min: 0, avg: 0, max: 0 };
  if (research.estimatedValue.low && research.estimatedValue.high) {
    priceRange = {
      min: research.estimatedValue.low,
      avg: research.market.median || Math.round((research.estimatedValue.low + research.estimatedValue.high) / 2),
      max: research.estimatedValue.high,
    };
  } else if (research.market.low && research.market.high) {
    priceRange = {
      min: research.market.low,
      avg: research.market.median || Math.round((research.market.low + research.market.high) / 2),
      max: research.market.high,
    };
  }

  // Build price sources from research
  const priceSources = research.market.sources.map(s => ({
    source: s.title,
    price: s.price,
    reference: s.isSold ? 'Sold/Completed' : 'Active listing',
    url: s.url,
  }));

  // Determine confidence
  let confidence = 'low';
  if (research.release.confidence >= 0.8 && research.market.confidence >= 0.7) {
    confidence = 'high';
  } else if (research.release.confidence >= 0.5 || research.market.confidence >= 0.5) {
    confidence = 'medium';
  }

  // Build status message
  let statusMessage = '';
  switch (research.status) {
    case 'IDENTIFIED':
      statusMessage = `Verified from ${research.researchSources.length} sources`;
      break;
    case 'AMBIGUOUS_YEAR':
      statusMessage = research.release.notes;
      break;
    case 'NO_RESEARCH_DATA':
      statusMessage = 'Internet research could not identify this release. Showing limited data.';
      break;
    case 'PRICES_STALE':
      statusMessage = 'Release verified. Price data may need refresh.';
      break;
    default:
      statusMessage = research.status;
  }

  return {
    name: `${evidence.model_text || evidence.casting_name_visible || 'Unknown Car'}${year !== 'Unknown' ? ` (${year})` : ''}`,
    year,
    series: research.identification.series || evidence.series_text || '',
    color: evidence.body_color || '',
    model: evidence.model_text || evidence.casting_name_visible || '',
    scale: '1:64',
    rarity: 'Mainline',
    condition: condition.overall_condition || condition.card_condition || 'Unknown',
    conditionNotes: condition.condition_notes?.join('. ') || '',
    barcode: evidence.toy_number || '',
    manufacturer: 'Mattel',
    tampos: evidence.tampos?.join(', ') || '',
    wheelType: evidence.wheel_type || '',
    baseColor: '',
    variant: evidence.body_color || '',
    expectedPrice: priceRange.avg,
    priceINR: priceRange.avg,
    priceRange,
    priceSources,
    confidence,
    status: research.status,
    matchScore: Math.round(research.release.confidence * 100),
    history: research.identification.model
      ? `${research.identification.model} - ${research.identification.series || 'Mainline'} release`
      : '',
    searchResults: statusMessage,
  };
}

// ─── Refresh Market Data ──────────────────────────────────────

export async function refreshMarketData(
  settings: NvidiaSettings,
  model: string,
  toyNumber: string,
  color: string,
  year: string
): Promise<PriceResearch> {
  const research = await researchHotWheel(
    {
      model,
      series: '',
      toyNumber,
      color,
      year,
    },
    80, // Assume good condition for refresh
    []
  );

  return research.market;
}

// ─── Get Research Sources ─────────────────────────────────────

export function getResearchSources(research: ResearchResult): {
  yearSources: { title: string; url: string; year: number }[];
  priceSources: { title: string; url: string; price: number; isSold: boolean }[];
} {
  return {
    yearSources: research.release.sources,
    priceSources: research.market.sources,
  };
}

// ─── Clear Cache ──────────────────────────────────────────────

export function clearCache(): void {
  cache.clear();
}

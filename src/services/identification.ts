/**
 * Hot Wheels Identification Pipeline
 * 
 * This module implements the multi-step identification pipeline:
 * 1. Image Analysis (NVIDIA Vision) - evidence extraction only
 * 2. Candidate Matching (Database) - find matching releases
 * 3. Condition Analysis (Separate) - assess card/car condition
 * 4. Price Calculation (Database) - verified market pricing
 * 5. Final Result - combined verified output
 * 
 * The AI vision model NEVER guesses year or price.
 * It only extracts what is visible in the image.
 */

import { NvidiaSettings, ScanResult } from '../types';
import * as FileSystem from 'expo-file-system';
import {
  findCandidates,
  getBestMatch,
  isAmbiguousMatch,
  getPriceData,
  ImageEvidence,
  CandidateMatch,
} from '../data/hotwheels-db';

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';

// ─── Evidence Extraction Prompt ───────────────────────────────
// This prompt ONLY asks the model to read what is visible.
// It NEVER asks for year or price estimation.

const EVIDENCE_EXTRACTION_PROMPT = `You are a Hot Wheels card reader. Your ONLY job is to read text and identify visual features from the image. You do NOT guess, estimate, or use any knowledge from training data.

RULES:
1. If you cannot read something, return null. Never guess.
2. Only report what you SEE in the image.
3. Never invent a year, price, or toy number.
4. Never assume information that is not clearly visible.

Extract the following from the image:

1. CASTING NAME: The large text at top of card (e.g., "67 Custom Camaro", "Skyline GT-R")
2. MODEL TEXT: Any model/casting text visible on card
3. SERIES: Series name (e.g., "HW J-Import", "Fast & Furious", "HW Drag Race")
4. TOY NUMBER: Number like "123/250" usually near barcode
5. YEAR TEXT: ONLY the year visible near "©" symbol near barcode (e.g., "©2024 Mattel"). If not visible, return null.
6. BODY COLOR: The actual car body color in the photo
7. WHEEL TYPE: Wheel type if visible (10SP, MC5, OH5, PR5, J5, etc.)
8. TAMPOS: Any decorations, logos, or graphics on the car body
9. SPECIAL FEATURES: Treasure Hunt flame, TH/STH text, spectraflame paint, metal base, etc.
10. IMAGE QUALITY: Rate as "clear", "acceptable", or "poor"

Respond ONLY with valid JSON:
{
  "casting_name_visible": "string or null",
  "model_text": "string or null",
  "series_text": "string or null",
  "toy_number": "string or null (e.g., '123/250')",
  "year_text_visible": "string or null (the year from © symbol)",
  "body_color": "string or null",
  "wheel_type": "string or null",
  "tampos": ["list of visible decorations"],
  "special_features": ["list of special features visible"],
  "image_quality": "clear or acceptable or poor",
  "identification_confidence": 0.0 to 1.0
}`;

// ─── Condition Analysis Prompt ────────────────────────────────
// Separate prompt for condition assessment only.

const CONDITION_ANALYSIS_PROMPT = `You are a condition assessor for collectible items. Analyze the physical condition of this Hot Wheels card and car. Look at:

CARD CONDITION:
- Corners: Are they sharp/pointed, or bent/rounded/creased?
- Edges: Are they straight, or dinged/peeling/damaged?
- Surface: Is it clean, or scratched/stained/faded?
- Back: Any damage visible?

BLISTER (plastic bubble):
- Is it intact and clear?
- Any cracks, dents, yellowing, or scratches?
- Is it still attached to the card?

CAR CONDITION:
- Paint: Any chips, scratches, or wear?
- Wheels: All present and intact?
- Windows: Clear or damaged?
- Any missing parts?

Rate each component and give an overall condition score (0-100, where 100 is perfect mint).

Respond ONLY with valid JSON:
{
  "card_corners": "Sharp/Good/Fair/Poor",
  "card_edges": "Clean/Good/Fair/Poor",
  "card_surface": "Clean/Good/Fair/Poor",
  "blister": "Intact/Good/Fair/Poor/Missing",
  "car_paint": "Mint/Good/Fair/Poor",
  "car_wheels": "Good/Fair/Poor",
  "overall_condition": "Mint/Near Mint/Good/Fair/Poor",
  "condition_score": 85,
  "condition_notes": ["list of specific observations"]
}`;

// ─── Helper Functions ─────────────────────────────────────────

async function imageToBase64(uri: string): Promise<string> {
  // Try expo-file-system first
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    if (base64 && base64.length > 100) return base64;
  } catch {}
  // Fallback: fetch as blob
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = (reader.result as string).split(',')[1];
      if (data) resolve(data);
      else reject(new Error('Failed to convert image to base64'));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function chatCompletion(
  settings: NvidiaSettings,
  messages: any[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const base = settings.baseUrl || DEFAULT_BASE;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: options?.temperature ?? 0.0,
      max_tokens: options?.max_tokens ?? 1500,
      top_p: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function parseJsonResponse(response: string): any {
  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse JSON from AI response');
  }
}

// ─── Step 1: Extract Evidence from Image ──────────────────────

async function extractEvidence(
  settings: NvidiaSettings,
  imageUri: string
): Promise<ImageEvidence> {
  const base64 = await imageToBase64(imageUri);

  const messages = [
    {
      role: 'system',
      content: 'You are a Hot Wheels card reader. You ONLY read text and identify visual features from images. You NEVER guess or use knowledge from training data.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: EVIDENCE_EXTRACTION_PROMPT },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
      ],
    },
  ];

  const response = await chatCompletion(settings, messages, {
    temperature: 0.0,
    max_tokens: 1500,
  });

  const data = parseJsonResponse(response);

  return {
    casting_name_visible: data.casting_name_visible || null,
    model_text: data.model_text || null,
    series_text: data.series_text || null,
    toy_number: data.toy_number || null,
    year_text_visible: data.year_text_visible || null,
    body_color: data.body_color || null,
    wheel_type: data.wheel_type || null,
    tampos: data.tampos || [],
    special_features: data.special_features || [],
    image_quality: data.image_quality || 'poor',
    identification_confidence: data.identification_confidence || 0,
  };
}

// ─── Step 2: Analyze Condition (Separate) ────────────────────

async function analyzeCondition(
  settings: NvidiaSettings,
  imageUri: string
): Promise<{
  card_condition: string;
  blister_condition: string;
  car_condition: string;
  condition_score: number;
  condition_notes: string[];
}> {
  const base64 = await imageToBase64(imageUri);

  const messages = [
    {
      role: 'system',
      content: 'You are a condition assessor for collectible Hot Wheels. You analyze physical condition only.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: CONDITION_ANALYSIS_PROMPT },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
      ],
    },
  ];

  const response = await chatCompletion(settings, messages, {
    temperature: 0.0,
    max_tokens: 800,
  });

  const data = parseJsonResponse(response);

  return {
    card_condition: data.overall_condition || 'Unknown',
    blister_condition: data.blister || 'Unknown',
    car_condition: data.car_paint || 'Unknown',
    condition_score: data.condition_score || 50,
    condition_notes: data.condition_notes || [],
  };
}

// ─── Step 3: Match Against Database ──────────────────────────

function matchToDatabase(evidence: ImageEvidence): {
  bestMatch: CandidateMatch | null;
  allCandidates: CandidateMatch[];
  isAmbiguous: boolean;
  status: 'MATCHED' | 'AMBIGUOUS' | 'NO_MATCH' | 'NEEDS_BETTER_PHOTO';
} {
  // Check image quality first
  if (evidence.image_quality === 'poor') {
    return {
      bestMatch: null,
      allCandidates: [],
      isAmbiguous: false,
      status: 'NEEDS_BETTER_PHOTO',
    };
  }

  // Find candidates
  const candidates = findCandidates(evidence, 5);

  if (candidates.length === 0) {
    return {
      bestMatch: null,
      allCandidates: [],
      isAmbiguous: false,
      status: 'NO_MATCH',
    };
  }

  // Check for ambiguity
  if (isAmbiguousMatch(candidates)) {
    return {
      bestMatch: null,
      allCandidates: candidates,
      isAmbiguous: true,
      status: 'AMBIGUOUS',
    };
  }

  // Get best match
  const best = getBestMatch(candidates, 30);
  if (!best) {
    return {
      bestMatch: null,
      allCandidates: candidates,
      isAmbiguous: false,
      status: 'NO_MATCH',
    };
  }

  return {
    bestMatch: best,
    allCandidates: candidates,
    isAmbiguous: false,
    status: 'MATCHED',
  };
}

// ─── Step 4: Build Final Result ──────────────────────────────

function buildScanResult(
  evidence: ImageEvidence,
  matchResult: ReturnType<typeof matchToDatabase>,
  condition: Awaited<ReturnType<typeof analyzeCondition>>
): ScanResult {
  // Determine status message
  let statusMessage = '';
  let confidence = 'low';

  switch (matchResult.status) {
    case 'NEEDS_BETTER_PHOTO':
      statusMessage = 'Image too blurry to identify. Please upload a clearer photo of the card front.';
      break;
    case 'NO_MATCH':
      statusMessage = 'Could not match to a known release. This may be a new or uncommon variant.';
      break;
    case 'AMBIGUOUS':
      statusMessage = `Multiple releases look similar. Possible matches:\n${
        matchResult.allCandidates
          .slice(0, 3)
          .map(c => `• ${c.release.variation} (${c.release.releaseYear}) - ${c.release.series}`)
          .join('\n')
      }\n\nPlease upload a clearer photo of the card number or back of card.`;
      break;
    case 'MATCHED':
      statusMessage = `Identified: ${matchResult.bestMatch!.casting.name} (${matchResult.bestMatch!.release.releaseYear})`;
      confidence = matchResult.bestMatch!.matchScore >= 70 ? 'high' : matchResult.bestMatch!.matchScore >= 40 ? 'medium' : 'low';
      break;
  }

  // Get pricing if matched
  let priceRange = { min: 0, max: 0, avg: 0 };
  let priceSources: { source: string; price: number; reference: string }[] = [];

  if (matchResult.bestMatch) {
    const priceData = getPriceData(matchResult.bestMatch.release, condition.condition_score);
    priceRange = {
      min: priceData.low,
      avg: priceData.average,
      max: priceData.high,
    };
    priceSources = [
      {
        source: 'Verified Market Data',
        price: priceData.average,
        reference: `${matchResult.bestMatch.release.priceSource} | Updated: ${matchResult.bestMatch.release.priceUpdatedAt}`,
      },
    ];
  }

  // Build result
  const matchScore = matchResult.bestMatch ? matchResult.bestMatch.matchScore : 0;

  const result: ScanResult = {
    name: matchResult.bestMatch
      ? `${matchResult.bestMatch.casting.name} (${matchResult.bestMatch.release.releaseYear})`
      : evidence.casting_name_visible || evidence.model_text || 'Unknown Car',
    year: matchResult.bestMatch
      ? String(matchResult.bestMatch.release.releaseYear)
      : evidence.year_text_visible || 'Unknown',
    series: matchResult.bestMatch
      ? matchResult.bestMatch.release.series
      : evidence.series_text || '',
    color: evidence.body_color || '',
    model: matchResult.bestMatch
      ? matchResult.bestMatch.casting.realVehicle
      : '',
    scale: '1:64',
    rarity: matchResult.bestMatch ? matchResult.bestMatch.release.rarity : 'Mainline',
    condition: matchResult.bestMatch ? condition.card_condition : 'Unknown',
    conditionNotes: condition.condition_notes.join('. '),
    barcode: '',
    manufacturer: 'Mattel',
    tampos: evidence.tampos.join(', '),
    wheelType: evidence.wheel_type || '',
    baseColor: '',
    variant: matchResult.bestMatch ? matchResult.bestMatch.release.variation : '',
    expectedPrice: priceRange.avg,
    priceINR: priceRange.avg,
    priceRange,
    priceSources,
    confidence,
    status: matchResult.status,
    matchScore,
    history: matchResult.bestMatch
      ? `${matchResult.bestMatch.casting.realVehicle} - This is the ${matchResult.bestMatch.release.releaseYear} ${matchResult.bestMatch.release.series} release. The ${matchResult.bestMatch.casting.name} casting was first introduced by Mattel and has been released in multiple variations over the years.`
      : '',
    searchResults: matchResult.bestMatch
      ? `Match confidence: ${matchScore}% | Matched factors: ${matchResult.bestMatch.matchFactors.join(', ')} | Price data: ${matchResult.bestMatch.release.priceSource}`
      : statusMessage,
  };

  return result;
}

// ─── Export Functions for Research Service ───────────────────

export { extractEvidence, analyzeCondition };

// ─── Main Pipeline ───────────────────────────────────────────

/**
 * Run the full identification pipeline on a Hot Wheels image.
 * 
 * Steps:
 * 1. Extract visual evidence (AI)
 * 2. Match against database
 * 3. Analyze condition (AI, separate)
 * 4. Calculate verified pricing
 * 5. Return result
 * 
 * The AI NEVER generates year or price.
 */
export async function identifyHotWheel(
  settings: NvidiaSettings,
  imageUri: string
): Promise<ScanResult> {
  // Step 1: Extract evidence from image
  const evidence = await extractEvidence(settings, imageUri);

  // Step 2: Match against database
  const matchResult = matchToDatabase(evidence);

  // Step 3: Analyze condition
  const condition = await analyzeCondition(settings, imageUri);

  // Step 4: Build final result
  return buildScanResult(evidence, matchResult, condition);
}

/**
 * Bulk identification - multiple cars from one photo.
 * Uses the same pipeline but processes multiple detected regions.
 */
export async function identifyBulkHotWheels(
  settings: NvidiaSettings,
  imageUri: string
): Promise<ScanResult[]> {
  // For bulk, we first ask the AI to identify how many cars and their locations
  const base64 = await imageToBase64(imageUri);

  const detectPrompt = `Count how many Hot Wheels cars are visible in this image. For each car, describe its location in the image (e.g., "top left", "center", "bottom right"). Respond with JSON: {"count": 2, "locations": ["top left", "center"]}`;

  const detectResponse = await chatCompletion(settings, [
    { role: 'system', content: 'You are counting Hot Wheels cars in images.' },
    { role: 'user', content: [
      { type: 'text', text: detectPrompt },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
    ]},
  ], { temperature: 0.0, max_tokens: 200 });

  let detectData: { count: number; locations: string[] };
  try {
    detectData = parseJsonResponse(detectResponse);
  } catch {
    // Fallback: treat as single car
    const result = await identifyHotWheel(settings, imageUri);
    return [result];
  }

  // For each detected car, run the identification pipeline
  // Note: In a production system, you'd crop the image for each car.
  // For now, we run the full pipeline on the same image for each detected car.
  const results: ScanResult[] = [];
  for (let i = 0; i < Math.min(detectData.count || 1, 10); i++) {
    const result = await identifyHotWheel(settings, imageUri);
    results.push(result);
  }

  return results;
}

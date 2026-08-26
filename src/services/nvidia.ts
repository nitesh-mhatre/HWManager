import { NvidiaSettings, ScanResult, PriceRange, ApiProvider } from '../types';
import * as FileSystem from 'expo-file-system';

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';
const OPENAI_BASE = 'https://api.openai.com/v1';

// ─── Provider defaults ─────────────────────────────────────
export const PROVIDER_DEFAULTS: Record<ApiProvider, { baseUrl: string; models: string[] }> = {
  nvidia: {
    baseUrl: DEFAULT_BASE,
    models: [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.2-11b-vision-instruct',
      'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      'nvidia/llama-3.3-nemotron-super-49b-v1',
      'meta/llama-3.2-1b-instruct',
      'meta/llama-3.1-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-7b-instruct-v0.3',
      'google/gemma-2-9b-it',
    ],
  },
  openai: {
    baseUrl: OPENAI_BASE,
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-4-vision-preview',
    ],
  },
};

// ─── Fetch available models for a given API key ──────────────
export async function fetchModels(apiKey: string, baseUrl?: string, provider?: ApiProvider): Promise<string[]> {
  const base = baseUrl || (provider === 'openai' ? OPENAI_BASE : DEFAULT_BASE);
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models: string[] = data.data?.map((m: any) => m.id) ?? [];
    return models.sort();
  } catch {
    return PROVIDER_DEFAULTS[provider || 'nvidia'].models;
  }
}

// ─── Helper: read image as base64 ────────────────────────────
async function imageToBase64(uri: string): Promise<string> {
  // Try expo-file-system first
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    if (base64 && base64.length > 100) return base64;
  } catch {}
  // Fallback: fetch as blob
  try {
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
  } catch (e: any) {
    throw new Error('Could not read image: ' + (e.message || 'unknown error'));
  }
}

// ─── Chat completions call ───────────────────────────────────
async function chatCompletion(
  settings: NvidiaSettings,
  messages: any[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const provider = settings.provider || 'nvidia';
  const base = settings.baseUrl || (provider === 'openai' ? OPENAI_BASE : DEFAULT_BASE);
  const providerLabel = provider === 'openai' ? 'OpenAI' : 'NVIDIA';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.max_tokens ?? 1024,
      top_p: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${providerLabel} API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Parse JSON from AI response ─────────────────────────────
function parseJsonResponse(response: string): any {
  let cleaned = response.trim();
  // Remove markdown fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}
  // Try extracting JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.substring(start, end + 1));
    } catch {}
  }
  // Try regex extraction
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  throw new Error('Could not parse JSON from AI response');
}

// ─── Single car scan ─────────────────────────────────────────
export async function scanCarFromImage(
  settings: NvidiaSettings,
  imageUri: string
): Promise<ScanResult> {
  const base64 = await imageToBase64(imageUri);

  const systemPrompt = 'You are a Hot Wheels card reader. Read text and identify visual features from the image. Return ONLY valid JSON. If you cannot read something, use "Unknown". Do NOT guess.';

  const userPrompt = `Read this Hot Wheels card and return ONLY this JSON (no extra text):

{
  "name": "car name from top of card",
  "year": "year from copyright symbol near barcode",
  "series": "series name from card",
  "color": "car body color",
  "model": "casting name",
  "rarity": "Mainline or Treasure Hunt or Super Treasure Hunt or Premium",
  "condition": "Mint or Near Mint or Good or Poor",
  "conditionNotes": "describe corners, edges, surface, blister",
  "tampos": "decorations on car body",
  "wheelType": "wheel type code",
  "baseColor": "base color",
  "variant": "color variant info"
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
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
    name: data.name || 'Unknown',
    year: data.year || 'Unknown',
    series: data.series || '',
    color: data.color || '',
    model: data.model || '',
    scale: '1:64',
    rarity: data.rarity || 'Mainline',
    condition: data.condition || 'Unknown',
    conditionNotes: data.conditionNotes || '',
    barcode: '',
    manufacturer: 'Mattel',
    tampos: data.tampos || '',
    wheelType: data.wheelType || '',
    baseColor: data.baseColor || '',
    variant: data.variant || '',
    expectedPrice: 0,
    priceINR: 0,
    priceRange: { min: 0, max: 0, avg: 0 },
    priceSources: [],
    confidence: data.condition === 'Unknown' && data.name === 'Unknown' ? 'low' : 'medium',
    status: 'SCAN_ONLY',
    matchScore: 0,
    history: '',
    searchResults: '',
  };
}

// ─── Bulk scan: multiple cars from one photo ─────────────────
export async function scanBulkFromImage(
  settings: NvidiaSettings,
  imageUri: string
): Promise<ScanResult[]> {
  const base64 = await imageToBase64(imageUri);

  const systemPrompt = 'You are a Hot Wheels card reader. Read text from each car card. Return ONLY a JSON array. If you cannot read something, use "Unknown".';

  const userPrompt = `This image may have MULTIPLE Hot Wheels cars. For EACH car, return a JSON object in an array. Each object:

{
  "name": "car name from card",
  "year": "year from copyright symbol",
  "series": "series name",
  "color": "car body color",
  "model": "casting name",
  "rarity": "Mainline or Treasure Hunt or Super Treasure Hunt or Premium",
  "condition": "Mint or Near Mint or Good or Poor",
  "conditionNotes": "card condition",
  "tampos": "decorations",
  "wheelType": "wheel type",
  "baseColor": "base color",
  "variant": "variant info"
}

Return JSON array only. Skip cars you cannot read.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
      ],
    },
  ];

  const response = await chatCompletion(settings, messages, {
    temperature: 0.0,
    max_tokens: 2000,
  });

  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let arr: any[];
  try {
    arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) arr = [arr];
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      arr = JSON.parse(arrayMatch[0]);
    } else {
      const singleMatch = cleaned.match(/\{[\s\S]*\}/);
      if (singleMatch) {
        arr = [JSON.parse(singleMatch[0])];
      } else {
        throw new Error('Could not parse bulk scan results');
      }
    }
  }

  return arr.map((data) => ({
    name: data.name || 'Unknown',
    year: data.year || 'Unknown',
    series: data.series || '',
    color: data.color || '',
    model: data.model || '',
    scale: '1:64',
    rarity: data.rarity || 'Mainline',
    condition: data.condition || 'Unknown',
    conditionNotes: data.conditionNotes || '',
    barcode: '',
    manufacturer: 'Mattel',
    tampos: data.tampos || '',
    wheelType: data.wheelType || '',
    baseColor: data.baseColor || '',
    variant: data.variant || '',
    expectedPrice: 0,
    priceINR: 0,
    priceRange: { min: 0, max: 0, avg: 0 },
    priceSources: [],
    confidence: 'medium',
    status: 'SCAN_ONLY',
    matchScore: 0,
    history: '',
    searchResults: '',
  }));
}

// ─── Search for car value online ──────────────────────────────
export async function searchCarValue(
  settings: NvidiaSettings,
  carName: string,
  year: string
): Promise<{ estimatedValue: string; searchInfo: string; priceSources: { source: string; price: number; reference: string }[] }> {
  const messages = [
    {
      system: 'You are a Hot Wheels collector market expert.',
      role: 'system',
      content: 'You are a Hot Wheels collector market expert. You provide REAL collector resale prices based on actual market knowledge. You understand that prices vary by year, rarity, condition, and color variant. You provide honest assessments.',
    },
    {
      role: 'user',
      content: `What is the current collector resale market value for this Hot Wheels car in India?

Car: ${carName}
Production Year: ${year}

IMPORTANT: These are COLLECTOR RESALE prices, not retail store prices. A common 2024 Mainline car resells for ₹80-150, NOT ₹299. A 2010 car resells for ₹200-500. A Treasure Hunt resells for ₹400-2500. Condition affects price by 30-65%.

Provide:
1. Honest price estimate based on year, rarity, and typical condition
2. How price changes based on condition (Mint vs Good vs Poor)
3. Reference sources: eBay sold, Mercari, collector communities
4. What makes this car more or less valuable

Respond in JSON:
{
  "estimatedValue": "₹100 - ₹200",
  "searchInfo": "detailed market analysis explaining why this price range, factors affecting value, and condition impact",
  "priceSources": [
    {"source": "eBay Sold Listings", "price": 150, "reference": "based on recent completed auctions for similar model/year"},
    {"source": "Collector Community", "price": 120, "reference": "FB group collector reported sales in India"}
  ]
}`,
    },
  ];

  const response = await chatCompletion(settings, messages, {
    temperature: 0.1,
    max_tokens: 800,
  });

  try {
    return parseJsonResponse(response);
  } catch {
    return { estimatedValue: 'N/A', searchInfo: response, priceSources: [] };
  }
}

// ─── Quick text query ─────────────────────────────────────────
export async function askHotWheelsExpert(
  settings: NvidiaSettings,
  question: string
): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: 'You are a knowledgeable Hot Wheels collector and expert. Provide accurate, helpful information about Hot Wheels cars, values, and collecting.',
    },
    { role: 'user', content: question },
  ];

  return chatCompletion(settings, messages);
}

// ─── Re-export identification pipeline ───────────────────────
export { identifyHotWheel, identifyBulkHotWheels } from './identification';

// ─── Re-export research pipeline ─────────────────────────────
export { researchHotWheelComplete, refreshMarketData, getResearchSources, clearCache } from './research';

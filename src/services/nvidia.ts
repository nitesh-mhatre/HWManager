import { NvidiaSettings, ScanResult } from '../types';
import * as FileSystem from 'expo-file-system';

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';

// ─── Fetch available models for a given API key ──────────────
export async function fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
  const base = baseUrl || DEFAULT_BASE;
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models: string[] = data.data?.map((m: any) => m.id) ?? [];
    return models.sort();
  } catch {
    // Fallback: well-known free NVIDIA models
    return [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.2-11b-vision-instruct',
      'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      'nvidia/llama-3.3-nemotron-super-49b-v1',
      'meta/llama-3.2-1b-instruct',
      'meta/llama-3.1-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-7b-instruct-v0.3',
      'google/gemma-2-9b-it',
    ];
  }
}

// ─── Helper: read image as base64 ────────────────────────────
async function imageToBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
    // If local file fails, try fetching the URI directly
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string).split(',')[1];
        resolve(result);
      };
      reader.readAsDataURL(blob);
    });
  }
}

// ─── Chat completions call ───────────────────────────────────
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
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.max_tokens ?? 1024,
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

// ─── Scan a Hot Wheels car from image ────────────────────────
export async function scanCarFromImage(
  settings: NvidiaSettings,
  imageUri: string
): Promise<ScanResult> {
  const base64 = await imageToBase64(imageUri);

  const prompt = `You are a Hot Wheels car expert and collector. Analyze this image of a Hot Wheels car package/card or loose car and extract ALL identifiable details.

Search your knowledge for this specific Hot Wheels model and provide accurate information.

Respond in JSON format ONLY (no markdown, no explanation), with these fields:
{
  "name": "Full name of the car (e.g., '1967 Custom Camaro')",
  "year": "Year this casting was released (e.g., '2023')",
  "series": "Series name if visible (e.g., 'HW primaries', 'Fast & Furious')",
  "color": "Main color of the car",
  "model": "Casting/mold name if different from name",
  "scale": "Scale (usually 1:64)",
  "rarity": "Mainline, Treasure Hunt, Super Treasure Hunt, Zamac, Factory Sealed, etc.",
  "barcode": "UPC/barcode if visible on card",
  "manufacturer": "Manufacturer (usually Mattel)",
  "tampos": "Side/top decoration details if visible",
  "wheelType": "Wheel type if identifiable (e.g., 10SP, MC5, OH5)",
  "baseColor": "Color of the metal/plastic base if visible",
  "expectedPrice": 0.00,
  "confidence": "high/medium/low",
  "searchResults": "Any additional collector info about this model's value and rarity"
}

If you cannot determine a field, use an empty string. For expectedPrice, provide estimated market value in USD as a number.`;

  const messages = [
    {
      role: 'system',
      content: 'You are a Hot Wheels collector expert with deep knowledge of every casting, series, variant, and market value. Always respond with valid JSON only.',
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64}` },
        },
      ],
    },
  ];

  const response = await chatCompletion(settings, messages, {
    temperature: 0.1,
    max_tokens: 1500,
  });

  // Parse JSON from response, handling potential markdown wrapping
  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse scan result from AI response');
  }
}

// ─── Search for car value online ──────────────────────────────
export async function searchCarValue(
  settings: NvidiaSettings,
  carName: string,
  year: string
): Promise<{ estimatedValue: string; searchInfo: string }> {
  const messages = [
    {
      role: 'system',
      content: 'You are a Hot Wheels market expert. Provide accurate collector market values.',
    },
    {
      role: 'user',
      content: `Search your knowledge for the current collector market value of this Hot Wheels car:
Name: ${carName}
Year: ${year}

Provide:
1. Estimated market value range in USD
2. Key factors affecting value (rarity, condition, demand)
3. Notable sales or market trends

Respond in JSON format:
{"estimatedValue": "$X.XX - $X.XX", "searchInfo": "detailed information"}`,
    },
  ];

  const response = await chatCompletion(settings, messages, {
    temperature: 0.2,
    max_tokens: 800,
  });

  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return { estimatedValue: 'N/A', searchInfo: response };
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

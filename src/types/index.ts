export interface NvidiaSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface PriceSource {
  source: string;       // e.g. "eBay Sold Listings", "Mercari Sold", "Collector Community"
  price: number;
  reference: string;    // e.g. "eBay item #12345", "Mercari listing avg", "FB Group India HW"
  url?: string;         // optional link to source
}

export interface PriceRange {
  min: number;
  max: number;
  avg: number;
}

export interface HotWheelCar {
  id: string;
  name: string;
  year: string;
  series: string;
  color: string;
  model: string;       // casting name
  scale: string;
  rarity: string;
  condition: string;   // mint, loose, damaged
  buyPrice: number;
  expectedPrice: number;
  priceINR: number;
  priceRange: PriceRange;
  priceSources: PriceSource[];
  remarks: string;
  images: string[];     // local file URIs
  inCollection: boolean; // true = Garage, false = Wishlist
  dateAdded: string;
  barcode: string;
  manufacturer: string;
  tampos: string;       // decoration details
  wheelType: string;
  baseColor: string;
  history: string;      // car history, background info from AI
  status: string;       // MATCHED, AMBIGUOUS, NO_MATCH, NEEDS_BETTER_PHOTO
  matchScore: number;   // 0-100, how well evidence matched database
  // Sold tracking
  isSold: boolean;
  soldPrice: number;
  soldDate: string;     // ISO date string
  soldPlatform: string; // eBay, Mercari, FB Marketplace, etc.
  soldNotes: string;
}

export interface ScanResult {
  name: string;
  year: string;
  series: string;
  color: string;
  model: string;
  scale: string;
  rarity: string;
  condition: string;    // AI-detected condition
  conditionNotes: string; // what AI sees on the card
  barcode: string;
  manufacturer: string;
  tampos: string;
  wheelType: string;
  baseColor: string;
  expectedPrice: number;
  priceINR: number;
  priceRange: PriceRange;
  priceSources: PriceSource[];
  confidence: string;   // overall confidence
  searchResults: string;
  history: string;      // car history and background from AI
  variant: string;      // variant/color edition info
  status: string;       // MATCHED, AMBIGUOUS, NO_MATCH, NEEDS_BETTER_PHOTO
  matchScore: number;   // 0-100, how well evidence matched database
}

export type TabRoute = 'garage' | 'wishlist' | 'scan' | 'add' | 'settings';

export type ApiProvider = 'nvidia' | 'openai';

export interface NvidiaSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider?: ApiProvider;
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

/** A single purchase record — user can buy the same car multiple times at different rates */
export interface PurchaseEntry {
  id: string;
  buyPrice: number;
  quantity: number;
  date: string;           // ISO date string
  source: string;         // where purchased: "Local Shop", "Amazon", "eBay", etc.
  condition: string;      // Mint, Loose, Damaged, Carded, etc.
  notes: string;
}

/** A single sale record — user can sell units of a car at different rates */
export interface SaleEntry {
  id: string;
  soldPrice: number;
  quantity: number;
  date: string;           // ISO date string
  platform: string;       // eBay, Mercari, FB Marketplace, etc.
  buyerInfo: string;
  notes: string;
  platformFees: number;   // platform commission / listing fees
  shippingCost: number;   // shipping cost paid
}

/** Allocation bucket — where this unit lives in the collection */
export type AllocationType = 'personal' | 'trade' | 'forSale';

export interface HotWheelCar {
  id: string;
  name: string;
  year: string;
  series: string;
  color: string;
  model: string;       // casting name
  scale: string;
  rarity: string;
  condition: string;   // legacy: mint, loose, damaged
  // Legacy single-price fields (kept for backward compatibility)
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
  // Professional inventory tracking
  quantity: number;           // total units in stock (sum of purchases minus sales)
  purchaseHistory: PurchaseEntry[];
  saleHistory: SaleEntry[];
  // Sold tracking (legacy, kept for backward compat)
  isSold: boolean;
  soldPrice: number;
  soldDate: string;     // ISO date string
  soldPlatform: string; // eBay, Mercari, FB Marketplace, etc.
  soldNotes: string;
  // === NEW: Feature #1 Storage Location ===
  storageLocation: string;  // e.g. "Shelf 1 > Clear Tub #4 > Row 2"
  // === NEW: Feature #2 Allocation Tags ===
  allocation: AllocationType; // 'personal' | 'trade' | 'forSale'
  // === NEW: Feature #3 Card Condition Detail ===
  cardCondition: string;     // 'mint' | 'softCorner' | 'crackedBubble' | 'crease' | 'protector' | 'na'
  packaging: string;         // 'longCard' | 'shortCard' | 'protector' | 'loose' | 'damaged' | ''
  // === NEW: Feature #4 Case Code & Toy Number ===
  caseCode: string;          // A–Q release case letter
  toyNumber: string;         // e.g. "124/250" collector number
  // === NEW: Feature #5 Variation & Error Log ===
  variations: string[];      // e.g. ["Short Card", "Wheel Swap", "Color Shift", "Tampo Error"]
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

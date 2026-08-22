export interface NvidiaSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
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
  remarks: string;
  images: string[];     // local file URIs
  inCollection: boolean; // true = Garage, false = Wishlist
  dateAdded: string;
  barcode: string;
  manufacturer: string;
  tampos: string;       // decoration details
  wheelType: string;
  baseColor: string;
}

export interface ScanResult {
  name: string;
  year: string;
  series: string;
  color: string;
  model: string;
  scale: string;
  rarity: string;
  barcode: string;
  manufacturer: string;
  tampos: string;
  wheelType: string;
  baseColor: string;
  expectedPrice: number;
  confidence: string;
  searchResults: string;
}

export type TabRoute = 'garage' | 'wishlist' | 'scan' | 'add' | 'settings';

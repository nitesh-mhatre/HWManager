import AsyncStorage from '@react-native-async-storage/async-storage';
import { NvidiaSettings, HotWheelCar, PurchaseEntry, SaleEntry } from '../types';

const KEYS = {
  SETTINGS: 'hw_settings',
  CARS: 'hw_cars',
  MANUAL_MODE: 'hw_manual_mode',
  VIEW_PREFS: 'hw_view_prefs',
} as const;

// ─── Settings ───────────────────────────────────────────────
export async function getSettings(): Promise<NvidiaSettings | null> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : null;
}

export async function saveSettings(settings: NvidiaSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ─── Cars ───────────────────────────────────────────────────
export async function getAllCars(): Promise<HotWheelCar[]> {
  const raw = await AsyncStorage.getItem(KEYS.CARS);
  const cars: HotWheelCar[] = raw ? JSON.parse(raw) : [];
  // Backward-compat: migrate old cars missing new fields
  return cars.map((c) => ({
    ...c,
    quantity: c.quantity ?? 1,
    purchaseHistory: c.purchaseHistory ?? [],
    storageLocation: c.storageLocation ?? '',
    allocation: c.allocation ?? 'personal',
    cardCondition: c.cardCondition ?? '',
    packaging: c.packaging ?? '',
    caseCode: c.caseCode ?? '',
    toyNumber: c.toyNumber ?? '',
    variations: c.variations ?? [],
    // Migrate old SaleEntry items missing new fields
    saleHistory: (c.saleHistory ?? []).map((s: any) => ({
      ...s,
      platformFees: s.platformFees ?? 0,
      shippingCost: s.shippingCost ?? 0,
    })),
  }));
}

export async function saveAllCars(cars: HotWheelCar[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CARS, JSON.stringify(cars));
}

export async function addCar(car: HotWheelCar): Promise<void> {
  const cars = await getAllCars();
  cars.push(car);
  await saveAllCars(cars);
}

export async function updateCar(updated: HotWheelCar): Promise<void> {
  const cars = await getAllCars();
  const idx = cars.findIndex((c) => c.id === updated.id);
  if (idx >= 0) {
    cars[idx] = updated;
    await saveAllCars(cars);
  }
}

export async function deleteCar(id: string): Promise<void> {
  const cars = await getAllCars();
  await saveAllCars(cars.filter((c) => c.id !== id));
}

export async function getGarage(): Promise<HotWheelCar[]> {
  const cars = await getAllCars();
  return cars.filter((c) => c.inCollection);
}

export async function getWishlist(): Promise<HotWheelCar[]> {
  const cars = await getAllCars();
  return cars.filter((c) => !c.inCollection);
}

// ─── Duplicate Detection ────────────────────────────────────

export async function findDuplicateCars(
  name: string,
  model: string,
  year: string,
  color: string,
): Promise<HotWheelCar[]> {
  const cars = await getAllCars();
  const norm = (s: string) => (s || '').toLowerCase().trim();
  return cars.filter((c) => {
    const nameMatch = norm(c.name) === norm(name);
    const modelMatch = norm(c.model) === norm(model);
    const yearMatch = norm(c.year) === norm(year);
    const cColor = norm(c.color);
    const nColor = norm(color);
    const colorMatch = cColor === nColor || (cColor.length > 0 && nColor.length > 0 && cColor.split(' ')[0] === nColor.split(' ')[0]);
    return nameMatch && modelMatch && yearMatch && colorMatch;
  });
}

// ─── Purchase History Management ────────────────────────────

export async function addPurchaseToCar(
  carId: string,
  entry: PurchaseEntry,
): Promise<HotWheelCar | null> {
  const cars = await getAllCars();
  const idx = cars.findIndex((c) => c.id === carId);
  if (idx < 0) return null;

  const car = cars[idx];
  car.purchaseHistory = [...(car.purchaseHistory || []), entry];
  const totalPurchased = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
  const totalSold = car.saleHistory.reduce((s, sl) => s + (sl.quantity || 1), 0);
  car.quantity = Math.max(0, totalPurchased - totalSold);
  if (car.purchaseHistory.length > 0) {
    const totalCost = car.purchaseHistory.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0);
    const totalUnits = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
    car.buyPrice = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
  }
  cars[idx] = car;
  await saveAllCars(cars);
  return car;
}

export async function addSaleToCar(
  carId: string,
  entry: SaleEntry,
): Promise<HotWheelCar | null> {
  const cars = await getAllCars();
  const idx = cars.findIndex((c) => c.id === carId);
  if (idx < 0) return null;

  const car = cars[idx];
  car.saleHistory = [...(car.saleHistory || []), entry];
  const totalPurchased = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
  const totalSold = car.saleHistory.reduce((s, sl) => s + (sl.quantity || 1), 0);
  car.quantity = Math.max(0, totalPurchased - totalSold);
  if (car.quantity === 0 && car.saleHistory.length > 0) {
    car.isSold = true;
    const latestSale = car.saleHistory[car.saleHistory.length - 1];
    car.soldPrice = latestSale.soldPrice;
    car.soldDate = latestSale.date;
    car.soldPlatform = latestSale.platform;
    car.soldNotes = latestSale.notes;
  } else if (car.quantity > 0) {
    car.isSold = false;
  }
  cars[idx] = car;
  await saveAllCars(cars);
  return car;
}

export function computeCarStats(car: HotWheelCar) {
  const totalPurchased = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
  const totalSold = car.saleHistory.reduce((s, sl) => s + (sl.quantity || 1), 0);
  const totalInvested = car.purchaseHistory.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0);
  const totalRevenue = car.saleHistory.reduce((s, sl) => s + sl.soldPrice * (sl.quantity || 1), 0);
  const totalFees = car.saleHistory.reduce((s, sl) => s + (sl.platformFees || 0) + (sl.shippingCost || 0), 0);
  const netRevenue = totalRevenue - totalFees;
  const avgBuyPrice = totalPurchased > 0 ? Math.round(totalInvested / totalPurchased) : 0;
  const avgSellPrice = totalSold > 0 ? Math.round(totalRevenue / totalSold) : 0;

  // Realized P&L: only account for the cost of items actually sold
  const cogs = totalSold * avgBuyPrice;
  const profit = netRevenue - cogs;
  const roi = cogs > 0 ? ((profit / cogs) * 100) : 0;
  const inStock = Math.max(0, totalPurchased - totalSold);

  return {
    totalPurchased,
    totalSold,
    totalInvested,
    totalRevenue,
    totalFees,
    netRevenue,
    avgBuyPrice,
    avgSellPrice,
    cogs,
    profit,
    roi,
    inStock,
  };
}

// ─── CSV/JSON Export ────────────────────────────────────────

export function generateCSV(cars: HotWheelCar[]): string {
  const headers = [
    'Name', 'Year', 'Series', 'Color', 'Model', 'Rarity',
    'Condition', 'Card Condition', 'Packaging', 'Case Code', 'Toy #',
    'Buy Price', 'Market Value', 'Qty', 'Allocation', 'Storage Location',
    'Variations', 'Date Added',
  ];
  const rows = cars.map((c) => [
    c.name, c.year, c.series, c.color, c.model, c.rarity,
    c.condition, c.cardCondition, c.packaging, c.caseCode, c.toyNumber,
    c.buyPrice, c.priceINR || c.expectedPrice, c.quantity, c.allocation, c.storageLocation,
    (c.variations || []).join('; '), c.dateAdded,
  ]);
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  return csvContent;
}

export function generateJSON(cars: HotWheelCar[]): string {
  return JSON.stringify(cars, null, 2);
}

// ─── Manual Mode ──────────────────────────────────────────
export async function isManualMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.MANUAL_MODE);
  return raw === 'true';
}

export async function setManualMode(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.MANUAL_MODE, String(value));
}

// ─── View Preferences (Bug 1 fix) ─────────────────────────
export interface ViewPreferences {
  garage: { viewMode: string; sortBy: string };
  wishlist: { viewMode: string; sortBy: string };
}

const defaultViewPrefs: ViewPreferences = {
  garage: { viewMode: 'grid', sortBy: 'newest' },
  wishlist: { viewMode: 'grid', sortBy: 'newest' },
};

export async function getViewPreferences(): Promise<ViewPreferences> {
  const raw = await AsyncStorage.getItem(KEYS.VIEW_PREFS);
  return raw ? { ...defaultViewPrefs, ...JSON.parse(raw) } : defaultViewPrefs;
}

export async function saveViewPreference(
  screen: 'garage' | 'wishlist',
  key: 'viewMode' | 'sortBy',
  value: string,
): Promise<void> {
  const prefs = await getViewPreferences();
  prefs[screen] = { ...prefs[screen], [key]: value };
  await AsyncStorage.setItem(KEYS.VIEW_PREFS, JSON.stringify(prefs));
}

// ─── Backup & Restore (with images as base64) ──────────────
import { File, Directory, Paths } from 'expo-file-system';

export interface BackupData {
  version: 1;
  timestamp: string;
  settings: NvidiaSettings | null;
  cars: HotWheelCar[];
  images: Record<string, string>;
}

export async function createBackup(): Promise<BackupData> {
  const settings = await getSettings();
  const cars = await getAllCars();
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    settings,
    cars,
    images: {},  // images saved as separate files to avoid bridge string limits
  };
}

export async function restoreBackup(backup: BackupData): Promise<{ carsImported: number; imagesRestored: number }> {
  const imageMapping: Record<string, string> = {};
  let imagesRestored = 0;
  const docDir = Paths.document.uri || '';
  const imagesDir = `${docDir}backup_images/`;
  try {
    const dirInstance = new Directory(imagesDir);
    if (!dirInstance.exists) {
      dirInstance.create();
    }
  } catch {
    new Directory(imagesDir).create();
  }
  // Restore images from base64 data in backup (old format)
  for (const [originalUri, base64] of Object.entries(backup.images || {})) {
    try {
      const filename = originalUri.split('/').pop() || `img_${Date.now()}.jpg`;
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const newUri = `${imagesDir}${safeFilename}`;
      new File(newUri).write(base64, { encoding: 'base64' });
      imageMapping[originalUri] = newUri;
      imagesRestored++;
    } catch (e) {
      console.warn(`Failed to restore image: ${originalUri}`);
    }
  }
  const restoredCars = backup.cars.map((car) => ({
    ...car,
    images: car.images.map((uri) => imageMapping[uri] || uri),
  }));
  if (backup.settings) {
    await saveSettings(backup.settings);
  }
  await saveAllCars(restoredCars);
  return {
    carsImported: restoredCars.length,
    imagesRestored,
  };
}

export async function createBackupFile(): Promise<string> {
  const backup = await createBackup();
  const json = JSON.stringify(backup);
  const fileUri = `${Paths.cache}hotwheels-backup-${new Date().toISOString().slice(0, 10)}.json`;
  await new File(fileUri).write(json);

  // Copy images as separate files to avoid string bridge limits
  const allImageUris = new Set<string>();
  for (const car of backup.cars) {
    if (car.images && car.images.length > 0) {
      for (const uri of car.images) {
        if (uri && !uri.startsWith('data:')) {
          allImageUris.add(uri);
        }
      }
    }
  }
  if (allImageUris.size > 0) {
    const backupDir = `${Paths.cache}hotwheels-images/`;
    try {
      const dir = new Directory(backupDir);
      if (!dir.exists) dir.create();
    } catch {
      new Directory(backupDir).create();
    }
    for (const uri of allImageUris) {
      try {
        const filename = uri.split('/').pop() || `img_${Date.now()}.jpg`;
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const srcFile = new File(uri);
        if (srcFile.exists) {
          const base64Data = srcFile.base64Sync();
          new File(`${backupDir}${safeFilename}`).write(base64Data, { encoding: 'base64' });
        }
      } catch (e) {
        console.warn(`Failed to copy image for backup: ${uri}`);
      }
    }
  }
  return fileUri;
}

// ─── Peg-Hunting Helpers ────────────────────────────────────

/** Get all unique case codes from the collection */
export async function getCaseCodes(): Promise<string[]> {
  const cars = await getAllCars();
  const codes = new Set(cars.map((c) => c.caseCode).filter(Boolean));
  return Array.from(codes).sort();
}

/** Build a peg-hunting checklist: for each case code, list cars and their status */
export interface PegHuntItem {
  name: string;
  model: string;
  year: string;
  color: string;
  toyNumber: string;
  status: 'have' | 'want' | 'need';  // have = in garage, want = on wishlist, need = not found
  allocation?: string;
  images?: string[];
}

export async function buildPegHuntChecklist(caseCode: string): Promise<PegHuntItem[]> {
  const cars = await getAllCars();
  const inCase = cars.filter((c) => c.caseCode === caseCode);
  return inCase.map((c) => ({
    name: c.name,
    model: c.model,
    year: c.year,
    color: c.color,
    toyNumber: c.toyNumber,
    status: c.inCollection ? 'have' : 'want',
    allocation: c.allocation,
    images: c.images,
  }));
}

// ─── Smart Duplicate Detection ──────────────────────────────

export interface DuplicateAnalysis {
  exactDupes: HotWheelCar[];        // same name+model+year+color
  colorVariants: HotWheelCar[];     // same name+model+year but different color
  sameColorCount: number;           // how many of the exact same color
  differentColorCount: number;      // how many different colors of same car
  variantColors: string[];          // list of variant colors
}

/** Analyze duplicates with color-aware detail */
export async function analyzeDuplicateDetails(
  name: string,
  model: string,
  year: string,
  color: string,
): Promise<DuplicateAnalysis> {
  const cars = await getAllCars();
  const norm = (s: string) => (s || '').toLowerCase().trim();
  const nName = norm(name);
  const nModel = norm(model);
  const nYear = norm(year);
  const nColor = norm(color);
  const nColorBase = nColor.split(' ')[0];

  // Find all cars with same name+model+year (any color)
  const sameModelCars = cars.filter((c) => {
    return norm(c.name) === nName && norm(c.model) === nModel && norm(c.year) === nYear;
  });

  if (sameModelCars.length === 0) {
    return { exactDupes: [], colorVariants: [], sameColorCount: 0, differentColorCount: 0, variantColors: [] };
  }

  const exactDupes = sameModelCars.filter((c) => {
    const cColor = norm(c.color);
    return cColor === nColor || (cColor.length > 0 && nColor.length > 0 && cColor.split(' ')[0] === nColorBase);
  });

  const colorVariants = sameModelCars.filter((c) => {
    const cColor = norm(c.color);
    return !(cColor === nColor || (cColor.length > 0 && nColor.length > 0 && cColor.split(' ')[0] === nColorBase));
  });

  const variantColors = colorVariants.map((c) => c.color).filter(Boolean);

  return {
    exactDupes,
    colorVariants,
    sameColorCount: exactDupes.length,
    differentColorCount: colorVariants.length,
    variantColors,
  };
}

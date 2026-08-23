import AsyncStorage from '@react-native-async-storage/async-storage';
import { NvidiaSettings, HotWheelCar, PurchaseEntry, SaleEntry } from '../types';

const KEYS = {
  SETTINGS: 'hw_settings',
  CARS: 'hw_cars',
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
    saleHistory: c.saleHistory ?? [],
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

/**
 * Find duplicate cars by matching on name + model + year + color.
 * Returns existing cars that match the scanned car's identity.
 */
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
    // Color match is fuzzy — same first word matches
    const cColor = norm(c.color);
    const nColor = norm(color);
    const colorMatch = cColor === nColor || (cColor.length > 0 && nColor.length > 0 && cColor.split(' ')[0] === nColor.split(' ')[0]);
    // At least name+model+year must match (color is bonus)
    return nameMatch && modelMatch && yearMatch && colorMatch;
  });
}

// ─── Purchase History Management ────────────────────────────

/** Add a new purchase entry to a car and recalculate quantity */
export async function addPurchaseToCar(
  carId: string,
  entry: PurchaseEntry,
): Promise<HotWheelCar | null> {
  const cars = await getAllCars();
  const idx = cars.findIndex((c) => c.id === carId);
  if (idx < 0) return null;

  const car = cars[idx];
  car.purchaseHistory = [...(car.purchaseHistory || []), entry];
  // Recalculate quantity: total purchased minus total sold
  const totalPurchased = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
  const totalSold = car.saleHistory.reduce((s, sl) => s + (sl.quantity || 1), 0);
  car.quantity = Math.max(0, totalPurchased - totalSold);
  // Update legacy buyPrice to weighted average
  if (car.purchaseHistory.length > 0) {
    const totalCost = car.purchaseHistory.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0);
    const totalUnits = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
    car.buyPrice = totalUnits > 0 ? Math.round(totalCost / totalUnits) : 0;
  }
  cars[idx] = car;
  await saveAllCars(cars);
  return car;
}

/** Add a new sale entry to a car and recalculate quantity */
export async function addSaleToCar(
  carId: string,
  entry: SaleEntry,
): Promise<HotWheelCar | null> {
  const cars = await getAllCars();
  const idx = cars.findIndex((c) => c.id === carId);
  if (idx < 0) return null;

  const car = cars[idx];
  car.saleHistory = [...(car.saleHistory || []), entry];
  // Recalculate quantity
  const totalPurchased = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
  const totalSold = car.saleHistory.reduce((s, sl) => s + (sl.quantity || 1), 0);
  car.quantity = Math.max(0, totalPurchased - totalSold);
  // Mark as fully sold if quantity is 0
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

/** Compute derived inventory stats for a car */
export function computeCarStats(car: HotWheelCar) {
  const totalPurchased = car.purchaseHistory.reduce((s, p) => s + (p.quantity || 1), 0);
  const totalSold = car.saleHistory.reduce((s, sl) => s + (sl.quantity || 1), 0);
  const totalInvested = car.purchaseHistory.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0);
  const totalRevenue = car.saleHistory.reduce((s, sl) => s + sl.soldPrice * (sl.quantity || 1), 0);
  const avgBuyPrice = totalPurchased > 0 ? Math.round(totalInvested / totalPurchased) : 0;
  const avgSellPrice = totalSold > 0 ? Math.round(totalRevenue / totalSold) : 0;
  const profit = totalRevenue - totalInvested;
  const roi = totalInvested > 0 ? ((profit / totalInvested) * 100) : 0;
  const inStock = Math.max(0, totalPurchased - totalSold);

  return {
    totalPurchased,
    totalSold,
    totalInvested,
    totalRevenue,
    avgBuyPrice,
    avgSellPrice,
    profit,
    roi,
    inStock,
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NvidiaSettings, HotWheelCar } from '../types';

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
  return raw ? JSON.parse(raw) : [];
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

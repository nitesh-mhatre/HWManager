import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getSettings } from '../../src/services/storage';
import { scanCarFromImage, searchCarValue, askHotWheelsExpert } from '../../src/services/nvidia';
import { addCar } from '../../src/services/storage';
import { ScanResult } from '../../src/types';

type ScanPhase = 'pick' | 'analyzing' | 'result' | 'searching';

export default function ScanScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<ScanPhase>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [error, setError] = useState('');

  const pickImage = async (useCamera: boolean) => {
    try {
      let pickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required to scan cars.');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: false,
        });
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: false,
        });
      }

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setImageUri(pickerResult.assets[0].uri);
        analyzeImage(pickerResult.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const analyzeImage = async (uri: string) => {
    setPhase('analyzing');
    setError('');
    try {
      const settings = await getSettings();
      if (!settings) {
        Alert.alert('Not configured', 'Please set up your API key first.', [
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings') },
        ]);
        setPhase('pick');
        return;
      }
      const scanResult = await scanCarFromImage(settings, uri);
      setResult(scanResult);
      setPhase('result');
    } catch (e: any) {
      setError(e.message);
      setPhase('result');
      setResult(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setPhase('searching');
    try {
      const settings = await getSettings();
      if (!settings) return;
      const res = await searchCarValue(settings, searchQuery, '');
      setSearchResult(res.searchInfo + '\n\nValue: ' + res.estimatedValue);
      setPhase('result');
    } catch (e: any) {
      setSearchResult('Search failed: ' + e.message);
      setPhase('result');
    }
  };

  const addToGarage = async () => {
    if (!result) return;
    const car = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: result.name || 'Unknown Car',
      year: result.year || '',
      series: result.series || '',
      color: result.color || '',
      model: result.model || '',
      scale: result.scale || '1:64',
      rarity: result.rarity || '',
      condition: 'Mint',
      buyPrice: 0,
      expectedPrice: result.expectedPrice || 0,
      remarks: result.searchResults || '',
      images: imageUri ? [imageUri] : [],
      inCollection: true,
      dateAdded: new Date().toISOString(),
      barcode: result.barcode || '',
      manufacturer: result.manufacturer || 'Mattel',
      tampos: result.tampos || '',
      wheelType: result.wheelType || '',
      baseColor: result.baseColor || '',
    };
    await addCar(car);
    Alert.alert('Added! 🏎️', `${car.name} added to your Garage!`, [
      { text: 'View Garage', onPress: () => router.push('/(tabs)/garage') },
      { text: 'Scan Another', onPress: reset },
    ]);
  };

  const addToWishlist = async () => {
    if (!result) return;
    const car = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: result.name || 'Unknown Car',
      year: result.year || '',
      series: result.series || '',
      color: result.color || '',
      model: result.model || '',
      scale: result.scale || '1:64',
      rarity: result.rarity || '',
      condition: '',
      buyPrice: 0,
      expectedPrice: result.expectedPrice || 0,
      remarks: result.searchResults || '',
      images: imageUri ? [imageUri] : [],
      inCollection: false,
      dateAdded: new Date().toISOString(),
      barcode: result.barcode || '',
      manufacturer: result.manufacturer || 'Mattel',
      tampos: result.tampos || '',
      wheelType: result.wheelType || '',
      baseColor: result.baseColor || '',
    };
    await addCar(car);
    Alert.alert('Added to Wishlist! ⭐', `${car.name} added to your Wishlist!`, [
      { text: 'View Wishlist', onPress: () => router.push('/(tabs)/wishlist') },
      { text: 'Scan Another', onPress: reset },
    ]);
  };

  const reset = () => {
    setPhase('pick');
    setImageUri(null);
    setResult(null);
    setSearchQuery('');
    setSearchResult('');
    setError('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📷 Scan Car</Text>
        <Text style={styles.headerSub}>Take a photo to identify any Hot Wheels car</Text>
      </View>

      {phase === 'pick' && (
        <>
          {/* Image preview */}
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(true)}>
              <Text style={styles.actionIcon}>📸</Text>
              <Text style={styles.actionLabel}>Take Photo</Text>
              <Text style={styles.actionDesc}>Use your camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(false)}>
              <Text style={styles.actionIcon}>🖼️</Text>
              <Text style={styles.actionLabel}>Pick Image</Text>
              <Text style={styles.actionDesc}>From your gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>🔍 Or search by name</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g., '1967 Custom Camaro' or 'Treasure Hunt 2023'"
                placeholderTextColor="#555"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                disabled={!searchQuery.trim()}
              >
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {phase === 'analyzing' && (
        <View style={styles.statusCard}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}
          <ActivityIndicator size="large" color="#e63946" style={{ marginTop: 16 }} />
          <Text style={styles.statusText}>🔍 Analyzing car with AI...</Text>
          <Text style={styles.statusDesc}>
            Identifying model, year, rarity, and market value
          </Text>
        </View>
      )}

      {phase === 'searching' && (
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color="#4da6ff" />
          <Text style={styles.statusText}>🔍 Searching market data...</Text>
          <Text style={styles.statusDesc}>
            Looking up collector values and market info
          </Text>
        </View>
      )}

      {phase === 'result' && (
        <>
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={reset}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : result ? (
            <>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}

              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>{result.name || 'Unknown Car'}</Text>
                <Text style={styles.confidence}>
                  Confidence: {result.confidence || 'medium'}
                </Text>

                <View style={styles.detailsGrid}>
                  <DetailRow label="Year" value={result.year} />
                  <DetailRow label="Color" value={result.color} />
                  <DetailRow label="Series" value={result.series} />
                  <DetailRow label="Rarity" value={result.rarity} />
                  <DetailRow label="Scale" value={result.scale} />
                  <DetailRow label="Manufacturer" value={result.manufacturer} />
                  <DetailRow label="Wheels" value={result.wheelType} />
                  <DetailRow label="Base" value={result.baseColor} />
                  <DetailRow label="Tampos" value={result.tampos} />
                  <DetailRow label="Barcode" value={result.barcode} />
                </View>

                {result.expectedPrice > 0 && (
                  <View style={styles.priceCard}>
                    <Text style={styles.priceLabel}>Estimated Market Value</Text>
                    <Text style={styles.priceValue}>${result.expectedPrice.toFixed(2)}</Text>
                  </View>
                )}

                {result.searchResults ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>📝 Collector Info</Text>
                    <Text style={styles.infoText}>{result.searchResults}</Text>
                  </View>
                ) : null}
              </View>

              {searchResult ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>🔍 Search Results</Text>
                  <Text style={styles.infoText}>{searchResult}</Text>
                </View>
              ) : null}

              {/* Action buttons */}
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.garageButton} onPress={addToGarage}>
                  <Text style={styles.garageButtonText}>🏎️ Add to Garage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.wishlistButton} onPress={addToWishlist}>
                  <Text style={styles.wishlistButtonText}>⭐ Add to Wishlist</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetButton} onPress={reset}>
                  <Text style={styles.resetButtonText}>📷 Scan Another</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingTop: 55, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  preview: {
    width: '100%',
    height: 250,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    marginBottom: 16,
  },
  miniPreview: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: '#1a1a2e',
    marginBottom: 12,
  },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  actionIcon: { fontSize: 36, marginBottom: 8 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  actionDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  searchSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#aaa', marginBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#e63946',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statusCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statusText: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 12 },
  statusDesc: { fontSize: 13, color: '#888', marginTop: 4, textAlign: 'center' },
  errorCard: {
    backgroundColor: '#2a1a1a',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a2222',
  },
  errorIcon: { fontSize: 36 },
  errorText: { fontSize: 14, color: '#ff6b6b', marginTop: 8, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#e63946',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 12,
  },
  retryButtonText: { color: '#fff', fontWeight: '700' },
  resultCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  resultTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  confidence: {
    fontSize: 12,
    color: '#4da6ff',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  detailsGrid: { marginTop: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  detailLabel: { fontSize: 13, color: '#888' },
  detailValue: { fontSize: 13, color: '#fff', fontWeight: '600', flex: 1, textAlign: 'right' },
  priceCard: {
    backgroundColor: '#0a2a1a',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1b5e20',
  },
  priceLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  priceValue: { fontSize: 28, fontWeight: '800', color: '#4caf50', marginTop: 4 },
  infoCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#aaa', lineHeight: 20 },
  resultActions: { gap: 10, marginTop: 4 },
  garageButton: {
    backgroundColor: '#1b5e20',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  garageButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  wishlistButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  wishlistButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  resetButtonText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
});

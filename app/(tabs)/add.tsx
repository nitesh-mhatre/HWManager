import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { addCar, getSettings, findDuplicateCars, analyzeDuplicateDetails } from '../../src/services/storage';
import { HotWheelCar, PurchaseEntry } from '../../src/types';
import { identifyHotWheel, researchHotWheelComplete } from '../../src/services/nvidia';
import { ScanResult } from '../../src/types';

export default function AddScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<'pick' | 'analyzing' | 'result'>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [researchData, setResearchData] = useState<any>(null);

  // Duplicate detection modal
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeAnalysis, setDupeAnalysis] = useState<import('../../src/services/storage').DuplicateAnalysis | null>(null);
  const [pendingCar, setPendingCar] = useState<HotWheelCar | null>(null);

  const pickImage = async (useCamera: boolean) => {
    try {
      let pickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
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
        Alert.alert('Not configured', 'Please set up your API key in Settings first.', [
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings') },
        ]);
        setPhase('pick');
        return;
      }
      const { result: scanResult, research } = await researchHotWheelComplete(settings, uri);
      setResult(scanResult);
      setResearchData(research);
      setPhase('result');
    } catch (e: any) {
      setError(e.message);
      setPhase('result');
      setResult(null);
    }
  };

  const buildNewCar = (): HotWheelCar | null => {
    if (!result) return null;
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    return {
      id,
      name: result.name || 'Unknown Car',
      year: result.year || '',
      series: result.series || '',
      color: result.color || '',
      model: result.model || '',
      scale: result.scale || '1:64',
      rarity: result.rarity || '',
      condition: result.condition || 'Mint',
      buyPrice: 0,
      expectedPrice: result.priceINR || 0,
      priceINR: result.priceINR || 0,
      priceRange: result.priceRange || { min: 0, max: 0, avg: 0 },
      priceSources: result.priceSources || [],
      remarks: result.searchResults || '',
      images: imageUri ? [imageUri] : [],
      inCollection: true,
      dateAdded: new Date().toISOString(),
      barcode: result.barcode || '',
      manufacturer: result.manufacturer || 'Mattel',
      tampos: result.tampos || '',
      wheelType: result.wheelType || '',
      baseColor: result.baseColor || '',
      history: result.history || '',
      status: result.status || 'UNKNOWN',
      matchScore: result.matchScore || 0,
      quantity: 1,
      purchaseHistory: [],
      saleHistory: [],
      isSold: false,
      soldPrice: 0,
      soldDate: '',
      soldPlatform: '',
      soldNotes: '',
      storageLocation: '',
      allocation: 'personal',
      cardCondition: '',
      packaging: '',
      caseCode: '',
      toyNumber: '',
      variations: [],
    };
  };

  const doAddCar = async (car: HotWheelCar) => {
    await addCar(car);
    setShowDupeModal(false);
    setDupeAnalysis(null);
    setPendingCar(null);
    Alert.alert('Added!', `${car.name} added as a new purchase to Garage!`, [
      { text: 'View Garage', onPress: () => router.push('/(tabs)/garage') },
      { text: 'Done', onPress: reset },
    ]);
  };

  const addToGarage = async () => {
    const car = buildNewCar();
    if (!car) return;
    // Smart duplicate detection
    const analysis = await analyzeDuplicateDetails(car.name, car.model, car.year, car.color);
    if (analysis.sameColorCount > 0 || analysis.differentColorCount > 0) {
      setDupeAnalysis(analysis);
      setPendingCar(car);
      setShowDupeModal(true);
      return;
    }
    await addCar(car);
    Alert.alert('Added!', `${car.name} (${car.year}) — ₹${car.priceINR} added to Garage!`, [
      { text: 'View Garage', onPress: () => router.push('/(tabs)/garage') },
      { text: 'Done', onPress: reset },
    ]);
  };

  const addToWishlist = async () => {
    const car = buildNewCar();
    if (!car) return;
    car.inCollection = false;
    car.condition = '';
    await addCar(car);
    Alert.alert('Added to Wishlist!', `${car.name} — ₹${car.priceINR}`, [
      { text: 'View Wishlist', onPress: () => router.push('/(tabs)/wishlist') },
      { text: 'Done', onPress: reset },
    ]);
  };

  const reset = () => {
    setPhase('pick');
    setImageUri(null);
    setResult(null);
    setError('');
    setResearchData(null);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialIcons name="add-circle" size={28} color="#e63946" />
          <View>
            <Text style={styles.headerTitle}>Add Car</Text>
            <Text style={styles.headerSub}>AI identifies all details from your photo</Text>
          </View>
        </View>
      </View>

      {phase === 'pick' && (
        <>
          {/* Photo input */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(true)}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(230, 57, 70, 0.15)' }]}>
                <MaterialIcons name="camera-alt" size={28} color="#e63946" />
              </View>
              <Text style={styles.actionLabel}>Take Photo</Text>
              <Text style={styles.actionDesc}>Snap your car card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(false)}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(77, 166, 255, 0.15)' }]}>
                <MaterialIcons name="photo-library" size={28} color="#4da6ff" />
              </View>
              <Text style={styles.actionLabel}>Pick Image</Text>
              <Text style={styles.actionDesc}>From your gallery</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={16} color="#4da6ff" />
            <Text style={styles.infoText}>
              Just take a photo of the Hot Wheels card — AI will automatically identify the car name, year, series, rarity, price, and full history. No manual entry needed!
            </Text>
          </View>
        </>
      )}

      {phase === 'analyzing' && (
        <View style={styles.statusCard}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e63946" />
            <MaterialCommunityIcons name="car" size={40} color="#e63946" style={styles.loadingCarIcon} />
          </View>
          <Text style={styles.statusText}>AI is identifying your car...</Text>
          <Text style={styles.statusDesc}>Reading card details, year, pricing & history</Text>
        </View>
      )}

      {phase === 'result' && (
        <>
          {error ? (
            <View style={styles.errorCard}>
              <MaterialIcons name="error-outline" size={40} color="#ff6b6b" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={reset}>
                <MaterialIcons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : result ? (
            <>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}

              {/* AI Details */}
              <View style={styles.aiSection}>
                <View style={styles.aiHeader}>
                  <MaterialCommunityIcons name="robot" size={18} color="#4da6ff" />
                  <Text style={styles.aiTitle}>AI Identified</Text>
                  <View style={[
                    styles.confidenceBadge,
                    result.confidence === 'high' ? styles.confHigh :
                    result.confidence === 'medium' ? styles.confMed : styles.confLow
                  ]}>
                    <Text style={styles.confText}>{result.confidence || 'medium'}</Text>
                  </View>
                </View>

                <Text style={styles.carName}>{result.name || 'Unknown Car'}</Text>
                <Text style={styles.carSub}>
                  {result.year ? `${result.year}` : ''}
                  {result.model ? ` · ${result.model}` : ''}
                </Text>

                <View style={styles.tags}>
                  {result.rarity ? (
                    <View style={[styles.tag, styles.tagRarity]}>
                      <MaterialIcons name="star" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{result.rarity}</Text>
                    </View>
                  ) : null}
                  {result.condition ? (
                    <View style={[styles.tag, styles.tagCondition]}>
                      <MaterialIcons name="check-circle" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{result.condition}</Text>
                    </View>
                  ) : null}
                  {result.series ? (
                    <View style={[styles.tag, styles.tagSeries]}>
                      <MaterialIcons name="collections-bookmark" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{result.series}</Text>
                    </View>
                  ) : null}
                  {result.variant ? (
                    <View style={[styles.tag, styles.tagVariant]}>
                      <MaterialIcons name="palette" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{result.variant}</Text>
                    </View>
                  ) : null}
                </View>

                {result.conditionNotes ? (
                  <Text style={styles.conditionNotes}>
                    {result.conditionNotes}
                  </Text>
                ) : null}

                <View style={styles.aiDetails}>
                  {result.color ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="palette" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Color</Text>
                      <Text style={styles.aiValue}>{result.color}</Text>
                    </View>
                  ) : null}
                  {result.scale ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="straighten" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Scale</Text>
                      <Text style={styles.aiValue}>{result.scale}</Text>
                    </View>
                  ) : null}
                  {result.manufacturer ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="business" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Maker</Text>
                      <Text style={styles.aiValue}>{result.manufacturer}</Text>
                    </View>
                  ) : null}
                  {result.wheelType ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="loop" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Wheels</Text>
                      <Text style={styles.aiValue}>{result.wheelType}</Text>
                    </View>
                  ) : null}
                  {result.baseColor ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="square" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Base</Text>
                      <Text style={styles.aiValue}>{result.baseColor}</Text>
                    </View>
                  ) : null}
                  {result.tampos ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="brush" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Tampos</Text>
                      <Text style={styles.aiValue}>{result.tampos}</Text>
                    </View>
                  ) : null}
                  {result.barcode ? (
                    <View style={styles.aiRow}>
                      <MaterialCommunityIcons name="barcode" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Barcode</Text>
                      <Text style={styles.aiValue}>{result.barcode}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Car History */}
              {result.history ? (
                <View style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <MaterialIcons name="history-edu" size={18} color="#FFD700" />
                    <Text style={styles.historyTitle}>Car History & Background</Text>
                  </View>
                  <Text style={styles.historyText}>{result.history}</Text>
                </View>
              ) : null}

              {/* Price Range */}
              {result.priceRange && result.priceRange.min > 0 && (
                <View style={styles.priceRangeCard}>
                  <View style={styles.priceRangeHeader}>
                    <MaterialIcons name="show-chart" size={18} color="#4caf50" />
                    <Text style={styles.priceRangeTitle}>Market Value (INR)</Text>
                  </View>
                  <View style={styles.priceRangeRow}>
                    <View style={styles.priceRangeBox}>
                      <Text style={styles.priceRangeLabel}>Low</Text>
                      <Text style={styles.priceRangeValue}>₹{result.priceRange.min.toLocaleString('en-IN')}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={20} color="#555" />
                    <View style={styles.priceRangeBox}>
                      <Text style={styles.priceRangeLabel}>Avg</Text>
                      <Text style={[styles.priceRangeValue, { color: '#4caf50' }]}>₹{result.priceRange.avg.toLocaleString('en-IN')}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={20} color="#555" />
                    <View style={styles.priceRangeBox}>
                      <Text style={styles.priceRangeLabel}>High</Text>
                      <Text style={styles.priceRangeValue}>₹{result.priceRange.max.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                  {result.priceSources && result.priceSources.length > 0 && (
                    <View style={styles.priceSourcesList}>
                      <Text style={styles.priceSourcesHeader}>Collector References</Text>
                      {result.priceSources.map((source, idx) => (
                        <View key={idx} style={styles.priceSourceItem}>
                          <View style={styles.priceSourceLeft}>
                            <Text style={styles.priceSourceName}>{source.source || 'Collector'}</Text>
                            <Text style={styles.priceSourceRef}>{source.reference || ''}</Text>
                          </View>
                          <Text style={styles.priceSourcePrice}>₹{source.price.toLocaleString('en-IN')}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Market Info */}
              {result.searchResults ? (
                <View style={styles.infoCard}>
                  <View style={styles.infoHeader}>
                    <MaterialIcons name="trending-up" size={18} color="#4da6ff" />
                    <Text style={styles.infoTitle}>Market Info</Text>
                  </View>
                  <Text style={styles.infoText}>{result.searchResults}</Text>
                </View>
              ) : null}

              {/* Research Sources */}
              {researchData && researchData.researchSources && researchData.researchSources.length > 0 && (
                <View style={styles.researchCard}>
                  <View style={styles.researchHeader}>
                    <MaterialIcons name="public" size={18} color="#4da6ff" />
                    <Text style={styles.researchTitle}>Internet Research</Text>
                    <View style={styles.researchBadge}>
                      <Text style={styles.researchBadgeText}>{researchData.researchSources.length} sources</Text>
                    </View>
                  </View>

                  {researchData.release && researchData.release.year && (
                    <View style={styles.researchSection}>
                      <View style={styles.researchRow}>
                        <MaterialIcons name="calendar-today" size={14} color="#FFD700" />
                        <Text style={styles.researchLabel}>Release Year</Text>
                        <Text style={styles.researchValue}>{researchData.release.year}</Text>
                      </View>
                      <Text style={styles.researchStatus}>
                        {researchData.release.status === 'CONFIRMED' ? `✓ Verified from ${researchData.release.sources.length} sources` : researchData.release.notes}
                      </Text>
                    </View>
                  )}

                  {researchData.market && researchData.market.salesCount > 0 && (
                    <View style={styles.researchSection}>
                      <View style={styles.researchRow}>
                        <MaterialIcons name="trending-up" size={14} color="#4caf50" />
                        <Text style={styles.researchLabel}>Market Data</Text>
                        <Text style={styles.researchValue}>{researchData.market.salesCount} observations</Text>
                      </View>
                      <Text style={styles.researchStatus}>{researchData.market.notes}</Text>
                    </View>
                  )}

                  <View style={styles.researchSourcesList}>
                    {researchData.researchSources.slice(0, 5).map((source: any, idx: number) => (
                      <View key={idx} style={styles.researchSourceItem}>
                        <View style={styles.researchSourceIcon}>
                          <MaterialIcons name={source.type === 'year' ? 'calendar-today' : source.type === 'price' ? 'attach-money' : 'public'} size={12} color="#4da6ff" />
                        </View>
                        <Text style={styles.researchSourceName} numberOfLines={1}>{source.title}</Text>
                      </View>
                    ))}
                  </View>

                  {researchData.lastResearched && (
                    <Text style={styles.researchTimestamp}>
                      Last researched: {new Date(researchData.lastResearched).toLocaleDateString('en-IN')}
                    </Text>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.garageButton} onPress={addToGarage}>
                  <MaterialCommunityIcons name="car" size={20} color="#fff" />
                  <Text style={styles.garageButtonText}>Add to Garage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.wishlistButton} onPress={addToWishlist}>
                  <MaterialIcons name="star" size={20} color="#fff" />
                  <Text style={styles.wishlistButtonText}>Add to Wishlist</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetButton} onPress={reset}>
                  <MaterialIcons name="camera-alt" size={18} color="#aaa" />
                  <Text style={styles.resetButtonText}>Scan Another</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>

    {/* ===== DUPLICATE ALERT MODAL ===== */}
    {showDupeModal && dupeAnalysis && pendingCar && (
      <View style={styles.dupeOverlay}>
        <View style={styles.dupeModal}>
          <View style={styles.dupeHeader}>
            <MaterialIcons name="content-copy" size={28} color="#FF9800" />
            <Text style={styles.dupeTitle}>Duplicate Found!</Text>
          </View>
          {/* Same color duplicates */}
          {dupeAnalysis.sameColorCount > 0 && (
            <>
              <View style={styles.dupeSectionRow}>
                <MaterialIcons name="repeat" size={16} color="#FF9800" />
                <Text style={styles.dupeSectionTitle}>Same color ({dupeAnalysis.sameColorCount}x)</Text>
              </View>
              {dupeAnalysis.exactDupes.map((dc) => (
                <View key={dc.id} style={styles.dupeCard}>
                  {dc.images && dc.images.length > 0 ? (
                    <Image source={{ uri: dc.images[0] }} style={styles.dupeThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.dupeThumb, styles.dupeThumbPlaceholder]}>
                      <MaterialCommunityIcons name="car" size={20} color="#2a2a4a" />
                    </View>
                  )}
                  <View style={styles.dupeCardLeft}>
                    <Text style={styles.dupeName}>{dc.name}</Text>
                    <Text style={styles.dupeInfo}>{dc.year} · {dc.color} · Qty: {dc.quantity || 1}</Text>
                    <Text style={styles.dupePrice}>Paid: ₹{(dc.buyPrice || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dupeViewBtn}
                    onPress={() => {
                      setShowDupeModal(false);
                      setDupeAnalysis(null);
                      setPendingCar(null);
                      router.push({ pathname: '/car/[id]', params: { id: dc.id, source: 'garage' } });
                    }}
                  >
                    <Text style={styles.dupeViewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
          {/* Different color variants */}
          {dupeAnalysis.differentColorCount > 0 && (
            <>
              <View style={styles.dupeSectionRow}>
                <MaterialIcons name="palette" size={16} color="#42A5F5" />
                <Text style={[styles.dupeSectionTitle, { color: '#42A5F5' }]}>Different color ({dupeAnalysis.differentColorCount}x)</Text>
              </View>
              {dupeAnalysis.colorVariants.map((dc) => (
                <View key={dc.id} style={styles.dupeCard}>
                  {dc.images && dc.images.length > 0 ? (
                    <Image source={{ uri: dc.images[0] }} style={styles.dupeThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.dupeThumb, styles.dupeThumbPlaceholder]}>
                      <MaterialCommunityIcons name="car" size={20} color="#2a2a4a" />
                    </View>
                  )}
                  <View style={styles.dupeCardLeft}>
                    <Text style={styles.dupeName}>{dc.name}</Text>
                    <Text style={styles.dupeInfo}>{dc.year} · {dc.color} · Qty: {dc.quantity || 1}</Text>
                    <Text style={styles.dupePrice}>Paid: ₹{(dc.buyPrice || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.dupeViewBtn, { backgroundColor: '#1565C0' }]}
                    onPress={() => {
                      setShowDupeModal(false);
                      setDupeAnalysis(null);
                      setPendingCar(null);
                      router.push({ pathname: '/car/[id]', params: { id: dc.id, source: 'garage' } });
                    }}
                  >
                    <Text style={styles.dupeViewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
          <Text style={styles.dupeHint}>Add as a new purchase to track separate buy rates?</Text>
          <View style={styles.dupeActions}>
            <TouchableOpacity
              style={styles.dupeAddBtn}
              onPress={() => doAddCar(pendingCar)}
            >
              <MaterialIcons name="add-circle" size={18} color="#fff" />
              <Text style={styles.dupeAddBtnText}>Add as New Purchase</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dupeCancelBtn}
              onPress={() => {
                setShowDupeModal(false);
                setDupeAnalysis(null);
                setPendingCar(null);
              }}
            >
              <Text style={styles.dupeCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionCard: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  actionLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  actionDesc: { fontSize: 12, color: '#666', marginTop: 4 },
  infoCard: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(77, 166, 255, 0.1)',
    borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1,
    borderColor: 'rgba(77, 166, 255, 0.3)',
  },
  infoText: { flex: 1, fontSize: 13, color: '#4da6ff', lineHeight: 18 },
  miniPreview: {
    width: '100%', height: 140, borderRadius: 14,
    backgroundColor: '#1a1a2e', marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  statusCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  loadingContainer: {
    position: 'relative', width: 80, height: 80,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingCarIcon: { position: 'absolute' },
  statusText: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 16 },
  statusDesc: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },
  errorCard: {
    backgroundColor: '#2a1a1a', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#4a2222',
  },
  errorText: { fontSize: 14, color: '#ff6b6b', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e63946', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16,
  },
  retryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // AI Section
  aiSection: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1.5, borderColor: '#4da6ff',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aiTitle: { fontSize: 16, fontWeight: '800', color: '#4da6ff', flex: 1 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confHigh: { backgroundColor: 'rgba(76, 175, 80, 0.2)' },
  confMed: { backgroundColor: 'rgba(255, 152, 0, 0.2)' },
  confLow: { backgroundColor: 'rgba(244, 67, 54, 0.2)' },
  confText: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'capitalize' },
  carName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  carSub: { fontSize: 15, color: '#aaa', marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#222',
  },
  tagRarity: { backgroundColor: 'rgba(255, 215, 0, 0.15)' },
  tagCondition: { backgroundColor: 'rgba(76, 175, 80, 0.15)' },
  tagSeries: { backgroundColor: 'rgba(156, 39, 176, 0.15)' },
  tagVariant: { backgroundColor: 'rgba(77, 166, 255, 0.15)' },
  tagText: { fontSize: 11, color: '#ccc', fontWeight: '600' },
  conditionNotes: { fontSize: 11, color: '#888', marginBottom: 10, fontStyle: 'italic', lineHeight: 16 },
  aiDetails: {},
  aiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#222',
  },
  aiLabel: { fontSize: 13, color: '#888', width: 70 },
  aiValue: { fontSize: 13, color: '#fff', fontWeight: '600', flex: 1, textAlign: 'right' },
  // History card
  historyCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#FFD700',
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: '#FFD700' },
  historyText: { fontSize: 13, color: '#ccc', lineHeight: 20 },
  // Price range card
  priceRangeCard: {
    backgroundColor: '#0a2a1a', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#1b5e20',
  },
  priceRangeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  priceRangeTitle: { fontSize: 14, fontWeight: '700', color: '#4caf50' },
  priceRangeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  priceRangeBox: { alignItems: 'center', flex: 1 },
  priceRangeLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  priceRangeValue: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4 },
  priceSourcesList: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#1b5e20',
  },
  priceSourcesHeader: {
    fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8,
  },
  priceSourceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(27, 94, 32, 0.3)',
  },
  priceSourceLeft: { flex: 1, marginRight: 12 },
  priceSourceName: { fontSize: 12, color: '#ccc', fontWeight: '600' },
  priceSourceRef: { fontSize: 10, color: '#666', marginTop: 1 },
  priceSourcePrice: { fontSize: 13, color: '#4caf50', fontWeight: '800' },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff' },
  resultActions: { gap: 10, marginTop: 4 },
  garageButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1b5e20', borderRadius: 12, padding: 16,
  },
  garageButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  wishlistButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#333', borderRadius: 12, padding: 16,
  },
  wishlistButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a4a',
  },
  resetButtonText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  // Research section
  researchCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#4da6ff',
  },
  researchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  researchTitle: { fontSize: 15, fontWeight: '800', color: '#4da6ff', flex: 1 },
  researchBadge: {
    backgroundColor: 'rgba(77, 166, 255, 0.2)', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 6,
  },
  researchBadgeText: { fontSize: 10, color: '#4da6ff', fontWeight: '600' },
  researchSection: {
    backgroundColor: '#0f0f23', borderRadius: 10, padding: 12,
    marginBottom: 10,
  },
  researchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  researchLabel: { fontSize: 12, color: '#888', flex: 1 },
  researchValue: { fontSize: 14, color: '#fff', fontWeight: '700' },
  researchStatus: { fontSize: 11, color: '#4caf50', marginTop: 4, fontStyle: 'italic' },
  researchSourcesList: { marginTop: 10 },
  researchSourceItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 4,
  },
  researchSourceIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(77, 166, 255, 0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  researchSourceName: { fontSize: 11, color: '#aaa', flex: 1 },
  researchTimestamp: {
    fontSize: 10, color: '#555', marginTop: 8,
    textAlign: 'right', fontStyle: 'italic',
  },

  // Duplicate Alert Modal
  dupeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center',
    zIndex: 100, padding: 20,
  },
  dupeModal: {
    backgroundColor: '#1a1a2e', borderRadius: 18, padding: 20,
    width: '100%', borderWidth: 2, borderColor: '#FF9800', maxHeight: '80%',
  },
  dupeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dupeTitle: { fontSize: 20, fontWeight: '800', color: '#FF9800' },
  dupeSectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, marginBottom: 6,
  },
  dupeSectionTitle: { fontSize: 13, fontWeight: '700', color: '#FF9800' },
  dupeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f0f23',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#333', gap: 10,
  },
  dupeThumb: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: '#12122a',
  },
  dupeThumbPlaceholder: {
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  dupeCardLeft: { flex: 1 },
  dupeName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dupeInfo: { fontSize: 11, color: '#888', marginTop: 2 },
  dupePrice: { fontSize: 12, color: '#4caf50', fontWeight: '600', marginTop: 2 },
  dupeViewBtn: {
    backgroundColor: '#4da6ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  dupeViewBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  dupeHint: { fontSize: 12, color: '#FF9800', marginTop: 8, marginBottom: 12, textAlign: 'center' },
  dupeActions: { gap: 8 },
  dupeAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e65100', borderRadius: 12, padding: 14,
  },
  dupeAddBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dupeCancelBtn: {
    alignItems: 'center', padding: 12, borderRadius: 12,
  },
  dupeCancelBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
});

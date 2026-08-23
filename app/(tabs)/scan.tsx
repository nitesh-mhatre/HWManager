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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { getSettings, findDuplicateCars, addCar } from '../../src/services/storage';
import { scanCarFromImage, scanBulkFromImage, searchCarValue } from '../../src/services/nvidia';
import { ScanResult, HotWheelCar, PurchaseEntry } from '../../src/types';
import AdBanner from '../../src/components/AdBanner';

type ScanPhase = 'pick' | 'analyzing' | 'result' | 'searching';
type ScanMode = 'single' | 'bulk';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ScanScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<ScanPhase>('pick');
  const [scanMode, setScanMode] = useState<ScanMode>('single');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');

  // Duplicate detection
  const [duplicateCars, setDuplicateCars] = useState<HotWheelCar[]>([]);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);

  // AI-identified results
  const [result, setResult] = useState<ScanResult | null>(null);
  const [bulkResults, setBulkResults] = useState<ScanResult[]>([]);
  const [currentCarIndex, setCurrentCarIndex] = useState(0);

  // User-editable fields (year, buy price, expected sell price)
  const [userYear, setUserYear] = useState('');
  const [userBuyPrice, setUserBuyPrice] = useState('');
  const [userExpectedPrice, setUserExpectedPrice] = useState('');

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
    // Reset user fields
    setUserYear('');
    setUserBuyPrice('');
    setUserExpectedPrice('');
    try {
      const settings = await getSettings();
      if (!settings) {
        Alert.alert('Not configured', 'Please set up your API key first.', [
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings') },
        ]);
        setPhase('pick');
        return;
      }

      if (scanMode === 'bulk') {
        const results = await scanBulkFromImage(settings, uri);
        if (results.length === 0 || (results.length === 1 && results[0].name === 'Unknown')) {
          setError('Could not read the card. Try a clearer, well-lit photo of the card front.');
          setPhase('result');
          return;
        }
        setBulkResults(results);
        setCurrentCarIndex(0);
        if (results[0]?.year && results[0].year !== 'Unknown') {
          setUserYear(results[0].year);
        }
      } else {
        const scanResult = await scanCarFromImage(settings, uri);
        if (scanResult.name === 'Unknown' && scanResult.series === '') {
          setError('Could not read the card. Try a clearer, well-lit photo of the card front.');
          setPhase('result');
          return;
        }
        setResult(scanResult);
        if (scanResult.year && scanResult.year !== 'Unknown') {
          setUserYear(scanResult.year);
        }
      }
      setPhase('result');
    } catch (e: any) {
      setError(e.message);
      setPhase('result');
      setResult(null);
      setBulkResults([]);
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

  const getCurrentResult = () => {
    if (scanMode === 'bulk' && bulkResults.length > 0) {
      return bulkResults[currentCarIndex];
    }
    return result;
  };

  const buildCar = (r: ScanResult): HotWheelCar => {
    const finalYear = userYear.trim() || r.year || '';
    const finalBuyPrice = parseFloat(userBuyPrice) || 0;
    const finalExpectedPrice = parseFloat(userExpectedPrice) || 0;
    const purchaseId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const purchase: PurchaseEntry = finalBuyPrice > 0 ? {
      id: purchaseId,
      buyPrice: finalBuyPrice,
      quantity: 1,
      date: new Date().toISOString(),
      source: 'Scanned',
      condition: r.condition || 'Mint',
      notes: '',
    } : undefined as any;

    return {
      id: purchaseId,
      name: r.name || 'Unknown Car',
      year: finalYear,
      series: r.series || '',
      color: r.color || '',
      model: r.model || '',
      scale: r.scale || '1:64',
      rarity: r.rarity || '',
      condition: r.condition || 'Mint',
      buyPrice: finalBuyPrice,
      expectedPrice: finalExpectedPrice,
      priceINR: finalExpectedPrice || r.priceINR || 0,
      priceRange: r.priceRange || { min: 0, max: 0, avg: 0 },
      priceSources: r.priceSources || [],
      remarks: r.searchResults || '',
      images: imageUri ? [imageUri] : [],
      inCollection: true,
      dateAdded: new Date().toISOString(),
      barcode: r.barcode || '',
      manufacturer: r.manufacturer || 'Mattel',
      tampos: r.tampos || '',
      wheelType: r.wheelType || '',
      baseColor: r.baseColor || '',
      history: r.history || '',
      status: r.status || 'UNKNOWN',
      matchScore: r.matchScore || 0,
      quantity: finalBuyPrice > 0 ? 1 : 0,
      purchaseHistory: purchase ? [purchase] : [],
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

  const checkDuplicatesAndAdd = async (toGarage: boolean) => {
    const r = getCurrentResult();
    if (!r) return;
    const car = buildCar(r);
    // Duplicate detection
    const dupes = await findDuplicateCars(car.name, car.model, car.year, car.color);
    if (dupes.length > 0) {
      setDuplicateCars(dupes);
      setShowDuplicateAlert(true);
      // Store the car to add for later
      setPendingCar({ car, toGarage });
      return;
    }
    await doAddCar(car, toGarage);
  };

  const [pendingCar, setPendingCar] = useState<{ car: HotWheelCar; toGarage: boolean } | null>(null);

  const doAddCar = async (car: HotWheelCar, toGarage: boolean) => {
    await addCar(car);
    setShowDuplicateAlert(false);
    setDuplicateCars([]);
    Alert.alert('Added!', `${car.name} (${car.year}) — ₹${car.priceINR} added to Garage!`, [
      { text: 'View Garage', onPress: () => router.push('/(tabs)/garage') },
      {
        text: scanMode === 'bulk' && currentCarIndex < bulkResults.length - 1 ? 'Next Car' : 'Done',
        onPress: () => {
          if (scanMode === 'bulk' && currentCarIndex < bulkResults.length - 1) {
            goToNextCar();
          } else {
            reset();
          }
        },
      },
    ]);
  };

  const addToGarage = async () => {
    await checkDuplicatesAndAdd(true);
  };

  const addToWishlist = async () => {
    const r = getCurrentResult();
    if (!r) return;
    const car = { ...buildCar(r), inCollection: false, condition: '' };
    await addCar(car);
    Alert.alert('Added to Wishlist!', `${car.name} — ₹${car.priceINR}`, [
      { text: 'View Wishlist', onPress: () => router.push('/(tabs)/wishlist') },
      {
        text: scanMode === 'bulk' && currentCarIndex < bulkResults.length - 1 ? 'Next Car' : 'Done',
        onPress: () => {
          if (scanMode === 'bulk' && currentCarIndex < bulkResults.length - 1) {
            goToNextCar();
          } else {
            reset();
          }
        },
      },
    ]);
  };

  const goToNextCar = () => {
    if (currentCarIndex < bulkResults.length - 1) {
      setCurrentCarIndex(currentCarIndex + 1);
      // Pre-fill year for next car
      const next = bulkResults[currentCarIndex + 1];
      if (next?.year && next.year !== 'Unknown') {
        setUserYear(next.year);
      } else {
        setUserYear('');
      }
      setUserBuyPrice('');
      setUserExpectedPrice('');
    }
  };

  const goToPrevCar = () => {
    if (currentCarIndex > 0) {
      setCurrentCarIndex(currentCarIndex - 1);
      const prev = bulkResults[currentCarIndex - 1];
      if (prev?.year && prev.year !== 'Unknown') {
        setUserYear(prev.year);
      } else {
        setUserYear('');
      }
      setUserBuyPrice('');
      setUserExpectedPrice('');
    }
  };

  const reset = () => {
    setPhase('pick');
    setImageUri(null);
    setResult(null);
    setBulkResults([]);
    setCurrentCarIndex(0);
    setError('');
    setSearchQuery('');
    setSearchResult('');
    setUserYear('');
    setUserBuyPrice('');
    setUserExpectedPrice('');
  };

  const currentResult = getCurrentResult();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="barcode-scan" size={32} color="#e63946" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Scan Car</Text>
            <Text style={styles.headerSub}>AI reads the card · You enter year & price</Text>
          </View>
        </View>
      </View>

      {/* ═══ PICK PHASE ═══ */}
      {phase === 'pick' && (
        <>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />}

          {/* Scan mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, scanMode === 'single' && styles.modeBtnActive]}
              onPress={() => setScanMode('single')}
            >
              <MaterialIcons name="photo" size={18} color={scanMode === 'single' ? '#fff' : '#888'} />
              <Text style={[styles.modeBtnText, scanMode === 'single' && styles.modeBtnTextActive]}>Single Car</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, scanMode === 'bulk' && styles.modeBtnActive]}
              onPress={() => setScanMode('bulk')}
            >
              <MaterialIcons name="photo-library" size={18} color={scanMode === 'bulk' ? '#fff' : '#888'} />
              <Text style={[styles.modeBtnText, scanMode === 'bulk' && styles.modeBtnTextActive]}>Bulk Scan</Text>
            </TouchableOpacity>
          </View>

          {scanMode === 'bulk' && (
            <View style={styles.bulkHint}>
              <MaterialIcons name="info-outline" size={16} color="#4da6ff" />
              <Text style={styles.bulkHintText}>
                Point camera at multiple cars — AI will identify each one
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(true)}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(230, 57, 70, 0.15)' }]}>
                <MaterialIcons name="camera-alt" size={28} color="#e63946" />
              </View>
              <Text style={styles.actionLabel}>Take Photo</Text>
              <Text style={styles.actionDesc}>Use your camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => pickImage(false)}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(77, 166, 255, 0.15)' }]}>
                <MaterialIcons name="photo-library" size={28} color="#4da6ff" />
              </View>
              <Text style={styles.actionLabel}>Pick Image</Text>
              <Text style={styles.actionDesc}>From your gallery</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchSection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="search" size={18} color="#aaa" />
              <Text style={styles.sectionTitle}>Or search by name</Text>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="e.g., '1967 Custom Camaro'"
                  placeholderTextColor="#555"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity
                style={[styles.searchBtn, !searchQuery.trim() && styles.searchBtnDisabled]}
                onPress={handleSearch}
                disabled={!searchQuery.trim()}
              >
                <MaterialIcons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ═══ ANALYZING PHASE ═══ */}
      {phase === 'analyzing' && (
        <View style={styles.statusCard}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e63946" />
            <MaterialCommunityIcons name="car" size={40} color="#e63946" style={styles.loadingCarIcon} />
          </View>
          <Text style={styles.statusText}>
            {scanMode === 'bulk' ? 'AI scanning all cars...' : 'AI reading the card...'}
          </Text>
          <Text style={styles.statusDesc}>
            Detecting name, series, color, wheels, tampos, condition...
          </Text>
          {/* Google AdMob banner while AI is working */}
          <View style={styles.adWrapper}>
            <AdBanner />
          </View>
        </View>
      )}

      {phase === 'searching' && (
        <View style={styles.statusCard}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4da6ff" />
            <MaterialIcons name="trending-up" size={40} color="#4da6ff" style={styles.loadingCarIcon} />
          </View>
          <Text style={styles.statusText}>Searching market data</Text>
          {/* Google AdMob banner while searching */}
          <View style={styles.adWrapper}>
            <AdBanner />
          </View>
        </View>
      )}

      {/* ═══ RESULT PHASE ═══ */}
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
          ) : currentResult ? (
            <>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />}

              {/* Bulk scan car navigator */}
              {scanMode === 'bulk' && bulkResults.length > 1 && (
                <View style={styles.carNavigator}>
                  <TouchableOpacity
                    style={[styles.navBtn, currentCarIndex === 0 && styles.navBtnDisabled]}
                    onPress={goToPrevCar}
                    disabled={currentCarIndex === 0}
                  >
                    <MaterialIcons name="chevron-left" size={24} color={currentCarIndex === 0 ? '#333' : '#fff'} />
                  </TouchableOpacity>
                  <View style={styles.carDots}>
                    {bulkResults.map((_, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.dot, idx === currentCarIndex && styles.dotActive]}
                        onPress={() => setCurrentCarIndex(idx)}
                      >
                        <Text style={[styles.dotText, idx === currentCarIndex && styles.dotTextActive]}>
                          {idx + 1}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.navBtn, currentCarIndex === bulkResults.length - 1 && styles.navBtnDisabled]}
                    onPress={goToNextCar}
                    disabled={currentCarIndex === bulkResults.length - 1}
                  >
                    <MaterialIcons name="chevron-right" size={24} color={currentCarIndex === bulkResults.length - 1 ? '#333' : '#fff'} />
                  </TouchableOpacity>
                  <Text style={styles.carCounter}>
                    {currentCarIndex + 1}/{bulkResults.length}
                  </Text>
                </View>
              )}

              {/* ===== AI IDENTIFIED DETAILS ===== */}
              <View style={styles.aiSection}>
                <View style={styles.aiHeader}>
                  <MaterialCommunityIcons name="robot" size={18} color="#4da6ff" />
                  <Text style={styles.aiTitle}>AI Identified</Text>
                  <View style={[
                    styles.confidenceBadge,
                    currentResult.confidence === 'high' ? styles.confHigh :
                    currentResult.confidence === 'medium' ? styles.confMed : styles.confLow
                  ]}>
                    <Text style={styles.confText}>{currentResult.confidence || 'medium'}</Text>
                  </View>
                </View>

                <Text style={styles.carNameDisplay}>{currentResult.name || 'Unknown Car'}</Text>
                {currentResult.model ? (
                  <Text style={styles.carYearDisplay}>{currentResult.model}</Text>
                ) : null}

                {/* Tags */}
                <View style={styles.tags}>
                  {currentResult.rarity ? (
                    <View style={[styles.tag, styles.tagRarity]}>
                      <MaterialIcons name="star" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{currentResult.rarity}</Text>
                    </View>
                  ) : null}
                  {currentResult.condition ? (
                    <View style={[styles.tag, styles.tagCondition]}>
                      <MaterialIcons name="check-circle" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{currentResult.condition}</Text>
                    </View>
                  ) : null}
                  {currentResult.series ? (
                    <View style={[styles.tag, styles.tagSeries]}>
                      <MaterialIcons name="collections-bookmark" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{currentResult.series}</Text>
                    </View>
                  ) : null}
                  {currentResult.variant ? (
                    <View style={[styles.tag, styles.tagVariant]}>
                      <MaterialIcons name="palette" size={10} color="#ccc" />
                      <Text style={styles.tagText}>{currentResult.variant}</Text>
                    </View>
                  ) : null}
                </View>

                {currentResult.conditionNotes ? (
                  <Text style={styles.conditionNotes}>{currentResult.conditionNotes}</Text>
                ) : null}

                {/* All AI details */}
                <View style={styles.aiDetails}>
                  {currentResult.color ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="palette" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Color</Text>
                      <Text style={styles.aiValue}>{currentResult.color}</Text>
                    </View>
                  ) : null}
                  {currentResult.scale ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="straighten" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Scale</Text>
                      <Text style={styles.aiValue}>{currentResult.scale}</Text>
                    </View>
                  ) : null}
                  {currentResult.manufacturer ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="business" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Maker</Text>
                      <Text style={styles.aiValue}>{currentResult.manufacturer}</Text>
                    </View>
                  ) : null}
                  {currentResult.wheelType ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="loop" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Wheels</Text>
                      <Text style={styles.aiValue}>{currentResult.wheelType}</Text>
                    </View>
                  ) : null}
                  {currentResult.baseColor ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="square" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Base</Text>
                      <Text style={styles.aiValue}>{currentResult.baseColor}</Text>
                    </View>
                  ) : null}
                  {currentResult.tampos ? (
                    <View style={styles.aiRow}>
                      <MaterialIcons name="brush" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Tampos</Text>
                      <Text style={styles.aiValue}>{currentResult.tampos}</Text>
                    </View>
                  ) : null}
                  {currentResult.barcode ? (
                    <View style={styles.aiRow}>
                      <MaterialCommunityIcons name="barcode" size={14} color="#888" />
                      <Text style={styles.aiLabel}>Barcode</Text>
                      <Text style={styles.aiValue}>{currentResult.barcode}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* ===== USER INPUT FIELDS: Year, Buy Price, Expected Price ===== */}
              <View style={styles.userInputCard}>
                <View style={styles.userInputHeader}>
                  <MaterialIcons name="edit" size={18} color="#FFD700" />
                  <Text style={styles.userInputTitle}>Your Details</Text>
                  <Text style={styles.userInputHint}>Year · Buy Price · Expected Sell</Text>
                </View>

                {/* Year */}
                <View style={styles.userInputGroup}>
                  <View style={styles.userInputLabelRow}>
                    <MaterialIcons name="calendar-today" size={14} color="#FFD700" />
                    <Text style={styles.userInputLabel}>Year</Text>
                  </View>
                  <TextInput
                    style={styles.userInput}
                    placeholder='e.g. "2024"'
                    placeholderTextColor="#555"
                    value={userYear}
                    onChangeText={setUserYear}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Buy Price */}
                <View style={styles.userInputGroup}>
                  <View style={styles.userInputLabelRow}>
                    <MaterialIcons name="attach-money" size={14} color="#4da6ff" />
                    <Text style={styles.userInputLabel}>Buy Price (₹)</Text>
                  </View>
                  <TextInput
                    style={styles.userInput}
                    placeholder='What you paid, e.g. "179"'
                    placeholderTextColor="#555"
                    value={userBuyPrice}
                    onChangeText={setUserBuyPrice}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Expected Sell Price */}
                <View style={styles.userInputGroup}>
                  <View style={styles.userInputLabelRow}>
                    <MaterialIcons name="trending-up" size={14} color="#4caf50" />
                    <Text style={styles.userInputLabel}>Expected Sell Price (₹)</Text>
                  </View>
                  <TextInput
                    style={styles.userInput}
                    placeholder='Expected market value, e.g. "350"'
                    placeholderTextColor="#555"
                    value={userExpectedPrice}
                    onChangeText={setUserExpectedPrice}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* ROI Preview */}
                {userBuyPrice && userExpectedPrice && parseFloat(userBuyPrice) > 0 ? (
                  <View style={styles.roiPreview}>
                    <MaterialIcons name="show-chart" size={16} color={
                      parseFloat(userExpectedPrice) >= parseFloat(userBuyPrice) ? '#4caf50' : '#e63946'
                    } />
                    <Text style={styles.roiLabel}>ROI:</Text>
                    <Text style={[styles.roiValue, {
                      color: parseFloat(userExpectedPrice) >= parseFloat(userBuyPrice) ? '#4caf50' : '#e63946'
                    }]}>
                      {(((parseFloat(userExpectedPrice) - parseFloat(userBuyPrice)) / parseFloat(userBuyPrice)) * 100).toFixed(1)}%
                    </Text>
                    <Text style={styles.roiProfit}>
                      ({parseFloat(userExpectedPrice) >= parseFloat(userBuyPrice) ? '+' : ''}
                      ₹{(parseFloat(userExpectedPrice) - parseFloat(userBuyPrice)).toLocaleString('en-IN')})
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* ===== CAR HISTORY ===== */}
              {currentResult.history ? (
                <View style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <MaterialIcons name="history-edu" size={18} color="#FFD700" />
                    <Text style={styles.historyTitle}>Car History</Text>
                  </View>
                  <Text style={styles.historyText}>{currentResult.history}</Text>
                </View>
              ) : null}

              {searchResult ? (
                <View style={styles.infoCard}>
                  <View style={styles.infoHeader}>
                    <MaterialIcons name="search" size={18} color="#4da6ff" />
                    <Text style={styles.infoTitle}>Search Results</Text>
                  </View>
                  <Text style={styles.infoText}>{searchResult}</Text>
                </View>
              ) : null}

              {/* Action buttons */}
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.garageButton} onPress={addToGarage}>
                  <MaterialCommunityIcons name="car" size={20} color="#fff" />
                  <Text style={styles.garageButtonText}>
                    {scanMode === 'bulk' && currentCarIndex < bulkResults.length - 1
                      ? `Save & Next (${bulkResults.length - currentCarIndex - 1} left)`
                      : 'Add to Garage'}
                  </Text>
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

              {/* ===== DUPLICATE ALERT MODAL ===== */}
              {showDuplicateAlert && duplicateCars.length > 0 && (
                <View style={styles.dupeOverlay}>
                  <View style={styles.dupeModal}>
                    <View style={styles.dupeHeader}>
                      <MaterialIcons name="content-copy" size={28} color="#FF9800" />
                      <Text style={styles.dupeTitle}>Duplicate Found!</Text>
                    </View>
                    <Text style={styles.dupeDesc}>
                      You already have {duplicateCars.length} of this car in your collection:
                    </Text>
                    {duplicateCars.map((dc) => (
                      <View key={dc.id} style={styles.dupeCard}>
                        <View style={styles.dupeCardLeft}>
                          <Text style={styles.dupeName}>{dc.name}</Text>
                          <Text style={styles.dupeInfo}>{dc.year} · {dc.color} · Qty: {dc.quantity || 1}</Text>
                          <Text style={styles.dupePrice}>Paid: ₹{(dc.buyPrice || 0).toLocaleString('en-IN')}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.dupeViewBtn}
                          onPress={() => {
                            setShowDuplicateAlert(false);
                            router.push({ pathname: '/car/[id]', params: { id: dc.id, source: 'garage' } });
                          }}
                        >
                          <Text style={styles.dupeViewBtnText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <Text style={styles.dupeHint}>Add as a new purchase to track separate buy rates?</Text>
                    <View style={styles.dupeActions}>
                      <TouchableOpacity
                        style={styles.dupeAddBtn}
                        onPress={() => {
                          if (pendingCar) doAddCar(pendingCar.car, pendingCar.toGarage);
                        }}
                      >
                        <MaterialIcons name="add-circle" size={18} color="#fff" />
                        <Text style={styles.dupeAddBtnText}>Add as New Purchase</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dupeCancelBtn}
                        onPress={() => {
                          setShowDuplicateAlert(false);
                          setDuplicateCars([]);
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
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  preview: {
    width: '100%', height: 200, borderRadius: 14,
    backgroundColor: '#1a1a2e', marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  miniPreview: {
    width: '100%', height: 140, borderRadius: 14,
    backgroundColor: '#1a1a2e', marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  // Mode toggle
  modeToggle: {
    flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 12,
    padding: 4, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a4a',
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  modeBtnActive: { backgroundColor: '#e63946' },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#888' },
  modeBtnTextActive: { color: '#fff' },
  bulkHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(77, 166, 255, 0.1)', borderRadius: 8,
    padding: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(77, 166, 255, 0.3)',
  },
  bulkHintText: { fontSize: 12, color: '#4da6ff', flex: 1 },
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
  searchSection: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#aaa' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInputWrapper: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, borderWidth: 1, borderColor: '#333', paddingHorizontal: 12,
  },
  searchInput: { color: '#fff', fontSize: 14, paddingVertical: 12 },
  searchBtn: {
    backgroundColor: '#e63946', borderRadius: 12, width: 48, height: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
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
  adWrapper: { marginTop: 16, width: '100%' },
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
  // Bulk car navigator
  carNavigator: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e',
    borderRadius: 12, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnDisabled: { backgroundColor: '#1a1a2e' },
  carDots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  dotActive: { backgroundColor: '#e63946' },
  dotText: { fontSize: 12, color: '#888', fontWeight: '600' },
  dotTextActive: { color: '#fff', fontWeight: '800' },
  carCounter: { fontSize: 12, color: '#888', marginLeft: 8, fontWeight: '600' },
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
  carNameDisplay: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  carYearDisplay: { fontSize: 15, color: '#aaa', marginBottom: 10 },
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

  // User Input Card (Year, Buy Price, Expected Price)
  userInputCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1.5, borderColor: '#FFD700',
  },
  userInputHeader: { marginBottom: 12 },
  userInputTitle: { fontSize: 16, fontWeight: '800', color: '#FFD700', marginTop: 2 },
  userInputHint: { fontSize: 11, color: '#888', marginTop: 2 },
  userInputGroup: { marginBottom: 10 },
  userInputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  userInputLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase' },
  userInput: {
    backgroundColor: '#0f0f23', borderRadius: 10, borderWidth: 1, borderColor: '#FFD700',
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16, fontWeight: '600',
  },
  roiPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f0f23', borderRadius: 10, padding: 12, marginTop: 4,
  },
  roiLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  roiValue: { fontSize: 18, fontWeight: '900', flex: 1 },
  roiProfit: { fontSize: 13, color: '#888' },

  // History card
  historyCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#FFD700',
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: '#FFD700' },
  historyText: { fontSize: 13, color: '#ccc', lineHeight: 20 },

  // Info card
  infoCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff' },
  infoText: { fontSize: 13, color: '#aaa', lineHeight: 20 },

  // Action buttons
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

  // Duplicate alert modal
  dupeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center',
    zIndex: 100, padding: 20,
  },
  dupeModal: {
    backgroundColor: '#1a1a2e', borderRadius: 18, padding: 20,
    width: '100%', borderWidth: 2, borderColor: '#FF9800',
  },
  dupeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dupeTitle: { fontSize: 20, fontWeight: '800', color: '#FF9800' },
  dupeDesc: { fontSize: 13, color: '#aaa', marginBottom: 12, lineHeight: 18 },
  dupeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f0f23',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#333',
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

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { addCar, getSettings, analyzeDuplicateDetails, isManualMode, getAllCars } from '../../src/services/storage';
import { HotWheelCar } from '../../src/types';
import { useTheme } from '../../src/context/ThemeContext';
import { getAppStyles } from '../../src/styles/themeStyles';

type InputMode = 'choose' | 'manual';

export default function AddScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const appStyles = getAppStyles(colors);
  const [inputMode, setInputMode] = useState<InputMode>('choose');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [appIsManual, setAppIsManual] = useState(false);

  // Duplicate detection modal
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeAnalysis, setDupeAnalysis] = useState<import('../../src/services/storage').DuplicateAnalysis | null>(null);  const [pendingCar, setPendingCar] = useState<HotWheelCar | null>(null);
  const [recentCars, setRecentCars] = useState<HotWheelCar[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecent = useCallback(async () => {
    const all = await getAllCars();
    setRecentCars(all.slice(-5).reverse());
  }, []);

  useEffect(() => {
    loadRecent();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecent();
    setRefreshing(false);
  }, [loadRecent]);


  // Manual entry fields
  const [manualName, setManualName] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualSeries, setManualSeries] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualScale, setManualScale] = useState('1:64');
  const [manualRarity, setManualRarity] = useState('');
  const [manualCondition, setManualCondition] = useState('Mint');
  const [manualBuyPrice, setManualBuyPrice] = useState('');
  const [manualMarketPrice, setManualMarketPrice] = useState('');
  const [manualManufacturer, setManualManufacturer] = useState('Mattel');
  const [manualTampos, setManualTampos] = useState('');
  const [manualWheelType, setManualWheelType] = useState('');
  const [manualBaseColor, setManualBaseColor] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualRemarks, setManualRemarks] = useState('');
  const [manualCaseCode, setManualCaseCode] = useState('');
  const [manualToyNumber, setManualToyNumber] = useState('');
  const [manualPackaging, setManualPackaging] = useState('');
  const [manualCardCondition, setManualCardCondition] = useState('');
  const [manualAllocation, setManualAllocation] = useState<'personal' | 'trade' | 'forSale'>('personal');
  const [manualStorageLocation, setManualStorageLocation] = useState('');
  const [manualAddTo, setManualAddTo] = useState<'garage' | 'wishlist'>('garage');

  useEffect(() => {
    (async () => {
      const manual = await isManualMode();
      setAppIsManual(manual);
      if (manual) {
        setInputMode('manual');
      }
    })();
  }, []);

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
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const buildManualCar = (): HotWheelCar => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    return {
      id,
      name: manualName.trim() || 'Unknown Car',
      year: manualYear.trim(),
      series: manualSeries.trim(),
      color: manualColor.trim(),
      model: manualModel.trim(),
      scale: manualScale.trim() || '1:64',
      rarity: manualRarity.trim(),
      condition: manualCondition.trim() || 'Mint',
      buyPrice: parseInt(manualBuyPrice) || 0,
      expectedPrice: parseInt(manualMarketPrice) || 0,
      priceINR: parseInt(manualMarketPrice) || 0,
      priceRange: { min: 0, max: 0, avg: parseInt(manualMarketPrice) || 0 },
      priceSources: [],
      remarks: manualRemarks.trim(),
      images: imageUri ? [imageUri] : [],
      inCollection: manualAddTo === 'garage',
      dateAdded: new Date().toISOString(),
      barcode: manualBarcode.trim(),
      manufacturer: manualManufacturer.trim() || 'Mattel',
      tampos: manualTampos.trim(),
      wheelType: manualWheelType.trim(),
      baseColor: manualBaseColor.trim(),
      history: '',
      status: 'MANUAL',
      matchScore: 100,
      quantity: 1,
      purchaseHistory: [],
      saleHistory: [],
      isSold: false,
      soldPrice: 0,
      soldDate: '',
      soldPlatform: '',
      soldNotes: '',
      storageLocation: manualStorageLocation.trim(),
      allocation: manualAllocation,
      cardCondition: manualCardCondition.trim(),
      packaging: manualPackaging.trim(),
      caseCode: manualCaseCode.trim(),
      toyNumber: manualToyNumber.trim(),
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
      { text: 'Done', onPress: resetManual },
    ]);
  };



  const saveManualCar = async () => {
    if (!manualName.trim()) {
      Alert.alert('Name Required', 'Please enter the car name.');
      return;
    }
    const car = buildManualCar();
    // Check for duplicates
    const analysis = await analyzeDuplicateDetails(car.name, car.model, car.year, car.color);
    if (analysis.sameColorCount > 0 || analysis.differentColorCount > 0) {
      setDupeAnalysis(analysis);
      setPendingCar(car);
      setShowDupeModal(true);
      return;
    }
    await addCar(car);
    Alert.alert('Added!', `${car.name} added to ${manualAddTo === 'garage' ? 'Garage' : 'Wishlist'}!`, [
      { text: `View ${manualAddTo === 'garage' ? 'Garage' : 'Wishlist'}`, onPress: () => router.push(manualAddTo === 'garage' ? '/(tabs)/garage' : '/(tabs)/wishlist') },
      { text: 'Done', onPress: resetManual },
    ]);
  };


  const resetManual = () => {
    setInputMode(appIsManual ? 'manual' : 'choose');
    setManualName('');
    setManualYear('');
    setManualSeries('');
    setManualColor('');
    setManualModel('');
    setManualScale('1:64');
    setManualRarity('');
    setManualCondition('Mint');
    setManualBuyPrice('');
    setManualMarketPrice('');
    setManualManufacturer('Mattel');
    setManualTampos('');
    setManualWheelType('');
    setManualBaseColor('');
    setManualBarcode('');
    setManualRemarks('');
    setManualCaseCode('');
    setManualToyNumber('');
    setManualPackaging('');
    setManualCardCondition('');
    setManualAllocation('personal');
    setManualStorageLocation('');
    setManualAddTo('garage');
    setImageUri(null);
  };

  const ManualEntryForm = () => (
    <View style={styles.manualForm}>
      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backToChooseBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => { setInputMode('choose'); resetManual(); }}
      >
        <MaterialIcons name="arrow-back" size={18} color={colors.info} />
        <Text style={[styles.backToChooseText, { color: colors.info }]}>Back</Text>
      </TouchableOpacity>

      {/* Basic Info */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>📝 Basic Info</Text>
        <View style={styles.formRow}>
          <Text style={[styles.formLabel, appStyles.textSecondary]}>Name *</Text>
          <TextInput style={[styles.formInput, appStyles.input]} value={manualName} onChangeText={setManualName} placeholder="e.g. Lamborghini Countach" placeholderTextColor={colors.textMuted} />
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Year</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualYear} onChangeText={setManualYear} placeholder="2024" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Model (Casting)</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualModel} onChangeText={setManualModel} placeholder="e.g. HW Modified" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Series</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualSeries} onChangeText={setManualSeries} placeholder="e.g. HW Exotics" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Color</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualColor} onChangeText={setManualColor} placeholder="e.g. Red" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Rarity</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualRarity} onChangeText={setManualRarity} placeholder="e.g. Super Treasure Hunt" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Scale</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualScale} onChangeText={setManualScale} placeholder="1:64" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
      </View>

      {/* Price Info */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>💰 Price</Text>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Buy Price (₹)</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualBuyPrice} onChangeText={setManualBuyPrice} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Market Value (₹)</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualMarketPrice} onChangeText={setManualMarketPrice} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>🔧 Details</Text>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Manufacturer</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualManufacturer} onChangeText={setManualManufacturer} placeholder="Mattel" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Condition</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualCondition} onChangeText={setManualCondition} placeholder="Mint" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Tampos</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualTampos} onChangeText={setManualTampos} placeholder="Decoration details" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Wheels</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualWheelType} onChangeText={setManualWheelType} placeholder="Wheel type" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Base Color</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualBaseColor} onChangeText={setManualBaseColor} placeholder="e.g. Chrome" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Barcode</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualBarcode} onChangeText={setManualBarcode} placeholder="UPC / EAN" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Case Code</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualCaseCode} onChangeText={setManualCaseCode} placeholder="A-Q" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Toy Number</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualToyNumber} onChangeText={setManualToyNumber} placeholder="e.g. 124/250" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
        <View style={styles.formRowHalf}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Packaging</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualPackaging} onChangeText={setManualPackaging} placeholder="longCard / shortCard" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formLabel, appStyles.textSecondary]}>Card Condition</Text>
            <TextInput style={[styles.formInput, appStyles.input]} value={manualCardCondition} onChangeText={setManualCardCondition} placeholder="mint / softCorner" placeholderTextColor={colors.textMuted} />
          </View>
        </View>
      </View>

      {/* Allocation & Storage */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>📦 Allocation</Text>
        <View style={styles.allocRow}>
          {(['personal', 'trade', 'forSale'] as const).map((a) => (
            <TouchableOpacity
              key={a}
              style={[styles.allocChip, manualAllocation === a && styles.allocChipActive]}
              onPress={() => setManualAllocation(a)}
            >
              <Text style={[styles.allocChipText, manualAllocation === a && styles.allocChipTextActive]}>
                {a === 'personal' ? 'Personal' : a === 'trade' ? 'Trade' : 'For Sale'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.formRow}>
          <Text style={[styles.formLabel, appStyles.textSecondary]}>Storage Location</Text>
          <TextInput style={[styles.formInput, appStyles.input]} value={manualStorageLocation} onChangeText={setManualStorageLocation} placeholder="e.g. Shelf 1 > Tub #4" placeholderTextColor={colors.textMuted} />
        </View>
      </View>

      {/* Remarks */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>📋 Notes</Text>
        <TextInput
          style={[styles.formInput, appStyles.input, { height: 60, textAlignVertical: 'top' }]}
          value={manualRemarks}
          onChangeText={setManualRemarks}
          placeholder="Additional notes about this car..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
      </View>

      {/* Add To */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>📌 Add To</Text>
        <View style={styles.allocRow}>
          <TouchableOpacity
            style={[styles.allocChip, manualAddTo === 'garage' && { backgroundColor: '#1b5e20', borderColor: '#4caf50' }]}
            onPress={() => setManualAddTo('garage')}
          >
            <MaterialCommunityIcons name="car" size={14} color={manualAddTo === 'garage' ? '#fff' : '#888'} />
            <Text style={[styles.allocChipText, manualAddTo === 'garage' && { color: '#fff' }]}>Garage</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.allocChip, manualAddTo === 'wishlist' && { backgroundColor: '#333', borderColor: '#FFD700' }]}
            onPress={() => setManualAddTo('wishlist')}
          >
            <MaterialIcons name="star" size={14} color={manualAddTo === 'wishlist' ? '#FFD700' : '#888'} />
            <Text style={[styles.allocChipText, manualAddTo === 'wishlist' && { color: '#FFD700' }]}>Wishlist</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo */}
      <View style={[styles.formSection, appStyles.card]}>
        <Text style={[styles.formSectionTitle, appStyles.textPrimary]}>📸 Photo (Optional)</Text>
        {imageUri ? (
          <View style={{ position: 'relative' }}>
            <Image source={{ uri: imageUri }} style={styles.miniPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setImageUri(null)}>
              <MaterialIcons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoPickRow}>
            <TouchableOpacity style={styles.photoPickBtn} onPress={() => pickImage(true)}>
              <MaterialIcons name="camera-alt" size={20} color="#e63946" />
              <Text style={styles.photoPickText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoPickBtn} onPress={() => pickImage(false)}>
              <MaterialIcons name="photo-library" size={20} color="#4da6ff" />
              <Text style={styles.photoPickText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={saveManualCar}>
        <MaterialIcons name="save" size={20} color="#fff" />
        <Text style={styles.saveButtonText}>Save Car</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialIcons name="add-circle" size={28} color="#e63946" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Add Car</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {inputMode === 'manual' ? 'Enter car details manually' : 'AI identifies all details from your photo'}
            </Text>
          </View>
          {!appIsManual && inputMode !== 'manual' && (
            <TouchableOpacity style={[styles.modeToggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setInputMode('manual')}>
              <MaterialIcons name="edit" size={16} color={colors.info} />
              <Text style={[styles.modeToggleText, { color: colors.info }]}>Manual</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Input Mode: Choose */}
      {inputMode === 'choose' && (
        <>
          <TouchableOpacity
            style={[styles.actionCardFull, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setInputMode('manual')}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.infoBg }]}>
              <MaterialIcons name="edit" size={32} color={colors.info} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>Manual Entry</Text>
            <Text style={[styles.actionDesc, { color: colors.textMuted }]}>Fill in car details yourself</Text>
          </TouchableOpacity>

          <View style={[styles.infoCard, { backgroundColor: colors.infoBg, borderColor: 'rgba(77, 166, 255, 0.3)' }]}>  
            <MaterialIcons name="info-outline" size={16} color={colors.info} />
            <Text style={[styles.infoText, { color: colors.info }]}>
              Use Manual Entry to type in all car details. For AI scanning, use the Scan tab.
            </Text>
          </View>
        </>
      )}

      {/* Input Mode: Manual */}
      {inputMode === 'manual' && <ManualEntryForm />}

    </ScrollView>

    {/* ===== DUPLICATE ALERT MODAL ===== */}
    {showDupeModal && dupeAnalysis && pendingCar && (
      <View style={[styles.dupeOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.dupeModal, appStyles.card]}>
          <View style={styles.dupeHeader}>
            <MaterialIcons name="content-copy" size={28} color="#FF9800" />
            <Text style={styles.dupeTitle}>Duplicate Found!</Text>
          </View>
          {dupeAnalysis.sameColorCount > 0 && (
            <>
              <View style={styles.dupeSectionRow}>
                <MaterialIcons name="repeat" size={16} color="#FF9800" />
                <Text style={styles.dupeSectionTitle}>Same color ({dupeAnalysis.sameColorCount}x)</Text>
              </View>
              {dupeAnalysis.exactDupes.map((dc) => (
                <View key={dc.id} style={[styles.dupeCard, { backgroundColor: colors.inputBg, borderColor: colors.borderLight }]}>
                  {dc.images && dc.images.length > 0 ? (
                    <Image source={{ uri: dc.images[0] }} style={[styles.dupeThumb, { backgroundColor: colors.cardImageBg }]} resizeMode="cover" />
                  ) : (
                    <View style={[styles.dupeThumb, styles.dupeThumbPlaceholder, { backgroundColor: colors.cardImageBg, borderColor: colors.border }]}>  
                      <MaterialCommunityIcons name="car" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.dupeCardLeft}>
                    <Text style={[styles.dupeName, appStyles.textPrimary]}>{dc.name}</Text>
                    <Text style={[styles.dupeInfo, appStyles.textSecondary]}>{dc.year} · {dc.color} · Qty: {dc.quantity || 1}</Text>
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
          {dupeAnalysis.differentColorCount > 0 && (
            <>
              <View style={styles.dupeSectionRow}>
                <MaterialIcons name="palette" size={16} color="#42A5F5" />
                <Text style={[styles.dupeSectionTitle, { color: '#42A5F5' }]}>Different color ({dupeAnalysis.differentColorCount}x)</Text>
              </View>
              {dupeAnalysis.colorVariants.map((dc) => (
                <View key={dc.id} style={[styles.dupeCard, { backgroundColor: colors.inputBg, borderColor: colors.borderLight }]}>
                  {dc.images && dc.images.length > 0 ? (
                    <Image source={{ uri: dc.images[0] }} style={[styles.dupeThumb, { backgroundColor: colors.cardImageBg }]} resizeMode="cover" />
                  ) : (
                    <View style={[styles.dupeThumb, styles.dupeThumbPlaceholder, { backgroundColor: colors.cardImageBg, borderColor: colors.border }]}>  
                      <MaterialCommunityIcons name="car" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.dupeCardLeft}>
                    <Text style={[styles.dupeName, appStyles.textPrimary]}>{dc.name}</Text>
                    <Text style={[styles.dupeInfo, appStyles.textSecondary]}>{dc.year} · {dc.color} · Qty: {dc.quantity || 1}</Text>
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
  container: { flex: 1 },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  modeToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  modeToggleText: { fontSize: 12, fontWeight: '700', color: '#4da6ff' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionCard: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  actionCardFull: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
    marginBottom: 16,
  },
  backToChooseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, alignSelf: 'flex-start', marginBottom: 12,
  },
  backToChooseText: { fontSize: 14, fontWeight: '600' },
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
    marginBottom: 12, borderWidth: 1,
  },
  statusCard: {
    borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1,
  },
  loadingContainer: {
    position: 'relative', width: 80, height: 80,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingCarIcon: { position: 'absolute' },
  statusText: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  statusDesc: { fontSize: 13, marginTop: 6, textAlign: 'center' },
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
    borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1.5,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aiTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confHigh: { backgroundColor: 'rgba(76, 175, 80, 0.2)' },
  confMed: { backgroundColor: 'rgba(255, 152, 0, 0.2)' },
  confLow: { backgroundColor: 'rgba(244, 67, 54, 0.2)' },
  confText: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'capitalize' },
  carName: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  carSub: { fontSize: 15, marginBottom: 10 },
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
  aiLabel: { fontSize: 13, width: 70 },
  aiValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  // History card
  historyCard: {
    borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#FFD700',
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: '#FFD700' },
  historyText: { fontSize: 13, lineHeight: 20 },
  // Price range card
  priceRangeCard: {
    borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#1b5e20',
  },
  priceRangeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  priceRangeTitle: { fontSize: 14, fontWeight: '700', color: '#4caf50' },
  priceRangeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  priceRangeBox: { alignItems: 'center', flex: 1 },
  priceRangeLabel: { fontSize: 11, textTransform: 'uppercase' },
  priceRangeValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
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
  priceSourceName: { fontSize: 12, fontWeight: '600' },
  priceSourceRef: { fontSize: 10, marginTop: 1 },
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
    borderRadius: 12, padding: 16,
  },
  wishlistButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  resetButtonText: { fontSize: 14, fontWeight: '600' },
  // Research section
  researchCard: {
    borderRadius: 14, padding: 16,
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
    borderRadius: 10, padding: 12,
    marginBottom: 10,
  },
  researchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  researchLabel: { fontSize: 12, flex: 1 },
  researchValue: { fontSize: 14, fontWeight: '700' },
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
  researchSourceName: { fontSize: 11, flex: 1 },
  researchTimestamp: {
    fontSize: 10, color: '#555', marginTop: 8,
    textAlign: 'right', fontStyle: 'italic',
  },

  // Manual Entry Form
  manualForm: { gap: 12 },
  formSection: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  formSectionTitle: {
    fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12,
  },
  formRow: { marginBottom: 10 },
  formRowHalf: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  formLabel: {
    fontSize: 11, fontWeight: '600', color: '#aaa', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  formInput: {
    borderRadius: 10, borderWidth: 1,
    padding: 12, fontSize: 14,
  },
  allocRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  allocChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#222', borderWidth: 1, borderColor: '#333',
  },
  allocChipActive: { backgroundColor: '#e63946', borderColor: '#e63946' },
  allocChipText: { fontSize: 13, color: '#888', fontWeight: '600' },
  allocChipTextActive: { color: '#fff' },
  photoPickRow: {
    flexDirection: 'row', gap: 10,
  },
  photoPickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#222', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#333',
  },
  photoPickText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  removePhotoBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12,
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#e63946', borderRadius: 12, padding: 16, marginTop: 4,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Duplicate Alert Modal
  dupeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100, padding: 20,
  },
  dupeModal: {
    borderRadius: 18, padding: 20,
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
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, gap: 10,
  },
  dupeThumb: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: '#12122a',
  },
  dupeThumbPlaceholder: {
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  dupeCardLeft: { flex: 1 },
  dupeName: { fontSize: 14, fontWeight: '700' },
  dupeInfo: { fontSize: 11, marginTop: 2 },
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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getAllCars, updateCar, deleteCar, addPurchaseToCar, addSaleToCar, computeCarStats, getGarage, getWishlist, analyzeDuplicateDetails, DuplicateAnalysis } from '../../src/services/storage';
import { HotWheelCar, PurchaseEntry, SaleEntry } from '../../src/types';
import { searchCarValue } from '../../src/services/nvidia';
import { getSettings } from '../../src/services/storage';
import { useTheme } from '../../src/context/ThemeContext';
import { getAppStyles } from '../../src/styles/themeStyles';
import AdBanner from '../../src/components/AdBanner';

export default function CarDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const appStyles = getAppStyles(colors);
  const [car, setCar] = useState<HotWheelCar | null>(null);
  const [editing, setEditing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [siblingCars, setSiblingCars] = useState<HotWheelCar[]>([]);
  const [siblingIndex, setSiblingIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  // Photo change state
  const [newImageUri, setNewImageUri] = useState<string | null>(null);

  // Duplicate analysis state
  const [dupeAnalysis, setDupeAnalysis] = useState<DuplicateAnalysis | null>(null);

  // Refs to avoid stale closures in PanResponder
  const siblingIndexRef = useRef(0);
  const siblingCarsRef = useRef<HotWheelCar[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    siblingIndexRef.current = siblingIndex;
  }, [siblingIndex]);
  useEffect(() => {
    siblingCarsRef.current = siblingCars;
  }, [siblingCars]);

  // Editable fields
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [series, setSeries] = useState('');
  const [color, setColor] = useState('');
  const [model, setModel] = useState('');
  const [rarity, setRarity] = useState('');
  const [condition, setCondition] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [remarks, setRemarks] = useState('');
  const [inCollection, setInCollection] = useState(true);

  // Sold tracking
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldPrice, setSoldPrice] = useState('');
  const [soldPlatform, setSoldPlatform] = useState('');
  const [soldNotes, setSoldNotes] = useState('');

  // Purchase history modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('1');
  const [purchaseSource, setPurchaseSource] = useState('');
  const [purchaseCondition, setPurchaseCondition] = useState('Mint');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Sale history modal
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [saleQty, setSaleQty] = useState('1');
  const [salePlatform, setSalePlatform] = useState('');
  const [saleBuyerInfo, setSaleBuyerInfo] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleFees, setSaleFees] = useState('');
  const [saleShipping, setSaleShipping] = useState('');

  // New inventory fields
  const [storageLocation, setStorageLocation] = useState('');
  const [allocation, setAllocation] = useState<'personal' | 'trade' | 'forSale'>('personal');
  const [cardCondition, setCardCondition] = useState('');
  const [packaging, setPackaging] = useState('');
  const [caseCode, setCaseCode] = useState('');
  const [toyNumber, setToyNumber] = useState('');
  const [variationText, setVariationText] = useState('');

  // Load sibling cars on mount, then find starting index
  useEffect(() => {
    loadSiblings();
  }, []);

  // When siblingIndex changes (or siblings loaded), load the car at that index
  useEffect(() => {
    if (siblingCars.length > 0 && siblingIndex >= 0 && siblingIndex < siblingCars.length) {
      loadCarFromSibling(siblingCars[siblingIndex]);
    }
  }, [siblingIndex, siblingCars]);

  const loadSiblings = async () => {
    const list = source === 'wishlist' ? await getWishlist() : await getGarage();
    const sorted = list.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    setSiblingCars(sorted);
    const idx = sorted.findIndex((c) => c.id === id);
    setSiblingIndex(idx >= 0 ? idx : 0);
  };

  // Populate editable fields from a car object
  const loadCarFromSibling = (found: HotWheelCar) => {
    setCar(found);
    setName(found.name);
    setYear(found.year);
    setSeries(found.series);
    setColor(found.color);
    setModel(found.model);
    setRarity(found.rarity);
    setCondition(found.condition);
    setBuyPrice(found.buyPrice.toString());
    setExpectedPrice(found.expectedPrice.toString());
    setRemarks(found.remarks);
    setInCollection(found.inCollection);
    setStorageLocation(found.storageLocation || '');
    setAllocation(found.allocation || 'personal');
    setCardCondition(found.cardCondition || '');
    setPackaging(found.packaging || '');
    setCaseCode(found.caseCode || '');
    setToyNumber(found.toyNumber || '');
    setVariationText((found.variations || []).join(', '));
    if (found.isSold) {
      setSoldPrice(found.soldPrice?.toString() || '');
      setSoldPlatform(found.soldPlatform || '');
      setSoldNotes(found.soldNotes || '');
    }
    setNewImageUri(null);
    setEditing(false);
    // Duplicate analysis
    analyzeDuplicateDetails(found.name, found.model, found.year, found.color).then(setDupeAnalysis);
  };

  const goToPrev = useCallback(() => {
    const idx = siblingIndexRef.current;
    if (idx > 0) {
      setSiblingIndex(idx - 1);
    }
  }, []);

  const goToNext = useCallback(() => {
    const idx = siblingIndexRef.current;
    const siblings = siblingCarsRef.current;
    if (idx < siblings.length - 1) {
      setSiblingIndex(idx + 1);
    }
  }, []);

  // Swipe gesture — uses refs to avoid stale closures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        const dx = gestureState.dx;
        const idx = siblingIndexRef.current;
        const siblings = siblingCarsRef.current;
        const atLeftEdge = idx === 0 && dx > 0;
        const atRightEdge = idx === siblings.length - 1 && dx < 0;
        const dampened = atLeftEdge || atRightEdge ? dx * 0.25 : dx * 0.9;
        translateX.setValue(dampened);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const absDx = Math.abs(dx);
        const absVx = Math.abs(vx);
        const idx = siblingIndexRef.current;
        const siblings = siblingCarsRef.current;

        const isFastSwipe = absVx > 0.8 && absDx > 15;
        const isSlowSwipe = absDx > 50;

        if ((isFastSwipe || isSlowSwipe) && dx < 0 && idx < siblings.length - 1) {
          const duration = isFastSwipe ? 120 : 180;
          Animated.timing(translateX, { toValue: -350, duration, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            goToNext();
          });
        } else if ((isFastSwipe || isSlowSwipe) && dx > 0 && idx > 0) {
          const duration = isFastSwipe ? 120 : 180;
          Animated.timing(translateX, { toValue: 350, duration, useNativeDriver: true }).start(() => {
            translateX.setValue(0);
            goToPrev();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            velocity: vx * 0.5,
            tension: 300,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  const loadCar = async () => {
    // Reload siblings to refresh data after save/delete
    await loadSiblings();
  };

  const pickNewImage = async (useCamera: boolean) => {
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
        setNewImageUri(pickerResult.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSave = async () => {
    if (!car) return;
    const updated: HotWheelCar = {
      ...car,
      name,
      year,
      series,
      color,
      model,
      rarity,
      condition,
      buyPrice: parseFloat(buyPrice) || 0,
      expectedPrice: parseFloat(expectedPrice) || 0,
      remarks,
      inCollection,
      storageLocation,
      allocation,
      cardCondition,
      packaging,
      caseCode,
      toyNumber,
      variations: variationText.split(',').map((v) => v.trim()).filter(Boolean),
      images: newImageUri ? [newImageUri, ...(car.images || [])] : car.images,
    };
    await updateCar(updated);
    setCar(updated);
    setNewImageUri(null);
    setEditing(false);
    Alert.alert('Saved', 'Car details updated!');
  };

  const handleMarkSold = async () => {
    if (!car) return;
    const price = parseFloat(salePrice);
    const qty = parseInt(saleQty) || 1;
    if (!price || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid sold price.');
      return;
    }
    if (qty > (car.quantity || 0)) {
      Alert.alert('Insufficient Stock', `You only have ${car.quantity || 0} units in stock.`);
      return;
    }
    const fees = parseFloat(saleFees) || 0;
    const shipping = parseFloat(saleShipping) || 0;
    const entry: SaleEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      soldPrice: price,
      quantity: qty,
      date: new Date().toISOString(),
      platform: salePlatform.trim(),
      buyerInfo: saleBuyerInfo.trim(),
      notes: saleNotes.trim(),
      platformFees: fees,
      shippingCost: shipping,
    };
    const net = price - fees - shipping;
    const updated = await addSaleToCar(car.id, entry);
    if (updated) {
      setCar(updated);
      setShowSaleModal(false);
      setSalePrice('');
      setSaleQty('1');
      setSalePlatform('');
      setSaleBuyerInfo('');
      setSaleNotes('');
      setSaleFees('');
      setSaleShipping('');
      Alert.alert('Sale Recorded!', `Sold ${qty}x "${car.name}" for ₹${(price * qty).toLocaleString('en-IN')}`);
    }
  };

  const handleAddPurchase = async () => {
    if (!car) return;
    const price = parseFloat(purchasePrice);
    const qty = parseInt(purchaseQty) || 1;
    if (!price || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid buy price.');
      return;
    }
    const entry: PurchaseEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      buyPrice: price,
      quantity: qty,
      date: new Date().toISOString(),
      source: purchaseSource.trim() || 'Unknown',
      condition: purchaseCondition.trim() || 'Mint',
      notes: purchaseNotes.trim(),
    };
    const updated = await addPurchaseToCar(car.id, entry);
    if (updated) {
      setCar(updated);
      setShowPurchaseModal(false);
      setPurchasePrice('');
      setPurchaseQty('1');
      setPurchaseSource('');
      setPurchaseCondition('Mint');
      setPurchaseNotes('');
      Alert.alert('Purchase Added!', `Added ${qty}x at ₹${price.toLocaleString('en-IN')} each`);
    }
  };

  const handleUndoSold = async () => {
    if (!car) return;
    Alert.alert('Undo Sale', `Mark "${car.name}" as not sold?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo',
        onPress: async () => {
          const updated: HotWheelCar = {
            ...car,
            isSold: false,
            soldPrice: 0,
            soldDate: '',
            soldPlatform: '',
            soldNotes: '',
          };
          await updateCar(updated);
          setCar(updated);
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!car) return;
    Alert.alert('Delete Car', `Remove "${car.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCar(car.id);
          router.back();
        },
      },
    ]);
  };

  const handleSearchValue = async () => {
    if (!car) return;
    setSearching(true);
    try {
      const settings = await getSettings();
      if (!settings) {
        Alert.alert('Not configured', 'Set up your API key in Settings first.');
        return;
      }
      const result = await searchCarValue(settings, car.name, car.year);
      
      // Build price sources display
      let priceInfo = `Estimated Collector Value: ${result.estimatedValue}\n\n`;
      if (result.priceSources && result.priceSources.length > 0) {
        priceInfo += 'Collector References:\n';
        result.priceSources.forEach((source: { source?: string; store?: string; price: number; reference?: string }) => {
          const name = source.source || 'Collector';
          const ref = source.reference ? ` (${source.reference})` : '';
          priceInfo += `• ${name}${ref}: ₹${source.price}\n`;
        });
        priceInfo += '\n';
      }
      priceInfo += result.searchInfo;
      
      Alert.alert('Market Value (INR)', priceInfo);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSearching(false);
  };

  const toggleCollection = async () => {
    if (!car) return;
    const updated = { ...car, inCollection: !car.inCollection };
    await updateCar(updated);
    setCar(updated);
    setInCollection(updated.inCollection);
  };

  if (!car) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.loadingText, appStyles.textSecondary]}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View
        style={[styles.container, { backgroundColor: colors.background, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.info} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setEditing(!editing)}
            >
              <MaterialIcons name={editing ? "close" : "edit"} size={18} color={editing ? colors.text : colors.info} />
              <Text style={[styles.editButtonText, { color: editing ? colors.text : colors.info }]}>{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleDelete}>
              <MaterialIcons name="delete" size={18} color="#e63946" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swipe Navigation Bar */}
        {siblingCars.length > 1 && (
          <View style={[styles.swipeNavBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.swipeNavBtn, siblingIndex === 0 && styles.swipeNavBtnDisabled]}
              onPress={goToPrev}
              disabled={siblingIndex === 0}
            >
              <MaterialIcons name="chevron-left" size={22} color={siblingIndex === 0 ? '#333' : '#4da6ff'} />
              <Text style={[styles.swipeNavBtnText, siblingIndex === 0 && styles.swipeNavBtnTextDisabled]} numberOfLines={1}>Prev</Text>
            </TouchableOpacity>
            <View style={styles.swipeNavCenter}>
              <MaterialIcons name="swap-horiz" size={14} color="#555" />
              <Text style={styles.swipeNavPosition}>{siblingIndex + 1} / {siblingCars.length}</Text>
            </View>
            <TouchableOpacity
              style={[styles.swipeNavBtn, siblingIndex === siblingCars.length - 1 && styles.swipeNavBtnDisabled]}
              onPress={goToNext}
              disabled={siblingIndex === siblingCars.length - 1}
            >
              <Text style={[styles.swipeNavBtnText, siblingIndex === siblingCars.length - 1 && styles.swipeNavBtnTextDisabled]} numberOfLines={1}>Next</Text>
              <MaterialIcons name="chevron-right" size={22} color={siblingIndex === siblingCars.length - 1 ? '#333' : '#4da6ff'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Image */}
        {car.images.length > 0 && (
          <Image source={{ uri: car.images[0] }} style={styles.heroImage} resizeMode="cover" />
        )}

        {/* Photo change in edit mode */}
        {editing && (
          <View style={styles.photoChangeSection}>
            {newImageUri ? (
              <View>
                <Image source={{ uri: newImageUri }} style={styles.photoPreview} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => setNewImageUri(null)}
                >
                  <MaterialIcons name="close" size={18} color="#fff" />
                  <Text style={styles.photoRemoveBtnText}>Remove New Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoChangeRow}>
                <TouchableOpacity style={styles.photoChangeBtn} onPress={() => pickNewImage(true)}>
                  <MaterialIcons name="camera-alt" size={20} color="#4da6ff" />
                  <Text style={styles.photoChangeBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoChangeBtn} onPress={() => pickNewImage(false)}>
                  <MaterialIcons name="photo-library" size={20} color="#4da6ff" />
                  <Text style={styles.photoChangeBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Collection toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleLabelContainer}>
            {car.inCollection ? (
              <MaterialCommunityIcons name="car" size={18} color="#4caf50" />
            ) : (
              <MaterialIcons name="star" size={18} color="#FFD700" />
            )}
            <Text style={[styles.toggleLabel, appStyles.textPrimary]}>
              {car.inCollection ? 'In Garage' : 'In Wishlist'}
            </Text>
          </View>
          <Switch
            value={car.inCollection}
            onValueChange={toggleCollection}
            trackColor={{ false: '#333', true: '#1b5e20' }}
            thumbColor={car.inCollection ? '#4caf50' : '#888'}
          />
        </View>

        {/* ===== INVENTORY STATS ===== */}
        {!editing && car.inCollection && (() => {
          const stats = computeCarStats(car);
          return (
            <View style={[styles.inventoryCard, appStyles.card]}>
              <View style={styles.inventoryHeader}>
                <MaterialCommunityIcons name="package-variant" size={18} color="#FFD700" />
                <Text style={[styles.inventoryTitle, { color: '#FFD700' }]}>Inventory</Text>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>{stats.inStock} in stock</Text>
                </View>
              </View>
              <View style={styles.inventoryGrid}>
                <View style={[styles.inventoryStat, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.inventoryStatValue, appStyles.textPrimary]}>{stats.totalPurchased}</Text>
                  <Text style={[styles.inventoryStatLabel, appStyles.textSecondary]}>Bought</Text>
                </View>
                <View style={[styles.inventoryStat, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.inventoryStatValue, appStyles.textPrimary]}>{stats.totalSold}</Text>
                  <Text style={[styles.inventoryStatLabel, appStyles.textSecondary]}>Sold</Text>
                </View>
                <View style={[styles.inventoryStat, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.inventoryStatValue, { color: colors.info }]}>₹{stats.totalInvested.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.inventoryStatLabel, appStyles.textSecondary]}>Total Invested</Text>
                </View>
                <View style={[styles.inventoryStat, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.inventoryStatValue, { color: colors.success }]}>₹{stats.totalRevenue.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.inventoryStatLabel, appStyles.textSecondary]}>Revenue</Text>
                </View>
              </View>
              {stats.totalSold > 0 && stats.totalRevenue > 0 && (
                <View style={styles.inventoryProfitRow}>
                  <MaterialIcons name="show-chart" size={16} color={stats.profit >= 0 ? '#4caf50' : '#e63946'} />
                  <Text style={styles.inventoryProfitLabel}>Realized P&L:</Text>
                  <Text style={[styles.inventoryProfitValue, { color: stats.profit >= 0 ? '#4caf50' : '#e63946' }]}>
                    {stats.profit >= 0 ? '+' : ''}₹{stats.profit.toLocaleString('en-IN')} ({stats.roi.toFixed(1)}% ROI)
                  </Text>
                </View>
              )}
              <Text style={[styles.inventoryAvg, appStyles.textMuted]}>Avg Buy: ₹{stats.avgBuyPrice.toLocaleString('en-IN')}  ·  Avg Sell: ₹{stats.avgSellPrice.toLocaleString('en-IN')}  ·  COGS: ₹{stats.cogs.toLocaleString('en-IN')}</Text>
              {/* Duplicate Count */}
              {dupeAnalysis && dupeAnalysis.sameColorCount > 1 && (
                <View style={styles.dupeCountRow}>
                  <MaterialCommunityIcons name="content-copy" size={16} color="#FF9800" />
                  <Text style={styles.dupeCountText}>
                    {dupeAnalysis.sameColorCount}x same car in collection
                    {dupeAnalysis.differentColorCount > 0 ? ` · ${dupeAnalysis.differentColorCount} color variant${dupeAnalysis.differentColorCount > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
              )}
              {/* Add Purchase Button */}                <TouchableOpacity style={[styles.addPurchaseBtn, { backgroundColor: colors.primary }]} onPress={() => setShowPurchaseModal(true)}>
                <MaterialIcons name="add-circle" size={18} color="#fff" />
                <Text style={styles.addPurchaseBtnText}>Add New Purchase</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ===== PURCHASE HISTORY ===== */}
        {!editing && car.purchaseHistory && car.purchaseHistory.length > 0 && (
          <View style={[styles.historyCard, { backgroundColor: colors.surface }]}>
            <View style={styles.historyCardHeader}>
              <MaterialIcons name="receipt-long" size={18} color="#4da6ff" />
              <Text style={[styles.historyCardTitle, { color: colors.info }]}>Purchase History</Text>
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountText}>{car.purchaseHistory.length}</Text>
              </View>
            </View>
            {car.purchaseHistory.map((p, idx) => (
              <View key={p.id || idx} style={styles.historyEntry}>
                <View style={styles.historyEntryLeft}>
                  <Text style={[styles.historyEntryDate, appStyles.textPrimary]}>{new Date(p.date).toLocaleDateString('en-IN')}</Text>
                  <Text style={[styles.historyEntrySource, appStyles.textSecondary]}>{p.source || 'Unknown'} · {p.condition || 'Mint'}</Text>
                  {p.notes ? <Text style={[styles.historyEntryNotes, appStyles.textMuted]}>{p.notes}</Text> : null}
                </View>
                <View style={styles.historyEntryRight}>
                  <Text style={[styles.historyEntryPrice, appStyles.textPrimary]}>₹{p.buyPrice.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.historyEntryQty, appStyles.textSecondary]}>x{p.quantity || 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===== SALE HISTORY ===== */}
        {!editing && car.saleHistory && car.saleHistory.length > 0 && (
          <View style={[styles.historyCard, { backgroundColor: colors.surface }]}>
            <View style={styles.historyCardHeader}>
              <MaterialIcons name="sell" size={18} color="#4caf50" />
              <Text style={[styles.historyCardTitle, { color: colors.info }]}>Sale History</Text>
              <View style={[styles.historyCountBadge, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                <Text style={[styles.historyCountText, { color: '#4caf50' }]}>{car.saleHistory.length}</Text>
              </View>
            </View>
            {car.saleHistory.map((s, idx) => (
              <View key={s.id || idx} style={styles.historyEntry}>
                <View style={styles.historyEntryLeft}>
                  <Text style={[styles.historyEntryDate, appStyles.textPrimary]}>{new Date(s.date).toLocaleDateString('en-IN')}</Text>
                  <Text style={[styles.historyEntrySource, appStyles.textSecondary]}>{s.platform || 'Unknown'}{s.buyerInfo ? ` · ${s.buyerInfo}` : ''}</Text>
                  {s.notes ? <Text style={[styles.historyEntryNotes, appStyles.textMuted]}>{s.notes}</Text> : null}
                </View>
                <View style={styles.historyEntryRight}>
                  <Text style={[styles.historyEntryPrice, { color: '#4caf50' }]}>₹{s.soldPrice.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.historyEntryQty, appStyles.textSecondary]}>x{s.quantity || 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Details card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {editing ? (
            <>
              <Field label="Name" value={name} onChange={setName} icon="edit" />
              <Field label="Year" value={year} onChange={setYear} icon="calendar-today" />
              <Field label="Model / Casting" value={model} onChange={setModel} icon="directions-car" />
              <Field label="Series" value={series} onChange={setSeries} icon="collections-bookmark" />
              <Field label="Color" value={color} onChange={setColor} icon="palette" />
              <Field label="Rarity" value={rarity} onChange={setRarity} icon="star" />
              <Field label="Condition" value={condition} onChange={setCondition} icon="check-circle" />
              <Field label="Buy Price (₹)" value={buyPrice} onChange={setBuyPrice} icon="attach-money" keyboardType="decimal-pad" />
              <Field label="Expected Price (₹)" value={expectedPrice} onChange={setExpectedPrice} icon="trending-up" keyboardType="decimal-pad" />
              <Field label="Remarks" value={remarks} onChange={setRemarks} icon="notes" multiline />
              {/* === NEW FIELDS === */}
              <View style={styles.sectionDivider}>
                <MaterialIcons name="inventory" size={14} color="#FFD700" />
                <Text style={styles.sectionDividerText}>Inventory Details</Text>
              </View>
              <Field label="Storage Location" value={storageLocation} onChange={setStorageLocation} icon="place" placeholder="Shelf 1 > Tub #4 > Row 2" />
              <Field label="Case Code (A-Q)" value={caseCode} onChange={setCaseCode} icon="alpha" placeholder="e.g. F, G, H" />
              <Field label="Toy / Collector Number" value={toyNumber} onChange={setToyNumber} icon="tag" placeholder="e.g. 124/250" />
              <Field label="Card Condition" value={cardCondition} onChange={setCardCondition} icon="credit-card" placeholder="Mint, Soft Corner, Cracked Bubble, Crease" />
              <Field label="Packaging" value={packaging} onChange={setPackaging} icon="inventory-2" placeholder="Long Card, Short Card, Protector, Loose" />
              <Field label="Variations / Errors" value={variationText} onChange={setVariationText} icon="style" placeholder="Wheel Swap, Color Shift, Tampo Error" />
              {/* Allocation picker */}
              <View style={styles.sectionDivider}>
                <MaterialIcons name="swap-horiz" size={14} color="#FFD700" />
                <Text style={styles.sectionDividerText}>Allocation</Text>
              </View>
              <View style={styles.allocationRow}>
                {(['personal', 'trade', 'forSale'] as const).map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.allocChip, allocation === a && styles.allocChipActive]}
                    onPress={() => setAllocation(a)}
                  >
                    <MaterialIcons name={a === 'personal' ? 'favorite' : a === 'trade' ? 'swap-horiz' : 'sell'} size={14} color={allocation === a ? colors.text : colors.textSecondary} />
                    <Text style={[styles.allocChipText, allocation === a && styles.allocChipTextActive]}>
                      {a === 'forSale' ? 'For Sale' : a.charAt(0).toUpperCase() + a.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.carName, appStyles.textPrimary]}>{car.name}</Text>
              <Text style={[styles.carSub, appStyles.textSecondary]}>{car.year} · {car.model || car.name}</Text>
              <View style={styles.tags}>
                {car.rarity ? (
                  <View style={[styles.tag, car.rarity.toLowerCase().includes('super') ? styles.tagSuperTH : car.rarity.toLowerCase().includes('treasure') ? styles.tagTH : styles.tagMainline]}>
                    <MaterialIcons name="star" size={10} color="#ccc" />
                    <Text style={styles.tagText}>{car.rarity}</Text>
                  </View>
                ) : null}
                {car.condition ? (
                  <View style={[styles.tag, styles.tagCondition]}>
                    <MaterialIcons name="check-circle" size={10} color="#ccc" />
                    <Text style={styles.tagText}>{car.condition}</Text>
                  </View>
                ) : null}
                {car.series ? (
                  <View style={[styles.tag, styles.tagSeries]}>
                    <MaterialIcons name="collections-bookmark" size={10} color="#ccc" />
                    <Text style={styles.tagText}>{car.series}</Text>
                  </View>
                ) : null}
                {dupeAnalysis && dupeAnalysis.sameColorCount > 1 && (
                  <View style={[styles.tag, { backgroundColor: 'rgba(255, 152, 0, 0.2)' }]}>
                    <MaterialCommunityIcons name="content-copy" size={10} color="#FF9800" />
                    <Text style={[styles.tagText, { color: '#FF9800' }]}>x{dupeAnalysis.sameColorCount} duplicates</Text>
                  </View>
                )}
                {dupeAnalysis && dupeAnalysis.differentColorCount > 0 && (
                  <View style={[styles.tag, { backgroundColor: 'rgba(66, 165, 245, 0.15)' }]}>
                    <MaterialIcons name="palette" size={10} color="#42A5F5" />
                    <Text style={[styles.tagText, { color: '#42A5F5' }]}>+{dupeAnalysis.differentColorCount} color{dupeAnalysis.differentColorCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailGrid}>
                {car.color ? <DetailItem label="Color" value={car.color} icon="palette" /> : null}
                {car.scale ? <DetailItem label="Scale" value={car.scale} icon="straighten" /> : null}
                {car.manufacturer ? <DetailItem label="Manufacturer" value={car.manufacturer} icon="business" /> : null}
                {car.wheelType ? <DetailItem label="Wheels" value={car.wheelType} icon="loop" /> : null}
                {car.baseColor ? <DetailItem label="Base Color" value={car.baseColor} icon="square" /> : null}
                {car.tampos ? <DetailItem label="Tampos" value={car.tampos} icon="brush" /> : null}
                {car.barcode ? <DetailItem label="Barcode" value={car.barcode} icon="barcode" /> : null}
                {/* NEW: Inventory Fields */}
                {car.storageLocation ? <DetailItem label="Location" value={car.storageLocation} icon="place" /> : null}
                {car.caseCode ? <DetailItem label="Case" value={car.caseCode} icon="alpha" /> : null}
                {car.toyNumber ? <DetailItem label="Toy #" value={car.toyNumber} icon="tag" /> : null}
                {car.cardCondition ? <DetailItem label="Card" value={car.cardCondition} icon="credit-card" /> : null}
                {car.packaging ? <DetailItem label="Package" value={car.packaging} icon="inventory-2" /> : null}
              </View>

              {/* Allocation Badge */}
              {car.allocation && car.allocation !== 'personal' && (
                <View style={styles.allocBadge}>
                  <MaterialIcons name={car.allocation === 'trade' ? 'swap-horiz' : 'sell'} size={14} color={car.allocation === 'forSale' ? '#4caf50' : '#FF9800'} />
                  <Text style={[styles.allocBadgeText, { color: car.allocation === 'forSale' ? '#4caf50' : '#FF9800' }]}>
                    {car.allocation === 'forSale' ? 'For Sale' : 'Trade Pile'}
                  </Text>
                </View>
              )}

              {/* Variations */}
              {car.variations && car.variations.length > 0 && (
                <View style={styles.variationsSection}>
                  <View style={styles.variationsHeader}>
                    <MaterialIcons name="style" size={16} color="#FF9800" />
                    <Text style={styles.variationsTitle}>Variations & Notes</Text>
                  </View>
                  <View style={styles.variationsTags}>
                    {car.variations.map((v, idx) => (
                      <View key={idx} style={styles.variationTag}>
                        <Text style={styles.variationTagText}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Price Range */}
              {car.priceRange && car.priceRange.min > 0 && (
                <View style={styles.priceRangeSection}>
                  <View style={styles.priceRangeHeader}>
                    <MaterialIcons name="show-chart" size={16} color="#4caf50" />
                    <Text style={styles.priceRangeTitle}>Collectable Value Range</Text>
                  </View>
                  <View style={styles.priceRangeRow}>
                    <View style={styles.priceRangeBox}>
                      <Text style={[styles.priceRangeLabel, appStyles.textMuted]}>Low</Text>
                      <Text style={[styles.priceRangeValue, appStyles.textPrimary]}>₹{car.priceRange.min.toLocaleString('en-IN')}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={16} color="#555" />
                    <View style={styles.priceRangeBox}>
                      <Text style={[styles.priceRangeLabel, appStyles.textMuted]}>Avg</Text>
                      <Text style={[styles.priceRangeValue, { color: '#4caf50' }]}>₹{car.priceRange.avg.toLocaleString('en-IN')}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={16} color="#555" />
                    <View style={styles.priceRangeBox}>
                      <Text style={[styles.priceRangeLabel, appStyles.textMuted]}>High</Text>
                      <Text style={[styles.priceRangeValue, appStyles.textPrimary]}>₹{car.priceRange.max.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.priceSection}>
                <View style={[styles.priceBox, { backgroundColor: colors.inputBg }]}>
                  <MaterialIcons name="attach-money" size={16} color="#888" />
                  <Text style={[styles.priceLabel, appStyles.textMuted]}>Paid</Text>
                  <Text style={[styles.priceValue, { color: colors.info }]}>
                    ₹{car.buyPrice > 0 ? car.buyPrice.toLocaleString('en-IN') : '—'}
                  </Text>
                </View>
                <View style={[styles.priceBox, { backgroundColor: colors.inputBg }]}>
                  <MaterialIcons name="trending-up" size={16} color="#4caf50" />
                  <Text style={[styles.priceLabel, appStyles.textMuted]}>Market Value</Text>
                  <Text style={[styles.priceValue, { color: '#4caf50' }]}>
                    ₹{(car.priceINR || car.expectedPrice) > 0 ? (car.priceINR || car.expectedPrice).toLocaleString('en-IN') : '—'}
                  </Text>
                </View>
                {car.buyPrice > 0 && (car.priceINR || car.expectedPrice) > 0 && (
                  <View style={[styles.priceBox, { backgroundColor: colors.inputBg }]}>
                    <MaterialIcons name="show-chart" size={16} color="#888" />
                    <Text style={[styles.priceLabel, appStyles.textMuted]}>ROI</Text>
                    <Text
                      style={[
                        styles.priceValue,
                        { color: (car.priceINR || car.expectedPrice) >= car.buyPrice ? '#4caf50' : '#e63946' },
                      ]}
                    >
                      {(((car.priceINR || car.expectedPrice) - car.buyPrice) / car.buyPrice * 100).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>

              {/* Price Sources - Collector References */}
              {car.priceSources && car.priceSources.length > 0 && (
                <View style={[styles.priceSourcesCard, { backgroundColor: colors.inputBg }]}>
                  <View style={styles.priceSourcesHeader}>
                    <MaterialIcons name="verified" size={16} color="#4da6ff" />
                    <Text style={[styles.priceSourcesTitle, { color: colors.info }]}>Collector References</Text>
                  </View>
                  {car.priceSources.map((source, idx) => (
                    <View key={idx} style={styles.priceSourceRow}>
                      <View style={styles.priceSourceLeft}>
                        <Text style={[styles.priceSourceStore, appStyles.textPrimary]}>{source.source || 'Collector'}</Text>
                        {source.reference ? (
                          <Text style={[styles.priceSourceRef, appStyles.textMuted]}>{source.reference}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.priceSourcePrice}>₹{source.price.toLocaleString('en-IN')}</Text>
                    </View>
                  ))}
                </View>
              )}

              {car.history ? (
                <View style={[styles.historySection, { backgroundColor: colors.surface }]}>
                  <View style={styles.historyHeader}>
                    <MaterialIcons name="history-edu" size={16} color="#FFD700" />
                    <Text style={styles.historyTitle}>Car History & Background</Text>
                  </View>
                  <Text style={[styles.historyText, appStyles.textSecondary]}>{car.history}</Text>
                </View>
              ) : null}

              {car.remarks ? (
                <View style={[styles.remarksSection, { backgroundColor: colors.surface }]}>
                  <View style={styles.remarksHeader}>
                    <MaterialIcons name="notes" size={16} color="#4da6ff" />
                    <Text style={styles.remarksTitle}>Market Info</Text>
                  </View>
                  <Text style={[styles.remarksText, appStyles.textSecondary]}>{car.remarks}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Sold Banner (if already sold) */}
        {car.isSold && !editing && (
          <View style={styles.soldBanner}>
            <View style={styles.soldBannerHeader}>
              <MaterialIcons name="check-circle" size={22} color="#4caf50" />
              <Text style={styles.soldBannerTitle}>SOLD</Text>
              <TouchableOpacity onPress={handleUndoSold}>
                <Text style={[styles.undoSoldText, appStyles.textSecondary]}>Undo</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.soldBannerDetails}>
              <View style={styles.soldDetailRow}>
                <Text style={[styles.soldDetailLabel, appStyles.textSecondary]}>Sold For</Text>
                <Text style={[styles.soldDetailValue, appStyles.textPrimary]}>₹{car.soldPrice.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.soldDetailRow}>
                <Text style={[styles.soldDetailLabel, appStyles.textSecondary]}>Buy Price</Text>
                <Text style={[styles.soldDetailValue, appStyles.textPrimary]}>₹{car.buyPrice.toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.soldDetailRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8, marginTop: 4 }]}>
                <Text style={[styles.soldDetailLabel, appStyles.textSecondary]}>Profit</Text>
                <Text style={[styles.soldDetailValue, { color: car.soldPrice >= car.buyPrice ? '#4caf50' : '#e63946', fontSize: 18, fontWeight: '900' }]}>                  {car.soldPrice >= car.buyPrice ? '+' : ''}₹{(car.soldPrice - car.buyPrice).toLocaleString('en-IN')}                </Text>
              </View>
              {car.buyPrice > 0 && (
                <View style={styles.soldDetailRow}>
                  <Text style={[styles.soldDetailLabel, appStyles.textSecondary]}>ROI</Text>
                  <Text style={[styles.soldDetailValue, { color: car.soldPrice >= car.buyPrice ? '#4caf50' : '#e63946' }]}>                    {(((car.soldPrice - car.buyPrice) / car.buyPrice) * 100).toFixed(1)}%                  </Text>
                </View>
              )}
              {car.soldPlatform ? (
                <View style={styles.soldDetailRow}>
                  <Text style={[styles.soldDetailLabel, appStyles.textSecondary]}>Platform</Text>
                  <Text style={[styles.soldDetailValue, appStyles.textPrimary]}>{car.soldPlatform}</Text>
                </View>
              ) : null}
              {car.soldDate ? (
                <View style={styles.soldDetailRow}>
                  <Text style={[styles.soldDetailLabel, appStyles.textSecondary]}>Date</Text>
                  <Text style={[styles.soldDetailValue, appStyles.textPrimary]}>{new Date(car.soldDate).toLocaleDateString('en-IN')}</Text>
                </View>
              ) : null}
              {car.soldNotes ? (
                <Text style={[styles.soldNotes, appStyles.textSecondary]}>{car.soldNotes}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Action buttons */}
        {editing ? (
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
            <MaterialIcons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Mark as Sold button */}
            {(!car.isSold || (car.quantity || 0) > 0) && (car.buyPrice > 0 || (car.purchaseHistory && car.purchaseHistory.length > 0)) && (
              <TouchableOpacity
                style={[styles.soldButton, { backgroundColor: colors.success }]}
                onPress={() => setShowSaleModal(true)}
              >
                <MaterialIcons name="sell" size={20} color="#fff" />
                <Text style={[styles.soldButtonText, { color: '#fff' }]}>Record Sale</Text>
              </TouchableOpacity>
            )}

            {/* Add Purchase button (also available outside inventory card for quick access) */}
            {car.inCollection && !(car.purchaseHistory && car.purchaseHistory.length > 0) && (
              <TouchableOpacity
                style={[styles.soldButton, { backgroundColor: colors.info }]}
                onPress={() => setShowPurchaseModal(true)}
              >
                <MaterialIcons name="add-circle" size={20} color="#fff" />
                <Text style={[styles.soldButtonText, { color: '#fff' }]}>Add Purchase</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleSearchValue}
              disabled={searching}
            >
              <MaterialIcons name="search" size={18} color="#4da6ff" />
              <Text style={[styles.searchButtonText, { color: colors.info }]}>
                {searching ? 'Searching...' : 'Search Market Value (INR)'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ===== SALE MODAL ===== */}
        {showSaleModal && (
          <View style={[styles.soldModalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.soldModal, { backgroundColor: colors.surface }]}>
              <View style={styles.soldModalHeader}>
                <MaterialIcons name="sell" size={24} color="#4caf50" />
                <Text style={[styles.soldModalTitle, { color: colors.success }]}>Record Sale</Text>
                <TouchableOpacity onPress={() => setShowSaleModal(false)}>
                  <MaterialIcons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <View style={[styles.soldModalProfitPreview, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.soldModalProfitLabel, appStyles.textSecondary]}>In Stock: {car.quantity || 0}  ·  Avg Buy: ₹{car.buyPrice.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="attach-money" size={16} color="#4caf50" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Sell Price per Unit (₹) *</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="Enter sell price"
                  placeholderTextColor={colors.textMuted}
                  value={salePrice}
                  onChangeText={setSalePrice}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="numbers" size={16} color="#42A5F5" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Quantity to Sell</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder={`Max: ${car.quantity || 0}`}
                  placeholderTextColor={colors.textMuted}
                  value={saleQty}
                  onChangeText={setSaleQty}
                  keyboardType="number-pad"
                />
              </View>

              {salePrice && parseFloat(salePrice) > 0 && saleQty && parseInt(saleQty) > 0 && car.buyPrice > 0 && (
                <View style={[styles.soldProfitCalc, { backgroundColor: colors.inputBg }]}>
                  {(() => {
                    const sp = parseFloat(salePrice);
                    const sq = parseInt(saleQty);
                    const fees = parseFloat(saleFees) || 0;
                    const ship = parseFloat(saleShipping) || 0;
                    const total = sp * sq;
                    const net = total - fees - ship;
                    const profit = net - (car!.buyPrice * sq);
                    return (
                      <>
                        <Text style={[styles.soldProfitCalcText, appStyles.textSecondary]}>Total: ₹{total.toLocaleString('en-IN')}  ·  Net: ₹{net.toLocaleString('en-IN')}  ·  Profit: </Text>
                        <Text style={[styles.soldProfitCalcValue, {
                          color: profit >= 0 ? '#4caf50' : '#e63946'
                        }]}>
                          {profit >= 0 ? '+' : ''}₹{profit.toLocaleString('en-IN')}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              )}

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="store" size={16} color="#42A5F5" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Platform</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="e.g. eBay, Mercari, FB Marketplace"
                  placeholderTextColor={colors.textMuted}
                  value={salePlatform}
                  onChangeText={setSalePlatform}
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="person" size={16} color="#FFD700" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Buyer Info</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="Buyer name or contact"
                  placeholderTextColor={colors.textMuted}
                  value={saleBuyerInfo}
                  onChangeText={setSaleBuyerInfo}
                />
              </View>

              {/* Platform Fees & Shipping */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.soldInputGroup, { flex: 1 }]}>
                  <View style={styles.soldInputLabelRow}>
                    <MaterialIcons name="money-off" size={16} color="#e63946" />
                    <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Platform Fees (₹)</Text>
                  </View>
                  <TextInput
                    style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={saleFees}
                    onChangeText={setSaleFees}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.soldInputGroup, { flex: 1 }]}>
                  <View style={styles.soldInputLabelRow}>
                    <MaterialIcons name="local-shipping" size={16} color="#42A5F5" />
                    <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Shipping (₹)</Text>
                  </View>
                  <TextInput
                    style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={saleShipping}
                    onChangeText={setSaleShipping}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="notes" size={16} color="#FFD700" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Notes</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { minHeight: 50 }]}
                  placeholder="Shipping, condition notes, etc."
                  placeholderTextColor={colors.textMuted}
                  value={saleNotes}
                  onChangeText={setSaleNotes}
                  multiline
                />
              </View>

              <View style={styles.soldModalActions}>
                <TouchableOpacity style={[styles.soldCancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => setShowSaleModal(false)}>
                  <Text style={[styles.soldCancelBtnText, appStyles.textSecondary]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.soldConfirmBtn, { backgroundColor: colors.success }]} onPress={handleMarkSold}>
                  <MaterialIcons name="check" size={18} color="#fff" />
                  <Text style={styles.soldConfirmBtnText}>Record Sale</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ===== PURCHASE MODAL ===== */}
        {showPurchaseModal && (
          <View style={[styles.soldModalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.soldModal, { backgroundColor: colors.surface }]}>
              <View style={styles.soldModalHeader}>
                <MaterialIcons name="add-shopping-cart" size={24} color="#4da6ff" />
                <Text style={[styles.soldModalTitle, { color: '#4da6ff' }]}>Add Purchase</Text>
                <TouchableOpacity onPress={() => setShowPurchaseModal(false)}>
                  <MaterialIcons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="attach-money" size={16} color="#4da6ff" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Buy Price per Unit (₹) *</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="What you paid per unit"
                  placeholderTextColor={colors.textMuted}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="numbers" size={16} color="#42A5F5" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Quantity</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="Number of units"
                  placeholderTextColor={colors.textMuted}
                  value={purchaseQty}
                  onChangeText={setPurchaseQty}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="store" size={16} color="#FF9800" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Source / Where Bought</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="e.g. Amazon, Local Shop, eBay"
                  placeholderTextColor={colors.textMuted}
                  value={purchaseSource}
                  onChangeText={setPurchaseSource}
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="check-circle" size={16} color="#4caf50" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Condition</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="Mint, Carded, Loose, Damaged"
                  placeholderTextColor={colors.textMuted}
                  value={purchaseCondition}
                  onChangeText={setPurchaseCondition}
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="notes" size={16} color="#FFD700" />
                  <Text style={[styles.soldInputLabel, appStyles.textSecondary]}>Notes</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { minHeight: 50 }]}
                  placeholder="Extra details"
                  placeholderTextColor={colors.textMuted}
                  value={purchaseNotes}
                  onChangeText={setPurchaseNotes}
                  multiline
                />
              </View>

              {purchasePrice && parseFloat(purchasePrice) > 0 && purchaseQty && parseInt(purchaseQty) > 0 && (
                <View style={[styles.soldProfitCalc, { backgroundColor: colors.inputBg }]}>
                  <Text style={[styles.soldProfitCalcText, appStyles.textSecondary]}>Total Cost: ₹{(parseFloat(purchasePrice) * parseInt(purchaseQty)).toLocaleString('en-IN')}</Text>
                </View>
              )}

              <View style={styles.soldModalActions}>
                <TouchableOpacity style={styles.soldCancelBtn} onPress={() => setShowPurchaseModal(false)}>
                  <Text style={[styles.soldCancelBtnText, appStyles.textSecondary]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.soldConfirmBtn, { backgroundColor: colors.info }]} onPress={handleAddPurchase}>
                  <MaterialIcons name="check" size={18} color="#fff" />
                  <Text style={styles.soldConfirmBtnText}>Add Purchase</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Ad Banner */}
        {!editing && !car.isSold && (
          <View style={styles.adSection}>
            <AdBanner />
          </View>
        )}

        {/* Metadata */}
        <View style={styles.metaSection}>
          <MaterialIcons name="schedule" size={12} color="#555" />
          <Text style={[styles.metaText, appStyles.textMuted]}>
            Added: {new Date(car.dateAdded).toLocaleDateString('en-IN')}
          </Text>
        </View>
      </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  icon,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  icon?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
  placeholder?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={fieldStyles.container}>
      <View style={fieldStyles.labelRow}>
        {icon && <MaterialIcons name={icon as any} size={14} color={colors.textSecondary} />}
        <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <TextInput
        style={[fieldStyles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 10 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
});

function DetailItem({ label, value, icon }: { label: string; value: string; icon?: string }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabelContainer}>
        {icon && <MaterialIcons name={icon as any} size={14} color="#666" />}
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 100 },
  loadingText: { textAlign: 'center', marginTop: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: { padding: 8 },
  headerActions: { flexDirection: 'row', gap: 8 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: { fontSize: 14, fontWeight: '600' },
  deleteButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroImage: {
    width: '100%',
    height: 220,
    marginBottom: 12,
  },

  // Photo change
  photoChangeSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4da6ff',
  },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e63946',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  photoRemoveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoChangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoChangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  photoChangeBtnText: { color: '#4da6ff', fontSize: 14, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  toggleLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  carName: { fontSize: 22, fontWeight: '800' },
  carSub: { fontSize: 14, marginTop: 2 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  tagMainline: { backgroundColor: 'rgba(77, 166, 255, 0.15)' },
  tagTH: { backgroundColor: 'rgba(255, 193, 7, 0.15)' },
  tagSuperTH: { backgroundColor: 'rgba(255, 215, 0, 0.25)' },
  tagCondition: { backgroundColor: 'rgba(76, 175, 80, 0.15)' },
  tagSeries: { backgroundColor: 'rgba(156, 39, 176, 0.15)' },
  tagText: { fontSize: 11, color: '#ccc', fontWeight: '600' },
  detailGrid: { marginTop: 14 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '600' },
  priceRangeSection: {
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1b5e20',
  },
  priceRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  priceRangeTitle: { fontSize: 13, fontWeight: '700', color: '#4caf50' },
  priceRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  priceRangeBox: { alignItems: 'center', flex: 1 },
  priceRangeLabel: { fontSize: 10, textTransform: 'uppercase' },
  priceRangeValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  priceSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  priceBox: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  priceLabel: { fontSize: 10, textTransform: 'uppercase', marginTop: 4 },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#4da6ff', marginTop: 2 },
  priceSourcesCard: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  priceSourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  priceSourcesTitle: { fontSize: 13, fontWeight: '700', color: '#4da6ff' },
  priceSourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  priceSourceLeft: { flex: 1, marginRight: 12 },
  priceSourceStore: { fontSize: 13, fontWeight: '600' },
  priceSourceRef: { fontSize: 10, marginTop: 1 },
  priceSourcePrice: { fontSize: 13, color: '#4caf50', fontWeight: '800' },
  historySection: {
    marginTop: 14,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  historyTitle: { fontSize: 14, fontWeight: '800', color: '#FFD700' },
  historyText: { fontSize: 13, lineHeight: 20 },
  remarksSection: { marginTop: 12 },
  remarksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  remarksTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff' },
  remarksText: { fontSize: 13, lineHeight: 18 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  searchButtonText: { color: '#4da6ff', fontSize: 14, fontWeight: '600' },
  metaSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  metaText: { fontSize: 11, color: '#555' },

  // Sold Banner
  soldBanner: {
    borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#4caf50',
  },
  soldBannerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  soldBannerTitle: { fontSize: 18, fontWeight: '900', color: '#4caf50', flex: 1, letterSpacing: 1 },
  undoSoldText: { fontSize: 12, color: '#888', fontWeight: '600' },
  soldBannerDetails: { gap: 4 },
  soldDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  soldDetailLabel: { fontSize: 12 },
  soldDetailValue: { fontSize: 14, fontWeight: '700' },
  soldNotes: { fontSize: 12, marginTop: 8, fontStyle: 'italic', lineHeight: 18 },

  // Sold Button
  soldButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1b5e20', borderRadius: 12, padding: 16,
    marginHorizontal: 16, marginBottom: 10,
  },
  soldButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Sold Modal
  soldModalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20, zIndex: 100,
  },
  soldModal: {
    borderRadius: 18, padding: 20, width: '100%',
    borderWidth: 1, borderColor: '#4caf50',
  },
  soldModalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  soldModalTitle: { fontSize: 18, fontWeight: '800', color: '#4caf50', flex: 1 },
  soldModalProfitPreview: {
    borderRadius: 10, padding: 10, marginBottom: 16,
  },
  soldModalProfitLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  soldInputGroup: { marginBottom: 14 },
  soldInputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  soldInputLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  soldInput: {
    borderRadius: 10, borderWidth: 1, borderColor: '#333',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '600',
  },
  soldProfitCalc: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    borderRadius: 8, padding: 10,
  },
  soldProfitCalcText: { fontSize: 13, color: '#888', fontWeight: '600' },
  soldProfitCalcValue: { fontSize: 16, fontWeight: '900' },
  soldProfitCalcRoi: { fontSize: 12, fontWeight: '600' },
  soldModalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  soldCancelBtn: {
    flex: 1, backgroundColor: '#333', borderRadius: 10, padding: 14, alignItems: 'center',
  },
  soldCancelBtnText: { color: '#888', fontSize: 14, fontWeight: '700' },
  soldConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1b5e20', borderRadius: 10, padding: 14,
  },
  soldConfirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Ad section
  adSection: {
    marginHorizontal: 16, marginBottom: 12,
  },

  // Inventory Stats Card
  inventoryCard: {
    borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#FFD700',
  },
  inventoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  inventoryTitle: { fontSize: 16, fontWeight: '800', color: '#FFD700', flex: 1 },
  qtyBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  qtyBadgeText: { fontSize: 12, color: '#FFD700', fontWeight: '700' },
  inventoryGrid: {
    flexDirection: 'row', gap: 8, marginBottom: 8,
  },
  inventoryStat: {
    flex: 1, borderRadius: 10, padding: 10, alignItems: 'center',
  },
  inventoryStatValue: { fontSize: 16, fontWeight: '800' },
  inventoryStatLabel: { fontSize: 9, textTransform: 'uppercase', marginTop: 2 },
  inventoryProfitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  inventoryProfitLabel: { fontSize: 12, fontWeight: '600' },
  inventoryProfitValue: { fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'right' },
  inventoryAvg: { fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 10 },
  addPurchaseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1565C0', borderRadius: 12, padding: 12,
  },
  addPurchaseBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dupeCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.12)', borderRadius: 10, padding: 10,
    marginTop: 8,
  },
  dupeCountText: { fontSize: 12, color: '#FF9800', fontWeight: '600', flex: 1 },

  // Purchase / Sale History Cards
  historyCard: {
    borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  historyCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  historyCardTitle: { fontSize: 15, fontWeight: '800', color: '#4da6ff', flex: 1 },
  historyCountBadge: {
    backgroundColor: 'rgba(77, 166, 255, 0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  historyCountText: { fontSize: 12, color: '#4da6ff', fontWeight: '700' },
  historyEntry: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#222',
  },
  historyEntryLeft: { flex: 1, marginRight: 12 },
  historyEntryDate: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  historyEntrySource: { fontSize: 11, color: '#666', marginTop: 2 },
  historyEntryNotes: { fontSize: 10, color: '#555', marginTop: 2, fontStyle: 'italic' },
  historyEntryRight: { alignItems: 'flex-end' },
  historyEntryPrice: { fontSize: 15, fontWeight: '800', color: '#fff' },
  historyEntryQty: { fontSize: 11, color: '#888', fontWeight: '600', marginTop: 2 },

  // Section divider in edit mode
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, marginBottom: 6,
    borderTopWidth: 1, borderTopColor: '#222', paddingTop: 12,
  },
  sectionDividerText: { fontSize: 13, fontWeight: '700', color: '#FFD700' },

  // Allocation chips
  allocationRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  allocChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#0f0f23', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#333',
  },
  allocChipActive: { backgroundColor: '#333', borderColor: '#FFD700' },
  allocChipText: { fontSize: 12, color: '#888', fontWeight: '600' },
  allocChipTextActive: { color: '#fff' },

  // Allocation badge (view mode)
  allocBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0f0f23', borderRadius: 10, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#333',
  },
  allocBadgeText: { fontSize: 13, fontWeight: '700' },

  // Variations section
  variationsSection: {
    marginTop: 12, marginBottom: 4,
  },
  variationsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  variationsTitle: { fontSize: 13, fontWeight: '700', color: '#FF9800' },
  variationsTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variationTag: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  variationTagText: { fontSize: 11, color: '#FF9800', fontWeight: '600' },

  // Swipe Navigation Bar
  swipeNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  swipeNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  swipeNavBtnDisabled: {
    opacity: 0.3,
  },
  swipeNavBtnText: {
    fontSize: 12,
    color: '#4da6ff',
    fontWeight: '600',
  },
  swipeNavBtnTextDisabled: {
    color: '#333',
  },
  swipeNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeNavPosition: {
    fontSize: 12,
    color: '#888',
    fontWeight: '700',
  },
});

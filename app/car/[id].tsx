import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllCars, updateCar, deleteCar } from '../../src/services/storage';
import { HotWheelCar } from '../../src/types';
import { searchCarValue } from '../../src/services/nvidia';
import { getSettings } from '../../src/services/storage';
import AdBanner from '../../src/components/AdBanner';

export default function CarDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const router = useRouter();
  const [car, setCar] = useState<HotWheelCar | null>(null);
  const [editing, setEditing] = useState(false);
  const [searching, setSearching] = useState(false);

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

  useEffect(() => {
    loadCar();
  }, [id]);

  const loadCar = async () => {
    const cars = await getAllCars();
    const found = cars.find((c) => c.id === id);
    if (found) {
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
      if (found.isSold) {
        setSoldPrice(found.soldPrice?.toString() || '');
        setSoldPlatform(found.soldPlatform || '');
        setSoldNotes(found.soldNotes || '');
      }
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
    };
    await updateCar(updated);
    setCar(updated);
    setEditing(false);
    Alert.alert('Saved', 'Car details updated!');
  };

  const handleMarkSold = async () => {
    if (!car) return;
    const price = parseFloat(soldPrice);
    if (!price || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid sold price.');
      return;
    }
    const profit = price - car.buyPrice;
    const roi = car.buyPrice > 0 ? ((profit / car.buyPrice) * 100).toFixed(1) : '0';

    Alert.alert(
      'Confirm Sale',
      `Sold "${car.name}" for ₹${price.toLocaleString('en-IN')}\n\n` +
      `Buy Price: ₹${car.buyPrice.toLocaleString('en-IN')}\n` +
      `Profit: ${profit >= 0 ? '+' : ''}₹${profit.toLocaleString('en-IN')}\n` +
      `ROI: ${roi}%`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Sold',
          onPress: async () => {
            const updated: HotWheelCar = {
              ...car,
              isSold: true,
              soldPrice: price,
              soldDate: new Date().toISOString(),
              soldPlatform: soldPlatform.trim(),
              soldNotes: soldNotes.trim(),
            };
            await updateCar(updated);
            setCar(updated);
            setShowSoldModal(false);
            Alert.alert(
              'Sold!',
              `${car.name} marked as sold.\nProfit: ₹${profit.toLocaleString('en-IN')} (${roi}% ROI)`
            );
          },
        },
      ]
    );
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
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#4da6ff" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(!editing)}
            >
              <MaterialIcons name={editing ? "close" : "edit"} size={18} color="#fff" />
              <Text style={styles.editButtonText}>{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <MaterialIcons name="delete" size={18} color="#e63946" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image */}
        {car.images.length > 0 && (
          <Image source={{ uri: car.images[0] }} style={styles.heroImage} resizeMode="cover" />
        )}

        {/* Collection toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelContainer}>
            {car.inCollection ? (
              <MaterialCommunityIcons name="car" size={18} color="#4caf50" />
            ) : (
              <MaterialIcons name="star" size={18} color="#FFD700" />
            )}
            <Text style={styles.toggleLabel}>
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

        {/* Details card */}
        <View style={styles.card}>
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
            </>
          ) : (
            <>
              <Text style={styles.carName}>{car.name}</Text>
              <Text style={styles.carSub}>{car.year} · {car.model || car.name}</Text>
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
              </View>

              <View style={styles.detailGrid}>
                {car.color ? <DetailItem label="Color" value={car.color} icon="palette" /> : null}
                {car.scale ? <DetailItem label="Scale" value={car.scale} icon="straighten" /> : null}
                {car.manufacturer ? <DetailItem label="Manufacturer" value={car.manufacturer} icon="business" /> : null}
                {car.wheelType ? <DetailItem label="Wheels" value={car.wheelType} icon="loop" /> : null}
                {car.baseColor ? <DetailItem label="Base Color" value={car.baseColor} icon="square" /> : null}
                {car.tampos ? <DetailItem label="Tampos" value={car.tampos} icon="brush" /> : null}
                {car.barcode ? <DetailItem label="Barcode" value={car.barcode} icon="barcode" /> : null}
              </View>

              {/* Price Range */}
              {car.priceRange && car.priceRange.min > 0 && (
                <View style={styles.priceRangeSection}>
                  <View style={styles.priceRangeHeader}>
                    <MaterialIcons name="show-chart" size={16} color="#4caf50" />
                    <Text style={styles.priceRangeTitle}>Collectable Value Range</Text>
                  </View>
                  <View style={styles.priceRangeRow}>
                    <View style={styles.priceRangeBox}>
                      <Text style={styles.priceRangeLabel}>Low</Text>
                      <Text style={styles.priceRangeValue}>₹{car.priceRange.min.toLocaleString('en-IN')}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={16} color="#555" />
                    <View style={styles.priceRangeBox}>
                      <Text style={styles.priceRangeLabel}>Avg</Text>
                      <Text style={[styles.priceRangeValue, { color: '#4caf50' }]}>₹{car.priceRange.avg.toLocaleString('en-IN')}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={16} color="#555" />
                    <View style={styles.priceRangeBox}>
                      <Text style={styles.priceRangeLabel}>High</Text>
                      <Text style={styles.priceRangeValue}>₹{car.priceRange.max.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.priceSection}>
                <View style={styles.priceBox}>
                  <MaterialIcons name="attach-money" size={16} color="#888" />
                  <Text style={styles.priceLabel}>Paid</Text>
                  <Text style={styles.priceValue}>
                    ₹{car.buyPrice > 0 ? car.buyPrice.toLocaleString('en-IN') : '—'}
                  </Text>
                </View>
                <View style={styles.priceBox}>
                  <MaterialIcons name="trending-up" size={16} color="#4caf50" />
                  <Text style={styles.priceLabel}>Market Value</Text>
                  <Text style={[styles.priceValue, { color: '#4caf50' }]}>
                    ₹{(car.priceINR || car.expectedPrice) > 0 ? (car.priceINR || car.expectedPrice).toLocaleString('en-IN') : '—'}
                  </Text>
                </View>
                {car.buyPrice > 0 && (car.priceINR || car.expectedPrice) > 0 && (
                  <View style={styles.priceBox}>
                    <MaterialIcons name="show-chart" size={16} color="#888" />
                    <Text style={styles.priceLabel}>ROI</Text>
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
                <View style={styles.priceSourcesCard}>
                  <View style={styles.priceSourcesHeader}>
                    <MaterialIcons name="verified" size={16} color="#4da6ff" />
                    <Text style={styles.priceSourcesTitle}>Collector References</Text>
                  </View>
                  {car.priceSources.map((source, idx) => (
                    <View key={idx} style={styles.priceSourceRow}>
                      <View style={styles.priceSourceLeft}>
                        <Text style={styles.priceSourceStore}>{source.source || 'Collector'}</Text>
                        {source.reference ? (
                          <Text style={styles.priceSourceRef}>{source.reference}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.priceSourcePrice}>₹{source.price.toLocaleString('en-IN')}</Text>
                    </View>
                  ))}
                </View>
              )}

              {car.history ? (
                <View style={styles.historySection}>
                  <View style={styles.historyHeader}>
                    <MaterialIcons name="history-edu" size={16} color="#FFD700" />
                    <Text style={styles.historyTitle}>Car History & Background</Text>
                  </View>
                  <Text style={styles.historyText}>{car.history}</Text>
                </View>
              ) : null}

              {car.remarks ? (
                <View style={styles.remarksSection}>
                  <View style={styles.remarksHeader}>
                    <MaterialIcons name="notes" size={16} color="#4da6ff" />
                    <Text style={styles.remarksTitle}>Market Info</Text>
                  </View>
                  <Text style={styles.remarksText}>{car.remarks}</Text>
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
                <Text style={styles.undoSoldText}>Undo</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.soldBannerDetails}>
              <View style={styles.soldDetailRow}>
                <Text style={styles.soldDetailLabel}>Sold For</Text>
                <Text style={styles.soldDetailValue}>₹{car.soldPrice.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.soldDetailRow}>
                <Text style={styles.soldDetailLabel}>Buy Price</Text>
                <Text style={styles.soldDetailValue}>₹{car.buyPrice.toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.soldDetailRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8, marginTop: 4 }]}>
                <Text style={styles.soldDetailLabel}>Profit</Text>
                <Text style={[styles.soldDetailValue, { color: car.soldPrice >= car.buyPrice ? '#4caf50' : '#e63946', fontSize: 18, fontWeight: '900' }]}>                  {car.soldPrice >= car.buyPrice ? '+' : ''}₹{(car.soldPrice - car.buyPrice).toLocaleString('en-IN')}                </Text>
              </View>
              {car.buyPrice > 0 && (
                <View style={styles.soldDetailRow}>
                  <Text style={styles.soldDetailLabel}>ROI</Text>
                  <Text style={[styles.soldDetailValue, { color: car.soldPrice >= car.buyPrice ? '#4caf50' : '#e63946' }]}>                    {(((car.soldPrice - car.buyPrice) / car.buyPrice) * 100).toFixed(1)}%                  </Text>
                </View>
              )}
              {car.soldPlatform ? (
                <View style={styles.soldDetailRow}>
                  <Text style={styles.soldDetailLabel}>Platform</Text>
                  <Text style={styles.soldDetailValue}>{car.soldPlatform}</Text>
                </View>
              ) : null}
              {car.soldDate ? (
                <View style={styles.soldDetailRow}>
                  <Text style={styles.soldDetailLabel}>Date</Text>
                  <Text style={styles.soldDetailValue}>{new Date(car.soldDate).toLocaleDateString('en-IN')}</Text>
                </View>
              ) : null}
              {car.soldNotes ? (
                <Text style={styles.soldNotes}>{car.soldNotes}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Action buttons */}
        {editing ? (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <MaterialIcons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Mark as Sold button */}
            {!car.isSold && car.buyPrice > 0 && (
              <TouchableOpacity
                style={styles.soldButton}
                onPress={() => setShowSoldModal(true)}
              >
                <MaterialIcons name="sell" size={20} color="#fff" />
                <Text style={styles.soldButtonText}>Mark as Sold</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearchValue}
              disabled={searching}
            >
              <MaterialIcons name="search" size={18} color="#4da6ff" />
              <Text style={styles.searchButtonText}>
                {searching ? 'Searching...' : 'Search Market Value (INR)'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Sold Modal */}
        {showSoldModal && (
          <View style={styles.soldModalOverlay}>
            <View style={styles.soldModal}>
              <View style={styles.soldModalHeader}>
                <MaterialIcons name="sell" size={24} color="#4caf50" />
                <Text style={styles.soldModalTitle}>Mark as Sold</Text>
                <TouchableOpacity onPress={() => setShowSoldModal(false)}>
                  <MaterialIcons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <View style={styles.soldModalProfitPreview}>
                <Text style={styles.soldModalProfitLabel}>Buy Price: ₹{car.buyPrice.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="attach-money" size={16} color="#4caf50" />
                  <Text style={styles.soldInputLabel}>Sold Price (₹) *</Text>
                </View>
                <TextInput
                  style={styles.soldInput}
                  placeholder="Enter sold price"
                  placeholderTextColor="#555"
                  value={soldPrice}
                  onChangeText={setSoldPrice}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                {soldPrice && parseFloat(soldPrice) > 0 && car.buyPrice > 0 && (
                  <View style={styles.soldProfitCalc}>
                    <Text style={styles.soldProfitCalcText}>Profit: </Text>
                    <Text style={[styles.soldProfitCalcValue, {
                      color: parseFloat(soldPrice) >= car.buyPrice ? '#4caf50' : '#e63946'
                    }]}>
                      {parseFloat(soldPrice) >= car.buyPrice ? '+' : ''}
                      ₹{(parseFloat(soldPrice) - car.buyPrice).toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.soldProfitCalcRoi, {
                      color: parseFloat(soldPrice) >= car.buyPrice ? '#4caf50' : '#e63946'
                    }]}>
                      ({(((parseFloat(soldPrice) - car.buyPrice) / car.buyPrice) * 100).toFixed(1)}% ROI)
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="store" size={16} color="#42A5F5" />
                  <Text style={styles.soldInputLabel}>Platform</Text>
                </View>
                <TextInput
                  style={styles.soldInput}
                  placeholder="e.g. eBay, Mercari, FB Marketplace"
                  placeholderTextColor="#555"
                  value={soldPlatform}
                  onChangeText={setSoldPlatform}
                />
              </View>

              <View style={styles.soldInputGroup}>
                <View style={styles.soldInputLabelRow}>
                  <MaterialIcons name="notes" size={16} color="#FFD700" />
                  <Text style={styles.soldInputLabel}>Notes</Text>
                </View>
                <TextInput
                  style={[styles.soldInput, { minHeight: 50 }]}
                  placeholder="Buyer info, shipping, etc."
                  placeholderTextColor="#555"
                  value={soldNotes}
                  onChangeText={setSoldNotes}
                  multiline
                />
              </View>

              <View style={styles.soldModalActions}>
                <TouchableOpacity style={styles.soldCancelBtn} onPress={() => setShowSoldModal(false)}>
                  <Text style={styles.soldCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.soldConfirmBtn} onPress={handleMarkSold}>
                  <MaterialIcons name="check" size={18} color="#fff" />
                  <Text style={styles.soldConfirmBtnText}>Confirm Sale</Text>
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
          <Text style={styles.metaText}>
            Added: {new Date(car.dateAdded).toLocaleDateString('en-IN')}
          </Text>
        </View>
      </ScrollView>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  icon?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
}) {
  return (
    <View style={fieldStyles.container}>
      <View style={fieldStyles.labelRow}>
        {icon && <MaterialIcons name={icon as any} size={14} color="#888" />}
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#555"
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
    color: '#888',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    color: '#fff',
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
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { paddingBottom: 100 },
  loadingText: { color: '#888', textAlign: 'center', marginTop: 100 },
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
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#2a1a1a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroImage: {
    width: '100%',
    height: 220,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  toggleLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  carName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  carSub: { fontSize: 14, color: '#888', marginTop: 2 },
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
  detailLabel: { fontSize: 13, color: '#888' },
  detailValue: { fontSize: 13, color: '#fff', fontWeight: '600' },
  priceRangeSection: {
    backgroundColor: '#0a2a1a',
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
  priceRangeLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase' },
  priceRangeValue: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 },
  priceSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#0f0f23',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  priceLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', marginTop: 4 },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#4da6ff', marginTop: 2 },
  priceSourcesCard: {
    backgroundColor: '#0f0f23',
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
  priceSourceStore: { fontSize: 13, color: '#ccc', fontWeight: '600' },
  priceSourceRef: { fontSize: 10, color: '#666', marginTop: 1 },
  priceSourcePrice: { fontSize: 13, color: '#4caf50', fontWeight: '800' },
  historySection: {
    marginTop: 14,
    backgroundColor: '#1a1a2e',
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
  historyText: { fontSize: 13, color: '#ccc', lineHeight: 20 },
  remarksSection: { marginTop: 12 },
  remarksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  remarksTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff' },
  remarksText: { fontSize: 13, color: '#aaa', lineHeight: 18 },
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
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
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
    backgroundColor: '#0a2a1a', borderRadius: 14, padding: 16,
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
  soldDetailLabel: { fontSize: 12, color: '#888' },
  soldDetailValue: { fontSize: 14, color: '#fff', fontWeight: '700' },
  soldNotes: { fontSize: 12, color: '#aaa', marginTop: 8, fontStyle: 'italic', lineHeight: 18 },

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
    backgroundColor: '#1a1a2e', borderRadius: 18, padding: 20, width: '100%',
    borderWidth: 1, borderColor: '#4caf50',
  },
  soldModalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
  },
  soldModalTitle: { fontSize: 18, fontWeight: '800', color: '#4caf50', flex: 1 },
  soldModalProfitPreview: {
    backgroundColor: '#0f0f23', borderRadius: 10, padding: 10, marginBottom: 16,
  },
  soldModalProfitLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  soldInputGroup: { marginBottom: 14 },
  soldInputLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  soldInputLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase' },
  soldInput: {
    backgroundColor: '#0f0f23', borderRadius: 10, borderWidth: 1, borderColor: '#333',
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16, fontWeight: '600',
  },
  soldProfitCalc: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: '#0f0f23', borderRadius: 8, padding: 10,
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
});

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
import { getAllCars, updateCar, deleteCar } from '../../src/services/storage';
import { HotWheelCar } from '../../src/types';
import { searchCarValue } from '../../src/services/nvidia';
import { getSettings } from '../../src/services/storage';

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
      Alert.alert(
        'Market Value',
        `Estimated: ${result.estimatedValue}\n\n${result.searchInfo}`,
      );
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
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(!editing)}
            >
              <Text style={styles.editButtonText}>{editing ? '✕ Cancel' : '✏️ Edit'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image */}
        {car.images.length > 0 && (
          <Image source={{ uri: car.images[0] }} style={styles.heroImage} resizeMode="cover" />
        )}

        {/* Collection toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {car.inCollection ? '🏎️ In Garage' : '⭐ In Wishlist'}
          </Text>
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
              <Field label="Name" value={name} onChange={setName} />
              <Field label="Year" value={year} onChange={setYear} />
              <Field label="Model / Casting" value={model} onChange={setModel} />
              <Field label="Series" value={series} onChange={setSeries} />
              <Field label="Color" value={color} onChange={setColor} />
              <Field label="Rarity" value={rarity} onChange={setRarity} />
              <Field label="Condition" value={condition} onChange={setCondition} />
              <Field label="Buy Price" value={buyPrice} onChange={setBuyPrice} />
              <Field label="Expected Price" value={expectedPrice} onChange={setExpectedPrice} />
              <Field label="Remarks" value={remarks} onChange={setRemarks} multiline />
            </>
          ) : (
            <>
              <Text style={styles.carName}>{car.name}</Text>
              <Text style={styles.carSub}>{car.year} · {car.model || car.name}</Text>
              <View style={styles.tags}>
                {car.rarity ? (
                  <View style={[styles.tag, styles.tagRarity]}>
                    <Text style={styles.tagText}>{car.rarity}</Text>
                  </View>
                ) : null}
                {car.condition ? (
                  <View style={[styles.tag, styles.tagCondition]}>
                    <Text style={styles.tagText}>{car.condition}</Text>
                  </View>
                ) : null}
                {car.series ? (
                  <View style={[styles.tag, styles.tagSeries]}>
                    <Text style={styles.tagText}>{car.series}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.detailGrid}>
                <DetailItem label="Color" value={car.color} />
                <DetailItem label="Scale" value={car.scale} />
                <DetailItem label="Manufacturer" value={car.manufacturer} />
                <DetailItem label="Wheels" value={car.wheelType} />
                <DetailItem label="Base Color" value={car.baseColor} />
                <DetailItem label="Tampos" value={car.tampos} />
                <DetailItem label="Barcode" value={car.barcode} />
              </View>

              <View style={styles.priceSection}>
                <View style={styles.priceBox}>
                  <Text style={styles.priceLabel}>Paid</Text>
                  <Text style={styles.priceValue}>
                    ${car.buyPrice > 0 ? car.buyPrice.toFixed(2) : '—'}
                  </Text>
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.priceLabel}>Market Value</Text>
                  <Text style={[styles.priceValue, { color: '#4caf50' }]}>
                    ${car.expectedPrice > 0 ? car.expectedPrice.toFixed(2) : '—'}
                  </Text>
                </View>
                {car.buyPrice > 0 && car.expectedPrice > 0 && (
                  <View style={styles.priceBox}>
                    <Text style={styles.priceLabel}>ROI</Text>
                    <Text
                      style={[
                        styles.priceValue,
                        { color: car.expectedPrice >= car.buyPrice ? '#4caf50' : '#e63946' },
                      ]}
                    >
                      {(((car.expectedPrice - car.buyPrice) / car.buyPrice) * 100).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>

              {car.remarks ? (
                <View style={styles.remarksSection}>
                  <Text style={styles.remarksTitle}>📝 Notes</Text>
                  <Text style={styles.remarksText}>{car.remarks}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Action buttons */}
        {editing ? (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>💾 Save Changes</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearchValue}
              disabled={searching}
            >
              <Text style={styles.searchButtonText}>
                {searching ? '🔍 Searching...' : '🔍 Search Market Value'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Metadata */}
        <View style={styles.metaSection}>
          <Text style={styles.metaText}>
            Added: {new Date(car.dateAdded).toLocaleDateString()}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#555"
        multiline={multiline}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 10 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
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

function DetailItem({ label, value }: { label: string; value: string }) {
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
  scroll: { paddingBottom: 100 },
  loadingText: { color: '#888', textAlign: 'center', marginTop: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: { padding: 8 },
  backButtonText: { color: '#4da6ff', fontSize: 16, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8 },
  editButton: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#3d1c00',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: { fontSize: 16 },
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  tagRarity: { backgroundColor: '#3d1c00' },
  tagCondition: { backgroundColor: '#002233' },
  tagSeries: { backgroundColor: '#1a1a00' },
  tagText: { fontSize: 11, color: '#ccc', fontWeight: '600' },
  detailGrid: { marginTop: 14 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  detailLabel: { fontSize: 13, color: '#888' },
  detailValue: { fontSize: 13, color: '#fff', fontWeight: '600' },
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
  priceLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase' },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#4da6ff', marginTop: 2 },
  remarksSection: { marginTop: 12 },
  remarksTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff', marginBottom: 4 },
  remarksText: { fontSize: 13, color: '#aaa', lineHeight: 18 },
  saveButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  searchButtonText: { color: '#4da6ff', fontSize: 14, fontWeight: '600' },
  metaSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  metaText: { fontSize: 11, color: '#555', textAlign: 'center' },
});

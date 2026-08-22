import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { addCar } from '../../src/services/storage';

export default function AddScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [series, setSeries] = useState('');
  const [color, setColor] = useState('');
  const [model, setModel] = useState('');
  const [scale, setScale] = useState('1:64');
  const [rarity, setRarity] = useState('Mainline');
  const [condition, setCondition] = useState('Mint');
  const [buyPrice, setBuyPrice] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [remarks, setRemarks] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [inCollection, setInCollection] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [manufacturer, setManufacturer] = useState('Mattel');
  const [tampos, setTampos] = useState('');
  const [wheelType, setWheelType] = useState('');
  const [baseColor, setBaseColor] = useState('');
  const [saving, setSaving] = useState(false);

  const addImage = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      }
      if (!result.canceled && result.assets[0]) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a car name.');
      return;
    }
    setSaving(true);
    try {
      const car = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        year: year.trim(),
        series: series.trim(),
        color: color.trim(),
        model: model.trim(),
        scale: scale.trim(),
        rarity,
        condition,
        buyPrice: parseFloat(buyPrice) || 0,
        expectedPrice: parseFloat(expectedPrice) || 0,
        remarks: remarks.trim(),
        images,
        inCollection,
        dateAdded: new Date().toISOString(),
        barcode: barcode.trim(),
        manufacturer: manufacturer.trim(),
        tampos: tampos.trim(),
        wheelType: wheelType.trim(),
        baseColor: baseColor.trim(),
      };
      await addCar(car);
      Alert.alert('Saved! 🏎️', `${car.name} added to your ${inCollection ? 'Garage' : 'Wishlist'}!`, [
        {
          text: `View ${inCollection ? 'Garage' : 'Wishlist'}`,
          onPress: () => router.push(inCollection ? '/(tabs)/garage' : '/(tabs)/wishlist'),
        },
        { text: 'Add Another', onPress: resetForm },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setYear('');
    setSeries('');
    setColor('');
    setModel('');
    setScale('1:64');
    setRarity('Mainline');
    setCondition('Mint');
    setBuyPrice('');
    setExpectedPrice('');
    setRemarks('');
    setImages([]);
    setBarcode('');
    setManufacturer('Mattel');
    setTampos('');
    setWheelType('');
    setBaseColor('');
  };

  const RARITIES = ['Mainline', 'Treasure Hunt', 'Super Treasure Hunt', 'Zamac', 'Factory Sealed', 'Premium', 'Hot Wheels id', 'RLC', 'Other'];
  const CONDITIONS = ['Mint', 'Near Mint', 'Good', 'Fair', 'Poor', 'Damaged'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>➕ Add Car</Text>
          <Text style={styles.headerSub}>Manually enter your Hot Wheels car details</Text>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
            {images.map((uri, i) => (
              <TouchableOpacity key={i} onLongPress={() => removeImage(i)}>
                <Image source={{ uri }} style={styles.thumbImage} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(i)}>
                  <Text style={styles.removeImageBtnText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addImageButton} onPress={() => addImage(true)}>
              <Text style={styles.addImageIcon}>📸</Text>
              <Text style={styles.addImageText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addImageButton} onPress={() => addImage(false)}>
              <Text style={styles.addImageIcon}>🖼️</Text>
              <Text style={styles.addImageText}>Gallery</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Basic Info</Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., 1967 Custom Camaro" placeholderTextColor="#555" />

          <Text style={styles.label}>Year</Text>
          <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="e.g., 2023" placeholderTextColor="#555" keyboardType="numeric" />

          <Text style={styles.label}>Model / Casting</Text>
          <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="e.g., Custom Camaro" placeholderTextColor="#555" />

          <Text style={styles.label}>Series</Text>
          <TextInput style={styles.input} value={series} onChangeText={setSeries} placeholder="e.g., HW primaries, Fast & Furious" placeholderTextColor="#555" />

          <Text style={styles.label}>Color</Text>
          <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="e.g., Blue" placeholderTextColor="#555" />

          <Text style={styles.label}>Scale</Text>
          <TextInput style={styles.input} value={scale} onChangeText={setScale} placeholder="1:64" placeholderTextColor="#555" />

          <Text style={styles.label}>Manufacturer</Text>
          <TextInput style={styles.input} value={manufacturer} onChangeText={setManufacturer} placeholder="Mattel" placeholderTextColor="#555" />

          <Text style={styles.label}>Barcode / UPC</Text>
          <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Optional" placeholderTextColor="#555" keyboardType="numeric" />
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏷️ Details</Text>

          <Text style={styles.label}>Rarity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {RARITIES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, rarity === r && styles.chipActive]}
                onPress={() => setRarity(r)}
              >
                <Text style={[styles.chipText, rarity === r && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Condition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, condition === c && styles.chipActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Tampos / Decoration</Text>
          <TextInput style={styles.input} value={tampos} onChangeText={setTampos} placeholder="Side decoration details" placeholderTextColor="#555" />

          <Text style={styles.label}>Wheel Type</Text>
          <TextInput style={styles.input} value={wheelType} onChangeText={setWheelType} placeholder="e.g., 10SP, MC5, OH5" placeholderTextColor="#555" />

          <Text style={styles.label}>Base Color</Text>
          <TextInput style={styles.input} value={baseColor} onChangeText={setBaseColor} placeholder="e.g., unpainted metal, black" placeholderTextColor="#555" />
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Pricing</Text>

          <Text style={styles.label}>Buy Price ($)</Text>
          <TextInput style={styles.input} value={buyPrice} onChangeText={setBuyPrice} placeholder="0.00" placeholderTextColor="#555" keyboardType="decimal-pad" />

          <Text style={styles.label}>Expected Market Value ($)</Text>
          <TextInput style={styles.input} value={expectedPrice} onChangeText={setExpectedPrice} placeholder="0.00" placeholderTextColor="#555" keyboardType="decimal-pad" />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Additional notes, purchase location, etc."
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Collection toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {inCollection ? '🏎️ Add to Garage (I own this)' : '⭐ Add to Wishlist (I want this)'}
          </Text>
          <Switch
            value={inCollection}
            onValueChange={setInCollection}
            trackColor={{ false: '#333', true: '#1b5e20' }}
            thumbColor={inCollection ? '#4caf50' : '#888'}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : inCollection ? '🏎️ Save to Garage' : '⭐ Save to Wishlist'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingTop: 55, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imageRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  thumbImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e63946',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageIcon: { fontSize: 24 },
  addImageText: { fontSize: 10, color: '#888', marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: {
    backgroundColor: '#3d1c00',
    borderColor: '#e63946',
  },
  chipText: { fontSize: 12, color: '#888' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  saveButton: {
    backgroundColor: '#e63946',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

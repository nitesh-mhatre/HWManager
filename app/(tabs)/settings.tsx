import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getSettings, saveSettings, getAllCars } from '../../src/services/storage';
import { fetchModels } from '../../src/services/nvidia';
import { NvidiaSettings, HotWheelCar } from '../../src/types';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NvidiaSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, garage: 0, wishlist: 0, totalValue: 0 });

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    if (s) {
      setSettings(s);
      setApiKey(s.apiKey);
      setBaseUrl(s.baseUrl);
      setSelectedModel(s.model);
      setLoadingModels(true);
      try {
        const m = await fetchModels(s.apiKey, s.baseUrl);
        setModels(m);
      } catch {}
      setLoadingModels(false);
    }
  };

  const loadStats = async () => {
    const cars = await getAllCars();
    const garage = cars.filter((c) => c.inCollection);
    const wishlist = cars.filter((c) => !c.inCollection);
    const totalValue = garage.reduce((sum, c) => sum + (c.priceINR || c.expectedPrice || 0), 0);
    setStats({
      total: cars.length,
      garage: garage.length,
      wishlist: wishlist.length,
      totalValue,
    });
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setLoadingModels(true);
    try {
      const m = await fetchModels(apiKey.trim(), baseUrl.trim());
      setModels(m);
    } catch (e: any) {
      Alert.alert('Error', `Failed to fetch models: ${e.message}`);
    }
    setLoadingModels(false);
  };

  const handleSave = async () => {
    if (!apiKey.trim() || !selectedModel) {
      Alert.alert('Required', 'Please enter API key and select a model.');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: selectedModel,
      });
      Alert.alert('Saved', 'Settings updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSaving(false);
  };

  const handleExportData = async () => {
    const cars = await getAllCars();
    Alert.alert('Export Data', `${cars.length} cars in collection.\n\nExport as JSON to clipboard coming soon.`);
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your cars and settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.clear();
            Alert.alert('Done', 'All data cleared. Restart the app to set up again.', [
              { text: 'OK' },
            ]);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialIcons name="settings" size={28} color="#e63946" />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="car" size={20} color="#e63946" />
          <Text style={styles.statValue}>{stats.garage}</Text>
          <Text style={styles.statLabel}>Garage</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MaterialIcons name="star" size={20} color="#FFD700" />
          <Text style={styles.statValue}>{stats.wishlist}</Text>
          <Text style={styles.statLabel}>Wishlist</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MaterialIcons name="trending-up" size={20} color="#4caf50" />
          <Text style={[styles.statValue, { color: '#4caf50' }]}>₹{stats.totalValue.toLocaleString('en-IN')}</Text>
          <Text style={styles.statLabel}>Value</Text>
        </View>
      </View>

      {/* API Configuration */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="vpn-key" size={18} color="#4da6ff" />
          <Text style={styles.sectionTitle}>NVIDIA API Configuration</Text>
        </View>

        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://integrate.api.nvidia.com/v1"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="nvapi-xxxx"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleFetchModels}
          disabled={loadingModels}
        >
          {loadingModels ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialIcons name="refresh" size={16} color="#fff" />
              <Text style={styles.secondaryButtonText}>Refresh Models</Text>
            </View>
          )}
        </TouchableOpacity>

        {models.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Selected Model</Text>
            <ScrollView style={styles.modelList} nestedScrollEnabled>
              {models.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.modelItem,
                    selectedModel === m && styles.modelItemActive,
                  ]}
                  onPress={() => setSelectedModel(m)}
                >
                  <View style={styles.radio}>
                    <View style={[styles.radioInner, selectedModel === m && styles.radioActive]} />
                  </View>
                  <Text style={[styles.modelName, selectedModel === m && styles.modelNameActive]} numberOfLines={1}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialIcons name="save" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="storage" size={18} color="#4da6ff" />
          <Text style={styles.sectionTitle}>Data Management</Text>
        </View>

        <TouchableOpacity style={styles.menuItem} onPress={handleExportData}>
          <MaterialIcons name="file-upload" size={20} color="#888" />
          <View style={styles.menuInfo}>
            <Text style={styles.menuLabel}>Export Collection</Text>
            <Text style={styles.menuDesc}>{stats.total} cars total</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleClearAllData}>
          <MaterialIcons name="delete-forever" size={20} color="#e63946" />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: '#e63946' }]}>Clear All Data</Text>
            <Text style={styles.menuDesc}>Delete all cars and settings</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Export */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="file-download" size={18} color="#4caf50" />
          <Text style={styles.sectionTitle}>Export Collection</Text>
        </View>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Download your collection data for backup or sharing.</Text>
        <TouchableOpacity style={styles.saveButton} onPress={async () => {
          try {
            const { generateCSV, getAllCars } = require('../../src/services/storage');
            const { Paths, File } = await import('expo-file-system');
            const Share = (await import('expo-sharing'));
            const cars = await getAllCars();
            if (cars.length === 0) {
              Alert.alert('Empty', 'No cars to export.');
              return;
            }
            const csv = generateCSV(cars);
            const file = new File(Paths.cache, 'hotwheels-collection.csv');
            await file.write(csv);
            await Share.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Collection CSV' });
          } catch (e: any) {
            Alert.alert('Export Failed', e.message);
          }
        }}>
          <MaterialIcons name="table-chart" size={18} color="#fff" />
          <Text style={styles.saveButtonText}>Export as CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#1565C0', marginTop: 8 }]} onPress={async () => {
          try {
            const { generateJSON, getAllCars } = require('../../src/services/storage');
            const { Paths, File } = await import('expo-file-system');
            const Share = (await import('expo-sharing'));
            const cars = await getAllCars();
            if (cars.length === 0) {
              Alert.alert('Empty', 'No cars to export.');
              return;
            }
            const json = generateJSON(cars);
            const file = new File(Paths.cache, 'hotwheels-collection.json');
            await file.write(json);
            await Share.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Collection JSON' });
          } catch (e: any) {
            Alert.alert('Export Failed', e.message);
          }
        }}>
          <MaterialIcons name="code" size={18} color="#fff" />
          <Text style={styles.saveButtonText}>Export as JSON</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="info" size={18} color="#4da6ff" />
          <Text style={styles.sectionTitle}>About</Text>
        </View>
        <Text style={styles.aboutText}>
          Hot Wheels Recorder v1.0{'\n\n'}
          Track your Hot Wheels collection, scan cars with AI, and monitor market values in INR.{'\n\n'}
          Powered by NVIDIA free-tier AI APIs for car identification and value estimation.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 100 },
  header: { marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase' },
  statDivider: { width: 1, backgroundColor: '#333', marginVertical: 4 },
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  secondaryButton: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modelList: { maxHeight: 200, marginTop: 4 },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 2,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#222',
  },
  modelItemActive: { borderColor: '#e63946', backgroundColor: '#1a0a0c' },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioInner: { width: 6, height: 6, borderRadius: 3 },
  radioActive: { backgroundColor: '#e63946' },
  modelName: { fontSize: 12, color: '#888', flex: 1 },
  modelNameActive: { color: '#fff', fontWeight: '600' },
  saveButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  menuDesc: { fontSize: 12, color: '#666', marginTop: 1 },
  aboutText: { fontSize: 13, color: '#888', lineHeight: 20 },
});

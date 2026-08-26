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
import { getSettings, saveSettings, getAllCars, createBackupFile, restoreBackup, setManualMode, isManualMode } from '../../src/services/storage';
import { fetchModels, PROVIDER_DEFAULTS } from '../../src/services/nvidia';
import { NvidiaSettings, HotWheelCar, ApiProvider } from '../../src/types';
import { File } from 'expo-file-system';
import { useTheme } from '../../src/context/ThemeContext';
import { hapticLight } from '../../src/services/haptics';

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, colors, toggleTheme, isDark } = useTheme();
  const [settings, setSettings] = useState<NvidiaSettings | null>(null);
  const [provider, setProvider] = useState<ApiProvider>('nvidia');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, garage: 0, wishlist: 0, totalValue: 0 });
  const [manualMode, setManualModeState] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
    loadManualMode();
  }, []);

  const loadManualMode = async () => {
    const isManual = await isManualMode();
    setManualModeState(isManual);
  };

  const loadSettings = async () => {
    const s = await getSettings();
    if (s) {
      setSettings(s);
      setProvider(s.provider || 'nvidia');
      setApiKey(s.apiKey);
      setBaseUrl(s.baseUrl);
      setSelectedModel(s.model);
      setLoadingModels(true);
      try {
        const m = await fetchModels(s.apiKey, s.baseUrl, s.provider || 'nvidia');
        setModels(m);
      } catch {}
      setLoadingModels(false);
    }
  };

  const handleProviderChange = async (p: ApiProvider) => {
    setProvider(p);
    const defaults = PROVIDER_DEFAULTS[p];
    setBaseUrl(defaults.baseUrl);
    setSelectedModel('');
    setModels([]);
    if (apiKey.trim()) {
      setLoadingModels(true);
      try {
        const m = await fetchModels(apiKey.trim(), defaults.baseUrl, p);
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
      const m = await fetchModels(apiKey.trim(), baseUrl.trim(), provider);
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
        provider,
      });
      await setManualMode(false);
      setManualModeState(false);
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

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const fileUri = await createBackupFile();
      const Share = await import('expo-sharing');
      await Share.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Backup Hot Wheels Collection',
      });
      Alert.alert('Backup Created', 'Your backup has been shared. Save it to your desired location.');
    } catch (e: any) {
      Alert.alert('Backup Failed', e.message);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Backup',
      'This will replace your current collection with the backup data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            setRestoring(true);
            try {
              const result = await File.pickFileAsync({
                mimeTypes: ['application/json'],
              });

              if (result.canceled || !result.result) {
                setRestoring(false);
                return;
              }

              const pickedFile = result.result;
              const json = await pickedFile.text();
              const backup = JSON.parse(json);

              if (!backup.version || !backup.cars) {
                Alert.alert('Invalid Backup', 'This file does not appear to be a valid Hot Wheels backup.');
                setRestoring(false);
                return;
              }

              const { carsImported, imagesRestored } = await restoreBackup(backup);
              await loadStats();
              Alert.alert(
                'Restore Complete!',
                `Imported ${carsImported} cars and restored ${imagesRestored} images.`
              );
            } catch (e: any) {
              Alert.alert('Restore Failed', e.message);
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  };

  const toggleManualMode = async () => {
    const newValue = !manualMode;
    await setManualMode(newValue);
    setManualModeState(newValue);
    if (newValue) {
      Alert.alert('Manual Mode', 'App is now in Manual Mode. You can use all features without an API key. AI scanning features will not work until you set up an API key.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialIcons name="settings" size={28} color="#e63946" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

      {/* Theme Toggle */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="brightness-6" size={18} color={colors.info} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        </View>
        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: colors.border }]}
          onPress={() => { hapticLight(); toggleTheme(); }}
        >
          <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={24} color={isDark ? '#FFD700' : '#FF9800'} />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Text style={[styles.menuDesc, { color: colors.textMuted }]}>Currently using {isDark ? 'dark' : 'light'} theme</Text>
          </View>
          <View style={[styles.themeToggle, isDark && styles.themeToggleActive]}>
            <View style={[styles.themeToggleDot, isDark && styles.themeToggleDotActive]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Manual Mode */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="edit" size={18} color={colors.info} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>App Mode</Text>
        </View>
        <TouchableOpacity style={styles.menuItem} onPress={toggleManualMode}>
          <MaterialIcons name={manualMode ? 'toggle-on' : 'toggle-off'} size={28} color={manualMode ? '#4caf50' : '#555'} />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Manual Mode</Text>
            <Text style={[styles.menuDesc, { color: colors.textMuted }]}>
              {manualMode ? 'ON — Using app without API key' : 'OFF — API features available'}
            </Text>
          </View>
        </TouchableOpacity>
        {manualMode && (
          <View style={[styles.infoCallout, { backgroundColor: colors.infoBg }]}>
            <MaterialIcons name="info-outline" size={14} color={colors.info} />
            <Text style={[styles.infoCalloutText, { color: colors.info }]}>
              AI scanning is disabled. Add cars via Manual Entry. Set up API key to enable AI features.
            </Text>
          </View>
        )}
      </View>

      {/* API Support */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="vpn-key" size={18} color="#4da6ff" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>API Support</Text>
        </View>

        {/* Provider Selector */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Provider</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {([
            { key: 'nvidia' as const, label: 'NVIDIA', icon: 'memory', desc: 'Free tier available' },
            { key: 'openai' as const, label: 'OpenAI', icon: 'smart_toy', desc: 'GPT-4o & Vision' },
          ]).map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1.5 },
                provider === p.key
                  ? { backgroundColor: colors.dangerBg, borderColor: colors.primary }
                  : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
              ]}
              onPress={() => handleProviderChange(p.key)}
            >
              <MaterialIcons name={p.icon as any} size={20} color={provider === p.key ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: provider === p.key ? colors.text : colors.textSecondary }}>{p.label}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>{p.desc}</Text>
              </View>
              {provider === p.key && <MaterialIcons name="check-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>API Base URL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder={provider === 'openai' ? 'https://api.openai.com/v1' : 'https://integrate.api.nvidia.com/v1'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>API Key</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={provider === 'openai' ? 'sk-xxxx' : 'nvapi-xxxx'}
          placeholderTextColor={colors.textMuted}
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
            <Text style={[styles.label, { marginTop: 12, color: colors.textSecondary }]}>Selected Model</Text>
            <ScrollView style={styles.modelList} nestedScrollEnabled>
              {models.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.modelItem,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                    selectedModel === m && { borderColor: colors.primary, backgroundColor: colors.dangerBg },
                  ]}
                  onPress={() => setSelectedModel(m)}
                >
                  <View style={styles.radio}>
                    <View style={[styles.radioInner, selectedModel === m && styles.radioActive]} />
                  </View>
                  <Text style={[styles.modelName, { color: colors.textMuted }, selectedModel === m && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
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

      {/* Backup & Restore */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="backup" size={18} color="#4caf50" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Backup & Restore</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 18 }}>
          Create a full backup of your collection including all images. You can restore it on another phone or after reinstalling.
        </Text>

        <TouchableOpacity
          style={[styles.backupButton, backingUp && { opacity: 0.4 }]}
          onPress={handleBackup}
          disabled={backingUp}
        >
          {backingUp ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.backupButtonText}>Create Backup</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.restoreButton, restoring && { opacity: 0.4 }]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="cloud-download" size={20} color="#fff" />
              <Text style={styles.restoreButtonText}>Restore from Backup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Data Management */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="storage" size={18} color="#4da6ff" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
        </View>

        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleExportData}>
          <MaterialIcons name="file-upload" size={20} color="#888" />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Export Collection</Text>
            <Text style={[styles.menuDesc, { color: colors.textMuted }]}>{stats.total} cars total</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleClearAllData}>
          <MaterialIcons name="delete-forever" size={20} color="#e63946" />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.danger }]}>Clear All Data</Text>
            <Text style={[styles.menuDesc, { color: colors.textMuted }]}>Delete all cars and settings</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Export */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="file-download" size={18} color="#4caf50" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Export Collection</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>Download your collection data for backup or sharing.</Text>
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
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="info" size={18} color="#4da6ff" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
        </View>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>
          Hot Wheels Recorder v1.0{'\n\n'}
          Track your Hot Wheels collection, scan cars with AI, and monitor market values in INR.{'\n\n'}
          Supports NVIDIA and OpenAI APIs for car identification and value estimation.
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
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1b5e20',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  backupButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 14,
  },
  restoreButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
  themeToggle: {
    width: 50, height: 28, borderRadius: 14, backgroundColor: '#333',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  themeToggleActive: { backgroundColor: '#e63946' },
  themeToggleDot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#888',
  },
  themeToggleDotActive: {
    alignSelf: 'flex-end', backgroundColor: '#fff',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(77, 166, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12,
    color: '#4da6ff',
    lineHeight: 17,
  },
});

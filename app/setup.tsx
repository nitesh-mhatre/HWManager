import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchModels } from '../src/services/nvidia';
import { saveSettings } from '../src/services/storage';

const PRESET_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export default function SetupScreen() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(PRESET_BASE_URL);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleFetchModels = async () => {
    if (!apiKey.trim()) {
      Alert.alert('API Key Required', 'Please enter your NVIDIA API key.');
      return;
    }
    setLoadingModels(true);
    try {
      const fetched = await fetchModels(apiKey.trim(), baseUrl.trim());
      setModels(fetched);
      if (fetched.length > 0) setSelectedModel(fetched[0]);
      setStep(2);
    } catch (e: any) {
      Alert.alert('Error', `Failed to fetch models: ${e.message}`);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedModel) {
      Alert.alert('Model Required', 'Please select a model.');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || PRESET_BASE_URL,
        model: selectedModel,
      });
      router.replace('/(tabs)/garage');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏎️</Text>
          <Text style={styles.title}>Hot Wheels Recorder</Text>
          <Text style={styles.subtitle}>
            Track your collection, scan cars, and know your market values
          </Text>
        </View>

        {/* Step indicator */}
        <View style={styles.steps}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>

        {step === 1 ? (
          /* Step 1: API Key */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔑 Connect to NVIDIA API</Text>
            <Text style={styles.cardDesc}>
              Get your free API key from{' '}
              <Text style={styles.link}>build.nvidia.com</Text>
            </Text>

            <Text style={styles.label}>API Base URL</Text>
            <TextInput
              style={styles.input}
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder={PRESET_BASE_URL}
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>API Key</Text>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="nvapi-xxxxxxxxxxxxxx"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, (!apiKey.trim() || loadingModels) && styles.buttonDisabled]}
              onPress={handleFetchModels}
              disabled={loadingModels || !apiKey.trim()}
            >
              {loadingModels ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Fetch Available Models →</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Step 2: Model Selection */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤖 Choose AI Model</Text>
            <Text style={styles.cardDesc}>
              Select the model to use for car scanning and identification
            </Text>

            <ScrollView style={styles.modelList} nestedScrollEnabled>
              {models.map((model) => (
                <TouchableOpacity
                  key={model}
                  style={[
                    styles.modelItem,
                    selectedModel === model && styles.modelItemActive,
                  ]}
                  onPress={() => setSelectedModel(model)}
                >
                  <View style={styles.modelRadio}>
                    <View
                      style={[
                        styles.modelRadioInner,
                        selectedModel === model && styles.modelRadioActive,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.modelName,
                      selectedModel === model && styles.modelNameActive,
                    ]}
                    numberOfLines={2}
                  >
                    {model}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStep(1)}
              >
                <Text style={styles.secondaryButtonText}>← Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, !selectedModel || saving && styles.buttonDisabled]}
                onPress={handleContinue}
                disabled={!selectedModel || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Start Collecting 🏁</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ About NVIDIA Free APIs</Text>
          <Text style={styles.infoText}>
            • Free tier: 1,000 API credits/day{'\n'}
            • Vision models can scan car packages{'\n'}
            • All processing happens via API calls{'\n'}
            • Your API key stays on your device only
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#e63946', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 4,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  stepDotActive: { backgroundColor: '#e63946' },
  stepLine: { width: 40, height: 2, backgroundColor: '#333' },
  stepLineActive: { backgroundColor: '#e63946' },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardDesc: { fontSize: 13, color: '#888', marginBottom: 16 },
  link: { color: '#4da6ff', textDecorationLine: 'underline' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    padding: 14,
    color: '#fff',
    fontSize: 14,
    marginBottom: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  button: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  secondaryButtonText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  modelList: { maxHeight: 300, marginBottom: 10 },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  modelItemActive: {
    borderColor: '#e63946',
    backgroundColor: '#1a0a0c',
  },
  modelRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modelRadioInner: { width: 8, height: 8, borderRadius: 4 },
  modelRadioActive: { backgroundColor: '#e63946' },
  modelName: { fontSize: 13, color: '#aaa', flex: 1 },
  modelNameActive: { color: '#fff', fontWeight: '600' },
  infoBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#4da6ff', marginBottom: 6 },
  infoText: { fontSize: 12, color: '#777', lineHeight: 18 },
});

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getSettings } from '../src/services/storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (!settings) {
        router.replace('/setup');
      } else {
        router.replace('/(tabs)/garage');
      }
    })();
  }, []);

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#e63946" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
});

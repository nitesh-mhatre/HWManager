import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import LoadingScreen from '../src/components/LoadingScreen';
import Onboarding, { ONBOARDING_KEY } from '../src/components/Onboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      setShowOnboarding(done !== 'true');
    })();
  }, []);

  if (showOnboarding === null) return null;

  if (showOnboarding) {
    return <Onboarding onComplete={() => router.replace('/setup')} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <LoadingScreen
        duration={3500}
        onReady={() => {
          router.replace('/(tabs)/garage');
        }}
      />
    </View>
  );
}

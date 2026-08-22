import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getSettings } from '../src/services/storage';
import { initAdMob } from '../src/services/admob';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Initialize Google AdMob
      initAdMob();

      const settings = await getSettings();
      if (!settings) {
        router.replace('/setup');
      } else {
        router.replace('/(tabs)/garage');
      }
    })();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f0f23' },
        }}
      />
    </>
  );
}

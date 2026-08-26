import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getSettings, isManualMode } from '../src/services/storage';
import { initAdMob } from '../src/services/admob';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

function RootLayoutInner() {
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    (async () => {
      initAdMob();

      const manual = await isManualMode();
      const settings = await getSettings();

      if (manual || settings) {
        router.replace('/(tabs)/garage');
      } else {
        router.replace('/setup');
      }
    })();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? '#0f0f23' : '#f5f5f5' },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

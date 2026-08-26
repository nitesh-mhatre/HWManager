import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  // Base
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderLight: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Accent
  primary: string;
  primaryBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  info: string;
  infoBg: string;
  danger: string;
  dangerBg: string;

  // Card
  cardBg: string;
  cardBorder: string;
  cardImageBg: string;

  // Input
  inputBg: string;
  inputBorder: string;

  // Tab bar
  tabBarBg: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  // Misc
  gold: string;
  purple: string;
  purpleBg: string;
  overlay: string;
  shadow: string;
}

const darkTheme: ThemeColors = {
  background: '#0f0f23',
  surface: '#1a1a2e',
  surfaceAlt: '#252540',
  border: '#2a2a4a',
  borderLight: '#333',

  text: '#fff',
  textSecondary: '#aaa',
  textMuted: '#666',

  primary: '#e63946',
  primaryBg: 'rgba(230, 57, 70, 0.15)',
  success: '#4caf50',
  successBg: 'rgba(76, 175, 80, 0.15)',
  warning: '#FF9800',
  warningBg: 'rgba(255, 152, 0, 0.15)',
  info: '#4da6ff',
  infoBg: 'rgba(77, 166, 255, 0.15)',
  danger: '#e63946',
  dangerBg: 'rgba(230, 57, 70, 0.15)',

  cardBg: '#1a1a2e',
  cardBorder: '#2a2a4a',
  cardImageBg: '#12122a',

  inputBg: '#0f0f23',
  inputBorder: '#333',

  tabBarBg: '#0f0f23',
  tabBarBorder: '#222',
  tabActive: '#e63946',
  tabInactive: '#555',

  gold: '#FFD700',
  purple: '#9C27B0',
  purpleBg: 'rgba(156, 39, 176, 0.15)',
  overlay: 'rgba(0,0,0,0.85)',
  shadow: '#000',
};

const lightTheme: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceAlt: '#f0f0f0',
  border: '#e0e0e0',
  borderLight: '#ccc',

  text: '#1a1a2e',
  textSecondary: '#444',
  textMuted: '#777',

  primary: '#e63946',
  primaryBg: 'rgba(230, 57, 70, 0.1)',
  success: '#2e7d32',
  successBg: 'rgba(46, 125, 50, 0.1)',
  warning: '#e65100',
  warningBg: 'rgba(230, 81, 0, 0.1)',
  info: '#1565c0',
  infoBg: 'rgba(21, 101, 192, 0.1)',
  danger: '#c62828',
  dangerBg: 'rgba(198, 40, 40, 0.1)',

  cardBg: '#ffffff',
  cardBorder: '#e0e0e0',
  cardImageBg: '#eeeeee',

  inputBg: '#f5f5f5',
  inputBorder: '#ddd',

  tabBarBg: '#ffffff',
  tabBarBorder: '#e0e0e0',
  tabActive: '#e63946',
  tabInactive: '#999',

  gold: '#F9A825',
  purple: '#7b1fa2',
  purpleBg: 'rgba(123, 31, 162, 0.1)',
  overlay: 'rgba(0,0,0,0.5)',
  shadow: '#ccc',
};

const THEME_KEY = 'hw_theme_mode';

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') {
          setMode(saved);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const colors = mode === 'dark' ? darkTheme : lightTheme;

  const toggleTheme = async () => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const setTheme = async (newMode: ThemeMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark: mode === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { darkTheme, lightTheme };

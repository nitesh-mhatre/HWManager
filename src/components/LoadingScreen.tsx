import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AdBanner from './AdBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LoadingScreenProps {
  onReady?: () => void;
  duration?: number;
}

export default function LoadingScreen({ onReady, duration = 3000 }: LoadingScreenProps) {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const spinnerOpacity = useRef(new Animated.Value(0)).current;
  const adSlideUp = useRef(new Animated.Value(60)).current;
  const adOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Spinner
    Animated.timing(spinnerOpacity, { toValue: 1, duration: 400, delay: 400, useNativeDriver: true }).start();

    // Pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Ad banner entrance
    Animated.parallel([
      Animated.timing(adSlideUp, { toValue: 0, duration: 500, delay: 800, useNativeDriver: true }),
      Animated.timing(adOpacity, { toValue: 1, duration: 500, delay: 800, useNativeDriver: true }),
    ]).start();

    // Progress bar
    Animated.timing(progressWidth, {
      toValue: SCREEN_WIDTH - 64,
      duration,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      pulse.stop();
      onReady?.();
    }, duration);

    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, [duration, onReady]);

  return (
    <View style={styles.container}>
      {/* Background glow */}
      <View style={[styles.glowOrb, styles.glowOrb1]} />
      <View style={[styles.glowOrb, styles.glowOrb2]} />

      {/* Logo */}
      <Animated.View
        style={[styles.logoContainer, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}
      >
        <Animated.View style={[styles.logoIconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <MaterialCommunityIcons name="car-sports" size={56} color="#e63946" />
        </Animated.View>
        <Text style={styles.logoTitle}>Hot Wheels</Text>
        <Text style={styles.logoSubtitle}>Recorder</Text>
      </Animated.View>

      {/* Loading */}
      <Animated.View style={[styles.loadingInfo, { opacity: spinnerOpacity }]}>
        <Text style={styles.loadingText}>Setting up your collection...</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </Animated.View>

      {/* AdMob Banner */}
      <Animated.View
        style={[
          styles.adContainer,
          { transform: [{ translateY: adSlideUp }], opacity: adOpacity },
        ]}
      >
        <AdBanner style={styles.adMobBanner} />
      </Animated.View>

      {/* Version */}
      <Text style={styles.version}>v1.0.0 · by Mr.Bites</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // Glow
  glowOrb: { position: 'absolute', borderRadius: 200, opacity: 0.08 },
  glowOrb1: { width: 300, height: 300, backgroundColor: '#e63946', top: -80, right: -60 },
  glowOrb2: { width: 250, height: 250, backgroundColor: '#4da6ff', bottom: 80, left: -80 },

  // Logo
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIconWrap: {
    width: 100, height: 100, borderRadius: 28, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2,
    borderColor: '#e6394630', marginBottom: 16,
    shadowColor: '#e63946', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  logoTitle: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  logoSubtitle: {
    fontSize: 16, fontWeight: '500', color: '#e63946',
    letterSpacing: 4, textTransform: 'uppercase', marginTop: 2,
  },

  // Loading
  loadingInfo: { alignItems: 'center', width: '100%', marginBottom: 32 },
  loadingText: { fontSize: 13, color: '#666', marginBottom: 14, fontWeight: '500' },
  progressTrack: {
    width: SCREEN_WIDTH - 64, height: 3, backgroundColor: '#1a1a2e',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: '#e63946', borderRadius: 2 },

  // Ad
  adContainer: { width: '100%' },
  adMobBanner: { width: '100%', height: 60, borderRadius: 14 },

  // Version
  version: { position: 'absolute', bottom: 40, fontSize: 11, color: '#333' },
});

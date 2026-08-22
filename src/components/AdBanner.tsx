import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

// ── Live Ad Unit IDs ──────────────────────────────────────────
const LIVE_BANNER_ID = 'ca-app-pub-2889632845666311/9703267604';

// ── Dynamic native module import (safe for Expo Go) ───────────
let BannerAdComponent: React.ComponentType<any> | null = null;
let BannerAdSizeValue: any = null;
let adMobAvailable = false;

try {
  const ads = require('react-native-google-mobile-ads');
  BannerAdComponent = ads.BannerAd;
  BannerAdSizeValue = ads.BannerAdSize;
  adMobAvailable = true;
} catch {
  adMobAvailable = false;
}

// Use Google test IDs in dev, live IDs in production
const BANNER_UNIT_ID = __DEV__
  ? (Platform.OS === 'android'
      ? 'ca-app-pub-3940256099942544/6300978111'
      : 'ca-app-pub-3940256099942544/2934735716')
  : LIVE_BANNER_ID;

// ── Fallback ads (when native module unavailable) ─────────────
const FALLBACK_ADS = [
  { title: 'Hot Wheels Collectors', desc: 'Track, trade & value your collection', icon: 'car' as const, bg: '#1a237e', accent: '#ff5252' },
  { title: 'Premium Diecast Store', desc: 'Rare Super Treasure Hunts & RLC exclusives', icon: 'store' as const, bg: '#1b5e20', accent: '#FFD700' },
  { title: 'Collector Insurance', desc: 'Protect your valuable collection today', icon: 'shield' as const, bg: '#4a148c', accent: '#ea80fc' },
];

interface AdBannerProps {
  size?: any;
  style?: object;
}

/**
 * Google AdMob banner with safe fallback.
 * - Dev / Expo Go → TestIds banner or styled placeholder
 * - Production native build → Live banner ad
 */
export default function AdBanner({ size, style }: AdBannerProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  // Cycle fallback ads
  useEffect(() => {
    if (adMobAvailable) return;
    const id = setInterval(() => {
      setFallbackIndex((prev) => (prev + 1) % FALLBACK_ADS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Pulse animation for fallback label
  useEffect(() => {
    if (adMobAvailable) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // ── Real AdMob banner ──────────────────────────────────────
  if (adMobAvailable && BannerAdComponent) {
    const BannerAd = BannerAdComponent;
    const bannerSize = size || (BannerAdSizeValue?.BANNER ?? 'STANDARD');

    return (
      <View style={[styles.container, style]}>
        <View style={styles.adLabel}>
          <MaterialIcons name="info-outline" size={9} color="#555" />
          <Text style={styles.adLabelText}>SPONSORED</Text>
        </View>
        <BannerAd
          unitId={BANNER_UNIT_ID}
          size={bannerSize}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => console.log('[AdMob] Banner loaded')}
          onAdFailedToLoad={(err: any) => console.log('[AdMob] Banner failed:', err.message)}
        />
      </View>
    );
  }

  // ── Fallback placeholder ad ────────────────────────────────
  const ad = FALLBACK_ADS[fallbackIndex];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <MaterialIcons name="info-outline" size={9} color="#555" />
        <Animated.Text style={[styles.adLabelText, { opacity: pulseAnim }]}>SPONSORED</Animated.Text>
      </View>
      <View style={[styles.fallbackBanner, { backgroundColor: ad.bg }]}>
        <View style={[styles.fallbackIconWrap, { backgroundColor: `${ad.accent}25` }]}>
          <MaterialCommunityIcons name={ad.icon} size={24} color={ad.accent} />
        </View>
        <View style={styles.fallbackContent}>
          <Text style={styles.fallbackTitle}>{ad.title}</Text>
          <Text style={styles.fallbackDesc}>{ad.desc}</Text>
        </View>
        <View style={[styles.fallbackCta, { backgroundColor: ad.accent }]}>
          <Text style={styles.fallbackCtaText}>Learn</Text>
          <MaterialIcons name="open-in-new" size={10} color="#000" />
        </View>
      </View>
      <View style={styles.dots}>
        {FALLBACK_ADS.map((_, i) => (
          <View key={i} style={[styles.dot, i === fallbackIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  adLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingTop: 6,
  },
  adLabelText: { fontSize: 8, color: '#555', fontWeight: '600', letterSpacing: 1 },

  // Fallback
  fallbackBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12, width: '100%',
  },
  fallbackIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  fallbackContent: { flex: 1 },
  fallbackTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  fallbackDesc: { fontSize: 10, color: '#ffffffaa', marginTop: 1 },
  fallbackCta: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  fallbackCtaText: { fontSize: 10, fontWeight: '700', color: '#000' },
  dots: { flexDirection: 'row', gap: 5, paddingBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#333' },
  dotActive: { backgroundColor: '#e63946', width: 14 },
});

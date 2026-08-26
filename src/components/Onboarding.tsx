import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticLight } from '../services/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = 'hw_onboarding_done';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: '🏎️',
    title: 'Welcome to Hot Wheels Recorder',
    desc: 'Track your entire Hot Wheels collection, monitor market values, and never miss a car again.',
    color: '#e63946',
  },
  {
    iconLib: 'materialCommunity' as const,
    icon: 'garage',
    title: 'Your Garage',
    desc: 'View all your collected cars in list, grid, or compact mode. Sort and filter by year, color, series, rarity, and more.',
    color: '#e63946',
  },
  {
    iconLib: 'material' as const,
    icon: 'star',
    title: 'Wishlist',
    desc: 'Keep track of cars you want to find. When you spot one in the wild, add it to your garage instantly.',
    color: '#FFD700',
  },
  {
    iconLib: 'materialCommunity' as const,
    icon: 'barcode-scan',
    title: 'AI Scan',
    desc: 'Point your camera at any Hot Wheels card — AI identifies the car, year, series, rarity, and market value automatically.',
    color: '#4da6ff',
  },
  {
    iconLib: 'material' as const,
    icon: 'edit',
    title: 'Manual Entry',
    desc: 'No API key? No problem! Add cars manually by typing in all the details yourself.',
    color: '#4caf50',
  },
  {
    iconLib: 'material' as const,
    icon: 'backup',
    title: 'Backup & Restore',
    desc: 'Create a full backup of your collection including images. Transfer your data to a new phone anytime.',
    color: '#9C27B0',
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    hapticLight();
    if (currentStep < STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentStep + 1 });
      setCurrentStep(currentStep + 1);
    } else {
      finish();
    }
  };

  const handleSkip = () => {
    hapticLight();
    finish();
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const renderItem = ({ item, index }: { item: typeof STEPS[0]; index: number }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
        {item.iconLib ? (
          <MaterialCommunityIcons name={item.icon as any} size={64} color={item.color} />
        ) : (
          <Text style={styles.emoji}>{item.icon}</Text>
        )}
      </View>
      <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
      <Text style={styles.desc}>{item.desc}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentStep(index);
        }}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => {
          const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { width: dotWidth, opacity: dotOpacity, backgroundColor: STEPS[currentStep].color },
              ]}
            />
          );
        })}
      </View>

      {/* Next / Get Started button */}
      <TouchableOpacity
        style={[styles.nextBtn, { backgroundColor: STEPS[currentStep].color }]}
        onPress={handleNext}
      >
        <Text style={styles.nextBtnText}>
          {currentStep === STEPS.length - 1 ? 'Get Started 🏁' : 'Next'}
        </Text>
        {currentStep < STEPS.length - 1 && (
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

export { ONBOARDING_KEY };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 72,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  desc: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 40,
    marginBottom: 60,
    paddingVertical: 16,
    borderRadius: 16,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

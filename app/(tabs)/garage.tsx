import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getGarage, deleteCar } from '../../src/services/storage';
import { HotWheelCar } from '../../src/types';

export default function GarageScreen() {
  const router = useRouter();
  const [cars, setCars] = useState<HotWheelCar[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadCars = async () => {
    const garage = await getGarage();
    setCars(garage.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)));
  };

  useFocusEffect(
    useCallback(() => {
      loadCars();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCars();
    setRefreshing(false);
  };

  const filtered = cars.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.model.toLowerCase().includes(search.toLowerCase()) ||
      c.series.toLowerCase().includes(search.toLowerCase()) ||
      c.year.includes(search)
  );

  const totalValue = filtered.reduce((sum, c) => sum + (c.expectedPrice || 0), 0);
  const totalSpent = filtered.reduce((sum, c) => sum + (c.buyPrice || 0), 0);

  const handleDelete = (car: HotWheelCar) => {
    Alert.alert('Delete Car', `Remove "${car.name}" from your garage?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCar(car.id);
          await loadCars();
        },
      },
    ]);
  };

  const moveToWishlist = async (car: HotWheelCar) => {
    const { updateCar } = await import('../../src/services/storage');
    await updateCar({ ...car, inCollection: false });
    await loadCars();
    Alert.alert('Moved', `${car.name} moved to Wishlist`);
  };

  const renderCar = ({ item }: { item: HotWheelCar }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/car/[id]', params: { id: item.id, source: 'garage' } })}
      onLongPress={() => {
        Alert.alert(item.name, 'What would you like to do?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move to Wishlist', onPress: () => moveToWishlist(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
        ]);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardImage}>
          {item.images.length > 0 ? (
            <Text style={styles.cardImagePlaceholder}>📷</Text>
          ) : (
            <Text style={styles.cardImagePlaceholder}>🚗</Text>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.year} · {item.color} · {item.series || 'Mainline'}
          </Text>
          <View style={styles.cardTags}>
            {item.rarity ? (
              <View style={[styles.tag, styles.tagRarity]}>
                <Text style={styles.tagText}>{item.rarity}</Text>
              </View>
            ) : null}
            {item.condition ? (
              <View style={[styles.tag, styles.tagCondition]}>
                <Text style={styles.tagText}>{item.condition}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.cardPrice}>
          <Text style={styles.priceLabel}>Value</Text>
          <Text style={styles.priceValue}>
            ${item.expectedPrice > 0 ? item.expectedPrice.toFixed(2) : '—'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏎️ My Garage</Text>
        <Text style={styles.headerCount}>{filtered.length} cars · ${totalValue.toFixed(2)} value</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, model, series..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Cars</Text>
          <Text style={styles.statValue}>{filtered.length}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Spent</Text>
          <Text style={styles.statValue}>${totalSpent.toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Market Value</Text>
          <Text style={[styles.statValue, { color: '#4caf50' }]}>
            ${totalValue.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Car list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCar}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏁</Text>
            <Text style={styles.emptyTitle}>No cars in your garage yet</Text>
            <Text style={styles.emptyDesc}>
              Scan a car or add one manually to start building your collection
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/scan')}
            >
              <Text style={styles.emptyButtonText}>📷 Scan a Car</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: {
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerCount: { fontSize: 13, color: '#888', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 12,
  },
  clearSearch: { fontSize: 16, color: '#888', padding: 4 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 2 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardImagePlaceholder: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  cardTags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#222',
  },
  tagRarity: { backgroundColor: '#3d1c00' },
  tagCondition: { backgroundColor: '#002233' },
  tagText: { fontSize: 10, color: '#ccc', fontWeight: '600' },
  cardPrice: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, color: '#666' },
  priceValue: { fontSize: 16, fontWeight: '700', color: '#4da6ff' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  emptyButton: {
    backgroundColor: '#e63946',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700' },
});

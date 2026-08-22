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
import { getWishlist, deleteCar, updateCar } from '../../src/services/storage';
import { HotWheelCar } from '../../src/types';

export default function WishlistScreen() {
  const router = useRouter();
  const [cars, setCars] = useState<HotWheelCar[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadCars = async () => {
    const wish = await getWishlist();
    setCars(wish.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)));
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

  const moveToGarage = async (car: HotWheelCar) => {
    await updateCar({ ...car, inCollection: true });
    await loadCars();
    Alert.alert('Moved', `${car.name} added to your Garage! 🏎️`);
  };

  const handleDelete = (car: HotWheelCar) => {
    Alert.alert('Remove from Wishlist', `Remove "${car.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteCar(car.id);
          await loadCars();
        },
      },
    ]);
  };

  const renderCar = ({ item }: { item: HotWheelCar }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/car/[id]', params: { id: item.id, source: 'wishlist' } })}
      onLongPress={() => {
        Alert.alert(item.name, 'What would you like to do?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move to Garage', onPress: () => moveToGarage(item) },
          { text: 'Remove', style: 'destructive', onPress: () => handleDelete(item) },
        ]);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardImage}>
          <Text style={styles.cardImagePlaceholder}>⭐</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {item.year} · {item.color} · {item.series || 'Mainline'}
          </Text>
          {item.expectedPrice > 0 && (
            <Text style={styles.cardPrice}>
              Est. ${item.expectedPrice.toFixed(2)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => moveToGarage(item)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⭐ My Wishlist</Text>
        <Text style={styles.headerCount}>{filtered.length} cars wanted</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search wishlist..."
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
            <Text style={styles.emptyIcon}>🌟</Text>
            <Text style={styles.emptyTitle}>Wishlist is empty</Text>
            <Text style={styles.emptyDesc}>
              Add cars you want to your wishlist to track them
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
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#1a1800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardImagePlaceholder: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  cardPrice: {
    fontSize: 13,
    color: '#4da6ff',
    fontWeight: '600',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#1b5e20',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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

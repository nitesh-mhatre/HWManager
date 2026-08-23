import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllCars, getCaseCodes } from '../services/storage';
import { HotWheelCar } from '../types';
import { useFocusEffect } from 'expo-router';

interface Props {
  onClose: () => void;
}

type FilterStatus = 'all' | 'have' | 'want' | 'need';

export default function PegHuntChecklist({ onClose }: Props) {
  const [caseCodes, setCaseCodes] = useState<string[]>([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [cars, setCars] = useState<HotWheelCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    const allCars = await getAllCars();
    const codes = await getCaseCodes();
    setCaseCodes(codes);
    setCars(allCars);
    if (codes.length > 0 && !selectedCase) {
      setSelectedCase(codes[0]);
    }
    setLoading(false);
  };

  const filteredCars = cars.filter((c) => {
    if (selectedCase && c.caseCode !== selectedCase) return false;
    if (statusFilter === 'have') return c.inCollection && (c.quantity || 0) > 0;
    if (statusFilter === 'want') return !c.inCollection;
    if (statusFilter === 'need') return !c.inCollection; // wishlist items are "need"
    return true;
  });

  const getCounts = () => {
    const inCase = cars.filter((c) => c.caseCode === selectedCase);
    return {
      total: inCase.length,
      have: inCase.filter((c) => c.inCollection && (c.quantity || 0) > 0).length,
      want: inCase.filter((c) => !c.inCollection).length,
    };
  };

  const counts = getCounts();

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e63946" />
        <Text style={styles.loadingText}>Loading checklist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="map-marker-check" size={24} color="#FFD700" />
          <Text style={styles.headerTitle}>Peg Hunt Checklist</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <MaterialIcons name="close" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <Text style={styles.headerSub}>Filter by case letter — check off cars while hunting</Text>

      {/* Case Code Picker */}
      {caseCodes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.caseRow}>
          {caseCodes.map((code) => (
            <TouchableOpacity
              key={code}
              style={[styles.caseChip, selectedCase === code && styles.caseChipActive]}
              onPress={() => setSelectedCase(code)}
            >
              <Text style={[styles.caseChipText, selectedCase === code && styles.caseChipTextActive]}>
                Case {code}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {caseCodes.length === 0 && (
        <View style={styles.emptyCase}>
          <MaterialIcons name="info-outline" size={16} color="#888" />
          <Text style={styles.emptyCaseText}>
            No case codes found. Add case codes to your cars in the car detail page.
          </Text>
        </View>
      )}

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{counts.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#4caf50' }]}>{counts.have}</Text>
          <Text style={styles.statLabel}>Have</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>{counts.want}</Text>
          <Text style={styles.statLabel}>Want</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#42A5F5' }]}>{checkedItems.size}</Text>
          <Text style={styles.statLabel}>Checked</Text>
        </View>
      </View>

      {/* Status filter */}
      <View style={styles.statusFilterRow}>
        {(['all', 'have', 'want'] as FilterStatus[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusChip, statusFilter === s && styles.statusChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <MaterialIcons
              name={s === 'all' ? 'apps' : s === 'have' ? 'check-circle' : 'star'}
              size={12}
              color={statusFilter === s ? '#fff' : '#888'}
            />
            <Text style={[styles.statusChipText, statusFilter === s && styles.statusChipTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Car list */}
      <ScrollView contentContainerStyle={styles.list}>
        {filteredCars.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="car-off" size={40} color="#2a2a4a" />
            <Text style={styles.emptyTitle}>
              {caseCodes.length === 0 ? 'No case codes set' : 'No cars in this case'}
            </Text>
            <Text style={styles.emptyDesc}>
              {caseCodes.length === 0
                ? 'Add case codes to your cars to use the checklist'
                : 'Add cars with case code "' + selectedCase + '" to see them here'}
            </Text>
          </View>
        ) : (
          filteredCars.map((car) => {
            const isChecked = checkedItems.has(car.id);
            const status: FilterStatus = car.inCollection ? 'have' : 'want';
            return (
              <TouchableOpacity
                key={car.id}
                style={[styles.checkItem, isChecked && styles.checkItemChecked]}
                onPress={() => toggleCheck(car.id)}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <MaterialIcons name="check" size={16} color="#fff" />}
                </View>
                {car.images && car.images.length > 0 ? (
                  <View style={styles.itemThumb}>
                    <MaterialCommunityIcons name="car" size={20} color="#333" />
                  </View>
                ) : (
                  <View style={styles.itemThumb}>
                    <MaterialCommunityIcons name="car" size={20} color="#333" />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, isChecked && styles.itemNameChecked]} numberOfLines={1}>
                    {car.name}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {car.year} · {car.color} · {car.toyNumber || 'No toy #'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, status === 'have' ? styles.statusHave : styles.statusWant]}>
                  <Text style={[styles.statusBadgeText, status === 'have' ? styles.statusTextHave : styles.statusTextWant]}>
                    {status === 'have' ? 'HAVE' : 'WANT'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: { color: '#888', marginTop: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#666', paddingHorizontal: 16, marginBottom: 12 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },

  caseRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  caseChip: {
    backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: '#2a2a4a',
  },
  caseChipActive: { backgroundColor: '#e63946', borderColor: '#e63946' },
  caseChipText: { fontSize: 13, fontWeight: '700', color: '#888' },
  caseChipTextActive: { color: '#fff' },

  emptyCase: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1a1a2e',
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  emptyCaseText: { flex: 1, fontSize: 12, color: '#888', lineHeight: 16 },

  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10, backgroundColor: '#1a1a2e',
    borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#2a2a4a',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 9, color: '#555', textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#252540' },

  statusFilterRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 10,
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  statusChipActive: { backgroundColor: '#333', borderColor: '#555' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#888' },
  statusChipTextActive: { color: '#fff' },

  list: { padding: 16, paddingBottom: 100 },

  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  checkItemChecked: { borderColor: '#4caf50', backgroundColor: '#0a2a1a' },
  checkbox: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#444',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#4caf50', borderColor: '#4caf50' },
  itemThumb: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#252540',
    justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  itemNameChecked: { color: '#888', textDecorationLine: 'line-through' },
  itemMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusHave: { backgroundColor: 'rgba(76, 175, 80, 0.2)' },
  statusWant: { backgroundColor: 'rgba(255, 215, 0, 0.2)' },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  statusTextHave: { color: '#4caf50' },
  statusTextWant: { color: '#FFD700' },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 12, marginBottom: 6 },
  emptyDesc: { fontSize: 12, color: '#555', textAlign: 'center', paddingHorizontal: 40 },
});

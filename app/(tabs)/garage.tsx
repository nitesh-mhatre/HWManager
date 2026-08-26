import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getGarage, deleteCar, updateCar, analyzeDuplicateDetails, getViewPreferences, saveViewPreference } from '../../src/services/storage';
import { hapticLight, hapticMedium, hapticSuccess } from '../../src/services/haptics';
import { HotWheelCar, AllocationType } from '../../src/types';
import FilterDropdown from '../../src/components/FilterDropdown';
import PegHuntChecklist from '../../src/components/PegHuntChecklist';
import { useTheme } from '../../src/context/ThemeContext';

type ViewMode = 'list' | 'grid' | 'compact';
type SortBy = 'newest' | 'name' | 'price-high' | 'price-low' | 'year';

export default function GarageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [cars, setCars] = useState<HotWheelCar[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showSort, setShowSort] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Dropdown filters
  const [filterYear, setFilterYear] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterCaseCode, setFilterCaseCode] = useState('');
  const [filterAllocation, setFilterAllocation] = useState('');
  const [showPegHunt, setShowPegHunt] = useState(false);
  const [dupeCounts, setDupeCounts] = useState<Record<string, { same: number; diff: number }>>({});

  // Load saved view preferences on mount
  useEffect(() => {
    (async () => {
      const prefs = await getViewPreferences();
      setViewMode((prefs.garage.viewMode as ViewMode) || 'grid');
      setSortBy((prefs.garage.sortBy as SortBy) || 'newest');
      setPrefsLoaded(true);
    })();
  }, []);

  // Persist viewMode changes
  const handleViewModeChange = useCallback(async (mode: ViewMode) => {
    setViewMode(mode);
    await saveViewPreference('garage', 'viewMode', mode);
  }, []);

  // Persist sortBy changes
  const handleSortByChange = useCallback(async (sort: SortBy) => {
    setSortBy(sort);
    await saveViewPreference('garage', 'sortBy', sort);
  }, []);

  const loadCars = async () => {
    const garage = await getGarage();
    const sorted = garage.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    setCars(sorted);
    // Compute duplicate counts
    const counts: Record<string, { same: number; diff: number }> = {};
    for (const car of sorted) {
      const analysis = await analyzeDuplicateDetails(car.name, car.model, car.year, car.color);
      counts[car.id] = { same: analysis.sameColorCount, diff: analysis.differentColorCount };
    }
    setDupeCounts(counts);
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

  // Extract unique filter options
  const allYears = useMemo(() => {
    const y = new Set(cars.map((c) => c.year).filter(Boolean));
    return Array.from(y).sort().reverse().map((v) => ({ label: v, value: v }));
  }, [cars]);

  const allColors = useMemo(() => {
    const s = new Set(cars.map((c) => c.color).filter(Boolean));
    return Array.from(s).sort().map((v) => ({ label: v, value: v }));
  }, [cars]);

  const allSeries = useMemo(() => {
    const s = new Set(cars.map((c) => c.series).filter(Boolean));
    return Array.from(s).sort().map((v) => ({ label: v, value: v }));
  }, [cars]);

  const allRarities = useMemo(() => {
    const r = new Set(cars.map((c) => c.rarity).filter(Boolean));
    return Array.from(r).sort().map((v) => ({ label: v, value: v }));
  }, [cars]);

  const allCaseCodes = useMemo(() => {
    const r = new Set(cars.map((c) => c.caseCode).filter(Boolean));
    return Array.from(r).sort().map((v) => ({ label: v, value: v }));
  }, [cars]);

  const allAllocations = useMemo(() => {
    const allocs = [{ label: 'Personal', value: 'personal' as AllocationType }, { label: 'Trade Pile', value: 'trade' as AllocationType }, { label: 'For Sale', value: 'forSale' as AllocationType }];
    const used = new Set(cars.map((c) => c.allocation).filter(Boolean));
    return allocs.filter((a) => used.has(a.value));
  }, [cars]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = cars.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.model.toLowerCase().includes(search.toLowerCase()) ||
        c.series.toLowerCase().includes(search.toLowerCase()) ||
        c.year.includes(search);
      const matchYear = !filterYear || c.year === filterYear;
      const matchColor = !filterColor || c.color === filterColor;
      const matchSeries = !filterSeries || c.series === filterSeries;
      const matchRarity = !filterRarity || c.rarity === filterRarity;
      const matchCaseCode = !filterCaseCode || c.caseCode === filterCaseCode;
      const matchAllocation = !filterAllocation || c.allocation === filterAllocation;
      return matchSearch && matchYear && matchColor && matchSeries && matchRarity && matchCaseCode && matchAllocation;
    });

    switch (sortBy) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price-high':
        list.sort((a, b) => (b.priceINR || b.expectedPrice || 0) - (a.priceINR || a.expectedPrice || 0));
        break;
      case 'price-low':
        list.sort((a, b) => (a.priceINR || a.expectedPrice || 0) - (b.priceINR || b.expectedPrice || 0));
        break;
      case 'year':
        list.sort((a, b) => (b.year || '').localeCompare(a.year || ''));
        break;
      case 'newest':
      default:
        list.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
        break;
    }
    return list;
  }, [cars, search, filterYear, filterColor, filterSeries, filterRarity, filterCaseCode, filterAllocation, sortBy]);

  const totalValue = filtered.reduce((sum, c) => sum + (c.priceINR || c.expectedPrice || 0), 0);
  const totalSpent = filtered.reduce((sum, c) => sum + (c.buyPrice || 0), 0);

  const clearFilters = () => {
    setFilterYear('');
    setFilterColor('');
    setFilterSeries('');
    setFilterRarity('');
    setFilterCaseCode('');
    setFilterAllocation('');
  };

  const hasActiveFilters = filterYear || filterColor || filterSeries || filterRarity || filterCaseCode || filterAllocation;
  const activeFilterCount = [filterYear, filterColor, filterSeries, filterRarity, filterCaseCode, filterAllocation].filter(Boolean).length;

  const cycleViewMode = () => {
    hapticLight();
    const modes: ViewMode[] = ['list', 'grid', 'compact'];
    const idx = modes.indexOf(viewMode);
    const newMode = modes[(idx + 1) % modes.length];
    handleViewModeChange(newMode);
  };

  const viewIcon = viewMode === 'list' ? 'view-list' : viewMode === 'grid' ? 'grid-view' : 'view-module';

  const handleDelete = (car: HotWheelCar) => {
    hapticMedium();
    Alert.alert('Delete Car', `Remove "${car.name}" from your garage?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          hapticSuccess();
          await deleteCar(car.id);
          await loadCars();
        },
      },
    ]);
  };

  const moveToWishlist = async (car: HotWheelCar) => {
    hapticLight();
    await updateCar({ ...car, inCollection: false });
    await loadCars();
    hapticSuccess();
    Alert.alert('Moved', `${car.name} moved to Wishlist`);
  };

  // ── Rarity Badge ──
  const renderRarityBadge = (rarity?: string) => {
    if (!rarity) return null;
    const isSuper = rarity.toLowerCase().includes('super');
    const isTH = rarity.toLowerCase().includes('treasure') && !isSuper;
    const isPremium = rarity.toLowerCase().includes('premium');
    return (
      <View style={[
        styles.rarityBadge,
        isSuper ? styles.raritySuper : isTH ? styles.rarityTH : isPremium ? styles.rarityPremium : styles.rarityMainline,
      ]}>
        {isSuper && <MaterialIcons name="star" size={10} color="#FFD700" />}
        {isTH && <MaterialIcons name="stars" size={10} color="#FFA726" />}
        <Text style={styles.rarityText}>{rarity}</Text>
      </View>
    );
  };

  // Quantity badge
  const renderQtyBadge = (qty?: number) => {
    if (!qty || qty <= 1) return null;
    return (
      <View style={styles.qtyBadge}>
        <MaterialCommunityIcons name="package-variant" size={10} color="#FFD700" />
        <Text style={styles.qtyBadgeText}>x{qty}</Text>
      </View>
    );
  };

  // ── List View Card ──
  const renderListItem = ({ item }: { item: HotWheelCar }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      onPress={() => router.push({ pathname: '/car/[id]', params: { id: item.id, source: 'garage' } })}
      onLongPress={() => {
        Alert.alert(item.name, 'What would you like to do?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move to Wishlist', onPress: () => moveToWishlist(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
        ]);
      }}
    >
      <View style={styles.cardImageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.cardImageBg }]}>
            <MaterialCommunityIcons name="car" size={36} color={colors.border} />
          </View>
        )}
        {renderRarityBadge(item.rarity)}
        {renderQtyBadge(item.quantity)}
        {dupeCounts[item.id] && dupeCounts[item.id].same > 1 && (
          <View style={[styles.qtyBadge, { backgroundColor: 'rgba(255, 152, 0, 0.3)' }]}>
            <MaterialCommunityIcons name="content-copy" size={10} color="#FF9800" />
            <Text style={[styles.qtyBadgeText, { color: '#FF9800' }]}>x{dupeCounts[item.id].same}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={1}>{item.model}</Text>
        <View style={styles.cardMetaRow}>
          <View style={[styles.metaPill, { backgroundColor: colors.surfaceAlt }]}>
            <MaterialIcons name="calendar-today" size={10} color={colors.textMuted} />
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.year || '—'}</Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: colors.surfaceAlt }]}>
            <MaterialIcons name="palette" size={10} color={colors.textMuted} />
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.color || '—'}</Text>
          </View>
        </View>
        {item.series ? (
          <View style={styles.seriesPill}>
            <Text style={styles.seriesPillText} numberOfLines={1}>{item.series}</Text>
          </View>
        ) : null}
        {item.allocation && item.allocation !== 'personal' && (
          <View style={[styles.seriesPill, { backgroundColor: item.allocation === 'forSale' ? 'rgba(76, 175, 80, 0.12)' : 'rgba(255, 152, 0, 0.12)' }]}>
            <MaterialIcons name={item.allocation === 'forSale' ? 'sell' : 'swap-horiz'} size={10} color={item.allocation === 'forSale' ? '#4caf50' : '#FF9800'} />
            <Text style={[styles.seriesPillText, { color: item.allocation === 'forSale' ? '#4caf50' : '#FF9800' }]}>
              {item.allocation === 'forSale' ? 'For Sale' : 'Trade'}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.cardPrice, { borderTopColor: colors.borderLight }]}>
        <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Market</Text>
        <Text style={[styles.priceValue, { color: colors.success }]}>
          ₹{(item.priceINR || item.expectedPrice || 0) > 0
            ? (item.priceINR || item.expectedPrice || 0).toLocaleString('en-IN')
            : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ── Grid View Card ──
  const renderGridItem = ({ item }: { item: HotWheelCar }) => (
    <TouchableOpacity
      style={[styles.gridCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      onPress={() => router.push({ pathname: '/car/[id]', params: { id: item.id, source: 'garage' } })}
      onLongPress={() => {
        Alert.alert(item.name, 'What would you like to do?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move to Wishlist', onPress: () => moveToWishlist(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
        ]);
      }}
    >
      <View style={styles.gridImageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.gridImagePlaceholder, { backgroundColor: colors.cardImageBg }]}>
            <MaterialCommunityIcons name="car" size={30} color={colors.border} />
          </View>
        )}
        {renderRarityBadge(item.rarity)}
        {renderQtyBadge(item.quantity)}
        {dupeCounts[item.id] && dupeCounts[item.id].same > 1 && (
          <View style={[styles.qtyBadge, { backgroundColor: 'rgba(255, 152, 0, 0.3)' }]}>
            <MaterialCommunityIcons name="content-copy" size={10} color="#FF9800" />
            <Text style={[styles.qtyBadgeText, { color: '#FF9800' }]}>x{dupeCounts[item.id].same}</Text>
          </View>
        )}
      </View>
      <View style={styles.gridInfo}>
        <Text style={[styles.gridName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.gridMeta, { color: colors.textMuted }]}>{item.year || '—'} · {item.color || '—'}</Text>
        {item.allocation && item.allocation !== 'personal' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MaterialIcons name={item.allocation === 'forSale' ? 'sell' : 'swap-horiz'} size={10} color={item.allocation === 'forSale' ? '#4caf50' : '#FF9800'} />
            <Text style={{ fontSize: 9, color: item.allocation === 'forSale' ? '#4caf50' : '#FF9800', fontWeight: '600' }}>
              {item.allocation === 'forSale' ? 'For Sale' : 'Trade'}
            </Text>
          </View>
        )}
        <Text style={[styles.gridPrice, { color: colors.success }]}>
          ₹{(item.priceINR || item.expectedPrice || 0) > 0
            ? (item.priceINR || item.expectedPrice || 0).toLocaleString('en-IN')
            : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ── Compact Grid Card ──
  const renderCompactItem = ({ item }: { item: HotWheelCar }) => (
    <TouchableOpacity
      style={[styles.compactCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      onPress={() => router.push({ pathname: '/car/[id]', params: { id: item.id, source: 'garage' } })}
      onLongPress={() => {
        Alert.alert(item.name, 'What would you like to do?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move to Wishlist', onPress: () => moveToWishlist(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
        ]);
      }}
    >
      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.compactImage} resizeMode="cover" />
      ) : (
        <View style={[styles.compactImagePlaceholder, { backgroundColor: colors.cardImageBg }]}>
          <MaterialCommunityIcons name="car" size={20} color={colors.border} />
        </View>
      )}
      <Text style={[styles.compactName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.compactMeta, { color: colors.textMuted }]}>{item.year || '—'} · {(item.priceINR || item.expectedPrice || 0) > 0 ? `₹${(item.priceINR || item.expectedPrice || 0).toLocaleString('en-IN')}` : '—'}</Text>
    </TouchableOpacity>
  );

  const renderItems: Record<ViewMode, ({ item }: { item: HotWheelCar }) => React.JSX.Element> = {
    list: renderListItem,
    grid: renderGridItem,
    compact: renderCompactItem,
  };

  const numCols = viewMode === 'compact' ? 3 : viewMode === 'grid' ? 2 : 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="garage" size={24} color="#e63946" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>My Garage</Text>
            <Text style={[styles.headerCount, { color: colors.textMuted }]}>
              {filtered.length} cars · ₹{totalValue.toLocaleString('en-IN')} value
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={clearFilters}>
            <MaterialIcons name="filter-list-off" size={20} color={hasActiveFilters ? '#e63946' : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={cycleViewMode}>
            <MaterialIcons name={viewIcon as any} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowSort(!showSort)}>
            <MaterialIcons name="sort" size={20} color={showSort ? '#e63946' : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowPegHunt(true)}>
            <MaterialCommunityIcons name="map-marker-check" size={20} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort bar */}
      {showSort && (
        <View style={styles.sortBar}>
          {[
            { key: 'newest', label: 'Newest', icon: 'schedule' },
            { key: 'name', label: 'A–Z', icon: 'sort-by-alpha' },
            { key: 'price-high', label: 'Price ↓', icon: 'trending-up' },
            { key: 'price-low', label: 'Price ↑', icon: 'trending-down' },
            { key: 'year', label: 'Year', icon: 'calendar-today' },
          ].map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sortChip, { backgroundColor: colors.surface, borderColor: colors.border }, sortBy === s.key && styles.sortChipActive]}
              onPress={() => handleSortByChange(s.key as SortBy)}
            >
              <MaterialIcons name={s.icon as any} size={12} color={sortBy === s.key ? '#fff' : colors.textMuted} />
              <Text style={[styles.sortChipText, sortBy === s.key && styles.sortChipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search name, model, series..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown Filters */}
      <View style={styles.filterRow}>
        <FilterDropdown
          label="Year"
          icon="calendar-today"
          options={allYears}
          selectedValue={filterYear}
          onSelect={setFilterYear}
          accentColor="#e63946"
        />
        <FilterDropdown
          label="Color"
          icon="palette"
          options={allColors}
          selectedValue={filterColor}
          onSelect={setFilterColor}
          accentColor="#FF9800"
        />
        <FilterDropdown
          label="Series"
          icon="category"
          options={allSeries}
          selectedValue={filterSeries}
          onSelect={setFilterSeries}
          accentColor="#9C27B0"
        />
        <FilterDropdown
          label="Rarity"
          icon="stars"
          options={allRarities}
          selectedValue={filterRarity}
          onSelect={setFilterRarity}
          accentColor="#FFD700"
        />
      </View>

      {/* Second filter row: Case Code + Allocation */}
      {(allCaseCodes.length > 0 || allAllocations.length > 0) && (
        <View style={styles.filterRow}>
          {allCaseCodes.length > 0 && (
            <FilterDropdown
              label="Case"
              icon="alpha"
              options={allCaseCodes}
              selectedValue={filterCaseCode}
              onSelect={setFilterCaseCode}
              accentColor="#42A5F5"
            />
          )}
          {allAllocations.length > 0 && (
            <FilterDropdown
              label="Allocation"
              icon="swap-horiz"
              options={allAllocations}
              selectedValue={filterAllocation}
              onSelect={setFilterAllocation}
              accentColor="#FF9800"
            />
          )}
        </View>
      )}

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.border, borderRightColor: colors.border, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <View style={styles.stat}>
          <MaterialCommunityIcons name="car" size={16} color="#e63946" />
          <Text style={[styles.statValue, { color: colors.text }]}>{filtered.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Cars</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.stat}>
          <MaterialIcons name="account-balance-wallet" size={16} color={colors.textMuted} />
          <Text style={[styles.statValue, { color: colors.text }]}>₹{totalSpent.toLocaleString('en-IN')}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Spent</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.stat}>
          <MaterialIcons name="trending-up" size={16} color="#4caf50" />
          <Text style={[styles.statValue, { color: '#4caf50' }]}>₹{totalValue.toLocaleString('en-IN')}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Value</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.stat}>
          <MaterialIcons name="show-chart" size={16} color="#42A5F5" />
          <Text style={[styles.statValue, { color: '#42A5F5' }]}>
            {totalSpent > 0 ? `${Math.round(((totalValue - totalSpent) / totalSpent) * 100)}%` : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>ROI</Text>
        </View>
      </View>

      {/* Car list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItems[viewMode]}
        numColumns={numCols}
        key={`${viewMode}-${numCols}`}
        columnWrapperStyle={numCols > 1 ? styles.gridRow : undefined}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e63946" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="car-off" size={56} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No cars found</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              {hasActiveFilters ? 'Try adjusting your filters' : 'Scan a car or add one manually'}
            </Text>
            {!hasActiveFilters && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/scan')}
              >
                <MaterialIcons name="camera-alt" size={18} color="#fff" />
                <Text style={styles.emptyButtonText}>Scan a Car</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Peg Hunt Checklist Modal */}
      {showPegHunt && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 100 }}>
          <PegHuntChecklist onClose={() => setShowPegHunt(false)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },

  // Header
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e6394620',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerCount: { fontSize: 12, color: '#666', marginTop: 1 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },

  // Sort
  sortBar: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 8, flexWrap: 'wrap',
  },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  sortChipActive: { backgroundColor: '#e63946', borderColor: '#e63946' },
  sortChipText: { fontSize: 11, color: '#888', fontWeight: '600' },
  sortChipTextActive: { color: '#fff' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e',
    marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10, marginLeft: 8 },

  // Dropdown filters
  filterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8,
  },

  // Stats
  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1a1a2e',
    borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#2a2a4a',
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  statValue: { fontSize: 12, fontWeight: '700', color: '#fff', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#252540' },

  list: { padding: 16, paddingBottom: 100 },
  gridRow: { gap: 10 },

  // List card
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a4a', overflow: 'hidden',
  },
  cardImageContainer: { position: 'relative' },
  cardImage: { width: '100%', height: 140 },
  cardImagePlaceholder: {
    width: '100%', height: 140, backgroundColor: '#12122a',
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { padding: 12, paddingBottom: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardSubtitle: { fontSize: 12, color: '#555', marginTop: 1 },
  cardMetaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#252540', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  cardMeta: { fontSize: 11, color: '#888', fontWeight: '500' },
  seriesPill: {
    marginTop: 6, backgroundColor: 'rgba(156, 39, 176, 0.12)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  seriesPillText: { fontSize: 10, color: '#CE93D8', fontWeight: '600' },
  rarityBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  raritySuper: { backgroundColor: 'rgba(255, 215, 0, 0.25)' },
  rarityTH: { backgroundColor: 'rgba(255, 167, 38, 0.2)' },
  rarityPremium: { backgroundColor: 'rgba(156, 39, 176, 0.2)' },
  rarityMainline: { backgroundColor: 'rgba(0,0,0,0.7)' },
  rarityText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  qtyBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255, 215, 0, 0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  qtyBadgeText: { fontSize: 10, color: '#FFD700', fontWeight: '700' },
  cardPrice: {
    paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4,
    borderTopWidth: 0.5, borderTopColor: '#252540',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  priceLabel: { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 0.3 },
  priceValue: { fontSize: 15, fontWeight: '800', color: '#4caf50' },

  // Grid card
  gridCard: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#2a2a4a', overflow: 'hidden',
  },
  gridImageContainer: { position: 'relative' },
  gridImage: { width: '100%', height: 120 },
  gridImagePlaceholder: {
    width: '100%', height: 120, backgroundColor: '#12122a',
    justifyContent: 'center', alignItems: 'center',
  },
  gridInfo: { padding: 10 },
  gridName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  gridMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  gridPrice: { fontSize: 13, fontWeight: '800', color: '#4caf50', marginTop: 4 },

  // Compact card
  compactCard: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 10, marginBottom: 8, marginHorizontal: 3,
    borderWidth: 1, borderColor: '#2a2a4a', overflow: 'hidden',
  },
  compactImage: { width: '100%', height: 80 },
  compactImagePlaceholder: {
    width: '100%', height: 80, backgroundColor: '#12122a',
    justifyContent: 'center', alignItems: 'center',
  },
  compactName: { fontSize: 11, fontWeight: '700', color: '#fff', paddingHorizontal: 8, paddingTop: 6 },
  compactMeta: { fontSize: 10, color: '#666', paddingHorizontal: 8, paddingBottom: 6, marginTop: 1 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 12, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e63946', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700' },
});

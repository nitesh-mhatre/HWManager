import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllCars } from '../src/services/storage';
import { HotWheelCar } from '../src/types';
import { useTheme } from '../src/context/ThemeContext';
import { hapticLight } from '../src/services/haptics';

interface MonthlyStats {
  month: string;
  count: number;
  cost: number;
}

interface SeriesStats {
  name: string;
  count: number;
}

interface ConditionStats {
  condition: string;
  count: number;
}

interface AllocationStats {
  type: string;
  count: number;
}

interface DuplicateGroup {
  name: string;
  model: string;
  year: string;
  count: number;
  colors: string[];
}

interface CategoryCost {
  category: string;
  totalCost: number;
  count: number;
  avgCost: number;
}

export default function StatsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<HotWheelCar[]>([]);
  const [totalCars, setTotalCars] = useState(0);
  const [garageCount, setGarageCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [seriesStats, setSeriesStats] = useState<SeriesStats[]>([]);
  const [conditionStats, setConditionStats] = useState<ConditionStats[]>([]);
  const [allocationStats, setAllocationStats] = useState<AllocationStats[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [uniqueModels, setUniqueModels] = useState(0);
  const [uniqueSeries, setUniqueSeries] = useState(0);
  const [rareCount, setRareCount] = useState(0);
  const [timelineMode, setTimelineMode] = useState<'count' | 'cost' | 'both'>('both');
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [categoryCosts, setCategoryCosts] = useState<CategoryCost[]>([]);
  const [forecastMonths, setForecastMonths] = useState<{ month: string; predicted: number; trend: 'up' | 'down' | 'stable' }[]>([]);

  useEffect(() => {
    loadStats();
    loadBudget();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const allCars = await getAllCars();
    setCars(allCars);
    setTotalCars(allCars.length);

    const garage = allCars.filter((c) => c.inCollection);
    const wishlist = allCars.filter((c) => !c.inCollection);
    setGarageCount(garage.length);
    setWishlistCount(wishlist.length);

    const value = allCars.reduce((sum, c) => sum + (c.priceINR || c.expectedPrice || 0), 0);
    setTotalValue(value);

    const cost = allCars.reduce((sum, c) => {
      const ph = c.purchaseHistory || [];
      if (ph.length > 0) {
        // Use purchaseHistory sum when entries exist
        return sum + ph.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0);
      }
      // Legacy fallback: only use buyPrice when no purchase history
      return sum + (c.buyPrice || 0);
    }, 0);
    setTotalCost(cost);

    // Unique models and series
    const models = new Set(allCars.map((c) => (c.model || '').toLowerCase().trim()).filter(Boolean));
    const seriesSet = new Set(allCars.map((c) => (c.series || '').toLowerCase().trim()).filter(Boolean));
    setUniqueModels(models.size);
    setUniqueSeries(seriesSet.size);

    // Rare cars
    const rareKeywords = ['super', 'treasure', 'th', 'sTH', 'super treasure'];
    const rare = allCars.filter((c) =>
      rareKeywords.some((k) => (c.rarity || '').toLowerCase().includes(k.toLowerCase()))
    );
    setRareCount(rare.length);

    // Monthly stats (last 12 months)
    const monthlyMap: Record<string, { count: number; cost: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = { count: 0, cost: 0 };
    }

    allCars.forEach((c) => {
      const ph = c.purchaseHistory || [];
      if (ph.length > 0) {
        // Use purchaseHistory for accurate per-entry tracking
        ph.forEach((p) => {
          if (p.date) {
            const d = new Date(p.date);
            if (!isNaN(d.getTime())) {
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              if (monthlyMap[key]) {
                monthlyMap[key].count += p.quantity || 1;
                monthlyMap[key].cost += p.buyPrice * (p.quantity || 1);
              }
            }
          }
        });
      } else {
        // Legacy fallback: use dateAdded + buyPrice
        const dateStr = c.dateAdded || '';
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyMap[key]) {
              monthlyMap[key].count += 1;
              monthlyMap[key].cost += c.buyPrice || 0;
            }
          }
        }
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyArr: MonthlyStats[] = Object.entries(monthlyMap)
      .map(([key, val]) => ({
        month: monthNames[parseInt(key.split('-')[1]) - 1] + " '" + key.split('-')[0].slice(2),
        count: val.count,
        cost: val.cost,
      }));
    setMonthlyStats(monthlyArr);

    // Series stats
    const seriesMap: Record<string, number> = {};
    allCars.forEach((c) => {
      const s = (c.series || 'Unknown').trim();
      seriesMap[s] = (seriesMap[s] || 0) + 1;
    });
    const seriesArr = Object.entries(seriesMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setSeriesStats(seriesArr);

    // Condition stats
    const condMap: Record<string, number> = {};
    allCars.forEach((c) => {
      const cond = (c.condition || 'Unknown').trim();
      condMap[cond] = (condMap[cond] || 0) + 1;
    });
    const condArr = Object.entries(condMap)
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count);
    setConditionStats(condArr);

    // Allocation stats
    const allocMap: Record<string, number> = {};
    allCars.forEach((c) => {
      const alloc = (c.allocation || 'personal').trim();
      allocMap[alloc] = (allocMap[alloc] || 0) + 1;
    });
    const allocArr = Object.entries(allocMap)
      .map(([type, count]) => ({ type, count }));
    setAllocationStats(allocArr);

    // Duplicate detection — same car (name+model+year+color) purchased more than once
    const dupMap: Record<string, DuplicateGroup> = {};
    allCars.forEach((c) => {
      const nameKey = (c.name || '').toLowerCase().trim();
      const modelKey = (c.model || '').toLowerCase().trim();
      const yearKey = (c.year || '').toLowerCase().trim();
      const colorKey = (c.color || '').toLowerCase().trim();
      // Skip entries with no identifying info
      if (!nameKey && !modelKey) return;
      const key = `${nameKey}|${modelKey}|${yearKey}|${colorKey}`;
      if (!dupMap[key]) {
        dupMap[key] = {
          name: c.name,
          model: c.model,
          year: c.year,
          count: 0,
          colors: [],
        };
      }
      dupMap[key].count += 1;
      const color = (c.color || '').trim();
      if (color && !dupMap[key].colors.includes(color)) {
        dupMap[key].colors.push(color);
      }
    });
    const dupArr = Object.values(dupMap)
      .filter((d) => d.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    setDuplicates(dupArr);

    setLoading(false);
  };

  const loadBudget = async () => {
    try {
      const saved = await AsyncStorage.getItem('hw_monthly_budget');
      if (saved) {
        const val = parseInt(saved, 10);
        setMonthlyBudget(val);
        setBudgetInput(String(val));
      }
    } catch {}
  };

  const saveBudget = async () => {
    const val = parseInt(budgetInput, 10);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid', 'Please enter a valid budget amount.');
      return;
    }
    setMonthlyBudget(val);
    await AsyncStorage.setItem('hw_monthly_budget', String(val));
    setShowBudgetInput(false);
    Alert.alert('Saved', `Monthly budget set to ${formatCurrency(val)}`);
  };

  const getBudgetUsage = () => {
    const currentMonthCost = monthlyStats.length > 0 ? monthlyStats[monthlyStats.length - 1].cost : 0;
    if (monthlyBudget === 0) return null;
    const used = Math.min((currentMonthCost / monthlyBudget) * 100, 100);
    return { used, currentMonthCost, remaining: Math.max(monthlyBudget - currentMonthCost, 0) };
  };

  const getForecast = () => {
    if (monthlyStats.length < 3) return [];
    const costs = monthlyStats.filter((m) => m.cost > 0).map((m) => m.cost);
    if (costs.length < 3) return [];
    // Simple linear regression
    const n = costs.length;
    const xMean = (n - 1) / 2;
    const yMean = costs.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    costs.forEach((y, x) => {
      num += (x - xMean) * (y - yMean);
      den += (x - xMean) * (x - xMean);
    });
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const lastCost = costs[costs.length - 1];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const predicted = Math.round(intercept + slope * (n + i - 1));
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const trend: 'up' | 'down' | 'stable' = predicted > lastCost * 1.1 ? 'up' : predicted < lastCost * 0.9 ? 'down' : 'stable';
      forecast.push({
        month: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        predicted: Math.max(0, predicted),
        trend,
      });
    }
    return forecast;
  };

  const getCategoryBreakdown = () => {
    const catMap: Record<string, { totalCost: number; count: number }> = {};
    cars.forEach((c) => {
      const cat = (c.series || 'Unknown').trim();
      if (!catMap[cat]) catMap[cat] = { totalCost: 0, count: 0 };
      const ph = c.purchaseHistory || [];
      const cost = ph.length > 0
        ? ph.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0)
        : (c.buyPrice || 0);
      catMap[cat].totalCost += cost;
      catMap[cat].count += 1;
    });
    return Object.entries(catMap)
      .map(([category, data]) => ({
        category,
        totalCost: data.totalCost,
        count: data.count,
        avgCost: data.count > 0 ? Math.round(data.totalCost / data.count) : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);
  };

  const getTopExpensiveCars = () => {
    return cars
      .map((c) => {
        const ph = c.purchaseHistory || [];
        const cost = ph.length > 0
          ? ph.reduce((s, p) => s + p.buyPrice * (p.quantity || 1), 0)
          : (c.buyPrice || 0);
        return { ...c, totalCost: cost };
      })
      .filter((c) => c.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getMaxCount = () => {
    if (monthlyStats.length === 0) return 1;
    return Math.max(...monthlyStats.map((m) => m.count), 1);
  };

  const getMaxCost = () => {
    if (monthlyStats.length === 0) return 1;
    return Math.max(...monthlyStats.map((m) => m.cost), 1);
  };

  const getCountBarHeight = (count: number) => {
    const max = getMaxCount();
    return Math.max((count / max) * 100, count > 0 ? 8 : 0);
  };

  const getCostBarHeight = (cost: number) => {
    const max = getMaxCost();
    return Math.max((cost / max) * 100, cost > 0 ? 8 : 0);
  };

  const getCountBarColor = (count: number) => {
    const max = getMaxCount();
    const ratio = count / max;
    if (ratio > 0.75) return colors.info;
    if (ratio > 0.5) return '#5c9ce6';
    if (ratio > 0.25) return '#7ab3e8';
    return colors.textMuted;
  };

  const getCostBarColor = (cost: number) => {
    const max = getMaxCost();
    const ratio = cost / max;
    if (ratio > 0.75) return colors.success;
    if (ratio > 0.5) return '#66bb6a';
    if (ratio > 0.25) return '#81c784';
    return colors.textMuted;
  };

  const getMonthlyTotalCount = () => monthlyStats.reduce((sum, m) => sum + m.count, 0);
  const getMonthlyTotalCost = () => monthlyStats.reduce((sum, m) => sum + m.cost, 0);

  const getAvgMonthlyCost = () => {
    const activeMonths = monthlyStats.filter((m) => m.cost > 0);
    if (activeMonths.length === 0) return 0;
    return Math.round(activeMonths.reduce((sum, m) => sum + m.cost, 0) / activeMonths.length);
  };

  const isAlertMonth = (cost: number) => {
    const avg = getAvgMonthlyCost();
    return avg > 0 && cost > avg * 1.5;
  };

  const getAlertMonths = () => {
    const avg = getAvgMonthlyCost();
    return monthlyStats.filter((m) => m.cost > avg * 1.5 && m.cost > 0);
  };

  const getHeatmapColor = (intensity: number) => {
    if (intensity === 0) return '#1a1a2e';
    if (intensity < 0.25) return '#2d4a2e';
    if (intensity < 0.5) return '#4a7a2e';
    if (intensity < 0.75) return '#6aad2e';
    return '#e63946';
  };

  const getCountHeatmapColor = (intensity: number) => {
    if (intensity === 0) return '#1a1a2e';
    if (intensity < 0.25) return '#1a2a4a';
    if (intensity < 0.5) return '#1a3a6a';
    if (intensity < 0.75) return '#2a5a8a';
    return '#4da6ff';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="chart-bar" size={40} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading stats...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { hapticLight(); router.back(); }} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialIcons name="insights" size={28} color="#4caf50" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Collection Stats</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Overview Cards */}
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="car" size={24} color="#e63946" />
          <Text style={[styles.overviewValue, { color: colors.text }]}>{totalCars}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Total Cars</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="car" size={24} color="#4da6ff" />
          <Text style={[styles.overviewValue, { color: colors.text }]}>{garageCount}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Garage</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="star" size={24} color="#FFD700" />
          <Text style={[styles.overviewValue, { color: colors.text }]}>{wishlistCount}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Wishlist</Text>
        </View>
      </View>

      {/* Value Summary */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="account-balance-wallet" size={18} color="#4caf50" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Value Summary</Text>
        </View>
        <View style={styles.valueRow}>
          <View style={styles.valueItem}>
            <Text style={[styles.valueAmount, { color: '#4caf50' }]}>{formatCurrency(totalValue)}</Text>
            <Text style={[styles.valueLabel, { color: colors.textMuted }]}>Market Value</Text>
          </View>
          <View style={[styles.valueDivider, { backgroundColor: colors.border }]} />
          <View style={styles.valueItem}>
            <Text style={[styles.valueAmount, { color: colors.warning }]}>{formatCurrency(totalCost)}</Text>
            <Text style={[styles.valueLabel, { color: colors.textMuted }]}>Total Invested</Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="auto-graph" size={18} color={colors.info} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Stats</Text>
        </View>
        <View style={styles.quickStatsGrid}>
          <View style={styles.quickStatItem}>
            <MaterialCommunityIcons name="toy-brick" size={20} color="#e63946" />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{uniqueModels}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Unique Models</Text>
          </View>
          <View style={styles.quickStatItem}>
            <MaterialIcons name="collections" size={20} color="#4da6ff" />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{uniqueSeries}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Series</Text>
          </View>
          <View style={styles.quickStatItem}>
            <MaterialIcons name="diamond" size={20} color="#FFD700" />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{rareCount}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Rare/STH</Text>
          </View>
          <View style={styles.quickStatItem}>
            <MaterialCommunityIcons name="content-duplicate" size={20} color={colors.warning} />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>{duplicates.length}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textMuted }]}>Duplicates</Text>
          </View>
        </View>
      </View>

      {/* Monthly Budget */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="account-balance-wallet" size={18} color="#FFD700" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Budget</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => { hapticLight(); setShowBudgetInput(!showBudgetInput); }}>
            <MaterialIcons name={showBudgetInput ? 'close' : 'edit'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showBudgetInput ? (
          <View style={styles.budgetInputRow}>
            <Text style={[styles.budgetInputLabel, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.budgetInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={budgetInput}
              onChangeText={setBudgetInput}
              placeholder="Enter monthly budget"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity style={[styles.budgetSaveBtn, { backgroundColor: colors.primary }]} onPress={saveBudget}>
              <MaterialIcons name="check" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : monthlyBudget > 0 ? (
          <>
            {(() => {
              const usage = getBudgetUsage();
              if (!usage) return null;
              const isOver = usage.currentMonthCost > monthlyBudget;
              const isWarning = usage.used > 75;
              return (
                <>
                  <View style={styles.budgetOverview}>
                    <View style={styles.budgetItem}>
                      <Text style={[styles.budgetItemLabel, { color: colors.textMuted }]}>Budget</Text>
                      <Text style={[styles.budgetItemValue, { color: colors.text }]}>{formatCurrency(monthlyBudget)}</Text>
                    </View>
                    <View style={[styles.budgetDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.budgetItem}>
                      <Text style={[styles.budgetItemLabel, { color: colors.textMuted }]}>Spent</Text>
                      <Text style={[styles.budgetItemValue, { color: isOver ? '#e63946' : colors.info }]}>{formatCurrency(usage.currentMonthCost)}</Text>
                    </View>
                    <View style={[styles.budgetDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.budgetItem}>
                      <Text style={[styles.budgetItemLabel, { color: colors.textMuted }]}>Left</Text>
                      <Text style={[styles.budgetItemValue, { color: usage.remaining > 0 ? colors.success : '#e63946' }]}>{formatCurrency(usage.remaining)}</Text>
                    </View>
                  </View>
                  <View style={styles.budgetBarContainer}>
                    <View style={[styles.budgetBarBg, { backgroundColor: colors.inputBg }]}>
                      <View
                        style={[
                          styles.budgetBarFill,
                          {
                            width: `${usage.used}%`,
                            backgroundColor: isOver ? '#e63946' : isWarning ? colors.warning : colors.success,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.budgetBarText, { color: colors.textMuted }]}>{Math.round(usage.used)}% used</Text>
                  </View>
                  {isOver && (
                    <View style={[styles.budgetAlert, { backgroundColor: 'rgba(230, 57, 70, 0.1)' }] }>
                      <MaterialIcons name="warning" size={14} color="#e63946" />
                      <Text style={[styles.budgetAlertText, { color: '#e63946' }]}>Over budget by {formatCurrency(usage.currentMonthCost - monthlyBudget)}</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <TouchableOpacity
            style={[styles.budgetEmpty, { borderColor: colors.border }]}
            onPress={() => { hapticLight(); setShowBudgetInput(true); }}
          >
            <MaterialIcons name="add-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.budgetEmptyText, { color: colors.textMuted }]}>Set monthly budget to track spending</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Spending Forecast */}
      {forecastMonths.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-fix-high" size={18} color={colors.purple} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Forecast</Text>
          </View>
          <Text style={[styles.forecastSubtitle, { color: colors.textMuted }]}>Next 3 months based on your spending trend</Text>
          <View style={styles.forecastRow}>
            {forecastMonths.map((item, index) => (
              <View key={index} style={[styles.forecastCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.forecastMonth, { color: colors.text }]}>{item.month}</Text>
                <View style={styles.forecastIconRow}>
                  <MaterialIcons
                    name={item.trend === 'up' ? 'trending-up' : item.trend === 'down' ? 'trending-down' : 'trending-flat'}
                    size={18}
                    color={item.trend === 'up' ? '#e63946' : item.trend === 'down' ? colors.success : colors.info}
                  />
                </View>
                <Text style={[styles.forecastValue, { color: item.trend === 'up' ? '#e63946' : item.trend === 'down' ? colors.success : colors.text }]}>
                  {formatCurrency(item.predicted)}
                </Text>
                {monthlyBudget > 0 && (
                  <View style={[styles.forecastBudgetTag, { backgroundColor: item.predicted > monthlyBudget ? 'rgba(230, 57, 70, 0.15)' : 'rgba(76, 175, 80, 0.15)' }]}>
                    <Text style={[styles.forecastBudgetText, { color: item.predicted > monthlyBudget ? '#e63946' : colors.success }]}>
                      {item.predicted > monthlyBudget ? 'Over' : 'Under'} budget
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Cost by Category */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="pie-chart" size={18} color={colors.warning} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cost by Series</Text>
        </View>
        <Text style={[styles.categorySubtitle, { color: colors.textMuted }]}>Top 10 series by total spending</Text>
        {(() => {
          const cats = getCategoryBreakdown();
          const maxCost = cats.length > 0 ? cats[0].totalCost : 1;
          if (cats.length === 0) {
            return <Text style={[styles.emptyText, { color: colors.textMuted }]}>No cost data yet</Text>;
          }
          return (
            <View style={styles.categoryList}>
              {cats.map((cat, index) => {
                const barWidth = maxCost > 0 ? (cat.totalCost / maxCost) * 100 : 0;
                const colors2 = ['#e63946', '#4da6ff', '#4caf50', '#FFD700', '#9C27B0', '#FF9800', '#00BCD4', '#E91E63', '#8BC34A', '#607D8B'];
                return (
                  <View key={index} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <Text style={[styles.categoryRank, { color: colors.textMuted }]}>{index + 1}</Text>
                      <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>{cat.category}</Text>
                    </View>
                    <View style={styles.categoryBarContainer}>
                      <View style={[styles.categoryBarBg, { backgroundColor: colors.inputBg }]}>
                        <View
                          style={[
                            styles.categoryBarFill,
                            { width: `${barWidth}%`, backgroundColor: colors2[index % colors2.length] },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.categoryValues}>
                      <Text style={[styles.categoryTotalCost, { color: colors.text }]}>{formatCurrency(cat.totalCost)}</Text>
                      <Text style={[styles.categoryAvgCost, { color: colors.textMuted }]}>₹{cat.avgCost}/ea · {cat.count}x</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* Top 5 Most Expensive Cars */}
        {(() => {
          const topCars = getTopExpensiveCars();
          if (topCars.length === 0) return null;
          const maxCarCost = topCars[0]?.totalCost || 1;
          return (
            <View style={styles.topCarsContainer}>
              <View style={[styles.topCarsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.topCarsHeader}>
                <MaterialIcons name="emoji-events" size={16} color="#FFD700" />
                <Text style={[styles.topCarsTitle, { color: colors.text }]}>Top 5 Most Expensive</Text>
              </View>
              {topCars.map((car, index) => {
                const barWidth = maxCarCost > 0 ? (car.totalCost / maxCarCost) * 100 : 0;
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <View key={car.id} style={styles.topCarRow}>
                    <View style={styles.topCarInfo}>
                      <Text style={styles.topCarMedal}>{medals[index]}</Text>
                      <View style={styles.topCarDetails}>
                        <Text style={[styles.topCarName, { color: colors.text }]} numberOfLines={1}>{car.name || 'Unknown'}</Text>
                        <Text style={[styles.topCarMeta, { color: colors.textMuted }]}>{car.model} · {car.year}{car.color ? ` · ${car.color}` : ''}</Text>
                      </View>
                    </View>
                    <View style={styles.topCarBarContainer}>
                      <View style={[styles.topCarBarBg, { backgroundColor: colors.inputBg }]}>
                        <View
                          style={[
                            styles.topCarBarFill,
                            {
                              width: `${barWidth}%`,
                              backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : colors.info,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={[styles.topCarCost, { color: index === 0 ? '#FFD700' : colors.text }]}>{formatCurrency(car.totalCost)}</Text>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </View>

      {/* Monthly Timeline */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="timeline" size={18} color="#4da6ff" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Purchase Timeline</Text>
        </View>

        {/* Toggle: Cars vs Cost vs Both */}
        <View style={styles.timelineToggle}>
          <TouchableOpacity
            style={[styles.timelineToggleBtn, timelineMode === 'both' && { backgroundColor: colors.primary }]}
            onPress={() => { hapticLight(); setTimelineMode('both'); }}
          >
            <MaterialIcons name="compare" size={14} color={timelineMode === 'both' ? '#fff' : colors.textMuted} />
            <Text style={[styles.timelineToggleText, { color: timelineMode === 'both' ? '#fff' : colors.textMuted }]}>Both</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timelineToggleBtn, timelineMode === 'count' && { backgroundColor: colors.primary }]}
            onPress={() => { hapticLight(); setTimelineMode('count'); }}
          >
            <MaterialCommunityIcons name="car" size={14} color={timelineMode === 'count' ? '#fff' : colors.textMuted} />
            <Text style={[styles.timelineToggleText, { color: timelineMode === 'count' ? '#fff' : colors.textMuted }]}>Cars</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timelineToggleBtn, timelineMode === 'cost' && { backgroundColor: colors.primary }]}
            onPress={() => { hapticLight(); setTimelineMode('cost'); }}
          >
            <MaterialIcons name="payments" size={14} color={timelineMode === 'cost' ? '#fff' : colors.textMuted} />
            <Text style={[styles.timelineToggleText, { color: timelineMode === 'cost' ? '#fff' : colors.textMuted }]}>₹ Cost</Text>
          </TouchableOpacity>
        </View>

        {/* Totals row */}
        {timelineMode === 'both' ? (
          <View style={styles.timelineTotalRow}>
            <View style={styles.timelineTotalItem}>
              <MaterialCommunityIcons name="car" size={12} color={colors.info} />
              <Text style={[styles.timelineTotalValue, { color: colors.info, fontSize: 14 }]}>{getMonthlyTotalCount()}</Text>
            </View>
            <View style={[styles.timelineTotalDivider, { backgroundColor: colors.border }]} />
            <View style={styles.timelineTotalItem}>
              <MaterialIcons name="payments" size={12} color={colors.success} />
              <Text style={[styles.timelineTotalValue, { color: colors.success, fontSize: 14 }]}>{formatCurrency(getMonthlyTotalCost())}</Text>
            </View>
            <Text style={[styles.timelineTotalSub, { color: colors.textMuted }]}>over {monthlyStats.length} mo</Text>
          </View>
        ) : (
          <View style={styles.timelineTotalRow}>
            <Text style={[styles.timelineTotalLabel, { color: colors.textMuted }]}>Total:</Text>
            <Text style={[styles.timelineTotalValue, { color: timelineMode === 'count' ? colors.info : colors.success }]}>
              {timelineMode === 'count' ? getMonthlyTotalCount() : formatCurrency(getMonthlyTotalCost())}
            </Text>
            <Text style={[styles.timelineTotalSub, { color: colors.textMuted }]}>over {monthlyStats.length} months</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
          {timelineMode === 'both' ? (
            /* Dual bar view */
            <View style={styles.dualChartContainer}>
              {monthlyStats.map((item, index) => (
                <View key={index} style={styles.dualBarWrapper}>
                  <View style={styles.dualBarValuesContainer}>
                    <Text style={[styles.dualBarValue, { color: colors.info }]} numberOfLines={1}>
                      {item.count > 0 ? item.count : ''}
                    </Text>
                    <Text style={[styles.dualBarValue, { color: colors.success }]} numberOfLines={1}>
                      {item.cost > 0 ? `₹${item.cost >= 1000 ? `${(item.cost / 1000).toFixed(1)}k` : item.cost}` : ''}
                    </Text>
                  </View>
                  <View style={styles.dualBarsRow}>
                    <View
                      style={[
                        styles.dualBar,
                        {
                          height: getCountBarHeight(item.count),
                          backgroundColor: getCountBarColor(item.count),
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.dualBar,
                        {
                          height: getCostBarHeight(item.cost),
                          backgroundColor: getCostBarColor(item.cost),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.dualBarLabel, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.month}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            /* Single bar view */
            <View style={styles.chartContainer}>
              {monthlyStats.map((item, index) => {
                const isCount = timelineMode === 'count';
                const value = isCount ? item.count : item.cost;
                const height = isCount ? getCountBarHeight(item.count) : getCostBarHeight(item.cost);
                const color = isCount ? getCountBarColor(item.count) : getCostBarColor(item.cost);
                return (
                  <View key={index} style={styles.barWrapper}>
                    <View style={styles.barValueContainer}>
                      <Text style={[styles.barValue, { color: colors.textMuted }]} numberOfLines={1}>
                        {isCount
                          ? (item.count > 0 ? item.count : '')
                          : (item.cost > 0 ? `₹${item.cost >= 1000 ? `${(item.cost / 1000).toFixed(1)}k` : item.cost}` : '')
                        }
                      </Text>
                    </View>
                    <View
                      style={[styles.bar, { height, backgroundColor: color }]}
                    />
                    <Text style={[styles.barLabel, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.month}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Legend */}
        {timelineMode === 'both' ? (
          <View style={styles.dualChartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Cars Count</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>₹ Spent</Text>
            </View>
          </View>
        ) : (
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>High (75%+)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Medium</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Low</Text>
            </View>
          </View>
        )}
      </View>

      {/* Spending Alerts */}
      {getAlertMonths().length > 0 && (
        <View style={[styles.alertCard, { backgroundColor: 'rgba(230, 57, 70, 0.1)', borderColor: '#e63946' }]}>
          <View style={styles.alertHeader}>
            <MaterialIcons name="warning" size={20} color="#e63946" />
            <Text style={[styles.alertTitle, { color: '#e63946' }]}>Spending Alert</Text>
          </View>
          <Text style={[styles.alertSubtitle, { color: colors.textMuted }]}>
            {getAlertMonths().length} month(s) exceeded 50%+ above average ({formatCurrency(getAvgMonthlyCost())}/mo)
          </Text>
          <View style={styles.alertList}>
            {getAlertMonths().map((item, index) => {
              const avg = getAvgMonthlyCost();
              const overPercent = Math.round(((item.cost - avg) / avg) * 100);
              return (
                <View key={index} style={[styles.alertItem, { backgroundColor: colors.surface }] }>
                  <View style={styles.alertItemLeft}>
                    <Text style={[styles.alertItemMonth, { color: colors.text }]}>{item.month}</Text>
                    <Text style={[styles.alertItemCost, { color: '#e63946' }]}>{formatCurrency(item.cost)}</Text>
                  </View>
                  <View style={styles.alertItemRight}>
                    <View style={[styles.alertBadge, { backgroundColor: 'rgba(230, 57, 70, 0.2)' }]}>
                      <Text style={[styles.alertBadgeText, { color: '#e63946' }]}>+{overPercent}%</Text>
                    </View>
                    <Text style={[styles.alertItemCars, { color: colors.textMuted }]}>🚗 {item.count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Spending Heatmap */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="whatshot" size={18} color="#ff6b35" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Heatmap</Text>
        </View>
        <Text style={[styles.heatmapSubtitle, { color: colors.textMuted }]}>Spending intensity over the last 12 months</Text>

        {/* Heatmap grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
          <View style={styles.heatmapContainer}>
            {/* Labels row */}
            <View style={styles.heatmapRow}>
              <Text style={[styles.heatmapSideLabel, { color: colors.textMuted }]}>₹</Text>
              {monthlyStats.map((item, index) => (
                <View key={index} style={styles.heatmapCellWrapper}>
                  <Text style={[styles.heatmapMonthLabel, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.month.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </View>

            {/* Heatmap row */}
            <View style={styles.heatmapRow}>
              <Text style={[styles.heatmapSideLabel, { color: colors.textMuted }]}> </Text>
              {monthlyStats.map((item, index) => {
                const maxCost = getMaxCost();
                const ratio = item.cost / maxCost;
                const intensity = item.cost > 0 ? Math.max(ratio, 0.08) : 0;
                const bgColor = getHeatmapColor(intensity);
                return (
                  <View key={index} style={styles.heatmapCellWrapper}>
                    <View
                      style={[
                        styles.heatmapCell,
                        { backgroundColor: bgColor },
                        isAlertMonth(item.cost) && styles.heatmapCellAlert,
                      ]}
                    />
                    {isAlertMonth(item.cost) && (
                      <View style={styles.heatmapAlertDot} />
                    )}
                    <Text style={[styles.heatmapValue, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.cost > 0 ? `₹${item.cost >= 1000 ? `${(item.cost / 1000).toFixed(1)}k` : item.cost}` : '–'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Cars count row */}
            <View style={styles.heatmapRow}>
              <Text style={[styles.heatmapSideLabel, { color: colors.textMuted }]}>🚗</Text>
              {monthlyStats.map((item, index) => {
                const maxCount = getMaxCount();
                const ratio = item.count / maxCount;
                const intensity = item.count > 0 ? Math.max(ratio, 0.08) : 0;
                const bgColor = getCountHeatmapColor(intensity);
                return (
                  <View key={index} style={styles.heatmapCellWrapper}>
                    <View
                      style={[
                        styles.heatmapCell,
                        styles.heatmapCellSmall,
                        { backgroundColor: bgColor },
                      ]}
                    />
                    <Text style={[styles.heatmapValue, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.count > 0 ? item.count : '–'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Heatmap Legend */}
        <View style={styles.heatmapLegend}>
          <Text style={[styles.heatmapLegendLabel, { color: colors.textMuted }]}>Less</Text>
          <View style={styles.heatmapLegendRow}>
            <View style={[styles.heatmapLegendCell, { backgroundColor: '#1a1a2e' }]} />
            <View style={[styles.heatmapLegendCell, { backgroundColor: '#2d4a2e' }]} />
            <View style={[styles.heatmapLegendCell, { backgroundColor: '#4a7a2e' }]} />
            <View style={[styles.heatmapLegendCell, { backgroundColor: '#6aad2e' }]} />
            <View style={[styles.heatmapLegendCell, { backgroundColor: '#e63946' }]} />
          </View>
          <Text style={[styles.heatmapLegendLabel, { color: colors.textMuted }]}>More</Text>
        </View>

        {/* Spending summary */}
        <View style={styles.heatmapSummary}>
          <View style={styles.heatmapSummaryItem}>
            <MaterialIcons name="trending-up" size={14} color={colors.success} />
            <Text style={[styles.heatmapSummaryText, { color: colors.textMuted }]}>Peak: </Text>
            <Text style={[styles.heatmapSummaryValue, { color: colors.success }]}>
              {formatCurrency(Math.max(...monthlyStats.map((m) => m.cost)))}
            </Text>
          </View>
          <View style={styles.heatmapSummaryItem}>
            <MaterialIcons name="trending-down" size={14} color={colors.info} />
            <Text style={[styles.heatmapSummaryText, { color: colors.textMuted }]}>Avg: </Text>
            <Text style={[styles.heatmapSummaryValue, { color: colors.info }]}>
              {formatCurrency(getAvgMonthlyCost())}
            </Text>
          </View>
          <View style={styles.heatmapSummaryItem}>
            <MaterialIcons name="warning" size={14} color="#e63946" />
            <Text style={[styles.heatmapSummaryText, { color: colors.textMuted }]}>Alert: </Text>
            <Text style={[styles.heatmapSummaryValue, { color: '#e63946' }]}>
              {formatCurrency(Math.round(getAvgMonthlyCost() * 1.5))}
            </Text>
          </View>
        </View>
      </View>

      {/* Condition Breakdown */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="health-and-safety" size={18} color="#4caf50" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Condition Breakdown</Text>
        </View>
        {conditionStats.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No condition data yet</Text>
        ) : (
          conditionStats.map((item, index) => (
            <View key={index} style={styles.conditionRow}>
              <View style={styles.conditionInfo}>
                <Text style={[styles.conditionName, { color: colors.text }]}>{item.condition}</Text>
                <Text style={[styles.conditionCount, { color: colors.textMuted }]}>
                  {item.count} cars ({Math.round((item.count / totalCars) * 100)}%)
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${(item.count / totalCars) * 100}%`,
                      backgroundColor: index === 0 ? colors.primary : colors.info,
                    },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </View>

      {/* Allocation Breakdown */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="category" size={18} color="#9C27B0" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Allocation</Text>
        </View>
        {allocationStats.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No allocation data yet</Text>
        ) : (
          <View style={styles.allocationRow}>
            {allocationStats.map((item, index) => {
              const icons: Record<string, string> = {
                personal: 'person',
                trade: 'swap-horiz',
                forSale: 'store',
              };
              return (
                <View key={index} style={styles.allocationItem}>
                  <MaterialIcons
                    name={(icons[item.type] || 'help') as any}
                    size={20}
                    color={index === 0 ? '#e63946' : index === 1 ? '#4da6ff' : '#4caf50'}
                  />
                  <Text style={[styles.allocationValue, { color: colors.text }]}>{item.count}</Text>
                  <Text style={[styles.allocationLabel, { color: colors.textMuted }]}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Top Series */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="collections" size={18} color="#FFD700" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Series</Text>
        </View>
        {seriesStats.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No series data yet</Text>
        ) : (
          seriesStats.map((item, index) => (
            <View key={index} style={styles.seriesRow}>
              <View style={[styles.seriesRank, { backgroundColor: index === 0 ? colors.primary : colors.surfaceAlt }]}>
                <Text style={[styles.seriesRankText, { color: index === 0 ? '#fff' : colors.textMuted }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.seriesName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.seriesCount, { color: colors.textMuted }]}>{item.count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Duplicates */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="content-duplicate" size={18} color={colors.warning} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Duplicate Cars</Text>
        </View>
        {duplicates.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No duplicates found!</Text>
        ) : (
          <>
            <Text style={[styles.duplicatesSummary, { color: colors.textMuted }]}>
              {duplicates.length} car(s) appear multiple times
            </Text>
            {duplicates.map((item, index) => (
              <View key={index} style={styles.duplicateCard}>
                <View style={styles.duplicateHeader}>
                  <Text style={[styles.duplicateName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={[styles.duplicateBadge, { backgroundColor: colors.warning }]}>
                    <Text style={styles.duplicateBadgeText}>×{item.count}</Text>
                  </View>
                </View>
                <Text style={[styles.duplicateDetails, { color: colors.textMuted }]}>
                  {item.model} • {item.year}
                </Text>
                {item.colors.length > 0 && (
                  <View style={styles.duplicateColors}>
                    {item.colors.slice(0, 5).map((color, i) => (
                      <View key={i} style={[styles.colorTag, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <Text style={[styles.colorTagText, { color: colors.textSecondary }]}>{color}</Text>
                      </View>
                    ))}
                    {item.colors.length > 5 && (
                      <Text style={[styles.moreColors, { color: colors.textMuted }]}>
                        +{item.colors.length - 5} more
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingTop: 50, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  overviewRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  overviewValue: { fontSize: 22, fontWeight: '800' },
  overviewLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueItem: { flex: 1, alignItems: 'center' },
  valueAmount: { fontSize: 18, fontWeight: '800' },
  valueLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  valueDivider: { width: 1, height: 40, marginHorizontal: 16 },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickStatItem: {
    width: '47%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 4,
  },
  quickStatValue: { fontSize: 20, fontWeight: '800' },
  quickStatLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  timelineToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  timelineToggleText: { fontSize: 12, fontWeight: '700' },
  timelineTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  timelineTotalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timelineTotalDivider: { width: 1, height: 16, marginHorizontal: 8 },
  timelineTotalLabel: { fontSize: 11, fontWeight: '600' },
  timelineTotalValue: { fontSize: 16, fontWeight: '800' },
  timelineTotalSub: { fontSize: 10, marginLeft: 4 },
  chartScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 130,
    paddingTop: 20,
  },
  barWrapper: { alignItems: 'center', minWidth: 48 },
  barValueContainer: { height: 20, justifyContent: 'flex-end' },
  barValue: { fontSize: 9, fontWeight: '700' },
  bar: {
    width: 28,
    borderRadius: 4,
    minHeight: 0,
    marginTop: 4,
  },
  barLabel: { fontSize: 9, marginTop: 4, fontWeight: '600' },
  /* Dual bar styles */
  dualChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 140,
    paddingTop: 20,
  },
  dualBarWrapper: { alignItems: 'center', minWidth: 52 },
  dualBarValuesContainer: { height: 32, justifyContent: 'flex-end', alignItems: 'center' },
  dualBarValue: { fontSize: 8, fontWeight: '700' },
  dualBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginTop: 2,
  },
  dualBar: {
    width: 16,
    borderRadius: 3,
    minHeight: 0,
  },
  dualBarLabel: { fontSize: 8, marginTop: 4, fontWeight: '600' },
  dualChartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10 },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  conditionInfo: { width: 100 },
  conditionName: { fontSize: 13, fontWeight: '600' },
  conditionCount: { fontSize: 10 },
  progressBarContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 4 },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  allocationItem: { alignItems: 'center', gap: 4 },
  allocationValue: { fontSize: 20, fontWeight: '800' },
  allocationLabel: { fontSize: 11, textTransform: 'capitalize' },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  seriesRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seriesRankText: { fontSize: 11, fontWeight: '800' },
  seriesName: { flex: 1, fontSize: 13, fontWeight: '600' },
  seriesCount: { fontSize: 13, fontWeight: '700' },
  duplicatesSummary: { fontSize: 12, marginBottom: 12 },
  duplicateCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duplicateName: { fontSize: 14, fontWeight: '700', flex: 1 },
  duplicateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  duplicateBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  duplicateDetails: { fontSize: 12, marginTop: 4 },
  duplicateColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  colorTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  colorTagText: { fontSize: 10, fontWeight: '600' },
  moreColors: { fontSize: 10, alignSelf: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  /* Alert styles */
  alertCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  alertTitle: { fontSize: 16, fontWeight: '800' },
  alertSubtitle: { fontSize: 11, marginBottom: 10 },
  alertList: { gap: 6 },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
  },
  alertItemLeft: { flexDirection: 'column', gap: 2 },
  alertItemMonth: { fontSize: 13, fontWeight: '700' },
  alertItemCost: { fontSize: 15, fontWeight: '800' },
  alertItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  alertBadgeText: { fontSize: 12, fontWeight: '800' },
  alertItemCars: { fontSize: 12 },
  /* Budget styles */
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetInputLabel: { fontSize: 16, fontWeight: '700' },
  budgetInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  budgetSaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetItem: { flex: 1, alignItems: 'center' },
  budgetItemLabel: { fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
  budgetItemValue: { fontSize: 16, fontWeight: '800' },
  budgetDivider: { width: 1, height: 30, marginHorizontal: 8 },
  budgetBarContainer: { marginBottom: 8 },
  budgetBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  budgetBarFill: { height: '100%', borderRadius: 5 },
  budgetBarText: { fontSize: 10, textAlign: 'right', marginTop: 4 },
  budgetAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
  },
  budgetAlertText: { fontSize: 12, fontWeight: '700' },
  budgetEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  budgetEmptyText: { fontSize: 13 },
  /* Forecast styles */
  forecastSubtitle: { fontSize: 11, marginBottom: 12 },
  forecastRow: {
    flexDirection: 'row',
    gap: 10,
  },
  forecastCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  forecastMonth: { fontSize: 12, fontWeight: '700' },
  forecastIconRow: { height: 20, justifyContent: 'center' },
  forecastValue: { fontSize: 16, fontWeight: '800' },
  forecastBudgetTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  forecastBudgetText: { fontSize: 9, fontWeight: '700' },
  /* Category styles */
  categorySubtitle: { fontSize: 11, marginBottom: 12 },
  categoryList: { gap: 8 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 90,
    gap: 6,
  },
  categoryRank: { fontSize: 10, fontWeight: '800', width: 14 },
  categoryName: { fontSize: 11, fontWeight: '600', flex: 1 },
  categoryBarContainer: { flex: 1, minWidth: 60 },
  categoryBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBarFill: { height: '100%', borderRadius: 4 },
  categoryValues: { alignItems: 'flex-end', width: 80 },
  categoryTotalCost: { fontSize: 11, fontWeight: '700' },
  categoryAvgCost: { fontSize: 9, marginTop: 1 },
  /* Top expensive cars styles */
  topCarsContainer: { marginTop: 8 },
  topCarsDivider: { height: 1, marginBottom: 12 },
  topCarsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  topCarsTitle: { fontSize: 12, fontWeight: '700' },
  topCarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  topCarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 130,
    gap: 6,
  },
  topCarMedal: { fontSize: 14 },
  topCarDetails: { flex: 1 },
  topCarName: { fontSize: 11, fontWeight: '700' },
  topCarMeta: { fontSize: 9, marginTop: 1 },
  topCarBarContainer: { flex: 1, minWidth: 50 },
  topCarBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  topCarBarFill: { height: '100%', borderRadius: 3 },
  topCarCost: { fontSize: 11, fontWeight: '800', width: 60, textAlign: 'right' },
  /* Heatmap styles */
  heatmapSubtitle: { fontSize: 11, marginBottom: 12 },
  heatmapContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heatmapSideLabel: {
    width: 20,
    fontSize: 10,
    textAlign: 'center',
  },
  heatmapCellWrapper: {
    alignItems: 'center',
    width: 36,
    gap: 2,
    position: 'relative',
  },
  heatmapCell: {
    width: 32,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heatmapCellAlert: {
    borderColor: '#e63946',
    borderWidth: 2,
  },
  heatmapCellSmall: {
    height: 16,
  },
  heatmapAlertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e63946',
    position: 'absolute',
    top: 0,
    right: 2,
  },
  heatmapMonthLabel: {
    fontSize: 7,
    fontWeight: '600',
  },
  heatmapValue: {
    fontSize: 8,
    fontWeight: '700',
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  heatmapLegendLabel: { fontSize: 10 },
  heatmapLegendRow: {
    flexDirection: 'row',
    gap: 2,
  },
  heatmapLegendCell: {
    width: 16,
    height: 12,
    borderRadius: 2,
  },
  heatmapSummary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  heatmapSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapSummaryText: { fontSize: 11 },
  heatmapSummaryValue: { fontSize: 12, fontWeight: '700' },
});

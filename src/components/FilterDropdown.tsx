import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  icon: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export default function FilterDropdown({
  label,
  icon,
  options,
  selectedValue,
  onSelect,
  accentColor = '#4da6ff',
}: FilterDropdownProps) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  const activeCount = selectedValue ? 1 : 0;
  const displayLabel = selectedValue || label;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }, selectedValue && { borderColor: accentColor, backgroundColor: `${accentColor}15` }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name={icon as any} size={14} color={selectedValue ? accentColor : colors.textMuted} />
        <Text style={[styles.triggerText, { color: colors.textMuted }, selectedValue && { color: accentColor }]} numberOfLines={1}>
          {displayLabel}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={16} color={selectedValue ? accentColor : colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <MaterialIcons name={icon as any} size={20} color={accentColor} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Select {label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }] }>
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* All option */}
            <TouchableOpacity
              style={[styles.option, !selectedValue && { backgroundColor: `${accentColor}15` }]}
              onPress={() => { onSelect(''); setVisible(false); }}
            >
              <MaterialIcons name="select-all" size={18} color={colors.textMuted} />
              <Text style={[styles.optionText, { color: colors.text }, !selectedValue && { color: accentColor, fontWeight: '700' }]}>
                All {label}s
              </Text>
              {!selectedValue && <MaterialIcons name="check" size={18} color={accentColor} />}
            </TouchableOpacity>

            {/* Options */}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = selectedValue === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && { backgroundColor: `${accentColor}15` }]}
                    onPress={() => { onSelect(item.value); setVisible(false); }}
                  >
                    <Text style={[styles.optionText, { color: colors.text }, isSelected && { color: accentColor, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                    {isSelected && <MaterialIcons name="check" size={18} color={accentColor} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    minWidth: 0,
    flex: 1,
  },
  triggerText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    flex: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#252540',
    justifyContent: 'center',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#252540',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
});

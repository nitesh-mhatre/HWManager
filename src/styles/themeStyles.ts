import { StyleSheet } from 'react-native';
import { ThemeColors } from '../context/ThemeContext';

/** Returns theme-aware styles that can be merged with static StyleSheet styles */
export function getAppStyles(colors: ThemeColors) {
  return {
    // Common containers
    card: { backgroundColor: colors.surface, borderColor: colors.border },
    cardAlt: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
    input: { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text },

    // Text
    textPrimary: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textMuted: { color: colors.textMuted },

    // Section
    section: { backgroundColor: colors.surface, borderColor: colors.border },

    // Overlay
    overlay: { backgroundColor: colors.overlay },

    // Tags/chips
    chip: { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight },
  };
}

export const staticStyles = StyleSheet.create({
  // Shared card-like elements used in add/scan
  formInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
  },
});

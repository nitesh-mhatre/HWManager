/**
 * Safe AdMob initialization — skips if native module is not linked.
 */
export async function initAdMob(): Promise<void> {
  try {
    const ads = require('react-native-google-mobile-ads');
    await ads.default().initialize();
    console.log('[AdMob] Initialized successfully');
  } catch (error) {
    console.log('[AdMob] Not available (native module not linked) — using fallback ads');
  }
}

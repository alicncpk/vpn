/**
 * AdMob Configuration for Ali CNC VPN
 * 
 * Provides official test Ad Unit IDs by default to guarantee the app
 * builds and runs out-of-the-box, with structural overrides for production.
 */

export interface AdUnitConfig {
  appId: string;
  bannerAdUnitId: string;
  rewardedAdUnitId: string;
}

// Official Google AdMob Test IDs (Android)
const TEST_CONFIG_ANDROID: AdUnitConfig = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerAdUnitId: 'ca-app-pub-3940256099942544/6300978111',
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
};

// Official Google AdMob Test IDs (iOS)
const TEST_CONFIG_IOS: AdUnitConfig = {
  appId: 'ca-app-pub-3940256099942544~1458002511',
  bannerAdUnitId: 'ca-app-pub-3940256099942544/2934735716',
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/1712485313',
};

import { Platform } from 'react-native';

export const getAdConfig = (customConfig?: Partial<AdUnitConfig>): AdUnitConfig => {
  const defaults = Platform.OS === 'ios' ? TEST_CONFIG_IOS : TEST_CONFIG_ANDROID;
  return {
    appId: customConfig?.appId || defaults.appId,
    bannerAdUnitId: customConfig?.bannerAdUnitId || defaults.bannerAdUnitId,
    rewardedAdUnitId: customConfig?.rewardedAdUnitId || defaults.rewardedAdUnitId,
  };
};

export const AD_CONFIG = getAdConfig();

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AD_CONFIG } from '../config/adConfig';

export const BannerAdView: React.FC = () => {
  const [adFailed, setAdFailed] = useState(false);

  if (adFailed) {
    // Show premium themed placeholder when ad loading fails
    return (
      <View style={styles.fallbackContainer}>
        <View style={styles.fallbackContent}>
          <Text style={styles.fallbackHeader}>▲ ALI CNC VPN SHIELD ▲</Text>
          <Text style={styles.fallbackText}>Secure DNS Routing • VLESS Protocol Enabled</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_CONFIG.bannerAdUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.warn('Banner Ad failed to load: ', error.message);
          setAdFailed(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#0c0f12',
    borderTopWidth: 1,
    borderColor: '#1a222a',
    paddingVertical: 5,
  },
  fallbackContainer: {
    height: 60,
    width: '100%',
    backgroundColor: '#0f1318',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1b232e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fallbackContent: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2e3d4f',
    borderStyle: 'dashed',
    width: '100%',
    height: '80%',
    borderRadius: 4,
  },
  fallbackHeader: {
    fontSize: 10,
    color: '#00e5ff',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  fallbackText: {
    fontSize: 9,
    color: '#5e7594',
    fontFamily: 'monospace',
    marginTop: 2,
  },
});

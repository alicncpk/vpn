import { useState, useEffect, useCallback, useRef } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { AD_CONFIG } from '../config/adConfig';

export interface UseVpnAdGateResult {
  isAdLoaded: boolean;
  isAdLoading: boolean;
  rewardEarned: boolean;
  loadAd: () => void;
  showAdAndExecute: (onSuccess: () => void) => void;
  adError: string | null;
}

export const useVpnAdGate = (): UseVpnAdGateResult => {
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [rewardEarned, setRewardEarned] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  // Keep a mutable reference to the active callback to avoid resetting listeners
  const onSuccessCallback = useRef<(() => void) | null>(null);
  const rewardedAdRef = useRef<RewardedAd | null>(null);

  // Initialize and load the rewarded ad
  const loadAd = useCallback(() => {
    if (isAdLoading) return;
    
    setIsAdLoading(true);
    setAdError(null);
    setRewardEarned(false);

    try {
      const rewarded = RewardedAd.createForAdRequest(AD_CONFIG.rewardedAdUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      rewardedAdRef.current = rewarded;

      const unsubscribeLoaded = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          setIsAdLoaded(true);
          setIsAdLoading(false);
        }
      );

      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          console.log('User earned reward: ', reward);
          setRewardEarned(true);
        }
      );

      const unsubscribeClosed = rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          setIsAdLoaded(false);
          // If the user earned the reward, trigger connection
          if (onSuccessCallback.current && rewardedAdRef.current) {
            // Trigger connection execution
            onSuccessCallback.current();
            onSuccessCallback.current = null;
          }
          // Pre-load the next ad
          loadAd();
        }
      );

      const unsubscribeError = rewarded.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.warn('AdMob Error: ', error.message);
          setAdError(error.message);
          setIsAdLoaded(false);
          setIsAdLoading(false);
        }
      );

      rewarded.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
      };
    } catch (err: any) {
      setAdError(err.message);
      setIsAdLoading(false);
    }
  }, [isAdLoading]);

  // Trigger ad play. If loaded, show it, otherwise fallback (e.g. bypass or auto-connect)
  const showAdAndExecute = useCallback(
    (onSuccess: () => void) => {
      onSuccessCallback.current = onSuccess;

      if (isAdLoaded && rewardedAdRef.current) {
        try {
          rewardedAdRef.current.show();
        } catch (showError: any) {
          console.error('Failed to show rewarded ad', showError);
          setAdError(showError.message);
          // Fallback: connect immediately if ad fails to show
          onSuccess();
        }
      } else {
        console.warn('Ad not ready yet. Bypassing gate directly to connect.');
        // If ad is not ready, we bypass the gate so the user isn't stuck
        onSuccess();
        loadAd();
      }
    },
    [isAdLoaded, loadAd]
  );

  // Load ad on hook initialization
  useEffect(() => {
    loadAd();
  }, []);

  return {
    isAdLoaded,
    isAdLoading,
    rewardEarned,
    loadAd,
    showAdAndExecute,
    adError,
  };
};

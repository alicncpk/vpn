import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';

export type VpnState = 'disconnected' | 'connecting' | 'connected';

interface ConnectButtonProps {
  state: VpnState;
  onPress: () => void;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({ state, onPress }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Handles active rotation and pulse effects based on connection state
  useEffect(() => {
    let rotateLoop: Animated.CompositeAnimation | null = null;
    let pulseLoop: Animated.CompositeAnimation | null = null;

    if (state === 'connecting') {
      // Start rapid dial spin
      rotateAnim.setValue(0);
      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoop.start();

      // Start alert pulse
      pulseAnim.setValue(1);
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
    } else if (state === 'connected') {
      // Small static pulse for connection integrity indicator
      rotateAnim.setValue(0);
      pulseAnim.setValue(1);
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 2000,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
    } else {
      // Stopped
      rotateAnim.setValue(0);
      pulseAnim.setValue(1);
    }

    return () => {
      if (rotateLoop) rotateLoop.stop();
      if (pulseLoop) pulseLoop.stop();
    };
  }, [state, rotateAnim, pulseAnim]);

  // Interpolate rotation angle
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Assign indicator glow color depending on states
  const getGlowColor = () => {
    switch (state) {
      case 'connected':
        return '#00ff66'; // Glowing Green
      case 'connecting':
        return '#ffb300'; // Warning Amber
      case 'disconnected':
      default:
        return '#00e5ff'; // Idle Cyan
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'connected':
        return 'SECURE';
      case 'connecting':
        return 'CONNECTING...';
      case 'disconnected':
      default:
        return 'CNC SHIELD OFF';
    }
  };

  const getButtonLabel = () => {
    switch (state) {
      case 'connected':
        return 'DISCONNECT';
      case 'connecting':
        return 'ABORT';
      case 'disconnected':
      default:
        return 'CONNECT';
    }
  };

  return (
    <View style={styles.container}>
      {/* Outer steel ring */}
      <Animated.View 
        style={[
          styles.outerRing,
          {
            borderColor: getGlowColor(),
            shadowColor: getGlowColor(),
            transform: [{ scale: pulseAnim }],
          }
        ]}
      >
        {/* Rotating dial markers */}
        <Animated.View style={[styles.dialMarkers, { transform: [{ rotate: spin }] }]}>
          <View style={[styles.marker, { top: 0, backgroundColor: getGlowColor() }]} />
          <View style={[styles.marker, { right: 0, backgroundColor: getGlowColor() }]} />
          <View style={[styles.marker, { bottom: 0, backgroundColor: getGlowColor() }]} />
          <View style={[styles.marker, { left: 0, backgroundColor: getGlowColor() }]} />
        </Animated.View>

        {/* Central clickable core */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={onPress}
          style={styles.innerCore}
        >
          <Text style={[styles.subLabel, { color: getGlowColor() }]}>{getStatusText()}</Text>
          <Text style={styles.actionLabel}>{getButtonLabel()}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  outerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    backgroundColor: '#131920',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 25,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    borderStyle: 'solid',
  },
  dialMarkers: {
    position: 'absolute',
    width: '92%',
    height: '92%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    position: 'absolute',
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  innerCore: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#1b232e',
    borderWidth: 2,
    borderColor: '#2e3d4f',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  subLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 5,
  },
  actionLabel: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
});

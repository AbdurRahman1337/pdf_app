import {
    Animated,
    Easing,
    AccessibilityInfo,
    Platform,
    Vibration,
} from 'react-native';

/**
 * Motion System Tokens & Helpers
 * Centralizes durations, easings, spring configurations, and reduce-motion awareness.
 */

export const motion = {
    durations: {
        micro: 120,
        chatMessage: 160,
        standard: 220,
        page: 320,
        flip: 350,
        shake: 300,
        celebratory: 800,
        countUp: 900,
        shimmer: 1200,
        breathe: 2400,
        highlightFade: 2500,
    },
    easings: {
        easeOutCubic: Easing.bezier(0.2, 0, 0, 1),
        easeOut: Easing.out(Easing.ease),
        easeInOut: Easing.inOut(Easing.ease),
        linear: Easing.linear,
    },
    springs: {
        standard: {
            tension: 60,
            friction: 7,
            useNativeDriver: true,
        },
        sheet: {
            damping: 18,
            stiffness: 140,
            mass: 0.9,
            useNativeDriver: true,
        },
        tabIndicator: {
            damping: 15,
            stiffness: 180,
            mass: 0.8,
            useNativeDriver: true,
        },
        press: {
            friction: 5,
            tension: 100,
            useNativeDriver: true,
        },
        pop: {
            tension: 120,
            friction: 5,
            useNativeDriver: true,
        },
    },
};

/**
 * Check if reduced motion is enabled on the device.
 */
let isReducedMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
    isReducedMotion = enabled;
});

export const getIsReducedMotion = () => isReducedMotion;

/**
 * Safe Haptic feedback trigger that gracefully degrades across all devices.
 */
export const triggerHaptic = (type: 'selection' | 'success' | 'warning' | 'error' | 'heavy' = 'selection') => {
    try {
        if (Platform.OS === 'web') return;
        switch (type) {
            case 'selection':
                Vibration.vibrate(10);
                break;
            case 'success':
                Vibration.vibrate([0, 15, 40, 20]);
                break;
            case 'warning':
                Vibration.vibrate([0, 25, 50, 25]);
                break;
            case 'error':
                Vibration.vibrate([0, 30, 40, 30, 40, 30]);
                break;
            case 'heavy':
                Vibration.vibrate(35);
                break;
        }
    } catch {
        // Fallback silently if device does not support vibration
    }
};

export default motion;

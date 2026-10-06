import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Calculates a reliable top spacing gap for all screens, ensuring
 * that screen headers and content never collide with the OS status bar,
 * camera punch holes, dynamic islands, or notches across iOS and Android.
 */
export const useSafeTopGap = (extraGap: number = 16): number => {
    let insetsTop = 0;
    try {
        const insets = useSafeAreaInsets();
        insetsTop = insets?.top ?? 0;
    } catch {
        insetsTop = 0;
    }

    const androidStatusHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
    const baseTop = Math.max(insetsTop, androidStatusHeight, Platform.OS === 'ios' ? 44 : 28);
    return baseTop + extraGap;
};

export const getStaticSafeTopGap = (extraGap: number = 16): number => {
    const androidStatusHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
    const baseTop = Math.max(androidStatusHeight, Platform.OS === 'ios' ? 44 : 28);
    return baseTop + extraGap;
};

export default useSafeTopGap;


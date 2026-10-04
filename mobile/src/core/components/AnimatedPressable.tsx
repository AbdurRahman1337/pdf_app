import React, { useRef } from 'react';
import {
    Animated,
    TouchableWithoutFeedback,
    StyleProp,
    ViewStyle,
    GestureResponderEvent,
} from 'react-native';
import { motion, triggerHaptic, getIsReducedMotion } from '../theme/motion';

export interface AnimatedPressableProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: (event: GestureResponderEvent) => void;
    onLongPress?: (event: GestureResponderEvent) => void;
    disabled?: boolean;
    scaleTo?: number;
    hapticFeedback?: boolean;
    hapticType?: 'selection' | 'success' | 'warning' | 'error' | 'heavy';
    accessibilityRole?: any;
    accessibilityLabel?: string;
    accessibilityState?: any;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
    children,
    style,
    onPress,
    onLongPress,
    disabled = false,
    scaleTo = 0.97,
    hapticFeedback = false,
    hapticType = 'selection',
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (disabled || getIsReducedMotion()) return;
        if (hapticFeedback) {
            triggerHaptic(hapticType);
        }
        Animated.spring(scaleAnim, {
            toValue: scaleTo,
            ...motion.springs.press,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (disabled || getIsReducedMotion()) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            ...motion.springs.press,
            useNativeDriver: true,
        }).start();
    };

    return (
        <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            onLongPress={onLongPress}
            disabled={disabled}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
        >
            <Animated.View
                style={[
                    style,
                    {
                        transform: [{ scale: scaleAnim }],
                        opacity: disabled ? 0.6 : 1,
                    },
                ]}
            >
                {children}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

export default AnimatedPressable;

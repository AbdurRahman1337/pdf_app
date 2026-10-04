import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { motion, getIsReducedMotion } from '../theme/motion';

export interface ProgressRingProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
    color?: string;
    gradientColors?: readonly [string, string];
    labelColor?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
    percentage,
    size = 36,
    strokeWidth = 3.5,
    showLabel = false,
    color,
    gradientColors,
    labelColor,
}) => {
    const { colors, isDark } = useTheme();
    const animValue = useRef(new Animated.Value(0)).current;

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, percentage));

    useEffect(() => {
        if (getIsReducedMotion()) {
            animValue.setValue(clamped);
            return;
        }

        Animated.timing(animValue, {
            toValue: clamped,
            duration: motion.durations.page,
            easing: motion.easings.easeOutCubic,
            useNativeDriver: false,
        }).start();
    }, [clamped]);

    const strokeDashoffset = circumference - (clamped / 100) * circumference;
    const fallbackColor = color || colors.accent;
    const gradId = `ring_grad_${size}_${Math.round(clamped)}`;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} style={styles.svg}>
                <Defs>
                    {gradientColors && (
                        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor={gradientColors[0]} />
                            <Stop offset="100%" stopColor={gradientColors[1]} />
                        </LinearGradient>
                    )}
                </Defs>

                {/* Track Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colors.surfaceRaised}
                    strokeWidth={strokeWidth}
                    fill="none"
                />

                {/* Animated Progress Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={gradientColors ? `url(#${gradId})` : fallbackColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>

            {showLabel && (
                <View style={styles.labelContainer}>
                    <Text
                        style={[
                            styles.labelText,
                            {
                                color: labelColor || colors.text,
                                fontSize: size < 40 ? 9 : 12,
                            },
                        ]}
                    >
                        {Math.round(clamped)}%
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    svg: {
        transform: [{ rotateZ: '0deg' }],
    },
    labelContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelText: {
        fontWeight: '700',
    },
});

export default ProgressRing;

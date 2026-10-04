import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

export interface ProgressRingProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
    color?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
    percentage,
    size = 32,
    strokeWidth = 3,
    showLabel = false,
    color,
}) => {
    const { colors } = useTheme();
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(100, Math.max(0, percentage));
    const strokeDashoffset = circumference - (clamped / 100) * circumference;
    const strokeColor = color || colors.accent;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} style={styles.svg}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colors.border}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={strokeColor}
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
                    <Text style={[styles.labelText, { color: colors.text }]}>
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
        fontSize: 9,
        fontWeight: '600',
    },
});

export default ProgressRing;


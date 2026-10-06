import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radii, typography } from '../theme/tokens';

export interface TactileProgressBarProps {
    progress: number; // 0.0 to 1.0 (or 0 to 100)
    height?: number;
    color?: string;
    showLabel?: boolean;
    label?: string;
    style?: ViewStyle;
    variant?: 'accent' | 'blue' | 'gold' | 'danger';
}

export const TactileProgressBar: React.FC<TactileProgressBarProps> = ({
    progress,
    height = 14,
    color,
    showLabel = false,
    label,
    style,
    variant = 'accent',
}) => {
    const { colors } = useTheme();
    const animValue = useRef(new Animated.Value(0)).current;

    // Normalize progress between 0 and 1
    const normalized = Math.min(Math.max(progress > 1 ? progress / 100 : progress, 0), 1);

    useEffect(() => {
        Animated.timing(animValue, {
            toValue: normalized,
            duration: 500,
            useNativeDriver: false,
        }).start();
    }, [normalized]);

    let barColor = colors.accent;
    if (variant === 'blue') barColor = colors.blue;
    else if (variant === 'gold') barColor = colors.gold;
    else if (variant === 'danger') barColor = colors.danger;
    if (color) barColor = color;

    const widthInterpolate = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[styles.container, style]}>
            {showLabel && (
                <View style={styles.labelRow}>
                    <Text style={[styles.labelText, { color: colors.textMuted }]}>
                        {label || 'Progress'}
                    </Text>
                    <Text style={[styles.percentageText, { color: colors.text }]}>
                        {Math.round(normalized * 100)}%
                    </Text>
                </View>
            )}

            <View
                style={[
                    styles.track,
                    {
                        height,
                        borderRadius: height / 2,
                        backgroundColor: colors.surfaceRaised,
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.fill,
                        {
                            width: widthInterpolate,
                            height: '100%',
                            borderRadius: height / 2,
                            backgroundColor: barColor,
                        },
                    ]}
                >
                    {/* Top-third shine highlight bar */}
                    <View
                        style={[
                            styles.shine,
                            {
                                height: Math.max(3, Math.round(height * 0.35)),
                                borderRadius: height / 4,
                            },
                        ]}
                    />
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    labelText: {
        fontSize: typography.sizes.xs,
        fontWeight: '700',
    },
    percentageText: {
        fontSize: typography.sizes.xs,
        fontWeight: '800',
    },
    track: {
        width: '100%',
        overflow: 'hidden',
    },
    fill: {
        position: 'relative',
        justifyContent: 'flex-start',
    },
    shine: {
        position: 'absolute',
        top: 2,
        left: 4,
        right: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.40)',
    },
});

export default TactileProgressBar;

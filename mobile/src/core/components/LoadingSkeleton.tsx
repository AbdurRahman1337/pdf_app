import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { motion, getIsReducedMotion } from '../theme/motion';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius,
    style,
}) => {
    const { colors, radii } = useTheme();
    const shimmerAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (getIsReducedMotion()) {
            shimmerAnim.setValue(0.5);
            return;
        }

        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 0.85,
                    duration: motion.durations.shimmer / 2,
                    easing: motion.easings.easeInOut,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0.3,
                    duration: motion.durations.shimmer / 2,
                    easing: motion.easings.easeInOut,
                    useNativeDriver: true,
                }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [shimmerAnim]);

    return (
        <Animated.View
            style={[
                {
                    backgroundColor: colors.surfaceHover,
                    width: width as any,
                    height,
                    borderRadius: borderRadius ?? radii.controls,
                    opacity: shimmerAnim,
                },
                style,
            ]}
        />
    );
};

export const CardSkeleton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
    const { colors, radii, spacing, shadows } = useTheme();

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.cards,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    ...shadows.card,
                },
                style,
            ]}
        >
            <View style={styles.cardHeader}>
                <Skeleton width={48} height={48} borderRadius={radii.controls} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                    <Skeleton width="65%" height={16} borderRadius={radii.xs} />
                    <Skeleton width="40%" height={12} borderRadius={radii.xs} style={{ marginTop: 8 }} />
                </View>
            </View>
            <Skeleton width="100%" height={12} borderRadius={radii.xs} style={{ marginTop: 14 }} />
            <Skeleton width="85%" height={12} borderRadius={radii.xs} style={{ marginTop: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <Skeleton width="30%" height={10} borderRadius={radii.xs} />
                <Skeleton width={28} height={28} borderRadius={14} />
            </View>
        </View>
    );
};

export const ParagraphSkeleton: React.FC<{ lines?: number; style?: StyleProp<ViewStyle> }> = ({
    lines = 4,
    style,
}) => {
    const { radii } = useTheme();

    return (
        <View style={style}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? '60%' : i % 2 === 0 ? '100%' : '92%'}
                    height={15}
                    borderRadius={radii.xs}
                    style={{ marginBottom: 12 }}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default Skeleton;

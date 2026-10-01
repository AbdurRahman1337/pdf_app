import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius,
    style,
}) => {
    const { colors, radii } = useTheme();
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                {
                    backgroundColor: colors.surfaceHover,
                    width: width as any,
                    height,
                    borderRadius: borderRadius ?? radii.sm,
                    opacity,
                },
                style,
            ]}
        />
    );
};

export const CardSkeleton: React.FC<{ style?: any }> = ({ style }) => {
    const { colors, radii, spacing } = useTheme();

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                },
                style,
            ]}
        >
            <View style={styles.cardHeader}>
                <Skeleton width={44} height={44} borderRadius={radii.md} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Skeleton width="70%" height={16} borderRadius={radii.xs} />
                    <Skeleton width="40%" height={12} borderRadius={radii.xs} style={{ marginTop: 6 }} />
                </View>
            </View>
            <Skeleton width="100%" height={12} borderRadius={radii.xs} style={{ marginTop: 12 }} />
            <Skeleton width="90%" height={12} borderRadius={radii.xs} style={{ marginTop: 6 }} />
        </View>
    );
};

export const ParagraphSkeleton: React.FC<{ lines?: number; style?: any }> = ({
    lines = 4,
    style,
}) => {
    const { radii } = useTheme();

    return (
        <View style={style}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? '65%' : '100%'}
                    height={14}
                    borderRadius={radii.xs}
                    style={{ marginBottom: 10 }}
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

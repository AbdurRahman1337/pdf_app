import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AnimatedPressable } from './AnimatedPressable';

interface EmptyStateProps {
    icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number; style?: any }>;
    title: string;
    description: string;
    actionLabel?: string;
    actionIcon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number; style?: any }>;
    onAction?: () => void;
    accentColor?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: IconComponent,
    title,
    description,
    actionLabel,
    actionIcon: ActionIconComponent,
    onAction,
    accentColor,
}) => {
    const { colors, typography, radii, shadows } = useTheme();
    const effectiveAccent = accentColor || colors.primary;

    return (
        <View style={styles.container}>
            {/* Multi-layered halo container */}
            <View style={styles.iconComposition}>
                <View
                    style={[
                        styles.outerRing,
                        {
                            backgroundColor: colors.surfaceRaised,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.innerCircle,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                ...shadows.card,
                            },
                        ]}
                    >
                        <IconComponent size={34} color={effectiveAccent} strokeWidth={1.75} />
                    </View>
                </View>
            </View>

            <Text style={[styles.title, { color: colors.text, fontSize: typography.sizes.lg }]}>
                {title}
            </Text>
            <Text style={[styles.description, { color: colors.textMuted, fontSize: typography.sizes.sm }]}>
                {description}
            </Text>

            {actionLabel && onAction && (
                <AnimatedPressable
                    style={[
                        styles.actionBtn,
                        {
                            backgroundColor: effectiveAccent,
                            borderRadius: radii.controls,
                            ...shadows.glowAccent,
                        },
                    ]}
                    onPress={onAction}
                    hapticFeedback={true}
                    hapticType="selection"
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                >
                    {ActionIconComponent && (
                        <ActionIconComponent
                            size={16}
                            color={colors.textInverse}
                            strokeWidth={2}
                            style={{ marginRight: 8 }}
                        />
                    )}
                    <Text style={[styles.actionText, { color: colors.textInverse, fontSize: typography.sizes.sm }]}>
                        {actionLabel}
                    </Text>
                </AnimatedPressable>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    iconComposition: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    outerRing: {
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.2,
    },
    description: {
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 340,
        marginBottom: 24,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 22,
        minHeight: 46,
    },
    actionText: {
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default EmptyState;

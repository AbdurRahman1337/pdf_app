import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface EmptyStateProps {
    icon: React.ComponentType<{ size: number; color: string; style?: any }>;
    title: string;
    description: string;
    actionLabel?: string;
    actionIcon?: React.ComponentType<{ size: number; color: string; style?: any }>;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: IconComponent,
    title,
    description,
    actionLabel,
    actionIcon: ActionIconComponent,
    onAction,
}) => {
    const { colors, typography, radii, spacing } = useTheme();

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.iconCircle,
                    {
                        backgroundColor: colors.accentMuted,
                        borderColor: colors.accentBorder,
                    },
                ]}
            >
                <IconComponent size={36} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontSize: typography.sizes.lg }]}>
                {title}
            </Text>
            <Text style={[styles.description, { color: colors.textMuted, fontSize: typography.sizes.sm }]}>
                {description}
            </Text>
            {actionLabel && onAction && (
                <TouchableOpacity
                    style={[
                        styles.actionBtn,
                        {
                            backgroundColor: colors.accent,
                            borderRadius: radii.full,
                            shadowColor: colors.accent,
                        },
                    ]}
                    onPress={onAction}
                    activeOpacity={0.8}
                >
                    {ActionIconComponent && (
                        <ActionIconComponent
                            size={18}
                            color={colors.textInverse}
                            style={{ marginRight: 8 }}
                        />
                    )}
                    <Text style={[styles.actionText, { color: colors.textInverse, fontSize: typography.sizes.sm }]}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 20,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 320,
        marginBottom: 20,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 3,
    },
    actionText: {
        fontWeight: '700',
    },
});

export default EmptyState;

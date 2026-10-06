import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography, radii } from '../theme/tokens';
import TactileButton from './TactileButton';

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
    const { colors } = useTheme();

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
                <IconComponent size={40} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
                {title}
            </Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
                {description}
            </Text>
            {actionLabel && onAction && (
                <View style={styles.actionContainer}>
                    <TactileButton
                        title={actionLabel}
                        onPress={onAction}
                        variant="primary"
                        size="md"
                        icon={ActionIconComponent}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 44,
        paddingHorizontal: 24,
    },
    iconCircle: {
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 320,
        marginBottom: 20,
        fontWeight: '500',
    },
    actionContainer: {
        marginTop: 4,
    },
});

export default EmptyState;

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors, radii, typography } from '../theme/tokens';
import { CheckCircle2, AlertCircle, Info, RotateCcw } from 'lucide-react-native';

export interface ToastProps {
    visible: boolean;
    message: string;
    type?: 'success' | 'warning' | 'error' | 'info';
    actionLabel?: string;
    onAction?: () => void;
    onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
    visible,
    message,
    type = 'info',
    actionLabel,
    onAction,
}) => {
    const { colors, shadows } = useTheme();
    const styles = createStyles(colors);

    if (!visible) return null;

    const Icon =
        type === 'success'
            ? CheckCircle2
            : type === 'error'
            ? AlertCircle
            : type === 'warning'
            ? AlertCircle
            : Info;

    const iconColor =
        type === 'success'
            ? colors.success
            : type === 'error'
            ? colors.danger
            : type === 'warning'
            ? colors.warning
            : colors.accent;

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <View style={[styles.container, shadows.card]}>
                <Icon size={18} color={iconColor} strokeWidth={1.5} style={styles.icon} />
                <Text style={styles.message} numberOfLines={2}>
                    {message}
                </Text>
                {actionLabel && onAction && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={onAction}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                    >
                        <RotateCcw size={14} color={colors.accent} strokeWidth={1.5} style={{ marginRight: 4 }} />
                        <Text style={[styles.actionText, { color: colors.accent }]}>
                            {actionLabel}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        wrapper: {
            position: 'absolute',
            bottom: 80,
            left: 16,
            right: 16,
            alignItems: 'center',
            zIndex: 999,
        },
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingVertical: 10,
            paddingHorizontal: 14,
            maxWidth: 440,
            width: '100%',
        },
        icon: {
            marginRight: 10,
        },
        message: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
            lineHeight: 18,
        },
        actionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginLeft: 8,
            borderRadius: radii.sm,
            backgroundColor: colors.accentMuted,
        },
        actionText: {
            fontSize: typography.sizes.xs,
            fontWeight: '600',
        },
    });

export default Toast;


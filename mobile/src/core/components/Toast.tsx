import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/tokens';
import { CheckCircle2, AlertCircle, Info, RotateCcw } from 'lucide-react-native';
import { motion, triggerHaptic, getIsReducedMotion } from '../theme/motion';
import { AnimatedPressable } from './AnimatedPressable';

export interface ToastProps {
    visible: boolean;
    message: string;
    type?: 'success' | 'warning' | 'error' | 'info';
    actionLabel?: string;
    onAction?: () => void;
    onDismiss?: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
    visible,
    message,
    type = 'info',
    actionLabel,
    onAction,
    onDismiss,
    duration = 4000,
}) => {
    const { colors, shadows, radii, typography } = useTheme();
    const styles = createStyles(colors, radii, typography);

    const translateY = useRef(new Animated.Value(60)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            triggerHaptic(type === 'error' ? 'error' : 'selection');

            if (getIsReducedMotion()) {
                translateY.setValue(0);
                opacity.setValue(1);
            } else {
                translateY.setValue(40);
                opacity.setValue(0);
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: motion.durations.standard,
                        useNativeDriver: true,
                    }),
                    Animated.spring(translateY, {
                        toValue: 0,
                        ...motion.springs.tabIndicator,
                        useNativeDriver: true,
                    }),
                ]).start();
            }

            const timer = setTimeout(() => {
                handleDismiss();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [visible, message]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: motion.durations.micro,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 20,
                duration: motion.durations.micro,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss?.();
        });
    };

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
            : colors.primary;

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <Animated.View
                style={[
                    styles.container,
                    shadows.elevated,
                    {
                        opacity,
                        transform: [{ translateY }],
                    },
                ]}
            >
                <Icon size={20} color={iconColor} strokeWidth={2} style={styles.icon} />
                <Text style={styles.message} numberOfLines={2}>
                    {message}
                </Text>
                {actionLabel && onAction && (
                    <AnimatedPressable
                        style={styles.actionBtn}
                        onPress={() => {
                            triggerHaptic('selection');
                            onAction();
                        }}
                        accessibilityRole="button"
                    >
                        <RotateCcw size={13} color={colors.primary} strokeWidth={2} style={{ marginRight: 4 }} />
                        <Text style={[styles.actionText, { color: colors.primary }]}>
                            {actionLabel}
                        </Text>
                    </AnimatedPressable>
                )}
            </Animated.View>
        </View>
    );
};

const createStyles = (colors: ThemeColors, radii: any, typography: any) =>
    StyleSheet.create({
        wrapper: {
            position: 'absolute',
            bottom: 84,
            left: 16,
            right: 16,
            alignItems: 'center',
            zIndex: 9999,
        },
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.cards,
            paddingVertical: 12,
            paddingHorizontal: 16,
            maxWidth: 440,
            width: '100%',
        },
        icon: {
            marginRight: 12,
        },
        message: {
            flex: 1,
            fontSize: typography.sizes.sm,
            color: colors.text,
            lineHeight: 20,
            fontWeight: '500',
        },
        actionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            marginLeft: 8,
            borderRadius: radii.full,
            backgroundColor: colors.primaryMuted,
        },
        actionText: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
        },
    });

export default Toast;

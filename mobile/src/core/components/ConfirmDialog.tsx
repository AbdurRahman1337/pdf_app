import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { AlertTriangle, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../theme/motion';
import { AnimatedPressable } from './AnimatedPressable';

export interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    message: string;
    itemName?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    visible,
    title,
    message,
    itemName,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = true,
    onConfirm,
    onCancel,
}) => {
    const { colors, shadows, radii, typography } = useTheme();
    const styles = createStyles(colors, radii, typography);

    const translateY = useRef(new Animated.Value(40)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            triggerHaptic('warning');
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
                        ...motion.springs.sheet,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.dialogCard,
                        shadows.modal,
                        {
                            opacity,
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconContainer,
                                {
                                    backgroundColor: isDestructive
                                        ? colors.dangerMuted
                                        : colors.warningMuted,
                                },
                            ]}
                        >
                            {isDestructive ? (
                                <Trash2 size={22} color={colors.danger} strokeWidth={1.75} />
                            ) : (
                                <AlertTriangle size={22} color={colors.warning} strokeWidth={1.75} />
                            )}
                        </View>
                        <AnimatedPressable
                            onPress={onCancel}
                            style={styles.closeBtn}
                            accessibilityLabel="Close dialog"
                        >
                            <X size={18} color={colors.textMuted} strokeWidth={2} />
                        </AnimatedPressable>
                    </View>

                    <Text style={styles.title}>{title}</Text>

                    <Text style={styles.message}>
                        {message}
                    </Text>

                    {itemName ? (
                        <View style={styles.itemBadge}>
                            <Text style={styles.itemName} numberOfLines={1}>
                                "{itemName}"
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.buttonRow}>
                        <AnimatedPressable
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={onCancel}
                            accessibilityRole="button"
                        >
                            <Text style={styles.cancelText}>{cancelText}</Text>
                        </AnimatedPressable>

                        <AnimatedPressable
                            style={[
                                styles.btn,
                                isDestructive ? styles.destructiveBtn : styles.confirmBtn,
                            ]}
                            onPress={onConfirm}
                            hapticFeedback={true}
                            hapticType={isDestructive ? 'error' : 'success'}
                            accessibilityRole="button"
                        >
                            <Text
                                style={[
                                    styles.confirmText,
                                    { color: colors.textInverse },
                                ]}
                            >
                                {confirmText}
                            </Text>
                        </AnimatedPressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: ThemeColors, radii: any, typography: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        iconContainer: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtn: {
            padding: 6,
            borderRadius: radii.full,
        },
        title: {
            fontSize: typography.sizes.lg,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
            letterSpacing: -0.2,
        },
        message: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 22,
            marginBottom: 14,
        },
        itemBadge: {
            backgroundColor: colors.surfaceRaised,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: radii.controls,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.border,
        },
        itemName: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.text,
        },
        buttonRow: {
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'flex-end',
        },
        btn: {
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: radii.controls,
            minHeight: 46,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cancelBtn: {
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cancelText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            color: colors.textSecondary,
        },
        confirmBtn: {
            backgroundColor: colors.primary,
        },
        destructiveBtn: {
            backgroundColor: colors.danger,
        },
        confirmText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
    });

export default ConfirmDialog;

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { AlertTriangle, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors, radii, typography } from '../theme/tokens';

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
    const { colors, shadows } = useTheme();
    const styles = createStyles(colors);

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={[styles.dialogCard, shadows.modal]}>
                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconContainer,
                                {
                                    backgroundColor: isDestructive
                                        ? colors.dangerMuted
                                        : colors.accentMuted,
                                },
                            ]}
                        >
                            {isDestructive ? (
                                <Trash2 size={20} color={colors.danger} strokeWidth={1.5} />
                            ) : (
                                <AlertTriangle size={20} color={colors.accent} strokeWidth={1.5} />
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={onCancel}
                            style={styles.closeBtn}
                            accessibilityLabel="Close dialog"
                        >
                            <X size={18} color={colors.textMuted} />
                        </TouchableOpacity>
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
                        <TouchableOpacity
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={onCancel}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                        >
                            <Text style={styles.cancelText}>{cancelText}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.btn,
                                isDestructive ? styles.destructiveBtn : styles.confirmBtn,
                            ]}
                            onPress={onConfirm}
                            activeOpacity={0.8}
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
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
        },
        iconContainer: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtn: {
            padding: 6,
        },
        title: {
            fontSize: typography.sizes.lg,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        message: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: 20,
            marginBottom: 12,
        },
        itemBadge: {
            backgroundColor: colors.surfaceRaised,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: radii.sm,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.border,
        },
        itemName: {
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            color: colors.text,
        },
        buttonRow: {
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'flex-end',
        },
        btn: {
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: radii.sm,
            minHeight: 44,
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
            fontWeight: '500',
            color: colors.textSecondary,
        },
        confirmBtn: {
            backgroundColor: colors.accent,
        },
        destructiveBtn: {
            backgroundColor: colors.danger,
        },
        confirmText: {
            fontSize: typography.sizes.sm,
            fontWeight: '600',
        },
    });

export default ConfirmDialog;


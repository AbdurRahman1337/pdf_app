import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { AlertTriangle, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors, radii, typography } from '../theme/tokens';
import TactileButton from './TactileButton';

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
                <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                                <Trash2 size={22} color={colors.danger} strokeWidth={2} />
                            ) : (
                                <AlertTriangle size={22} color={colors.accent} strokeWidth={2} />
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={onCancel}
                            style={styles.closeBtn}
                            accessibilityLabel="Close dialog"
                        >
                            <X size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.title}>{title}</Text>

                    <Text style={styles.message}>
                        {message}
                    </Text>

                    {itemName ? (
                        <View style={[styles.itemBadge, { backgroundColor: colors.surfaceRaised }]}>
                            <Text style={styles.itemName} numberOfLines={1}>
                                "{itemName}"
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.buttonRow}>
                        <View style={{ flex: 1 }}>
                            <TactileButton
                                title={cancelText}
                                onPress={onCancel}
                                variant="secondary"
                                size="md"
                                fullWidth
                            />
                        </View>

                        <View style={{ flex: 1 }}>
                            <TactileButton
                                title={confirmText}
                                onPress={onConfirm}
                                variant={isDestructive ? 'danger' : 'primary'}
                                size="md"
                                fullWidth
                            />
                        </View>
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
            padding: 20,
        },
        dialogCard: {
            width: '100%',
            maxWidth: 340,
            borderRadius: radii.xxl,
            borderWidth: 2,
            padding: 20,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        iconContainer: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtn: {
            padding: 4,
        },
        title: {
            fontSize: typography.sizes.lg,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 6,
        },
        message: {
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            lineHeight: 20,
            marginBottom: 14,
            fontWeight: '500',
        },
        itemBadge: {
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: radii.sm,
            marginBottom: 16,
        },
        itemName: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
        },
        buttonRow: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
        },
    });

export default ConfirmDialog;

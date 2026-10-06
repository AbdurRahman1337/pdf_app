import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Modal,
    Platform,
} from 'react-native';
import { CheckCircle2, Sparkles, Award } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { radii, typography } from '../theme/tokens';
import TactileButton from './TactileButton';

export interface CelebrationOverlayProps {
    visible: boolean;
    title: string;
    subtitle?: string;
    buttonText?: string;
    onDismiss: () => void;
    autoDismissMs?: number;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
    visible,
    title,
    subtitle,
    buttonText = 'Start Learning',
    onDismiss,
    autoDismissMs,
}) => {
    const { colors, isDark } = useTheme();
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const burstAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            scaleAnim.setValue(0.3);
            opacityAnim.setValue(0);
            burstAnim.setValue(0);

            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 60,
                    friction: 6,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(burstAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]).start();

            if (autoDismissMs) {
                const timer = setTimeout(() => {
                    onDismiss();
                }, autoDismissMs);
                return () => clearTimeout(timer);
            }
        }
    }, [visible]);

    if (!visible) return null;

    const burstScale = burstAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.8, 1.3, 1.5],
    });

    const burstOpacity = burstAnim.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0.8, 0.4, 0],
    });

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
                    {/* Radiating burst ring */}
                    <Animated.View
                        style={[
                            styles.burstRing,
                            {
                                borderColor: colors.accent,
                                transform: [{ scale: burstScale }],
                                opacity: burstOpacity,
                            },
                        ]}
                    />

                    {/* Icon circle */}
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
                        <CheckCircle2 size={54} color={colors.accent} strokeWidth={2.5} />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {subtitle}
                        </Text>
                    )}

                    <View style={styles.btnRow}>
                        <TactileButton
                            title={buttonText}
                            onPress={onDismiss}
                            variant="primary"
                            size="lg"
                            fullWidth
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: radii.xxl,
        padding: 24,
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 10,
    },
    burstRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        top: 24,
    },
    iconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    btnRow: {
        width: '100%',
    },
});

export default CelebrationOverlay;

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Modal,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { CheckCircle2, XCircle, ArrowRight, Sparkles } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { radii, typography, spacing } from '../theme/tokens';
import TactileButton from './TactileButton';

export interface QuizFeedbackSheetProps {
    visible: boolean;
    isCorrect: boolean;
    correctAnswerText?: string;
    explanation?: string;
    onContinue: () => void;
}

const CHEERFUL_TITLES = [
    'Nicely done!',
    'Spot on!',
    'Brilliant!',
    'Great job!',
    'You got it!',
];

export const QuizFeedbackSheet: React.FC<QuizFeedbackSheetProps> = ({
    visible,
    isCorrect,
    correctAnswerText,
    explanation,
    onContinue,
}) => {
    const { colors, isDark } = useTheme();
    const slideAnim = useRef(new Animated.Value(300)).current;
    const scaleAnim = useRef(new Animated.Value(0.5)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const title = React.useMemo(() => {
        if (!isCorrect) return 'Not quite right';
        const idx = Math.floor(Math.random() * CHEERFUL_TITLES.length);
        return CHEERFUL_TITLES[idx];
    }, [visible, isCorrect]);

    useEffect(() => {
        if (visible) {
            slideAnim.setValue(300);
            scaleAnim.setValue(0.6);
            shakeAnim.setValue(0);

            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 9,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 80,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]).start();

            if (!isCorrect) {
                // Gentle subtle shake
                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
                ]).start();
            }
        }
    }, [visible]);

    if (!visible) return null;

    const bgBannerColor = isCorrect
        ? isDark
            ? 'rgba(16, 185, 129, 0.22)'
            : '#D1FAE5'
        : isDark
        ? 'rgba(239, 68, 68, 0.22)'
        : '#FEE2E2';

    const headerTextColor = isCorrect ? (isDark ? '#34D399' : '#065F46') : isDark ? '#F87171' : '#991B1B';

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <Animated.View
                style={[
                    styles.sheetContainer,
                    {
                        backgroundColor: colors.surface,
                        borderTopColor: isCorrect ? colors.accent : colors.danger,
                        transform: [{ translateY: slideAnim }, { translateX: shakeAnim }],
                    },
                ]}
                accessibilityLiveRegion="polite"
            >
                {/* Header Banner */}
                <View style={[styles.banner, { backgroundColor: bgBannerColor }]}>
                    <Animated.View style={[styles.iconWrapper, { transform: [{ scale: scaleAnim }] }]}>
                        {isCorrect ? (
                            <CheckCircle2 size={32} color={colors.accent} />
                        ) : (
                            <XCircle size={32} color={colors.danger} />
                        )}
                    </Animated.View>

                    <View style={{ flex: 1 }}>
                        <Text style={[styles.bannerTitle, { color: headerTextColor }]}>
                            {title}
                        </Text>
                        {!isCorrect && correctAnswerText && (
                            <Text style={[styles.correctAnswerText, { color: headerTextColor }]}>
                                Correct answer: <Text style={{ fontWeight: '800' }}>{correctAnswerText}</Text>
                            </Text>
                        )}
                    </View>
                </View>

                {/* Explanation text */}
                {explanation ? (
                    <View style={styles.explanationContainer}>
                        <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                            {explanation}
                        </Text>
                    </View>
                ) : null}

                {/* Continue Action */}
                <View style={styles.actionRow}>
                    <TactileButton
                        title="Continue"
                        onPress={onContinue}
                        variant={isCorrect ? 'primary' : 'danger'}
                        size="lg"
                        fullWidth
                        iconRight={ArrowRight}
                    />
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        zIndex: 999,
    },
    sheetContainer: {
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        borderTopWidth: 4,
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 18,
        gap: 14,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    bannerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    correctAnswerText: {
        fontSize: typography.sizes.sm,
        marginTop: 2,
    },
    explanationContainer: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    explanationText: {
        fontSize: typography.sizes.sm,
        lineHeight: 22,
    },
    actionRow: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
});

export default QuizFeedbackSheet;

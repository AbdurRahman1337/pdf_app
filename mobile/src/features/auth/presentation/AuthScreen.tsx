import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, BookOpen } from 'lucide-react-native';
import authService from '../../../core/auth/authService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, gradients } from '../../../core/theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../../../core/theme/motion';
import { AnimatedPressable } from '../../../core/components/AnimatedPressable';
import { GradientView, GradientButton } from '../../../core/components/GradientView';

const friendlyError = (code?: string): string => {
    switch (code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        default:
            return 'Authentication failed. Please check your credentials.';
    }
};

const AuthScreen = ({ navigation }: any) => {
    const { colors, shadows, isDark, typography } = useTheme();
    const styles = useMemo(() => createStyles(colors, shadows), [colors, shadows]);

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {
                setIsKeyboardVisible(true);
                setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: 120, animated: true });
                }, 100);
            }
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setIsKeyboardVisible(false);
            }
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const handleAuth = async () => {
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('Please fill in all required fields.');
            triggerHaptic('error');
            return;
        }

        if (!isLogin && password !== confirmPassword) {
            setError('Passwords do not match.');
            triggerHaptic('error');
            return;
        }

        if (!isLogin && password.length < 6) {
            setError('Password must be at least 6 characters.');
            triggerHaptic('error');
            return;
        }

        setLoading(true);
        triggerHaptic('selection');
        try {
            if (isLogin) {
                await authService.signInWithEmailAndPassword(email.trim(), password);
            } else {
                await authService.createUserWithEmailAndPassword(email.trim(), password);
                setIsLogin(true);
            }
            triggerHaptic('success');
            navigation.replace('Dashboard');
        } catch (err: any) {
            triggerHaptic('error');
            setError(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        triggerHaptic('selection');
        try {
            await authService.continueAsGuest();
            triggerHaptic('success');
            navigation.replace('Dashboard');
        } catch (err: any) {
            triggerHaptic('error');
            setError('Failed to enter as guest.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={[
                    styles.scrollContainer,
                    isKeyboardVisible && {
                        justifyContent: 'flex-start',
                        paddingTop: spacing.lg,
                        paddingBottom: 60,
                    },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Brand Hero Block ── */}
                <View style={styles.brandContainer}>
                    <GradientView
                        colors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                        borderRadius={24}
                        style={[styles.logoBadge, shadows.glowAccent]}
                    >
                        <BookOpen size={36} color="#FFFFFF" strokeWidth={2.2} />
                    </GradientView>

                    <Text style={styles.appName}>StudyAI Hub</Text>
                    <Text style={styles.appTagline}>
                        Your intelligent AI-powered study companion
                    </Text>
                </View>

                {/* ── Auth Card ── */}
                <View style={[styles.authCard, shadows.elevated]}>
                    <View style={styles.tabToggleRow}>
                        <TouchableOpacity
                            style={[styles.authTab, isLogin && styles.authTabActive]}
                            onPress={() => {
                                setIsLogin(true);
                                setError('');
                                triggerHaptic('selection');
                            }}
                        >
                            <Text style={[styles.authTabText, isLogin && { color: colors.primary }]}>
                                Sign In
                            </Text>
                            {isLogin && <View style={[styles.authTabIndicator, { backgroundColor: colors.primary }]} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.authTab, !isLogin && styles.authTabActive]}
                            onPress={() => {
                                setIsLogin(false);
                                setError('');
                                triggerHaptic('selection');
                            }}
                        >
                            <Text style={[styles.authTabText, !isLogin && { color: colors.primary }]}>
                                Create Account
                            </Text>
                            {!isLogin && <View style={[styles.authTabIndicator, { backgroundColor: colors.primary }]} />}
                        </TouchableOpacity>
                    </View>

                    {error ? (
                        <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted }]}>
                            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Email Input */}
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                        <Mail size={18} color={colors.textMuted} strokeWidth={1.75} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.textInput, { color: colors.text }]}
                            placeholder="student@university.edu"
                            placeholderTextColor={colors.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Password Input */}
                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Password</Text>
                    <View style={styles.inputWrapper}>
                        <Lock size={18} color={colors.textMuted} strokeWidth={1.75} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.textInput, { color: colors.text }]}
                            placeholder="Enter your password"
                            placeholderTextColor={colors.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                            {showPassword ? (
                                <EyeOff size={18} color={colors.textMuted} />
                            ) : (
                                <Eye size={18} color={colors.textMuted} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Confirm Password (Sign up only) */}
                    {!isLogin && (
                        <>
                            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Confirm Password</Text>
                            <View style={styles.inputWrapper}>
                                <Lock size={18} color={colors.textMuted} strokeWidth={1.75} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.textInput, { color: colors.text }]}
                                    placeholder="Confirm your password"
                                    placeholderTextColor={colors.textMuted}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showPassword}
                                />
                            </View>
                        </>
                    )}

                    {/* Submit Button */}
                    <GradientButton
                        colors={gradients.tealToBlue[isDark ? 'dark' : 'light']}
                        title={isLogin ? 'Sign In to Hub' : 'Create Account'}
                        onPress={handleAuth}
                        loading={loading}
                        style={{ marginTop: 20 }}
                    />

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Guest Login */}
                    <AnimatedPressable
                        style={[styles.guestBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                        onPress={handleGuestLogin}
                        disabled={loading}
                    >
                        <Sparkles size={16} color={colors.primary} strokeWidth={2} style={{ marginRight: 6 }} />
                        <Text style={[styles.guestBtnText, { color: colors.text }]}>
                            Continue as Guest
                        </Text>
                    </AnimatedPressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: ThemeColors, shadows: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        scrollContainer: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingVertical: 36,
        },
        brandContainer: {
            alignItems: 'center',
            marginBottom: 24,
        },
        logoBadge: {
            width: 72,
            height: 72,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
        },
        appName: {
            fontSize: 26,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
        },
        appTagline: {
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            marginTop: 4,
            textAlign: 'center',
        },
        authCard: {
            backgroundColor: colors.surface,
            borderRadius: radii.sheets,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            width: '100%',
            maxWidth: 420,
            alignSelf: 'center',
        },
        tabToggleRow: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: 20,
        },
        authTab: {
            flex: 1,
            alignItems: 'center',
            paddingBottom: 12,
            position: 'relative',
        },
        authTabActive: {},
        authTabText: {
            fontSize: typography.sizes.sm + 1,
            fontWeight: '700',
            color: colors.textMuted,
        },
        authTabIndicator: {
            position: 'absolute',
            bottom: -1,
            left: 10,
            right: 10,
            height: 2.5,
            borderRadius: 1.5,
        },
        errorBox: {
            padding: 10,
            borderRadius: radii.controls,
            marginBottom: 14,
        },
        errorText: {
            fontSize: typography.sizes.xs + 1,
            fontWeight: '600',
            textAlign: 'center',
        },
        inputLabel: {
            fontSize: typography.sizes.xs,
            fontWeight: '700',
            color: colors.text,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
        },
        inputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceRaised,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.controls,
            paddingHorizontal: 12,
            height: 48,
        },
        inputIcon: {
            marginRight: 10,
        },
        textInput: {
            flex: 1,
            fontSize: typography.sizes.sm,
            height: '100%',
        },
        eyeBtn: {
            padding: 6,
        },
        dividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 18,
        },
        dividerLine: {
            flex: 1,
            height: 1,
        },
        dividerText: {
            marginHorizontal: 10,
            fontSize: typography.sizes.xs,
            fontWeight: '600',
            textTransform: 'uppercase',
        },
        guestBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 13,
            borderRadius: radii.controls,
            borderWidth: 1,
        },
        guestBtnText: {
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
    });

export default AuthScreen;

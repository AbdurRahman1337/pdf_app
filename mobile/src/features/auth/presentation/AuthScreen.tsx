import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Keyboard,
    Platform,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Zap } from 'lucide-react-native';
import authService from '../../../core/auth/authService';
import { useTheme } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing, darkShadows } from '../../../core/theme/tokens';

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
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Check your server connection.';
        default:
            return 'Authentication failed. Please try again.';
    }
};

const AuthScreen = ({ navigation }: any) => {
    const { colors, shadows } = useTheme();
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
                    scrollRef.current?.scrollTo({ y: 150, animated: true });
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
            return;
        }

        if (!isLogin && password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (!isLogin && password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await authService.signInWithEmailAndPassword(email.trim(), password);
            } else {
                await authService.createUserWithEmailAndPassword(email.trim(), password);
                setIsLogin(true);
            }
            navigation.replace('Dashboard');
        } catch (err: any) {
            setError(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        try {
            await authService.continueAsGuest();
            navigation.replace('Dashboard');
        } catch (err: any) {
            setError('Failed to enter as guest.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
                keyboardDismissMode="on-drag"
            >
                {/* ── Brand Header ── */}
                <View
                    style={[
                        styles.brandContainer,
                        isKeyboardVisible && { marginBottom: spacing.sm },
                    ]}
                >
                    <View
                        style={[
                            styles.logoBadge,
                            isKeyboardVisible && { width: 56, height: 56, marginBottom: spacing.xs },
                        ]}
                    >
                        <Image
                            source={require('../../../../assets/main.png')}
                            style={[
                                styles.logoImage,
                                isKeyboardVisible && { width: 40, height: 40 },
                            ]}
                        />
                    </View>
                    <Text style={styles.brandTitle}>PDF AI Study Hub</Text>
                    {!isKeyboardVisible && (
                        <Text style={styles.brandSubtitle}>
                            Synthesize documents, extract key vocabulary, and query notes with RAG.
                        </Text>
                    )}

                    <View style={authService.isFirebaseAvailable ? styles.authStatusBadgeFirebase : styles.authStatusBadgeExpo}>
                        <ShieldCheck
                            size={13}
                            color={authService.isFirebaseAvailable ? colors.warning : colors.accent}
                            style={{ marginRight: 5 }}
                        />
                        <Text style={authService.isFirebaseAvailable ? styles.badgeTextFirebase : styles.badgeTextExpo}>
                            {authService.isFirebaseAvailable
                                ? 'Firebase Auth Active'
                                : 'Expo Dev Session (Guest Ready)'}
                        </Text>
                    </View>
                </View>

                {/* ── Form Card ── */}
                <View style={styles.card}>
                    <View style={styles.cardNav}>
                        <TouchableOpacity
                            style={[styles.cardNavTab, isLogin && styles.cardNavTabActive]}
                            onPress={() => { setIsLogin(true); setError(''); }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.cardNavText, isLogin && styles.cardNavTextActive]}>
                                Sign In
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.cardNavTab, !isLogin && styles.cardNavTabActive]}
                            onPress={() => { setIsLogin(false); setError(''); }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.cardNavText, !isLogin && styles.cardNavTextActive]}>
                                Create Account
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Error Banner */}
                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Inputs */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                            <Mail size={17} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="student@university.edu"
                                placeholderTextColor={colors.textSubtle}
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => scrollRef.current?.scrollTo({ y: 120, animated: true })}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Lock size={17} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { paddingRight: 40 }]}
                                placeholder="Enter password"
                                placeholderTextColor={colors.textSubtle}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => scrollRef.current?.scrollTo({ y: 170, animated: true })}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                style={styles.passwordToggle}
                                onPress={() => setShowPassword(!showPassword)}
                                activeOpacity={0.7}
                            >
                                {showPassword ? (
                                    <EyeOff size={17} color={colors.textMuted} />
                                ) : (
                                    <Eye size={17} color={colors.textMuted} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!isLogin && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <View style={styles.inputWrapper}>
                                <Lock size={17} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Repeat password"
                                    placeholderTextColor={colors.textSubtle}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    onFocus={() => scrollRef.current?.scrollTo({ y: 220, animated: true })}
                                    secureTextEntry={!showPassword}
                                />
                            </View>
                        </View>
                    )}

                    {/* Primary Button */}
                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                        onPress={handleAuth}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.textInverse} size="small" />
                        ) : (
                            <View style={styles.btnContent}>
                                <Text style={styles.primaryBtnText}>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                </Text>
                                <ArrowRight size={17} color={colors.textInverse} style={{ marginLeft: 6 }} />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or continue with</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Instant Guest Mode Button */}
                    <TouchableOpacity
                        style={styles.guestBtn}
                        onPress={handleGuestLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Zap size={16} color={colors.accent} style={{ marginRight: 8 }} />
                        <Text style={styles.guestBtnText}>Instant Guest Session</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer Note */}
                <Text style={styles.footerNote}>
                    Document vectors and study data are securely partitioned per session.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xxl,
    },
    brandContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    logoBadge: {
        width: 72,
        height: 72,
        borderRadius: radii.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        ...shadows.card,
    },
    logoImage: {
        width: 52,
        height: 52,
        resizeMode: 'contain',
    },
    brandTitle: {
        color: colors.text,
        fontSize: typography.sizes.xxl,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    brandSubtitle: {
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 320,
        marginTop: spacing.xs,
    },
    authStatusBadgeFirebase: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningMuted,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.25)',
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: radii.full,
        marginTop: spacing.sm,
    },
    authStatusBadgeExpo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: radii.full,
        marginTop: spacing.sm,
    },
    badgeTextFirebase: {
        color: colors.warning,
        fontSize: typography.sizes.xs,
        fontWeight: '600',
    },
    badgeTextExpo: {
        color: colors.accent,
        fontSize: typography.sizes.xs,
        fontWeight: '600',
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        ...shadows.card,
    },
    cardNav: {
        flexDirection: 'row',
        backgroundColor: colors.surfaceSubtle,
        borderRadius: radii.md,
        padding: 3,
        marginBottom: spacing.lg,
    },
    cardNavTab: {
        flex: 1,
        paddingVertical: 9,
        alignItems: 'center',
        borderRadius: radii.sm,
    },
    cardNavTabActive: {
        backgroundColor: colors.surfaceRaised,
        ...shadows.card,
    },
    cardNavText: {
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
    cardNavTextActive: {
        color: colors.text,
        fontWeight: '700',
    },
    errorBox: {
        backgroundColor: colors.dangerMuted,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: radii.md,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    errorText: {
        color: colors.danger,
        fontSize: typography.sizes.xs,
        textAlign: 'center',
        fontWeight: '500',
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    inputLabel: {
        color: colors.textSecondary,
        fontSize: typography.sizes.xs,
        fontWeight: '600',
        marginBottom: 6,
        marginLeft: 2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        paddingHorizontal: spacing.sm,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: typography.sizes.md,
        paddingVertical: 12,
    },
    passwordToggle: {
        padding: 6,
    },
    primaryBtn: {
        backgroundColor: colors.accent,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xs,
        ...shadows.glowAccent,
    },
    btnContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    primaryBtnText: {
        color: colors.textInverse,
        fontSize: typography.sizes.md,
        fontWeight: '700',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    dividerText: {
        color: colors.textSubtle,
        fontSize: typography.sizes.xs,
        paddingHorizontal: spacing.sm,
    },
    guestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        borderRadius: radii.md,
        paddingVertical: 12,
    },
    guestBtnText: {
        color: colors.accent,
        fontSize: typography.sizes.sm,
        fontWeight: '700',
    },
    footerNote: {
        color: colors.textSubtle,
        fontSize: typography.sizes.xs,
        textAlign: 'center',
        marginTop: spacing.xl,
    },
});

export default AuthScreen;

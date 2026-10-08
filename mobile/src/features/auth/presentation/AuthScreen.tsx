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
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Zap, Sparkles, UploadCloud } from 'lucide-react-native';
import authService from '../../../core/auth/authService';
import { getBaseUrl } from '../../../core/network/apiClient';
import { useTheme, useSafeTopGap, getStaticSafeTopGap } from '../../../core/theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../../../core/theme/tokens';
import TactileButton from '../../../core/components/TactileButton';
import TactileCard from '../../../core/components/TactileCard';

const friendlyError = (code?: string): string => {
    switch (code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'Incorrect email or password.';
        case 'auth/wrong-password':
            return 'Incorrect email or password.';
        case 'auth/invalid-credential':
            return 'Incorrect email or password.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again in a moment.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        default:
            return 'Authentication failed. Please try again.';
    }
};

const AuthScreen = ({ navigation }: any) => {
    const { colors, shadows, isDark } = useTheme();
    const topGap = useSafeTopGap();
    const styles = useMemo(() => createStyles(colors, topGap), [colors, topGap]);

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
                    scrollRef.current?.scrollTo({ y: 140, animated: true });
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

    const handleGoogleDriveOAuth = async () => {
        setError('');
        setLoading(true);
        try {
            const baseUrl = getBaseUrl();
            await authService.initiateGoogleDriveOAuth(baseUrl);
            navigation.replace('Dashboard');
        } catch (err: any) {
            setError(err.message || 'Google Drive authorization failed.');
        } finally {
            setLoading(false);
        }
    };

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
        >
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={[
                    styles.scrollContainer,
                    isKeyboardVisible && {
                        justifyContent: 'flex-start',
                        paddingTop: topGap,
                        paddingBottom: 60,
                    },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Brand Header ── */}
                <View style={[styles.brandContainer, isKeyboardVisible && { marginBottom: 12 }]}>
                    <View style={styles.logoBadge}>
                        <Image
                            source={require('../../../../assets/newicon.jpeg')}
                            style={styles.logoImage}
                        />
                    </View>
                    <Text style={styles.brandTitle}>Lecta AI</Text>
                    {!isKeyboardVisible && (
                        <Text style={styles.brandSubtitle}>
                            Turn your study materials into interactive flashcards, active recall quizzes, and AI tutoring.
                        </Text>
                    )}
                </View>

                {/* ── Form Card ── */}
                <TactileCard contentStyle={{ padding: 20 }}>
                    <View style={styles.cardNav}>
                        <TouchableOpacity
                            style={[
                                styles.cardNavTab,
                                isLogin && {
                                    backgroundColor: colors.surface,
                                    borderBottomWidth: 3,
                                    borderBottomColor: colors.buttonSecondaryEdge,
                                },
                            ]}
                            onPress={() => { setIsLogin(true); setError(''); }}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.cardNavText, isLogin && { color: colors.text, fontWeight: '800' }]}>
                                Sign In
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.cardNavTab,
                                !isLogin && {
                                    backgroundColor: colors.surface,
                                    borderBottomWidth: 3,
                                    borderBottomColor: colors.buttonSecondaryEdge,
                                },
                            ]}
                            onPress={() => { setIsLogin(false); setError(''); }}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.cardNavText, !isLogin && { color: colors.text, fontWeight: '800' }]}>
                                Create Account
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Error Banner */}
                    {error ? (
                        <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerBorder }]}>
                            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Inputs */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                            <Mail size={18} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="student@university.edu"
                                placeholderTextColor={colors.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoCorrect={false}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                            <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { paddingRight: 40, color: colors.text }]}
                                placeholder="Enter password"
                                placeholderTextColor={colors.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                style={styles.passwordToggle}
                                onPress={() => setShowPassword(!showPassword)}
                                activeOpacity={0.7}
                            >
                                {showPassword ? (
                                    <EyeOff size={18} color={colors.textMuted} />
                                ) : (
                                    <Eye size={18} color={colors.textMuted} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!isLogin && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                                <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Repeat password"
                                    placeholderTextColor={colors.textMuted}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showPassword}
                                />
                            </View>
                        </View>
                    )}

                    {/* Primary Button */}
                    <TactileButton
                        title={isLogin ? 'Sign In' : 'Create Account'}
                        onPress={handleAuth}
                        loading={loading}
                        variant="primary"
                        size="lg"
                        fullWidth
                        iconRight={ArrowRight}
                        style={{ marginTop: 8 }}
                    />

                    {/* Google Drive OAuth Button */}
                    <TactileButton
                        title="Sign In with Google Drive"
                        onPress={handleGoogleDriveOAuth}
                        loading={loading}
                        variant="primary"
                        size="md"
                        fullWidth
                        icon={UploadCloud}
                        style={{ marginTop: 10, backgroundColor: '#10B981' }}
                    />

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Instant Guest Mode Button */}
                    <TactileButton
                        title="Instant Guest Session"
                        onPress={handleGuestLogin}
                        disabled={loading}
                        variant="secondary"
                        size="md"
                        fullWidth
                        icon={Zap}
                    />
                </TactileCard>

                {/* Footer Note */}
                <Text style={[styles.footerNote, { color: colors.textMuted }]}>
                    Study notes and vector embeddings are securely partitioned per user.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: ThemeColors, topGap: number = getStaticSafeTopGap()) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.bg,
        },
        scrollContainer: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingTop: topGap,
            paddingBottom: 32,
        },
        brandContainer: {
            alignItems: 'center',
            marginBottom: 20,
        },
        logoBadge: {
            width: 76,
            height: 76,
            borderRadius: radii.xxl,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
        },
        logoImage: {
            width: 56,
            height: 56,
            borderRadius: radii.md,
            resizeMode: 'contain',
        },
        brandTitle: {
            color: colors.text,
            fontSize: typography.sizes.xl,
            fontWeight: '800',
            letterSpacing: -0.3,
        },
        brandSubtitle: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 320,
            marginTop: 6,
            fontWeight: '500',
        },
        cardNav: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.lg,
            padding: 4,
            marginBottom: 16,
        },
        cardNavTab: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: radii.md,
        },
        cardNavText: {
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            fontWeight: '700',
        },
        errorBox: {
            borderWidth: 1.5,
            borderRadius: radii.md,
            padding: 10,
            marginBottom: 12,
        },
        errorText: {
            fontSize: typography.sizes.xs,
            textAlign: 'center',
            fontWeight: '700',
        },
        inputGroup: {
            marginBottom: 14,
        },
        inputLabel: {
            color: colors.textSecondary,
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 6,
        },
        inputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 2,
            borderRadius: radii.md,
            paddingHorizontal: 12,
            height: 48,
        },
        inputIcon: {
            marginRight: 8,
        },
        input: {
            flex: 1,
            fontSize: typography.sizes.sm,
            fontWeight: '600',
            paddingVertical: 0,
        },
        passwordToggle: {
            padding: 6,
        },
        dividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 16,
        },
        dividerLine: {
            flex: 1,
            height: 1.5,
        },
        dividerText: {
            fontSize: typography.sizes.xs,
            fontWeight: '800',
            textTransform: 'uppercase',
            paddingHorizontal: 12,
        },
        footerNote: {
            fontSize: typography.sizes.xs,
            textAlign: 'center',
            marginTop: 20,
            fontWeight: '500',
        },
    });

export default AuthScreen;

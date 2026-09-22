import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { FileText } from 'lucide-react-native';
import authService from '../../../core/auth/authService';

// Map Firebase error codes to human-friendly messages
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
            return 'Network error. Check your connection.';
        default:
            return 'Authentication failed. Please try again.';
    }
};

const AuthScreen = ({ navigation }: any) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async () => {
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('Please fill in all fields.');
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
            let authUser;
            if (isLogin) {
                // ── Sign In ─────────────────────────────────────────────
                authUser = await authService.signInWithEmailAndPassword(email.trim(), password);
            } else {
                // ── Register ────────────────────────────────────────────
                authUser = await authService.createUserWithEmailAndPassword(
                    email.trim(),
                    password
                );
                setIsLogin(true);
            }
            if (authUser) {
                const token = await authUser.getIdToken();
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🔑 [LOGGED IN - COPY THIS TOKEN FOR SWAGGER UI]');
                console.log(`Bearer Token : ${token}`);
                console.log(`X-Session-ID : ${authUser.uid}`);
                console.log(`Email        : ${authUser.email}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
            const guestUser = await authService.continueAsGuest();
            const token = await guestUser.getIdToken();
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔑 [GUEST LOGIN - COPY THIS TOKEN FOR SWAGGER UI]');
            console.log(`Bearer Token : ${token}`);
            console.log(`X-Session-ID : ${guestUser.uid}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            navigation.replace('Dashboard');
        } catch (err: any) {
            setError('Failed to enter as guest.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* ── Logo ── */}
            <View style={styles.logoContainer}>
                <View style={styles.iconWrapper}>
                    <FileText size={60} color="#38BDF8" />
                </View>
                <Text style={styles.title}>PDF AI Assistant</Text>
                <Text style={styles.subtitle}>Enterprise Summarization & RAG Engine</Text>
                <View style={authService.isFirebaseAvailable ? styles.firebaseBadge : styles.expoBadge}>
                    <Text style={authService.isFirebaseAvailable ? styles.firebaseBadgeText : styles.expoBadgeText}>
                        {authService.isFirebaseAvailable
                            ? '🔐 Secured by Firebase Auth'
                            : '📱 Expo Go Mode (Guest / Dev Session)'}
                    </Text>
                </View>
            </View>

            {/* ── Error Banner ── */}
            {error ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️  {error}</Text>
                </View>
            ) : null}

            {/* ── Form ── */}
            <View style={styles.form}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                    style={styles.input}
                    placeholder="name@company.com"
                    placeholderTextColor="#64748b"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                />

                <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                {/* Confirm password only shown on Register */}
                {!isLogin && (
                    <>
                        <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#64748b"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </>
                )}

                <TouchableOpacity
                    style={[styles.button, { opacity: loading ? 0.65 : 1 }]}
                    onPress={handleAuth}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000000" />
                    ) : (
                        <Text style={styles.buttonText}>
                            {isLogin ? 'Sign In' : 'Create Account'}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.guestButton}
                    onPress={handleGuestLogin}
                    disabled={loading}
                >
                    <Text style={styles.guestButtonText}>⚡ Continue as Guest (Instant Access)</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); }} style={styles.switchBtn}>
                    <Text style={styles.switchText}>
                        {isLogin
                            ? "Don't have an account?  Sign Up →"
                            : 'Already have an account?  Sign In →'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        backgroundColor: '#020617',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingVertical: 48,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconWrapper: {
        backgroundColor: 'rgba(56,189,248,0.1)',
        padding: 24,
        borderRadius: 999,
        marginBottom: 16,
    },
    title: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 8,
    },
    firebaseBadge: {
        backgroundColor: 'rgba(251,146,60,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(251,146,60,0.3)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 999,
        marginTop: 14,
    },
    firebaseBadgeText: {
        color: '#fb923c',
        fontSize: 12,
        fontWeight: '600',
    },
    expoBadge: {
        backgroundColor: 'rgba(56,189,248,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.3)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 999,
        marginTop: 14,
    },
    expoBadgeText: {
        color: '#38BDF8',
        fontSize: 12,
        fontWeight: '600',
    },
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.5)',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    errorText: {
        color: '#ef4444',
        textAlign: 'center',
    },
    form: {},
    label: {
        color: '#94a3b8',
        marginBottom: 8,
        marginLeft: 4,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        color: '#ffffff',
        padding: 16,
        borderRadius: 12,
    },
    button: {
        backgroundColor: '#38BDF8',
        padding: 16,
        borderRadius: 12,
        marginTop: 24,
        alignItems: 'center',
    },
    buttonText: {
        color: '#000000',
        fontWeight: 'bold',
        fontSize: 18,
    },
    guestButton: {
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.4)',
        backgroundColor: 'rgba(56,189,248,0.06)',
        padding: 14,
        borderRadius: 12,
        marginTop: 14,
        alignItems: 'center',
    },
    guestButtonText: {
        color: '#38BDF8',
        fontWeight: '600',
        fontSize: 15,
    },
    switchBtn: {
        alignItems: 'center',
        marginTop: 18,
        paddingVertical: 8,
    },
    switchText: {
        color: '#38BDF8',
        fontWeight: '500',
    },
});

export default AuthScreen;

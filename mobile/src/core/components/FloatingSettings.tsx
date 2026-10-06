import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Animated,
    PanResponder,
    useWindowDimensions,
    Alert,
    ScrollView,
    Easing,
    Keyboard,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Settings,
    Moon,
    Sun,
    Monitor,
    Sparkles,
    X,
    Move,
    RotateCcw,
    LogOut,
    Check,
    Palette,
    ShieldCheck,
    Layers,
    Sliders,
} from 'lucide-react-native';
import { useTheme, ThemeMode, useSafeTopGap } from '../theme/ThemeContext';
import authService from '../auth/authService';

const BUTTON_SIZE = 54;
const STORAGE_POS_X = '@pdf_app_floating_pos_x';
const STORAGE_POS_Y = '@pdf_app_floating_pos_y';

export const FloatingSettings: React.FC = () => {
    const { themeMode, setThemeMode, isDark, colors, shadows, typography, radii, spacing } = useTheme();
    const topGap = useSafeTopGap();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const [modalVisible, setModalVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

    // Safe bounds
    const minX = 12;
    const maxX = Math.max(minX, screenWidth - BUTTON_SIZE - 12);
    const minY = Math.max(topGap, 48); // Below status bar
    const maxY = Math.max(minY, screenHeight - BUTTON_SIZE - 36);

    const defaultX = screenWidth - BUTTON_SIZE - 20;
    const defaultY = screenHeight - BUTTON_SIZE - 100;

    // Animated pan position
    const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
    const lastPos = useRef({ x: defaultX, y: defaultY });
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Slow continuous circulating rotation animation
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const spinAnimation = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 10000, // 10s per full 360 rotation for graceful slow motion
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spinAnimation.start();
        return () => spinAnimation.stop();
    }, [spinAnim]);

    const spinInterpolate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Listen to user auth state
    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged((u) => {
            setCurrentUser(u);
        });
        return unsubscribe;
    }, []);

    // Listen to keyboard state
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setIsKeyboardVisible(true)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setIsKeyboardVisible(false)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Load saved position
    useEffect(() => {
        const loadPosition = async () => {
            try {
                const savedX = await AsyncStorage.getItem(STORAGE_POS_X);
                const savedY = await AsyncStorage.getItem(STORAGE_POS_Y);
                if (savedX !== null && savedY !== null) {
                    const parsedX = parseFloat(savedX);
                    const parsedY = parseFloat(savedY);
                    if (!isNaN(parsedX) && !isNaN(parsedY)) {
                        const clampedX = Math.min(Math.max(parsedX, minX), maxX);
                        const clampedY = Math.min(Math.max(parsedY, minY), maxY);
                        pan.setValue({ x: clampedX, y: clampedY });
                        lastPos.current = { x: clampedX, y: clampedY };
                    }
                } else {
                    pan.setValue({ x: defaultX, y: defaultY });
                    lastPos.current = { x: defaultX, y: defaultY };
                }
            } catch (err) {
                console.warn('[FloatingSettings] Error loading position:', err);
            }
        };
        loadPosition();
    }, [screenWidth, screenHeight]);

    // Save position helper
    const savePosition = async (x: number, y: number) => {
        try {
            await AsyncStorage.setItem(STORAGE_POS_X, x.toString());
            await AsyncStorage.setItem(STORAGE_POS_Y, y.toString());
        } catch (err) {
            console.warn('[FloatingSettings] Error saving position:', err);
        }
    };

    // PanResponder for dragging anywhere on the screen
    const dragStartTime = useRef<number>(0);
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
            },
            onPanResponderGrant: () => {
                dragStartTime.current = Date.now();
                Animated.spring(scaleAnim, {
                    toValue: 1.15,
                    useNativeDriver: false,
                }).start();
            },
            onPanResponderMove: (_, gestureState) => {
                const newX = Math.min(Math.max(lastPos.current.x + gestureState.dx, minX), maxX);
                const newY = Math.min(Math.max(lastPos.current.y + gestureState.dy, minY), maxY);
                pan.setValue({ x: newX, y: newY });
            },
            onPanResponderRelease: (_, gestureState) => {
                Animated.spring(scaleAnim, {
                    toValue: 1.0,
                    friction: 5,
                    useNativeDriver: false,
                }).start();

                const dragDuration = Date.now() - dragStartTime.current;
                const dragDistance = Math.hypot(gestureState.dx, gestureState.dy);

                // Tap detection: minimal movement and short tap
                if (dragDistance < 7 && dragDuration < 300) {
                    setModalVisible(true);
                    return;
                }

                // Dragged: clamp and finalize position
                const finalX = Math.min(Math.max(lastPos.current.x + gestureState.dx, minX), maxX);
                const finalY = Math.min(Math.max(lastPos.current.y + gestureState.dy, minY), maxY);

                lastPos.current = { x: finalX, y: finalY };
                pan.setValue({ x: finalX, y: finalY });
                savePosition(finalX, finalY);
            },
        })
    ).current;

    // Reset button position
    const resetPosition = () => {
        Animated.spring(pan, {
            toValue: { x: defaultX, y: defaultY },
            friction: 6,
            tension: 40,
            useNativeDriver: false,
        }).start(() => {
            lastPos.current = { x: defaultX, y: defaultY };
            savePosition(defaultX, defaultY);
        });
    };

    const handleSignOut = async () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    setModalVisible(false);
                    await authService.signOut();
                },
            },
        ]);
    };

    const themeOptions: { mode: ThemeMode; label: string; sub: string; icon: any }[] = [
        {
            mode: 'dark',
            label: 'Dark Mode',
            sub: 'Deep obsidian & sky blue glow',
            icon: Moon,
        },
        {
            mode: 'light',
            label: 'Light Mode',
            sub: 'Crisp daylight & high contrast',
            icon: Sun,
        },
        {
            mode: 'system',
            label: 'System Auto',
            sub: 'Matches your OS device theme',
            icon: Monitor,
        },
    ];

    return (
        <>
            {/* Movable Floating Icon */}
            {!isKeyboardVisible && (
                <View style={styles.floatingLayer} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            styles.floatingButtonContainer,
                            {
                                transform: [
                                    { translateX: pan.x },
                                    { translateY: pan.y },
                                    { scale: scaleAnim },
                                ],
                            },
                        ]}
                        {...panResponder.panHandlers}
                    >
                        <View
                            style={[
                                styles.floatingButton,
                                {
                                    backgroundColor: colors.floatingBg,
                                    borderColor: colors.floatingBorder,
                                    shadowColor: colors.floatingShadow,
                                },
                            ]}
                        >
                            {/* Glow indicator with circulating slow-motion Settings gear */}
                            <View style={[styles.innerGlow, { backgroundColor: colors.accentMuted }]}>
                                <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                                    <Settings size={22} color={colors.accent} />
                                </Animated.View>
                            </View>

                            {/* Mode Indicator Badge */}
                            <View
                                style={[
                                    styles.modeBadge,
                                    {
                                        backgroundColor: colors.surfaceRaised,
                                        borderColor: colors.borderActive,
                                    },
                                ]}
                            >
                                {themeMode === 'light' ? (
                                    <Sun size={11} color={colors.warning} />
                                ) : themeMode === 'dark' ? (
                                    <Moon size={11} color={colors.indigo} />
                                ) : (
                                    <Sparkles size={11} color={colors.teal} />
                                )}
                            </View>
                        </View>
                    </Animated.View>
                </View>
            )}

            {/* Settings & Theme Selector Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
                    <View
                        style={[
                            styles.modalCard,
                            {
                                backgroundColor: colors.surfaceRaised,
                                borderColor: colors.borderLight,
                                ...shadows.modal,
                            },
                        ]}
                    >
                        {/* Header */}
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <View style={styles.modalHeaderLeft}>
                                <View
                                    style={[
                                        styles.modalIconBg,
                                        { backgroundColor: colors.accentMuted, borderColor: colors.accentBorder },
                                    ]}
                                >
                                    <Palette size={20} color={colors.accent} />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                                        Appearance & Settings
                                    </Text>
                                    <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                                        Customize theme & controls
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle }]}
                                activeOpacity={0.7}
                            >
                                <X size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Section: Theme Select */}
                            <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>
                                Select Theme
                            </Text>

                            <View style={styles.themeOptionsGrid}>
                                {themeOptions.map((opt) => {
                                    const isSelected = themeMode === opt.mode;
                                    const Icon = opt.icon;

                                    return (
                                        <TouchableOpacity
                                            key={opt.mode}
                                            style={[
                                                styles.themeCard,
                                                {
                                                    backgroundColor: colors.surface,
                                                    borderColor: isSelected
                                                        ? colors.accent
                                                        : colors.border,
                                                },
                                                isSelected && {
                                                    backgroundColor: colors.accentMuted,
                                                    borderWidth: 2,
                                                },
                                            ]}
                                            onPress={() => setThemeMode(opt.mode)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={styles.themeCardLeft}>
                                                <View
                                                    style={[
                                                        styles.themeIconWrapper,
                                                        {
                                                            backgroundColor: isSelected
                                                                ? colors.accent
                                                                : colors.surfaceSubtle,
                                                        },
                                                    ]}
                                                >
                                                    <Icon
                                                        size={18}
                                                        color={isSelected ? colors.textInverse : colors.textMuted}
                                                    />
                                                </View>
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text
                                                        style={[
                                                            styles.themeLabel,
                                                            { color: colors.text },
                                                            isSelected && { fontWeight: '700', color: colors.accent },
                                                        ]}
                                                    >
                                                        {opt.label}
                                                    </Text>
                                                    <Text style={[styles.themeSub, { color: colors.textMuted }]}>
                                                        {opt.sub}
                                                    </Text>
                                                </View>
                                            </View>

                                            {isSelected && (
                                                <View
                                                    style={[
                                                        styles.selectedBadge,
                                                        { backgroundColor: colors.accent },
                                                    ]}
                                                >
                                                    <Check size={14} color={colors.textInverse} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Section: Dynamic Movable Icon Helpers */}
                            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginTop: spacing.md }]}>
                                Moveable Floating Icon
                            </Text>
                            <View
                                style={[
                                    styles.floatingInfoBox,
                                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                                ]}
                            >
                                <View style={styles.floatingInfoRow}>
                                    <Move size={16} color={colors.accent} style={{ marginRight: 8 }} />
                                    <Text style={[styles.floatingInfoText, { color: colors.textSecondary }]}>
                                        You can drag and move the floating settings button to any position on any screen.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.resetPosBtn,
                                        { borderColor: colors.border, backgroundColor: colors.surface },
                                    ]}
                                    onPress={resetPosition}
                                    activeOpacity={0.7}
                                >
                                    <RotateCcw size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                                    <Text style={[styles.resetPosText, { color: colors.textSecondary }]}>
                                        Reset Position to Bottom-Right
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Section: Session / Account Details */}
                            {currentUser && (
                                <>
                                    <Text
                                        style={[
                                            styles.sectionTitle,
                                            { color: colors.textSubtle, marginTop: spacing.md },
                                        ]}
                                    >
                                        Account
                                    </Text>
                                    <View
                                        style={[
                                            styles.accountBox,
                                            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                                        ]}
                                    >
                                        <View style={styles.accountInfo}>
                                            <ShieldCheck size={18} color={colors.teal} style={{ marginRight: 8 }} />
                                            <Text
                                                style={[styles.accountEmail, { color: colors.text }]}
                                                numberOfLines={1}
                                            >
                                                {currentUser.email || 'Guest Session'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.signOutBtn, { backgroundColor: colors.dangerMuted }]}
                                            onPress={handleSignOut}
                                            activeOpacity={0.8}
                                        >
                                            <LogOut size={14} color={colors.danger} style={{ marginRight: 6 }} />
                                            <Text style={[styles.signOutText, { color: colors.danger }]}>
                                                Sign Out
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {/* Footer App Info */}
                            <View style={styles.footerNote}>
                                <Text style={[styles.footerText, { color: colors.textSubtle }]}>
                                    Lecta AI • v1.0.0
                                </Text>
                            </View>
                        </ScrollView>

                        {/* Modal Action Button */}
                        <TouchableOpacity
                            style={[
                                styles.doneBtn,
                                { backgroundColor: colors.accent, ...shadows.glowAccent },
                            ]}
                            onPress={() => setModalVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.doneBtnText, { color: colors.textInverse }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    floatingLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        elevation: 99999,
    },
    floatingButtonContainer: {
        position: 'absolute',
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
    },
    floatingButton: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
    },
    innerGlow: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '85%',
        borderRadius: 24,
        borderWidth: 1,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        marginBottom: 14,
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    modalIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    modalSub: {
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    modalBody: {
        marginVertical: 4,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginLeft: 2,
    },
    themeOptionsGrid: {
        gap: 8,
    },
    themeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    themeCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    themeIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    themeLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    themeSub: {
        fontSize: 11,
        marginTop: 2,
    },
    selectedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    floatingInfoBox: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
    },
    floatingInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    floatingInfoText: {
        fontSize: 12,
        lineHeight: 17,
        flex: 1,
    },
    resetPosBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    resetPosText: {
        fontSize: 12,
        fontWeight: '600',
    },
    accountBox: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    accountInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    accountEmail: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    signOutText: {
        fontSize: 12,
        fontWeight: '700',
    },
    footerNote: {
        alignItems: 'center',
        paddingVertical: 14,
    },
    footerText: {
        fontSize: 11,
    },
    doneBtn: {
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    doneBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
});

export default FloatingSettings;

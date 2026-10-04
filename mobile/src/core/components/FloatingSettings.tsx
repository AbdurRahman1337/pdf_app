import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
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
} from 'lucide-react-native';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { ThemeColors, typography, radii, spacing } from '../theme/tokens';
import { motion, triggerHaptic } from '../theme/motion';
import { AnimatedPressable } from './AnimatedPressable';
import authService from '../auth/authService';

const BUTTON_SIZE = 50;
const STORAGE_POS_X = '@pdf_app_floating_pos_x';
const STORAGE_POS_Y = '@pdf_app_floating_pos_y';

export const FloatingSettings: React.FC = () => {
    const { themeMode, setThemeMode, isDark, colors, shadows } = useTheme();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const [modalVisible, setModalVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

    // Safe bounds
    const minX = 12;
    const maxX = Math.max(minX, screenWidth - BUTTON_SIZE - 12);
    const minY = 48;
    const maxY = Math.max(minY, screenHeight - BUTTON_SIZE - 36);

    const defaultX = screenWidth - BUTTON_SIZE - 18;
    const defaultY = screenHeight - BUTTON_SIZE - 95;

    // Animated pan position
    const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
    const lastPos = useRef({ x: defaultX, y: defaultY });
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const spinAnimation = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 12000,
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

    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged((u) => {
            setCurrentUser(u);
        });
        return unsubscribe;
    }, []);

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

    const savePosition = async (x: number, y: number) => {
        try {
            await AsyncStorage.setItem(STORAGE_POS_X, x.toString());
            await AsyncStorage.setItem(STORAGE_POS_Y, y.toString());
        } catch (err) {
            console.warn('[FloatingSettings] Error saving position:', err);
        }
    };

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
                    toValue: 1.12,
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

                if (dragDistance < 7 && dragDuration < 300) {
                    triggerHaptic('selection');
                    setModalVisible(true);
                    return;
                }

                const finalX = Math.min(Math.max(lastPos.current.x + gestureState.dx, minX), maxX);
                const finalY = Math.min(Math.max(lastPos.current.y + gestureState.dy, minY), maxY);

                lastPos.current = { x: finalX, y: finalY };
                pan.setValue({ x: finalX, y: finalY });
                savePosition(finalX, finalY);
            },
        })
    ).current;

    const resetPosition = () => {
        triggerHaptic('selection');
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
            mode: 'light',
            label: 'Light Mode',
            sub: 'Crisp paper tones & high contrast',
            icon: Sun,
        },
        {
            mode: 'dark',
            label: 'Dark Mode',
            sub: 'Deep obsidian & soft luminous teal',
            icon: Moon,
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
                            <View style={[styles.innerGlow, { backgroundColor: colors.primaryMuted }]}>
                                <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                                    <Settings size={20} color={colors.primary} strokeWidth={2} />
                                </Animated.View>
                            </View>

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
                                    <Sun size={10} color={colors.warning} />
                                ) : themeMode === 'dark' ? (
                                    <Moon size={10} color={colors.primary} />
                                ) : (
                                    <Sparkles size={10} color={colors.primary} />
                                )}
                            </View>
                        </View>
                    </Animated.View>
                </View>
            )}

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
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
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
                                        { backgroundColor: colors.primaryMuted },
                                    ]}
                                >
                                    <Palette size={18} color={colors.primary} strokeWidth={2} />
                                </View>
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                                        Appearance & Controls
                                    </Text>
                                    <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                                        Theme and floating dock settings
                                    </Text>
                                </View>
                            </View>
                            <AnimatedPressable
                                onPress={() => setModalVisible(false)}
                                style={[styles.closeBtn, { backgroundColor: colors.surfaceRaised }]}
                            >
                                <X size={18} color={colors.textMuted} strokeWidth={2} />
                            </AnimatedPressable>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Section: Theme Select */}
                            <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>
                                Color Theme
                            </Text>

                            <View style={styles.themeOptionsGrid}>
                                {themeOptions.map((opt) => {
                                    const isSelected = themeMode === opt.mode;
                                    const Icon = opt.icon;

                                    return (
                                        <AnimatedPressable
                                            key={opt.mode}
                                            style={[
                                                styles.themeCard,
                                                {
                                                    backgroundColor: isSelected
                                                        ? colors.primaryMuted
                                                        : colors.surfaceRaised,
                                                    borderColor: isSelected
                                                        ? colors.primary
                                                        : colors.border,
                                                },
                                            ]}
                                            onPress={() => {
                                                triggerHaptic('selection');
                                                setThemeMode(opt.mode);
                                            }}
                                        >
                                            <View style={styles.themeCardLeft}>
                                                <View
                                                    style={[
                                                        styles.themeIconWrapper,
                                                        {
                                                            backgroundColor: isSelected
                                                                ? colors.primary
                                                                : colors.surface,
                                                        },
                                                    ]}
                                                >
                                                    <Icon
                                                        size={16}
                                                        color={isSelected ? colors.textInverse : colors.textMuted}
                                                        strokeWidth={2}
                                                    />
                                                </View>
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text
                                                        style={[
                                                            styles.themeLabel,
                                                            { color: colors.text },
                                                            isSelected && { fontWeight: '700', color: colors.primary },
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
                                                        { backgroundColor: colors.primary },
                                                    ]}
                                                >
                                                    <Check size={13} color={colors.textInverse} strokeWidth={2.5} />
                                                </View>
                                            )}
                                        </AnimatedPressable>
                                    );
                                })}
                            </View>

                            {/* Section: Dynamic Movable Icon Helpers */}
                            <Text style={[styles.sectionTitle, { color: colors.textSubtle, marginTop: spacing.md }]}>
                                Moveable Settings Bubble
                            </Text>
                            <View
                                style={[
                                    styles.floatingInfoBox,
                                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                                ]}
                            >
                                <View style={styles.floatingInfoRow}>
                                    <Move size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 8 }} />
                                    <Text style={[styles.floatingInfoText, { color: colors.textSecondary }]}>
                                        You can drag and reposition this floating button anywhere on screen.
                                    </Text>
                                </View>
                                <AnimatedPressable
                                    style={[
                                        styles.resetPosBtn,
                                        { borderColor: colors.border, backgroundColor: colors.surface },
                                    ]}
                                    onPress={resetPosition}
                                >
                                    <RotateCcw size={13} color={colors.textMuted} strokeWidth={2} style={{ marginRight: 6 }} />
                                    <Text style={[styles.resetPosText, { color: colors.textSecondary }]}>
                                        Reset to Bottom-Right
                                    </Text>
                                </AnimatedPressable>
                            </View>

                            {/* Section: Account */}
                            {currentUser && (
                                <>
                                    <Text
                                        style={[
                                            styles.sectionTitle,
                                            { color: colors.textSubtle, marginTop: spacing.md },
                                        ]}
                                    >
                                        Active Account
                                    </Text>
                                    <View
                                        style={[
                                            styles.accountBox,
                                            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                                        ]}
                                    >
                                        <View style={styles.accountInfo}>
                                            <ShieldCheck size={18} color={colors.primary} strokeWidth={2} style={{ marginRight: 8 }} />
                                            <Text
                                                style={[styles.accountEmail, { color: colors.text }]}
                                                numberOfLines={1}
                                            >
                                                {currentUser.email || 'Guest Session'}
                                            </Text>
                                        </View>
                                        <AnimatedPressable
                                            style={[styles.signOutBtn, { backgroundColor: colors.dangerMuted }]}
                                            onPress={handleSignOut}
                                        >
                                            <LogOut size={13} color={colors.danger} strokeWidth={2} style={{ marginRight: 5 }} />
                                            <Text style={[styles.signOutText, { color: colors.danger }]}>
                                                Sign Out
                                            </Text>
                                        </AnimatedPressable>
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        <AnimatedPressable
                            style={[
                                styles.doneBtn,
                                { backgroundColor: colors.primary, ...shadows.glowAccent },
                            ]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={[styles.doneBtnText, { color: colors.textInverse }]}>Done</Text>
                        </AnimatedPressable>
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
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    innerGlow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
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
        maxWidth: 400,
        maxHeight: '85%',
        borderRadius: radii.sheets,
        borderWidth: 1,
        padding: 22,
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
        width: 38,
        height: 38,
        borderRadius: radii.controls,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: typography.sizes.md,
        fontWeight: '800',
    },
    modalSub: {
        fontSize: typography.sizes.xs,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    modalBody: {
        marginVertical: 4,
    },
    sectionTitle: {
        fontSize: 10.5,
        fontWeight: '800',
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
        borderRadius: radii.cards,
        borderWidth: 1.5,
    },
    themeCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    themeIconWrapper: {
        width: 34,
        height: 34,
        borderRadius: radii.controls,
        justifyContent: 'center',
        alignItems: 'center',
    },
    themeLabel: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
    themeSub: {
        fontSize: typography.sizes.xs - 1,
        marginTop: 2,
    },
    selectedBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    floatingInfoBox: {
        borderWidth: 1,
        borderRadius: radii.cards,
        padding: 12,
    },
    floatingInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    floatingInfoText: {
        fontSize: typography.sizes.xs,
        lineHeight: 18,
        flex: 1,
    },
    resetPosBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: radii.controls,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    resetPosText: {
        fontSize: typography.sizes.xs,
        fontWeight: '700',
    },
    accountBox: {
        borderWidth: 1,
        borderRadius: radii.cards,
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
        fontSize: typography.sizes.xs + 1,
        fontWeight: '700',
        flex: 1,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: radii.controls,
    },
    signOutText: {
        fontSize: typography.sizes.xs,
        fontWeight: '700',
    },
    doneBtn: {
        paddingVertical: 13,
        borderRadius: radii.controls,
        alignItems: 'center',
        marginTop: 12,
    },
    doneBtnText: {
        fontSize: typography.sizes.sm,
        fontWeight: '700',
    },
});

export default FloatingSettings;

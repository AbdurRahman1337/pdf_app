import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Keyboard,
    Animated,
    Dimensions,
    LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BookOpen,
    Layers,
    Award,
    MessageSquare,
    LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/tokens';

export type TabKey = 'library' | 'courses' | 'test' | 'tutor';

export interface TabItemData {
    key: TabKey;
    label: string;
    icon: LucideIcon;
    badge?: number;
}

export interface BottomTabBarProps {
    activeTab: TabKey;
    onSelectTab: (tab: TabKey) => void;
    dueFlashcardsCount?: number;
}

const BAR_HEIGHT = 64;
const CIRCLE_SIZE = 50;
const CIRCLE_RADIUS = CIRCLE_SIZE / 2; // 25
const CIRCLE_CENTER_Y = 10; // Center Y of circle in bar coordinates
const GAP = 7; // Concentric uniform gap around the circle
const NOTCH_RADIUS = CIRCLE_RADIUS + GAP; // 32 - exact circular arc radius
const SHOULDER_RADIUS = 10; // Outer tangent fillet radius
const CORNER_RADIUS = 20;

// Precalculated tangent geometry values
const R_SUM = NOTCH_RADIUS + SHOULDER_RADIUS; // 42
const DY = CIRCLE_CENTER_Y - SHOULDER_RADIUS; // 0
const XS = Math.sqrt(Math.max(0, R_SUM * R_SUM - DY * DY)); // 42
const UX = XS / R_SUM;
const UY = DY / R_SUM;

// Safe inset ensuring notch shoulder never collides with the corner arc
const MIN_CX_OFFSET = XS + CORNER_RADIUS + 6;

/**
 * Pure circular geometry: creates an exact circular arc notch cutout
 * concentric with the active button, joined with smooth G1-tangent shoulder arcs.
 */
function getPureCircularBarPath(width: number, height: number, cx: number): string {
    const R_corner = CORNER_RADIUS;
    const R_notch = NOTCH_RADIUS;
    const r_shoulder = SHOULDER_RADIUS;

    // Contact points between shoulder fillets and notch circle
    const x_c_l = cx - XS + r_shoulder * UX;
    const y_c_l = r_shoulder + r_shoulder * UY;
    const x_c_r = cx + XS - r_shoulder * UX;
    const y_c_r = r_shoulder + r_shoulder * UY;

    const x_top_l = cx - XS;
    const x_top_r = cx + XS;

    return [
        `M 0 ${R_corner}`,
        `A ${R_corner} ${R_corner} 0 0 1 ${R_corner} 0`,
        `L ${Math.max(R_corner, x_top_l).toFixed(2)} 0`,
        // Left convex shoulder fillet
        `A ${r_shoulder} ${r_shoulder} 0 0 1 ${x_c_l.toFixed(2)} ${y_c_l.toFixed(2)}`,
        // Pure circular concave scoop (exact concentric circle)
        `A ${R_notch} ${R_notch} 0 0 0 ${x_c_r.toFixed(2)} ${y_c_r.toFixed(2)}`,
        // Right convex shoulder fillet
        `A ${r_shoulder} ${r_shoulder} 0 0 1 ${Math.min(width - R_corner, x_top_r).toFixed(2)} 0`,
        `L ${width - R_corner} 0`,
        `A ${R_corner} ${R_corner} 0 0 1 ${width} ${R_corner}`,
        `L ${width} ${height - R_corner}`,
        `A ${R_corner} ${R_corner} 0 0 1 ${width - R_corner} ${height}`,
        `L ${R_corner} ${height}`,
        `A ${R_corner} ${R_corner} 0 0 1 0 ${height - R_corner}`,
        'Z',
    ].join(' ');
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
    activeTab,
    onSelectTab,
    dueFlashcardsCount = 0,
}) => {
    const { colors, isDark } = useTheme();

    let bottomInset = 0;
    try {
        const insets = useSafeAreaInsets();
        bottomInset = insets?.bottom || 0;
    } catch {
        bottomInset = Platform.OS === 'ios' ? 20 : 8;
    }

    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const screenWidth = Dimensions.get('window').width;
    const initialBarWidth = Math.max(screenWidth - 32, 280);
    const [barWidth, setBarWidth] = useState<number>(initialBarWidth);

    const tabs: TabItemData[] = useMemo(
        () => [
            { key: 'library', label: 'Library', icon: BookOpen },
            { key: 'courses', label: 'Course Hub', icon: Layers },
            {
                key: 'test',
                label: 'Exam Prep',
                icon: Award,
                badge: dueFlashcardsCount > 0 ? dueFlashcardsCount : undefined,
            },
            { key: 'tutor', label: 'AI Tutor', icon: MessageSquare },
        ],
        [dueFlashcardsCount]
    );

    const activeIndex = Math.max(
        0,
        tabs.findIndex((t) => t.key === activeTab)
    );

    // Compute exact center X for each tab ensuring no corner collision
    const getTabCenterX = (index: number, width: number) => {
        const minCx = Math.min(MIN_CX_OFFSET, width * 0.22);
        const maxCx = width - minCx;
        if (tabs.length <= 1) return width / 2;
        return minCx + (index / (tabs.length - 1)) * (maxCx - minCx);
    };

    const initialCenterX = getTabCenterX(activeIndex, initialBarWidth);

    // Animated values for smooth spring movement
    const animX = useRef(new Animated.Value(initialCenterX)).current;
    const animScale = useRef(new Animated.Value(1)).current;
    const iconFade = useRef(new Animated.Value(1)).current;
    const [currentNotchX, setCurrentNotchX] = useState<number>(initialCenterX);

    // Animated values for active border animation & ripple pulse
    const rippleScale = useRef(new Animated.Value(1)).current;
    const rippleOpacity = useRef(new Animated.Value(0)).current;
    const borderGlow = useRef(new Animated.Value(0)).current;
    const borderPulse = useRef(new Animated.Value(0)).current;

    // Ambient breathing glow loop on the active border
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(borderGlow, {
                    toValue: 1,
                    duration: 1800,
                    useNativeDriver: false,
                }),
                Animated.timing(borderGlow, {
                    toValue: 0,
                    duration: 1800,
                    useNativeDriver: false,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [borderGlow]);

    // Keep notch path updated synchronously with animation frame
    useEffect(() => {
        const listenerId = animX.addListener(({ value }) => {
            setCurrentNotchX(value);
        });
        return () => {
            animX.removeListener(listenerId);
        };
    }, [animX]);

    // Handle active tab transitions
    useEffect(() => {
        const targetX = getTabCenterX(activeIndex, barWidth);

        // Reset and trigger ripple pulse on tab change
        rippleScale.setValue(0.9);
        rippleOpacity.setValue(0.7);
        borderPulse.setValue(1);

        Animated.parallel([
            Animated.spring(animX, {
                toValue: targetX,
                damping: 18,
                stiffness: 160,
                mass: 0.9,
                useNativeDriver: false,
            }),
            Animated.sequence([
                Animated.timing(animScale, {
                    toValue: 0.88,
                    duration: 90,
                    useNativeDriver: false,
                }),
                Animated.spring(animScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 100,
                    useNativeDriver: false,
                }),
            ]),
            Animated.sequence([
                Animated.timing(iconFade, {
                    toValue: 0.3,
                    duration: 80,
                    useNativeDriver: false,
                }),
                Animated.timing(iconFade, {
                    toValue: 1,
                    duration: 160,
                    useNativeDriver: false,
                }),
            ]),
            // Ripple burst animation on active tab border
            Animated.timing(rippleScale, {
                toValue: 1.38,
                duration: 420,
                useNativeDriver: false,
            }),
            Animated.timing(rippleOpacity, {
                toValue: 0,
                duration: 420,
                useNativeDriver: false,
            }),
            // Border highlight pulse decay
            Animated.timing(borderPulse, {
                toValue: 0,
                duration: 400,
                useNativeDriver: false,
            }),
        ]).start();
    }, [activeIndex, barWidth]);

    // Listen to keyboard visibility to hide tab bar
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

    if (isKeyboardVisible) {
        return null;
    }

    const onLayout = (event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0 && Math.abs(width - barWidth) > 1) {
            setBarWidth(width);
            animX.setValue(getTabCenterX(activeIndex, width));
        }
    };

    const ActiveIcon = tabs[activeIndex]?.icon || BookOpen;
    const activeBadge = tabs[activeIndex]?.badge;
    const pathD = getPureCircularBarPath(barWidth, BAR_HEIGHT, currentNotchX);

    // Dynamic border color interpolation for the active button
    const animatedBorderColor = borderGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [
            isDark ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.35)',
            isDark ? 'rgba(52, 211, 153, 0.85)' : 'rgba(16, 185, 129, 0.80)',
        ],
    });

    const animatedBorderWidth = borderPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1.5, 2.5],
    });

    const styles = createStyles(colors, isDark, bottomInset);

    return (
        <View style={styles.container} pointerEvents="box-none">
            <View style={styles.barWrapper} onLayout={onLayout}>
                {/* SVG Curved Background Bar with Pure Circular Notch Cutout */}
                <Svg
                    width={barWidth}
                    height={BAR_HEIGHT}
                    style={styles.svgBackground}
                >
                    <Path
                        d={pathD}
                        fill={isDark ? colors.surface : '#FFFFFF'}
                        stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'}
                        strokeWidth={1}
                    />
                </Svg>

                {/* Floating Active Circle Button & Border Animation */}
                <Animated.View
                    style={[
                        styles.floatingCircleWrapper,
                        {
                            transform: [
                                {
                                    translateX: Animated.subtract(
                                        animX,
                                        CIRCLE_SIZE / 2
                                    ),
                                },
                            ],
                        },
                    ]}
                    pointerEvents="none"
                >
                    {/* Expanding Ripple Border Ring on Tab Selection */}
                    <Animated.View
                        style={[
                            styles.rippleRing,
                            {
                                borderColor: colors.accent,
                                transform: [{ scale: rippleScale }],
                                opacity: rippleOpacity,
                            },
                        ]}
                    />

                    {/* Active Floating Button with Animated Border & Glow */}
                    <Animated.View
                        style={[
                            styles.floatingCircle,
                            {
                                borderColor: animatedBorderColor,
                                borderWidth: animatedBorderWidth,
                                transform: [{ scale: animScale }],
                            },
                        ]}
                    >
                        <Animated.View
                            style={[
                                styles.circleInner,
                                { opacity: iconFade, transform: [{ scale: iconFade }] },
                            ]}
                        >
                            <ActiveIcon
                                size={24}
                                color={colors.accent}
                                strokeWidth={2.2}
                            />
                            {activeBadge && activeBadge > 0 ? (
                                <View style={styles.circleBadge}>
                                    <Text style={styles.badgeText}>
                                        {activeBadge > 99 ? '99+' : activeBadge}
                                    </Text>
                                </View>
                            ) : null}
                        </Animated.View>
                    </Animated.View>
                </Animated.View>

                {/* Inactive Tab Icon Slots and Touch Targets */}
                <View style={styles.tabsContainer} pointerEvents="box-none">
                    {tabs.map((tab, index) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        const tabCenterX = getTabCenterX(index, barWidth);
                        const tabItemWidth = Math.max(
                            48,
                            (barWidth - 2 * CORNER_RADIUS) / tabs.length
                        );

                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[
                                    styles.tabItem,
                                    {
                                        left: tabCenterX - tabItemWidth / 2,
                                        width: tabItemWidth,
                                    },
                                ]}
                                onPress={() => onSelectTab(tab.key)}
                                activeOpacity={0.7}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={`${tab.label} tab`}
                            >
                                <View
                                    style={[
                                        styles.iconSlot,
                                        isActive && styles.iconSlotHidden,
                                    ]}
                                >
                                    <Icon
                                        size={22}
                                        color={isDark ? '#94A3B8' : '#64748B'}
                                        strokeWidth={1.8}
                                    />
                                    {tab.badge && tab.badge > 0 ? (
                                        <View style={styles.slotBadge}>
                                            <Text style={styles.badgeText}>
                                                {tab.badge > 99 ? '99+' : tab.badge}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors: ThemeColors, isDark: boolean, bottomInset: number) =>
    StyleSheet.create({
        container: {
            position: 'absolute',
            bottom: Math.max(bottomInset, 0) + (Platform.OS === 'ios' ? 24 : 20),
            left: 16,
            right: 16,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
        },
        barWrapper: {
            width: '100%',
            height: BAR_HEIGHT,
            position: 'relative',
            ...Platform.select({
                ios: {
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDark ? 0.4 : 0.1,
                    shadowRadius: 16,
                },
                android: {
                    elevation: 8,
                },
                default: {
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 14,
                },
            }),
        },
        svgBackground: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        floatingCircleWrapper: {
            position: 'absolute',
            top: CIRCLE_CENTER_Y - CIRCLE_RADIUS, // 10 - 25 = -15
            left: 0,
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
        },
        rippleRing: {
            position: 'absolute',
            width: CIRCLE_SIZE + 6,
            height: CIRCLE_SIZE + 6,
            borderRadius: (CIRCLE_SIZE + 6) / 2,
            borderWidth: 2,
            zIndex: 1,
        },
        floatingCircle: {
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_RADIUS,
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            ...Platform.select({
                ios: {
                    shadowColor: colors.accent,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.45 : 0.22,
                    shadowRadius: 8,
                },
                android: {
                    elevation: 8,
                },
                default: {
                    shadowColor: colors.accent,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                },
            }),
        },
        circleInner: {
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            position: 'relative',
        },
        tabsContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            height: BAR_HEIGHT,
            zIndex: 5,
        },
        tabItem: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            height: BAR_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 6,
        },
        iconSlot: {
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            position: 'relative',
        },
        iconSlotHidden: {
            opacity: 0,
        },
        circleBadge: {
            position: 'absolute',
            top: 1,
            right: 1,
            backgroundColor: colors.danger || '#EF4444',
            borderRadius: 9,
            paddingHorizontal: 4,
            paddingVertical: 1,
            minWidth: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: isDark ? colors.surface : '#FFFFFF',
        },
        slotBadge: {
            position: 'absolute',
            top: -3,
            right: -6,
            backgroundColor: colors.danger || '#EF4444',
            borderRadius: 8,
            paddingHorizontal: 4,
            paddingVertical: 1,
            minWidth: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        badgeText: {
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '700',
            textAlign: 'center',
        },
    });

export default BottomTabBar;

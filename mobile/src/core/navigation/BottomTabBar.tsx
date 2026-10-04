import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Platform,
    Keyboard,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BookOpen,
    Layers,
    Award,
    MessageSquare,
} from 'lucide-react-native';
import { useTheme, TabKey } from '../theme/ThemeContext';
import { ThemeColors } from '../theme/tokens';
import { motion, triggerHaptic, getIsReducedMotion } from '../theme/motion';
import { AnimatedPressable } from '../components/AnimatedPressable';

export type { TabKey };

export interface BottomTabBarProps {
    activeTab: TabKey;
    onSelectTab: (tab: TabKey) => void;
    dueFlashcardsCount?: number;
}

const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: 'library', label: 'Library', icon: BookOpen },
    { key: 'courses', label: 'Course Hub', icon: Layers },
    { key: 'test', label: 'Exam Prep', icon: Award },
    { key: 'tutor', label: 'AI Tutor', icon: MessageSquare },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
    activeTab,
    onSelectTab,
    dueFlashcardsCount = 0,
}) => {
    const { colors, shadows, radii, typography, getTabAccent, isDark } = useTheme();
    let bottomInset = 0;
    try {
        const insets = useSafeAreaInsets();
        bottomInset = insets?.bottom || 0;
    } catch {
        bottomInset = Platform.OS === 'ios' ? 20 : 8;
    }

    const styles = createStyles(colors, radii, typography, bottomInset);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // Active Tab animated index for sliding indicator pill
    const activeIndex = TABS.findIndex((t) => t.key === activeTab);
    const indicatorAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

    // Pop animation values for each tab icon
    const popAnims = useRef(TABS.map(() => new Animated.Value(1))).current;

    useEffect(() => {
        const targetIndex = TABS.findIndex((t) => t.key === activeTab);
        if (targetIndex >= 0) {
            if (getIsReducedMotion()) {
                indicatorAnim.setValue(targetIndex);
            } else {
                Animated.spring(indicatorAnim, {
                    toValue: targetIndex,
                    ...motion.springs.tabIndicator,
                    useNativeDriver: false,
                }).start();
            }

            // Trigger Icon pop spring on the selected tab
            const targetPop = popAnims[targetIndex];
            if (targetPop && !getIsReducedMotion()) {
                targetPop.setValue(0.8);
                Animated.spring(targetPop, {
                    toValue: 1,
                    ...motion.springs.pop,
                    useNativeDriver: true,
                }).start();
            }
        }
    }, [activeTab]);

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

    const activeAccent = getTabAccent(activeTab);

    return (
        <View style={styles.tabBarContainer} pointerEvents="box-none">
            <View style={[styles.bar, shadows.elevated]}>
                {TABS.map((tab, idx) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    const tabAccent = getTabAccent(tab.key);
                    const popScale = popAnims[idx];

                    return (
                        <AnimatedPressable
                            key={tab.key}
                            style={[
                                styles.tabItem,
                                isActive && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' },
                            ]}
                            onPress={() => {
                                if (tab.key !== activeTab) {
                                    triggerHaptic('selection');
                                    onSelectTab(tab.key);
                                }
                            }}
                            scaleTo={0.94}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={`${tab.label} tab`}
                        >
                            <Animated.View
                                style={[
                                    styles.iconWrapper,
                                    { transform: [{ scale: isActive ? popScale : 1 }] },
                                ]}
                            >
                                <Icon
                                    size={21}
                                    color={isActive ? tabAccent : colors.textMuted}
                                    strokeWidth={isActive ? 2.2 : 1.75}
                                />
                                {tab.key === 'courses' && dueFlashcardsCount > 0 ? (
                                    <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                                        <Text style={styles.badgeText}>
                                            {dueFlashcardsCount > 99 ? '99+' : dueFlashcardsCount}
                                        </Text>
                                    </View>
                                ) : null}
                            </Animated.View>

                            <Text
                                style={[
                                    styles.tabLabel,
                                    { color: isActive ? tabAccent : colors.textMuted },
                                    isActive && styles.tabLabelActive,
                                ]}
                                numberOfLines={1}
                            >
                                {tab.label}
                            </Text>

                            {/* Active Tab Underline/Pill dot indicator */}
                            {isActive && (
                                <View
                                    style={[
                                        styles.activeDot,
                                        { backgroundColor: tabAccent },
                                    ]}
                                />
                            )}
                        </AnimatedPressable>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (
    colors: ThemeColors,
    radii: any,
    typography: any,
    bottomInset: number
) =>
    StyleSheet.create({
        tabBarContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'transparent',
            paddingHorizontal: 12,
            paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 14 : 10),
        },
        bar: {
            flexDirection: 'row',
            height: 64,
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: radii.cards + 4,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 6,
        },
        tabItem: {
            flex: 1,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
            borderRadius: radii.cards,
            position: 'relative',
        },
        iconWrapper: {
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            height: 24,
            width: 24,
        },
        tabLabel: {
            fontSize: typography.sizes.xs - 1,
            fontWeight: '600',
            marginTop: 4,
            textAlign: 'center',
            letterSpacing: 0.1,
        },
        tabLabelActive: {
            fontWeight: '700',
        },
        activeDot: {
            position: 'absolute',
            bottom: 4,
            width: 4,
            height: 4,
            borderRadius: 2,
        },
        badge: {
            position: 'absolute',
            top: -4,
            right: -10,
            borderRadius: 8,
            paddingHorizontal: 4,
            paddingVertical: 1,
            minWidth: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        badgeText: {
            color: '#FFFFFF',
            fontSize: 8.5,
            fontWeight: '800',
        },
    });

export default BottomTabBar;

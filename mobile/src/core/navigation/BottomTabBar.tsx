import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BookOpen,
    Layers,
    Award,
    MessageSquare,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors, radii, darkShadows } from '../theme/tokens';

export type TabKey = 'library' | 'courses' | 'test' | 'tutor';

export interface BottomTabBarProps {
    activeTab: TabKey;
    onSelectTab: (tab: TabKey) => void;
    dueFlashcardsCount?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
    activeTab,
    onSelectTab,
    dueFlashcardsCount = 0,
}) => {
    const { colors, shadows } = useTheme();
    let bottomInset = 0;
    try {
        const insets = useSafeAreaInsets();
        bottomInset = insets?.bottom || 0;
    } catch {
        bottomInset = Platform.OS === 'ios' ? 20 : 8;
    }
    const styles = createStyles(colors, shadows, bottomInset);
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

    if (isKeyboardVisible) {
        return null;
    }

    const tabs: { key: TabKey; label: string; icon: any; badge?: number }[] = [
        { key: 'library', label: 'Library', icon: BookOpen },
        { key: 'courses', label: 'Course Hub', icon: Layers },
        { key: 'test', label: 'Exam Prep', icon: Award },
        { key: 'tutor', label: 'AI Tutor', icon: MessageSquare },
    ];

    return (
        <View style={styles.tabBarContainer}>
            <View style={styles.bar}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;

                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabItem, isActive && styles.tabItemActive]}
                            onPress={() => onSelectTab(tab.key)}
                            activeOpacity={0.75}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={`${tab.label} tab`}
                        >
                            <View style={styles.iconWrapper}>
                                <Icon
                                    size={20}
                                    color={isActive ? colors.accent : colors.textMuted}
                                    strokeWidth={1.5}
                                />
                                {tab.badge && tab.badge > 0 ? (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {tab.badge > 99 ? '99+' : tab.badge}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text
                                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                                numberOfLines={1}
                            >
                                {tab.label}
                            </Text>
                            {isActive && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows, bottomInset: number) =>
    StyleSheet.create({
        tabBarContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 16 : 8),
            zIndex: 100,
        },
        bar: {
            flexDirection: 'row',
            height: 56,
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: 8,
        },
        tabItem: {
            flex: 1,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
            paddingHorizontal: 2,
            position: 'relative',
        },
        tabItemActive: {},
        iconWrapper: {
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            height: 24,
            width: 24,
        },
        tabLabel: {
            fontSize: 11,
            fontWeight: '500',
            color: colors.textMuted,
            marginTop: 3,
            textAlign: 'center',
            letterSpacing: 0.1,
        },
        tabLabelActive: {
            color: colors.accent,
            fontWeight: '600',
        },
        activeIndicator: {
            position: 'absolute',
            top: 0,
            width: 24,
            height: 2,
            borderRadius: 1,
            backgroundColor: colors.accent,
        },
        badge: {
            position: 'absolute',
            top: -3,
            right: -8,
            backgroundColor: colors.accent,
            borderRadius: 8,
            paddingHorizontal: 4,
            paddingVertical: 1,
            minWidth: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        badgeText: {
            color: colors.textInverse,
            fontSize: 9,
            fontWeight: '700',
        },
    });

export default BottomTabBar;

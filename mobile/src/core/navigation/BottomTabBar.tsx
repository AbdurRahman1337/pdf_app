import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import {
    FileText,
    BookOpen,
    Headphones,
    GraduationCap,
    MessageSquare,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors, typography, radii, darkShadows } from '../theme/tokens';

export type TabKey = 'library' | 'flashcards' | 'audio' | 'quizzes' | 'tutor';

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
    const styles = createStyles(colors, shadows);

    const tabs: { key: TabKey; label: string; icon: any; badge?: number }[] = [
        { key: 'library', label: 'Library', icon: FileText },
        { key: 'flashcards', label: 'Flashcards', icon: BookOpen, badge: dueFlashcardsCount },
        { key: 'audio', label: 'Audio & Notes', icon: Headphones },
        { key: 'quizzes', label: 'Quizzes', icon: GraduationCap },
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
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconWrapper}>
                                <Icon
                                    size={20}
                                    color={isActive ? colors.accent : colors.textSubtle}
                                    strokeWidth={isActive ? 2.3 : 1.8}
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
                            {isActive && <View style={styles.activeDot} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (colors: ThemeColors, shadows: typeof darkShadows) =>
    StyleSheet.create({
        tabBarContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'transparent',
            paddingHorizontal: 12,
            paddingBottom: Platform.OS === 'ios' ? 24 : 12,
            zIndex: 100,
        },
        bar: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceRaised,
            borderRadius: radii.xxl || 24,
            borderWidth: 1,
            borderColor: colors.borderLight,
            paddingVertical: 8,
            paddingHorizontal: 4,
            alignItems: 'center',
            justifyContent: 'space-around',
            ...shadows.modal,
        },
        tabItem: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
            position: 'relative',
        },
        tabItemActive: {},
        iconWrapper: {
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
            height: 24,
        },
        tabLabel: {
            fontSize: 10,
            fontWeight: '600',
            color: colors.textSubtle,
            marginTop: 4,
        },
        tabLabelActive: {
            color: colors.accent,
            fontWeight: '800',
        },
        activeDot: {
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.accent,
            marginTop: 2,
        },
        badge: {
            position: 'absolute',
            top: -4,
            right: -10,
            backgroundColor: colors.accent,
            borderRadius: 8,
            paddingHorizontal: 4,
            paddingVertical: 1,
            minWidth: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        badgeText: {
            color: colors.textInverse,
            fontSize: 8,
            fontWeight: '800',
        },
    });

export default BottomTabBar;


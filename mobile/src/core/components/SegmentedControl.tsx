import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Animated,
    LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { motion, triggerHaptic, getIsReducedMotion } from '../theme/motion';

export interface SegmentOption<T extends string = string> {
    key: T;
    label: string;
    icon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
    badgeCount?: number;
}

interface SegmentedControlProps<T extends string = string> {
    options: SegmentOption<T>[];
    selectedKey: T;
    onSelect: (key: T) => void;
    activeColor?: string;
    style?: any;
    scrollable?: boolean;
}

export function SegmentedControl<T extends string = string>({
    options,
    selectedKey,
    onSelect,
    activeColor,
    style,
    scrollable,
}: SegmentedControlProps<T>) {
    const { colors, typography, radii, shadows } = useTheme();
    const effectiveActiveColor = activeColor || colors.primary;

    const isScrollable = scrollable !== undefined ? scrollable : options.length > 3;

    const handleSelect = (key: T) => {
        if (key !== selectedKey) {
            triggerHaptic('selection');
            onSelect(key);
        }
    };

    const renderOption = (opt: SegmentOption<T>, isScroll: boolean) => {
        const isSelected = opt.key === selectedKey;
        const IconComponent = opt.icon;

        return (
            <TouchableOpacity
                key={opt.key}
                style={[
                    isScroll ? styles.scrollSegment : styles.segment,
                    { borderRadius: radii.controls },
                    isSelected && {
                        backgroundColor: effectiveActiveColor,
                        ...shadows.glowAccent,
                    },
                ]}
                onPress={() => handleSelect(opt.key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
            >
                {IconComponent && (
                    <IconComponent
                        size={15}
                        color={isSelected ? colors.textInverse : colors.textMuted}
                        strokeWidth={isSelected ? 2 : 1.75}
                    />
                )}
                <Text
                    style={[
                        styles.label,
                        {
                            fontSize: isScroll ? typography.sizes.xs + 1 : typography.sizes.sm,
                            color: isSelected ? colors.textInverse : colors.textMuted,
                            fontWeight: isSelected ? '700' : '500',
                            marginLeft: IconComponent ? 6 : 0,
                        },
                    ]}
                    numberOfLines={1}
                >
                    {opt.label}
                </Text>
                {opt.badgeCount !== undefined && opt.badgeCount > 0 && (
                    <View
                        style={[
                            styles.badge,
                            {
                                backgroundColor: isSelected
                                    ? 'rgba(0, 0, 0, 0.25)'
                                    : colors.surfaceHover,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                {
                                    fontSize: typography.sizes.xs - 1,
                                    color: isSelected ? colors.textInverse : colors.textMuted,
                                },
                            ]}
                        >
                            {opt.badgeCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (isScrollable) {
        return (
            <View
                style={[
                    styles.container,
                    {
                        backgroundColor: colors.surfaceRaised,
                        borderColor: colors.border,
                        borderRadius: radii.cards,
                    },
                    style,
                ]}
            >
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {options.map((opt) => renderOption(opt, true))}
                </ScrollView>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    borderRadius: radii.cards,
                },
                style,
            ]}
        >
            {options.map((opt) => renderOption(opt, false))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 4,
        borderWidth: 1,
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        paddingHorizontal: 8,
        minHeight: 40,
    },
    scrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scrollSegment: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginRight: 4,
        minHeight: 38,
    },
    label: {
        letterSpacing: 0.1,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 9999,
        marginLeft: 6,
    },
    badgeText: {
        fontWeight: '700',
    },
});

export default SegmentedControl;

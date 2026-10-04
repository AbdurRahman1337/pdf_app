import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface SegmentOption<T extends string = string> {
    key: T;
    label: string;
    icon?: React.ComponentType<{ size: number; color: string }>;
    badgeCount?: number;
}

interface SegmentedControlProps<T extends string = string> {
    options: SegmentOption<T>[];
    selectedKey: T;
    onSelect: (key: T) => void;
    style?: any;
    scrollable?: boolean;
}

export function SegmentedControl<T extends string = string>({
    options,
    selectedKey,
    onSelect,
    style,
    scrollable,
}: SegmentedControlProps<T>) {
    const { colors, typography, radii, shadows } = useTheme();

    const isScrollable = scrollable !== undefined ? scrollable : options.length > 2;

    const renderOption = (opt: SegmentOption<T>, isScroll: boolean) => {
        const isSelected = opt.key === selectedKey;
        const IconComponent = opt.icon;

        return (
            <TouchableOpacity
                key={opt.key}
                style={[
                    isScroll ? styles.scrollSegment : styles.segment,
                    { borderRadius: radii.sm },
                    isSelected && {
                        backgroundColor: colors.accent,
                        ...shadows.glowAccent,
                    },
                ]}
                onPress={() => onSelect(opt.key)}
                activeOpacity={0.7}
            >
                {IconComponent && (
                    <IconComponent
                        size={14}
                        color={isSelected ? colors.textInverse : colors.textMuted}
                    />
                )}
                <Text
                    style={[
                        styles.label,
                        {
                            fontSize: isScroll ? (typography.sizes.xs + 1) : typography.sizes.sm,
                            color: isSelected ? colors.textInverse : colors.textMuted,
                            marginLeft: IconComponent ? 6 : 0,
                        },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {opt.label}
                </Text>
                {opt.badgeCount !== undefined && (
                    <View
                        style={[
                            styles.badge,
                            {
                                backgroundColor: isSelected
                                    ? 'rgba(0, 0, 0, 0.2)'
                                    : colors.surfaceHover,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                {
                                    fontSize: typography.sizes.xs,
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
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                        borderRadius: radii.md,
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
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                    borderRadius: radii.md,
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
    },
    label: {
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 9999,
        marginLeft: 6,
    },
    badgeText: {
        fontWeight: '700',
    },
});

export default SegmentedControl;

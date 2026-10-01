import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
}

export function SegmentedControl<T extends string = string>({
    options,
    selectedKey,
    onSelect,
    style,
}: SegmentedControlProps<T>) {
    const { colors, typography, radii, shadows } = useTheme();

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
            {options.map((opt) => {
                const isSelected = opt.key === selectedKey;
                const IconComponent = opt.icon;

                return (
                    <TouchableOpacity
                        key={opt.key}
                        style={[
                            styles.segment,
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
                                size={15}
                                color={isSelected ? colors.textInverse : colors.textMuted}
                            />
                        )}
                        <Text
                            style={[
                                styles.label,
                                {
                                    fontSize: typography.sizes.sm,
                                    color: isSelected ? colors.textInverse : colors.textMuted,
                                },
                                IconComponent ? { marginLeft: 6 } : null,
                            ]}
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
            })}
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
        paddingHorizontal: 12,
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

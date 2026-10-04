import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    StyleProp,
    ViewStyle,
    LayoutChangeEvent,
    Text,
    TextStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import AnimatedPressable from './AnimatedPressable';
import { radii, typography, lightShadows } from '../theme/tokens';

export interface GradientViewProps {
    colors: readonly [string, string] | readonly string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    style?: StyleProp<ViewStyle>;
    borderRadius?: number;
    children?: React.ReactNode;
}

export const GradientView: React.FC<GradientViewProps> = ({
    colors,
    start = { x: 0, y: 0 },
    end = { x: 1, y: 1 },
    style,
    borderRadius = 0,
    children,
}) => {
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const handleLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
    };

    const gradientId = `grad_${(colors[0] || '').replace('#', '')}_${(colors[1] || '').replace('#', '')}`;

    return (
        <View
            style={[
                styles.container,
                { borderRadius, overflow: 'hidden' },
                style,
            ]}
            onLayout={handleLayout}
        >
            {layout.width > 0 && layout.height > 0 && (
                <Svg
                    width={layout.width}
                    height={layout.height}
                    style={StyleSheet.absoluteFill}
                >
                    <Defs>
                        <LinearGradient
                            id={gradientId}
                            x1={`${start.x * 100}%`}
                            y1={`${start.y * 100}%`}
                            x2={`${end.x * 100}%`}
                            y2={`${end.y * 100}%`}
                        >
                            <Stop offset="0%" stopColor={colors[0]} stopOpacity="1" />
                            <Stop offset="100%" stopColor={colors[colors.length - 1]} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    <Rect
                        x="0"
                        y="0"
                        width={layout.width}
                        height={layout.height}
                        fill={`url(#${gradientId})`}
                        rx={borderRadius}
                        ry={borderRadius}
                    />
                </Svg>
            )}
            {children}
        </View>
    );
};

export interface GradientButtonProps {
    colors: readonly [string, string] | readonly string[];
    title: string;
    icon?: React.ReactNode;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    borderRadius?: number;
    disabled?: boolean;
    loading?: boolean;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
    colors,
    title,
    icon,
    onPress,
    style,
    textStyle,
    borderRadius = radii.controls,
    disabled = false,
    loading = false,
}) => {
    return (
        <AnimatedPressable
            onPress={onPress}
            disabled={disabled || loading}
            hapticFeedback={true}
            hapticType="selection"
            style={[styles.btnWrapper, style]}
        >
            <GradientView
                colors={colors}
                borderRadius={borderRadius}
                style={[styles.btnInner, lightShadows.glowAccent]}
            >
                {icon && <View style={styles.btnIcon}>{icon}</View>}
                <Text style={[styles.btnText, textStyle]}>
                    {title}
                </Text>
            </GradientView>
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    btnWrapper: {
        alignSelf: 'stretch',
    },
    btnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        paddingHorizontal: 20,
        minHeight: 48,
    },
    btnIcon: {
        marginRight: 8,
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.sm + 1,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default GradientView;

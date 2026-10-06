import React, { useRef } from 'react';
import {
    Animated,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
    TouchableWithoutFeedback,
    View,
    Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radii, typography } from '../theme/tokens';

export type TactileButtonVariant = 'primary' | 'secondary' | 'blue' | 'gold' | 'danger' | 'ghost';
export type TactileButtonSize = 'sm' | 'md' | 'lg';

export interface TactileButtonProps {
    title: string;
    onPress: () => void;
    variant?: TactileButtonVariant;
    size?: TactileButtonSize;
    icon?: React.ComponentType<{ size: number; color: string; style?: any }>;
    iconRight?: React.ComponentType<{ size: number; color: string; style?: any }>;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    accessibilityLabel?: string;
}

export const TactileButton: React.FC<TactileButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon: IconComponent,
    iconRight: IconRightComponent,
    disabled = false,
    loading = false,
    fullWidth = false,
    style,
    textStyle,
    accessibilityLabel,
}) => {
    const { colors, isDark } = useTheme();
    const pressAnim = useRef(new Animated.Value(0)).current;

    const edgeHeight = size === 'sm' ? 3 : 4;

    const handlePressIn = () => {
        if (disabled || loading || variant === 'ghost') return;
        Animated.timing(pressAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (disabled || loading || variant === 'ghost') return;
        Animated.timing(pressAnim, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
        }).start();
    };

    // Calculate colors based on variant
    let bgColor = colors.accent;
    let edgeColor = colors.buttonEdge;
    let textColor = colors.textInverse;
    let borderColor = 'transparent';
    let borderWidth = 0;

    if (variant === 'secondary') {
        bgColor = colors.surface;
        edgeColor = isDark ? colors.border : colors.buttonSecondaryEdge;
        textColor = colors.text;
        borderColor = colors.border;
        borderWidth = 1.5;
    } else if (variant === 'blue') {
        bgColor = colors.blue;
        edgeColor = colors.buttonBlueEdge;
        textColor = colors.textInverse;
    } else if (variant === 'gold') {
        bgColor = colors.gold;
        edgeColor = colors.buttonGoldEdge;
        textColor = colors.textInverse;
    } else if (variant === 'danger') {
        bgColor = colors.danger;
        edgeColor = colors.buttonDangerEdge;
        textColor = colors.textInverse;
    } else if (variant === 'ghost') {
        bgColor = 'transparent';
        edgeColor = 'transparent';
        textColor = colors.accent;
    }

    if (disabled) {
        bgColor = isDark ? colors.surfaceRaised : '#E2E8F0';
        edgeColor = 'transparent';
        textColor = isDark ? colors.textSubtle : '#94A3B8';
        borderColor = 'transparent';
        borderWidth = 0;
    }

    // Size parameters
    const height = size === 'sm' ? 40 : size === 'lg' ? 54 : 48;
    const paddingHorizontal = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;
    const fontSize = size === 'sm' ? typography.sizes.xs : size === 'lg' ? typography.sizes.md : typography.sizes.sm;
    const iconSize = size === 'sm' ? 15 : size === 'lg' ? 20 : 18;

    const translateY = pressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, edgeHeight],
    });

    return (
        <TouchableWithoutFeedback
            onPress={disabled || loading ? undefined : onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityState={{ disabled: disabled || loading }}
        >
            <View
                style={[
                    styles.container,
                    {
                        height: height + (variant === 'ghost' || disabled ? 0 : edgeHeight),
                        width: fullWidth ? '100%' : undefined,
                    },
                    style,
                ]}
            >
                {/* 3D Bottom Edge Shadow */}
                {!disabled && variant !== 'ghost' && (
                    <View
                        style={[
                            styles.edge,
                            {
                                height: height,
                                backgroundColor: edgeColor,
                                borderRadius: radii.lg,
                                top: edgeHeight,
                            },
                        ]}
                    />
                )}

                {/* Tactile Face */}
                <Animated.View
                    style={[
                        styles.face,
                        {
                            height,
                            backgroundColor: bgColor,
                            borderRadius: radii.lg,
                            paddingHorizontal,
                            borderColor,
                            borderWidth,
                            transform: [{ translateY: disabled || variant === 'ghost' ? 0 : translateY }],
                        },
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={textColor} />
                    ) : (
                        <View style={styles.contentRow}>
                            {IconComponent && (
                                <IconComponent
                                    size={iconSize}
                                    color={textColor}
                                    style={{ marginRight: 8 }}
                                />
                            )}
                            <Text
                                style={[
                                    styles.titleText,
                                    {
                                        color: textColor,
                                        fontSize,
                                        fontWeight: '800',
                                    },
                                    textStyle,
                                ]}
                                numberOfLines={1}
                            >
                                {title}
                            </Text>
                            {IconRightComponent && (
                                <IconRightComponent
                                    size={iconSize}
                                    color={textColor}
                                    style={{ marginLeft: 8 }}
                                />
                            )}
                        </View>
                    )}
                </Animated.View>
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        justifyContent: 'flex-start',
    },
    edge: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    face: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleText: {
        textAlign: 'center',
        letterSpacing: 0.3,
    },
});

export default TactileButton;

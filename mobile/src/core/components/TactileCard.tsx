import React, { useRef } from 'react';
import {
    Animated,
    StyleSheet,
    ViewStyle,
    TouchableWithoutFeedback,
    View,
    Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radii } from '../theme/tokens';

export interface TactileCardProps {
    children: React.ReactNode;
    onPress?: () => void;
    selected?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
    variant?: 'default' | 'accent' | 'blue' | 'gold' | 'danger';
    edgeHeight?: number;
    accessibilityRole?: 'button' | 'none';
    accessibilityLabel?: string;
}

export const TactileCard: React.FC<TactileCardProps> = ({
    children,
    onPress,
    selected = false,
    disabled = false,
    style,
    contentStyle,
    variant = 'default',
    edgeHeight = 3,
    accessibilityRole,
    accessibilityLabel,
}) => {
    const { colors, isDark } = useTheme();
    const pressAnim = useRef(new Animated.Value(0)).current;

    const isInteractive = Boolean(onPress) && !disabled;

    const handlePressIn = () => {
        if (!isInteractive) return;
        Animated.timing(pressAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        if (!isInteractive) return;
        Animated.timing(pressAnim, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
        }).start();
    };

    const translateY = pressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, edgeHeight],
    });

    // Default styles
    let bgColor = colors.surface;
    let borderColor = colors.border;
    let edgeColor = isDark ? colors.border : colors.cardEdge;

    if (selected) {
        if (variant === 'accent' || variant === 'default') {
            bgColor = colors.accentMuted;
            borderColor = colors.accent;
            edgeColor = colors.buttonEdge;
        } else if (variant === 'blue') {
            bgColor = colors.blueMuted;
            borderColor = colors.blue;
            edgeColor = colors.buttonBlueEdge;
        } else if (variant === 'gold') {
            bgColor = colors.goldMuted;
            borderColor = colors.gold;
            edgeColor = colors.buttonGoldEdge;
        } else if (variant === 'danger') {
            bgColor = colors.dangerMuted;
            borderColor = colors.danger;
            edgeColor = colors.buttonDangerEdge;
        }
    }

    const cardContent = (
        <View style={[styles.container, style]}>
            {/* 3D Edge layer */}
            {isInteractive && (
                <View
                    style={[
                        styles.edge,
                        {
                            backgroundColor: edgeColor,
                            borderRadius: radii.xl,
                            top: edgeHeight,
                        },
                    ]}
                />
            )}

            {/* Front Card Face */}
            <Animated.View
                style={[
                    styles.face,
                    {
                        backgroundColor: bgColor,
                        borderColor,
                        borderRadius: radii.xl,
                        transform: [{ translateY: isInteractive ? translateY : 0 }],
                    },
                    contentStyle,
                ]}
            >
                {children}
            </Animated.View>
        </View>
    );

    if (!isInteractive) {
        return cardContent;
    }

    return (
        <TouchableWithoutFeedback
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole={accessibilityRole || 'button'}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected, disabled }}
        >
            {cardContent}
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        width: '100%',
        marginBottom: 8,
    },
    edge: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: 3,
    },
    face: {
        width: '100%',
        borderWidth: 2,
        padding: 16,
    },
});

export default TactileCard;

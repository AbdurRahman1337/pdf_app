import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export interface TypingDotsProps {
    dotSize?: number;
    color?: string;
}

export const TypingDots: React.FC<TypingDotsProps> = ({ dotSize = 8, color }) => {
    const { colors } = useTheme();
    const dotColor = color || colors.accent;

    const anim1 = useRef(new Animated.Value(0)).current;
    const anim2 = useRef(new Animated.Value(0)).current;
    const anim3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createBounce = (anim: Animated.Value, delay: number) => {
            return Animated.sequence([
                Animated.delay(delay),
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: -6,
                            duration: 250,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: 250,
                            useNativeDriver: true,
                        }),
                        Animated.delay(300),
                    ])
                ),
            ]);
        };

        const b1 = createBounce(anim1, 0);
        const b2 = createBounce(anim2, 140);
        const b3 = createBounce(anim3, 280);

        b1.start();
        b2.start();
        b3.start();

        return () => {
            b1.stop();
            b2.stop();
            b3.stop();
        };
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: dotColor,
                        transform: [{ translateY: anim1 }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: dotColor,
                        transform: [{ translateY: anim2 }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: dotColor,
                        transform: [{ translateY: anim3 }],
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    dot: {
        opacity: 0.85,
    },
});

export default TypingDots;

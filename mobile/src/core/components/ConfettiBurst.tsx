import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { motion, getIsReducedMotion } from '../theme/motion';

interface ConfettiPieceProps {
    x: number;
    delay: number;
    color: string;
    size: number;
}

const ConfettiPiece: React.FC<ConfettiPieceProps> = ({ x, delay, color, size }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const rotate = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (getIsReducedMotion()) return;

        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: 260 + Math.random() * 80,
                    duration: motion.durations.celebratory + Math.random() * 300,
                    easing: motion.easings.easeOutCubic,
                    useNativeDriver: true,
                }),
                Animated.timing(rotate, {
                    toValue: 1,
                    duration: motion.durations.celebratory + Math.random() * 300,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.delay(motion.durations.celebratory / 2),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        ]).start();
    }, []);

    const rotateInterpolation = rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360)}deg`],
    });

    return (
        <Animated.View
            style={[
                styles.piece,
                {
                    left: `${x}%`,
                    width: size,
                    height: size * (Math.random() > 0.5 ? 1.5 : 0.8),
                    backgroundColor: color,
                    borderRadius: Math.random() > 0.5 ? size / 2 : 2,
                    opacity,
                    transform: [
                        { translateY },
                        { rotate: rotateInterpolation },
                    ],
                },
            ]}
        />
    );
};

export const ConfettiBurst: React.FC<{ active?: boolean }> = ({ active = true }) => {
    if (!active || getIsReducedMotion()) return null;

    const colors = ['#0D9488', '#FF6B57', '#FFC857', '#2F6FED', '#7C5CFA', '#16A34A'];
    const count = 36;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {Array.from({ length: count }).map((_, i) => (
                <ConfettiPiece
                    key={i}
                    x={5 + (i * 90) / count}
                    delay={Math.random() * 200}
                    color={colors[i % colors.length]}
                    size={6 + Math.random() * 6}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    piece: {
        position: 'absolute',
        top: -10,
    },
});

export default ConfettiBurst;

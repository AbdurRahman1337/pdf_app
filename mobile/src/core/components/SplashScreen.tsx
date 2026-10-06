import React, { useEffect, useRef } from 'react';
import {
    View,
    Image,
    Text,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
    message?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
    message = 'Loading Lecta AI...',
}) => {
    const pulseAnim = useRef(new Animated.Value(0.4)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Fade in container
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();

        // Pulsing glow for the buffering indicator
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulseLoop.start();

        return () => pulseLoop.stop();
    }, [pulseAnim, fadeAnim]);

    return (
        <View style={styles.container}>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            
            {/* Splash Background Image */}
            <Image
                source={require('../../../../assets/splashscreen.jpeg')}
                style={styles.backgroundImage}
                resizeMode="cover"
            />

            {/* Bottom Buffering & Loading Overlay */}
            <Animated.View style={[styles.bufferingOverlay, { opacity: fadeAnim }]}>
                <Animated.View
                    style={[
                        styles.bufferingContainer,
                        {
                            opacity: pulseAnim,
                        },
                    ]}
                >
                    <ActivityIndicator size="large" color="#38BDF8" style={styles.spinner} />
                </Animated.View>
                
                {message ? (
                    <Text style={styles.loadingText}>{message}</Text>
                ) : null}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#142036',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: width,
        height: height,
    },
    bufferingOverlay: {
        position: 'absolute',
        bottom: 60,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    bufferingContainer: {
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        padding: 14,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
        marginBottom: 12,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    spinner: {
        transform: [{ scale: 1.1 }],
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.6,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});

export default SplashScreen;


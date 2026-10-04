import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemeColors, typography, radii } from '../theme/tokens';

export interface OfflineBannerProps {
    visible?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ visible = true }) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    if (!visible) return null;

    return (
        <View style={styles.banner} accessibilityRole="alert">
            <WifiOff size={15} color={colors.warning} strokeWidth={1.5} style={styles.icon} />
            <Text style={styles.text}>
                You're offline. Reading works, AI features need a connection.
            </Text>
        </View>
    );
};

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        banner: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceRaised,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: 8,
            paddingHorizontal: 16,
        },
        icon: {
            marginRight: 8,
        },
        text: {
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            fontWeight: '500',
        },
    });

export default OfflineBanner;


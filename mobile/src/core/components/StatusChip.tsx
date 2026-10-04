import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';

interface StatusChipProps {
    status?: string;
    size?: 'sm' | 'md';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status = 'READY', size = 'sm' }) => {
    const { colors, typography, radii } = useTheme();
    const s = (status || 'READY').toUpperCase();

    let bgColor = colors.successMuted;
    let textColor = colors.success;
    let label = 'Ready';
    let Icon = CheckCircle2;

    if (s.includes('PROCESS') || s.includes('INDEX') || s.includes('PENDING') || s.includes('READ')) {
        bgColor = colors.warningMuted;
        textColor = colors.warning;
        label = 'Processing';
        Icon = Clock;
    } else if (s.includes('FAIL') || s.includes('ERROR')) {
        bgColor = colors.dangerMuted;
        textColor = colors.danger;
        label = 'Failed';
        Icon = AlertCircle;
    }

    const isSmall = size === 'sm';

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: bgColor,
                    borderRadius: radii.full,
                    paddingVertical: isSmall ? 3 : 5,
                    paddingHorizontal: isSmall ? 8 : 12,
                },
            ]}
        >
            <Icon size={isSmall ? 11 : 13} color={textColor} strokeWidth={2} style={{ marginRight: 4 }} />
            <Text
                style={[
                    styles.text,
                    {
                        color: textColor,
                        fontSize: isSmall ? typography.sizes.xs - 1 : typography.sizes.xs,
                    },
                ]}
            >
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default StatusChip;

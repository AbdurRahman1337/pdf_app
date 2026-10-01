import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { BookOpen, X, Sparkles } from 'lucide-react-native';

interface CitationModalProps {
    visible: boolean;
    citationText: string;
    onClose: () => void;
    documentTitle?: string;
}

export const CitationModal: React.FC<CitationModalProps> = ({
    visible,
    citationText,
    onClose,
    documentTitle,
}) => {
    const { colors, typography, radii, spacing, shadows } = useTheme();

    // Parse citation if it has [filename - chunk index] pattern
    const match = citationText.match(/^\[(.*?)(?:\s*-\s*chunk\s*(\d+))?\]:\s*([\s\S]*)$/i);
    const filename = match ? match[1] : (documentTitle || 'Reference Document');
    const chunkNum = match && match[2] ? match[2] : null;
    const excerpt = match ? match[3] : citationText;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: colors.overlay, paddingHorizontal: spacing.lg }]}>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.surfaceRaised,
                            borderColor: colors.borderLight,
                            borderRadius: radii.xl,
                            padding: spacing.lg,
                            ...shadows.modal,
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border, marginBottom: spacing.md, paddingBottom: spacing.sm }]}>
                        <View style={styles.headerLeft}>
                            <View
                                style={[
                                    styles.iconBg,
                                    { backgroundColor: colors.accentMuted, borderRadius: radii.sm },
                                ]}
                            >
                                <BookOpen size={18} color={colors.accent} />
                            </View>
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text
                                    style={[
                                        styles.headerTitle,
                                        { color: colors.text, fontSize: typography.sizes.md },
                                    ]}
                                    numberOfLines={1}
                                >
                                    Grounding Citation
                                </Text>
                                <Text
                                    style={[
                                        styles.headerSub,
                                        { color: colors.textMuted, fontSize: typography.sizes.xs },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {filename} {chunkNum ? `• Chunk #${chunkNum}` : ''}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={[
                                styles.closeBtn,
                                { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full },
                            ]}
                            activeOpacity={0.7}
                        >
                            <X size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Excerpt Body */}
                    <ScrollView
                        style={[styles.contentScroll, { marginVertical: spacing.xs }]}
                        showsVerticalScrollIndicator={false}
                    >
                        <View
                            style={[
                                styles.highlightCard,
                                {
                                    backgroundColor: colors.surfaceSubtle,
                                    borderColor: colors.border,
                                    borderLeftColor: colors.accent,
                                    borderRadius: radii.md,
                                    padding: spacing.md,
                                    marginBottom: spacing.sm,
                                },
                            ]}
                        >
                            <View style={[styles.badgeRow, { marginBottom: spacing.xs }]}>
                                <Sparkles size={12} color={colors.indigo} />
                                <Text
                                    style={[
                                        styles.badgeText,
                                        { color: colors.indigo, fontSize: typography.sizes.xs },
                                    ]}
                                >
                                    Verified Vector Chunk
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.excerptText,
                                    { color: colors.textSecondary, fontSize: typography.sizes.sm },
                                ]}
                            >
                                {excerpt}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.helperNote,
                                { color: colors.textSubtle, fontSize: typography.sizes.xs, marginTop: spacing.xs },
                            ]}
                        >
                            This passage was retrieved from the vector knowledge base to support the AI answer.
                        </Text>
                    </ScrollView>

                    {/* Dismiss Button */}
                    <TouchableOpacity
                        style={[
                            styles.doneBtn,
                            {
                                backgroundColor: colors.accent,
                                borderRadius: radii.md,
                                marginTop: spacing.md,
                                ...shadows.glowAccent,
                            },
                        ]}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.doneBtnText,
                                { color: colors.textInverse, fontSize: typography.sizes.sm },
                            ]}
                        >
                            Close Source Preview
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        borderWidth: 1,
        width: '100%',
        maxWidth: 420,
        maxHeight: '75%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBg: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: '700',
    },
    headerSub: {
        marginTop: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    contentScroll: {},
    highlightCard: {
        borderWidth: 1,
        borderLeftWidth: 3,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeText: {
        fontWeight: '700',
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    excerptText: {
        lineHeight: 22,
        fontStyle: 'normal',
    },
    helperNote: {
        textAlign: 'center',
        lineHeight: 16,
    },
    doneBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    doneBtnText: {
        fontWeight: '700',
    },
});

export default CitationModal;

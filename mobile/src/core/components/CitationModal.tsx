import React from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { BookOpen, X, Sparkles, ExternalLink } from 'lucide-react-native';
import { AnimatedPressable } from './AnimatedPressable';

interface CitationModalProps {
    visible: boolean;
    citationText: string;
    onClose: () => void;
    documentTitle?: string;
    pageNumber?: number;
    onJumpToPage?: (page: number) => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({
    visible,
    citationText,
    onClose,
    documentTitle,
    pageNumber,
    onJumpToPage,
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
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            borderRadius: radii.sheets,
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
                                    { backgroundColor: colors.primaryMuted, borderRadius: radii.controls },
                                ]}
                            >
                                <BookOpen size={20} color={colors.primary} strokeWidth={1.75} />
                            </View>
                            <View style={{ marginLeft: 12, flex: 1 }}>
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
                                    {filename} {pageNumber ? `• Page ${pageNumber}` : chunkNum ? `• Chunk #${chunkNum}` : ''}
                                </Text>
                            </View>
                        </View>
                        <AnimatedPressable
                            onPress={onClose}
                            style={[
                                styles.closeBtn,
                                { backgroundColor: colors.surfaceRaised, borderRadius: radii.full },
                            ]}
                            accessibilityLabel="Close source citation preview"
                        >
                            <X size={18} color={colors.textMuted} strokeWidth={2} />
                        </AnimatedPressable>
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
                                    backgroundColor: colors.surfaceRaised,
                                    borderColor: colors.border,
                                    borderLeftColor: colors.primary,
                                    borderRadius: radii.cards,
                                    padding: spacing.md,
                                    marginBottom: spacing.sm,
                                },
                            ]}
                        >
                            <View style={[styles.badgeRow, { marginBottom: spacing.xs }]}>
                                <Sparkles size={13} color={colors.primary} strokeWidth={2} />
                                <Text
                                    style={[
                                        styles.badgeText,
                                        { color: colors.primary, fontSize: typography.sizes.xs },
                                    ]}
                                >
                                    Verified Source Chunk
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.excerptText,
                                    { color: colors.text, fontSize: typography.sizes.sm },
                                ]}
                            >
                                "{excerpt}"
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.helperNote,
                                { color: colors.textSubtle, fontSize: typography.sizes.xs, marginTop: spacing.xs },
                            ]}
                        >
                            This grounded context was retrieved directly from your course PDF to verify the AI response.
                        </Text>
                    </ScrollView>

                    {/* Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
                        {pageNumber && onJumpToPage && (
                            <AnimatedPressable
                                style={[
                                    styles.jumpBtn,
                                    {
                                        backgroundColor: colors.surfaceRaised,
                                        borderColor: colors.border,
                                        borderRadius: radii.controls,
                                    },
                                ]}
                                onPress={() => {
                                    onJumpToPage(pageNumber);
                                    onClose();
                                }}
                            >
                                <ExternalLink size={15} color={colors.primary} strokeWidth={2} style={{ marginRight: 6 }} />
                                <Text style={[styles.jumpBtnText, { color: colors.primary }]}>
                                    Jump to Page {pageNumber}
                                </Text>
                            </AnimatedPressable>
                        )}

                        <AnimatedPressable
                            style={[
                                styles.doneBtn,
                                {
                                    backgroundColor: colors.primary,
                                    borderRadius: radii.controls,
                                    flex: 1,
                                    ...shadows.glowAccent,
                                },
                            ]}
                            onPress={onClose}
                        >
                            <Text
                                style={[
                                    styles.doneBtnText,
                                    { color: colors.textInverse, fontSize: typography.sizes.sm },
                                ]}
                            >
                                Close Preview
                            </Text>
                        </AnimatedPressable>
                    </View>
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontWeight: '700',
    },
    headerSub: {
        marginTop: 2,
    },
    closeBtn: {
        width: 34,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    contentScroll: {},
    highlightCard: {
        borderWidth: 1,
        borderLeftWidth: 4,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeText: {
        fontWeight: '700',
        marginLeft: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    excerptText: {
        lineHeight: 22,
        fontStyle: 'normal',
        marginTop: 4,
    },
    helperNote: {
        textAlign: 'center',
        lineHeight: 18,
    },
    jumpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
    },
    jumpBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    doneBtn: {
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        fontWeight: '700',
    },
});

export default CitationModal;

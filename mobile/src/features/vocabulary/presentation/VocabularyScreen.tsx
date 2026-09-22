import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ChevronLeft, Languages, Book, Check } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const formatTitle = (name?: string) => {
    if (!name) return 'Vocabulary Bank';
    try {
        return decodeURIComponent(name).replace(/\+/g, ' ');
    } catch {
        return name;
    }
};

const VocabularyScreen = ({ route, navigation }: any) => {
    const { pdfId, title: routeTitle } = route.params;
    const [vocab, setVocab] = useState<any[]>([]);
    const [docTitle, setDocTitle] = useState<string>(routeTitle || '');
    const [loading, setLoading] = useState(true);
    const [translating, setTranslating] = useState<string | null>(null);
    const [translations, setTranslations] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchVocab = async () => {
            try {
                const response = await apiClient.get(`/pdf/${pdfId}`);
                setVocab(response.data.vocabulary || []);
                if (response.data.original_name) {
                    setDocTitle(response.data.original_name);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchVocab();
    }, [pdfId]);

    const handleTranslate = async (term: string, definition: string) => {
        setTranslating(term);
        try {
            const response = await apiClient.post('/ai/translate', {
                text: definition,
                target_language: 'es',
            });
            setTranslations((prev) => ({ ...prev, [term]: response.data.translated_text }));
        } catch (err) {
            alert('Translation failed');
        } finally {
            setTranslating(null);
        }
    };

    const cleanTitle = formatTitle(docTitle);

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.term}>{item.term}</Text>
                <TouchableOpacity
                    onPress={() => handleTranslate(item.term, item.definition)}
                    disabled={!!translating}
                    style={styles.translateBtn}
                    activeOpacity={0.7}
                >
                    {translating === item.term ? (
                        <ActivityIndicator size="small" color="#38BDF8" />
                    ) : translations[item.term] ? (
                        <Check size={16} color="#2DD4BF" />
                    ) : (
                        <Languages size={16} color="#38BDF8" />
                    )}
                </TouchableOpacity>
            </View>
            <Text style={styles.definition}>{item.definition}</Text>

            {translations[item.term] && (
                <View style={styles.translationBox}>
                    <Text style={styles.translationLabel}>Spanish Translation</Text>
                    <Text style={styles.translationText}>{translations[item.term]}</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    activeOpacity={0.7}
                >
                    <ChevronLeft size={22} color="#ffffff" />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {cleanTitle}
                    </Text>
                    <Text style={styles.headerSub}>Vocabulary Bank ({vocab.length} Terms)</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#38BDF8" />
                </View>
            ) : (
                <FlatList
                    data={vocab}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `${item.term}-${index}`}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Book size={60} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyText}>No vocabulary terms extracted yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
        paddingTop: 48,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#0F172A',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E293B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        marginLeft: 14,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    headerSub: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    card: {
        backgroundColor: '#0F172A',
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 20,
        borderRadius: 20,
        marginBottom: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    term: {
        color: '#38BDF8',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    translateBtn: {
        backgroundColor: 'rgba(56,189,248,0.1)',
        padding: 8,
        borderRadius: 10,
    },
    definition: {
        color: '#cbd5e1',
        lineHeight: 22,
        fontSize: 14,
    },
    translationBox: {
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    translationLabel: {
        color: '#818CF8',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    translationText: {
        color: '#94a3b8',
        fontStyle: 'italic',
        fontSize: 13,
        lineHeight: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80,
    },
    emptyText: {
        color: '#64748B',
        textAlign: 'center',
        marginTop: 16,
        fontSize: 15,
    },
});

export default VocabularyScreen;

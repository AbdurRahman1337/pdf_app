import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ChevronLeft, Languages, Book, Check } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const VocabularyScreen = ({ route, navigation }: any) => {
    const { pdfId } = route.params;
    const [vocab, setVocab] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [translating, setTranslating] = useState<string | null>(null);
    const [translations, setTranslations] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchVocab = async () => {
            try {
                const response = await apiClient.get(`/pdf/${pdfId}`);
                setVocab(response.data.vocabulary || []);
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
                target_language: 'es'
            });
            setTranslations(prev => ({ ...prev, [term]: response.data.translated_text }));
        } catch (err) {
            alert('Translation failed');
        } finally {
            setTranslating(null);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.term}>{item.term}</Text>
                <TouchableOpacity
                    onPress={() => handleTranslate(item.term, item.definition)}
                    disabled={!!translating}
                    style={styles.translateBtn}
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Vocabulary Bank</Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#38BDF8" />
                </View>
            ) : (
                <FlatList
                    data={vocab}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Book size={60} color="rgba(255,255,255,0.3)" />
                            <Text style={styles.emptyText}>No keywords extracted</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617', paddingTop: 48 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
    backBtn: { padding: 8, backgroundColor: '#0F172A', borderRadius: 999 },
    headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginLeft: 16 },
    card: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', padding: 24, borderRadius: 24, marginBottom: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    term: { color: '#38BDF8', fontSize: 20, fontWeight: 'bold', flex: 1, marginRight: 8 },
    translateBtn: { backgroundColor: 'rgba(56,189,248,0.1)', padding: 8, borderRadius: 8 },
    definition: { color: '#cbd5e1', lineHeight: 24 },
    translationBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    translationLabel: { color: '#818CF8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 },
    translationText: { color: '#94a3b8', fontStyle: 'italic', fontSize: 14 },
    emptyContainer: { alignItems: 'center', marginTop: 80, opacity: 0.3 },
    emptyText: { color: '#ffffff', textAlign: 'center', marginTop: 16 },
});

export default VocabularyScreen;

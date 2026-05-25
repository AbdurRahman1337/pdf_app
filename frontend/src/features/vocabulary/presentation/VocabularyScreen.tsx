import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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
        <View className="bg-dark-800 border border-dark-700 p-6 rounded-3xl mb-4">
            <View className="flex-row justify-between items-start mb-3">
                <Text className="text-primary text-xl font-bold flex-1 mr-2">{item.term}</Text>
                <TouchableOpacity
                    onPress={() => handleTranslate(item.term, item.definition)}
                    disabled={!!translating}
                    className="bg-primary/10 p-2 rounded-lg"
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
            <Text className="text-gray-300 leading-6">{item.definition}</Text>

            {translations[item.term] && (
                <View className="mt-4 pt-4 border-t border-white/5">
                    <Text className="text-secondary text-[10px] font-bold uppercase mb-2">Spanish Translation</Text>
                    <Text className="text-gray-400 italic text-sm">{translations[item.term]}</Text>
                </View>
            )}
        </View>
    );

    return (
        <View className="flex-1 bg-dark-900 pt-12">
            <View className="flex-row items-center px-6 mb-6">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-dark-800 rounded-full">
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold ml-4">Vocabulary Bank</Text>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#38BDF8" />
                </View>
            ) : (
                <FlatList
                    data={vocab}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View className="items-center mt-20 opacity-30">
                            <Book size={60} color="white" />
                            <Text className="text-white text-center mt-4">No keywords extracted</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

export default VocabularyScreen;

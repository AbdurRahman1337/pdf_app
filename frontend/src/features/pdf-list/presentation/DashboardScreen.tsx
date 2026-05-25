import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FilePdf, Plus, RefreshCw, ChevronRight, MessageSquare, BookOpen, Layers } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const DashboardScreen = ({ navigation }: any) => {
    const [pdfs, setPdfs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPdfs = async () => {
        try {
            const response = await apiClient.get('/pdf/list');
            setPdfs(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPdfs();
    }, []);

    const handleUpload = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'application/pdf',
        });

        if (!result.canceled) {
            const file = result.assets[0];
            const formData = new FormData();
            // @ts-ignore
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: 'application/pdf',
            });

            try {
                await apiClient.post('/pdf/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                fetchPdfs();
            } catch (err) {
                alert('Upload failed');
            }
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View className="bg-dark-800 border border-dark-700 p-4 rounded-2xl mb-4">
            <View className="flex-row items-center mb-4">
                <View className={`p-3 rounded-full ${item.process_status === 'COMPLETED' ? 'bg-primary/10' : 'bg-yellow-500/10'}`}>
                    <FilePdf size={24} color={item.process_status === 'COMPLETED' ? '#38BDF8' : '#EAB308'} />
                </View>
                <View className="flex-1 ml-4">
                    <Text className="text-white font-bold text-lg" numberOfLines={1}>{item.original_name}</Text>
                    <Text className="text-gray-400 text-xs">
                        {item.process_status} • {(item.size_bytes / 1024).toFixed(1)} KB
                    </Text>
                </View>
            </View>

            {item.process_status === 'COMPLETED' ? (
                <View className="flex-row justify-between border-t border-dark-700 pt-4">
                    <TouchableOpacity
                        className="items-center flex-1"
                        onPress={() => navigation.navigate('Summary', { pdfId: item.id })}
                    >
                        <Layers size={20} color="#818CF8" />
                        <Text className="text-gray-400 text-[10px] mt-1">Summary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="items-center flex-1"
                        onPress={() => navigation.navigate('Vocabulary', { pdfId: item.id })}
                    >
                        <BookOpen size={20} color="#2DD4BF" />
                        <Text className="text-gray-400 text-[10px] mt-1">Vocab</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="items-center flex-1"
                        onPress={() => navigation.navigate('Chat', { pdfId: item.id })}
                    >
                        <MessageSquare size={20} color="#38BDF8" />
                        <Text className="text-gray-400 text-[10px] mt-1">RAG Chat</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View className="flex-row items-center justify-center py-2">
                    <ActivityIndicator size="small" color="#EAB308" />
                    <Text className="text-yellow-500 ml-2 text-xs">Processing...</Text>
                </View>
            )}
        </View>
    );

    return (
        <View className="flex-1 bg-dark-900 px-6 pt-12">
            <View className="flex-row justify-between items-center mb-8">
                <View>
                    <Text className="text-gray-400">Welcome Back</Text>
                    <Text className="text-white text-2xl font-bold">Workspace</Text>
                </View>
                <TouchableOpacity
                    className="bg-primary p-3 rounded-full"
                    onPress={handleUpload}
                >
                    <Plus size={24} color="black" />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#38BDF8" />
                </View>
            ) : (
                <FlatList
                    data={pdfs}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchPdfs();
                            }}
                            tintColor="#38BDF8"
                        />
                    }
                    ListEmptyComponent={
                        <View className="items-center mt-20">
                            <Text className="text-gray-500 text-lg">No documents yet</Text>
                            <TouchableOpacity
                                className="mt-4 border border-primary/30 py-3 px-8 rounded-full"
                                onPress={handleUpload}
                            >
                                <Text className="text-primary font-bold">Upload First PDF</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
};

export default DashboardScreen;

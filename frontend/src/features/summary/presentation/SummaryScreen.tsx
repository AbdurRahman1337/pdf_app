import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ChevronLeft, FileText, ListChecks } from 'lucide-react-native';
import apiClient from '../../../core/network/apiClient';

const SummaryScreen = ({ route, navigation }: any) => {
    const { pdfId } = route.params;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('brief');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await apiClient.get(`/pdf/${pdfId}`);
                setData(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [pdfId]);

    if (loading) {
        return (
            <View className="flex-1 bg-dark-900 justify-center items-center">
                <ActivityIndicator size="large" color="#38BDF8" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-dark-900 pt-12">
            <View className="flex-row items-center px-6 mb-6">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-dark-800 rounded-full">
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold ml-4" numberOfLines={1}>
                    {data?.original_name}
                </Text>
            </View>

            <View className="flex-row px-6 mb-6">
                <TouchableOpacity
                    onPress={() => setActiveTab('brief')}
                    className={`flex-1 flex-row items-center justify-center py-3 rounded-xl mr-2 ${activeTab === 'brief' ? 'bg-primary' : 'bg-dark-800'}`}
                >
                    <FileText size={18} color={activeTab === 'brief' ? 'black' : 'white'} />
                    <Text className={`ml-2 font-bold ${activeTab === 'brief' ? 'text-black' : 'text-white'}`}>Brief</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('detailed')}
                    className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ml-2 ${activeTab === 'detailed' ? 'bg-primary' : 'bg-dark-800'}`}
                >
                    <ListChecks size={18} color={activeTab === 'detailed' ? 'black' : 'white'} />
                    <Text className={`ml-2 font-bold ${activeTab === 'detailed' ? 'text-black' : 'text-white'}`}>Details</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6 pb-10">
                <View className="bg-dark-800 border border-dark-700 p-6 rounded-3xl mb-8">
                    <Text className="text-primary text-xs font-bold uppercase tracking-widest mb-4">
                        {activeTab === 'brief' ? 'Executive Summary' : 'Granular Analysis'}
                    </Text>
                    <Text className="text-white text-lg leading-7">
                        {activeTab === 'brief'
                            ? data?.summary_brief
                            : data?.summary_details?.main_points}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

export default SummaryScreen;

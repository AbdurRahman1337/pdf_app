import axios, { InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;

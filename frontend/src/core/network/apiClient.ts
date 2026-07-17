/**
 * Axios HTTP Client
 *
 * Attaches a fresh Firebase ID Token (auto-refreshed) to every request.
 * Falls back gracefully if no user is signed in.
 */
import axios, { InternalAxiosRequestConfig } from 'axios';
import auth from '@react-native-firebase/auth';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const currentUser = auth().currentUser;
    if (currentUser) {
        // getIdToken(true) forces a refresh if the token is expired
        const idToken = await currentUser.getIdToken(false);
        config.headers.Authorization = `Bearer ${idToken}`;
    }
    return config;
});

export default apiClient;

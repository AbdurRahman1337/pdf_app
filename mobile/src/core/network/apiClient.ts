/**
 * Axios HTTP Client
 *
 * Attaches a fresh Auth ID Token and session ID to every request.
 * Automatically resolves the backend server IP (via EXPO_PUBLIC_API_URL, Expo Constants,
 * Metro scriptURL, or Android emulator mapping) so that both physical mobile devices
 * over Wi-Fi and emulators can reach the backend.
 */
import axios, { InternalAxiosRequestConfig } from 'axios';
import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import authService from '../auth/authService';

let customBaseUrl: string | null = null;

export const setApiBaseUrl = (url: string) => {
    customBaseUrl = url;
};

const extractHostFromUri = (uri?: string | null): string | null => {
    if (!uri || typeof uri !== 'string') return null;
    try {
        const withoutProto = uri.replace(/^[a-zA-Z]+:\/\//, '');
        const host = withoutProto.split('/')[0].split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
            return host;
        }
    } catch {
        // ignore parsing errors
    }
    return null;
};

export const getBaseUrl = (): string => {
    // 0. Manual runtime override if set
    if (customBaseUrl) {
        return customBaseUrl;
    }

    // 1. Explicit environment variable (set via EXPO_PUBLIC_API_URL in .env or eas.json)
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    // 2. Official Expo Constants host detection (works in Dev Client & Expo Go)
    try {
        const expoHost =
            extractHostFromUri(Constants.expoConfig?.hostUri) ||
            extractHostFromUri((Constants as any).manifest2?.extra?.expoGo?.debuggerHost) ||
            extractHostFromUri((Constants as any).manifest?.debuggerHost);

        if (expoHost) {
            return `http://${expoHost}:8000/api/v1`;
        }
    } catch {
        // Fall through
    }

    // 3. React Native Metro SourceCode.scriptURL host detection
    try {
        const scriptURL = NativeModules.SourceCode?.scriptURL;
        const scriptHost = extractHostFromUri(scriptURL);
        if (scriptHost) {
            return `http://${scriptHost}:8000/api/v1`;
        }
    } catch {
        // Fall through
    }

    // 4. Android Emulator loopback alias for host machine
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8000/api/v1';
    }

    // 5. iOS Simulator / Web / Local fallback
    return 'http://localhost:8000/api/v1';
};

const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 30000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    // Ensure base URL is dynamically evaluated if it was initially defaulted
    if (!config.baseURL || config.baseURL.includes('10.0.2.2') || config.baseURL.includes('localhost')) {
        const resolved = getBaseUrl();
        if (resolved) {
            config.baseURL = resolved;
        }
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
        try {
            const idToken = await currentUser.getIdToken(false);
            config.headers.Authorization = `Bearer ${idToken}`;
            config.headers['X-Session-ID'] = currentUser.uid;
        } catch (e) {
            config.headers['X-Session-ID'] = currentUser.uid;
        }
    } else {
        config.headers['X-Session-ID'] = 'session_default';
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
            console.warn(
                `[API Network Error] Unable to reach backend at: ${error.config?.baseURL || ''}. ` +
                `Ensure your FastAPI backend is running and listening on 0.0.0.0:8000 ` +
                `(run: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload). ` +
                `If using a physical device, ensure both device and computer are on the same Wi-Fi network ` +
                `or set EXPO_PUBLIC_API_URL in mobile/.env`
            );
        }
        return Promise.reject(error);
    }
);

export default apiClient;

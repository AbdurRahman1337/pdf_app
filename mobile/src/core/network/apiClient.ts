/**
 * Axios HTTP Client
 *
 * Attaches a fresh Auth ID Token and session ID to every request.
 * Automatically resolves the backend server IP (via EXPO_PUBLIC_API_URL, Expo Constants,
 * Metro scriptURL, or Android emulator mapping) so that both physical mobile devices
 * over Wi-Fi and emulators can reach the backend.
 */
import axios, { InternalAxiosRequestConfig } from 'axios';
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import authService from '../auth/authService';

export const BACKEND_LAN_URL = 'http://192.168.0.115:8000/api/v1';
export const BACKEND_USB_URL = 'http://localhost:8000/api/v1';

let customBaseUrl: string | null = null;
let probePromise: Promise<string> | null = null;

export const setApiBaseUrl = (url: string) => {
    customBaseUrl = url;
};

const extractHostFromUri = (uri?: string | null): string | null => {
    if (!uri || typeof uri !== 'string') return null;
    try {
        const withoutProto = uri.replace(/^[a-zA-Z]+:\/\//, '');
        const host = withoutProto.split('/')[0].split(':')[0];
        if (host) {
            return host;
        }
    } catch {
        // ignore parsing errors
    }
    return null;
};

export const getBaseUrl = (): string => {
    // 0. Manual or probed runtime override if set
    if (customBaseUrl) {
        return customBaseUrl;
    }

    // 1. Check how Metro loaded the bundle (if loaded via localhost/adb reverse, use localhost:8000)
    try {
        const expoHost =
            extractHostFromUri(Constants.expoConfig?.hostUri) ||
            extractHostFromUri((Constants as any).manifest2?.extra?.expoGo?.debuggerHost) ||
            extractHostFromUri((Constants as any).manifest?.debuggerHost) ||
            extractHostFromUri(NativeModules.SourceCode?.scriptURL);

        if (expoHost === 'localhost' || expoHost === '127.0.0.1') {
            return BACKEND_USB_URL;
        }
        if (expoHost) {
            return `http://${expoHost}:8000/api/v1`;
        }
    } catch {
        // Fall through
    }

    // 2. Explicit environment variable (set via EXPO_PUBLIC_API_URL in .env)
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    // 3. Configured LAN Backend IP (192.168.0.115)
    return BACKEND_LAN_URL;
};

/**
 * Probes both LAN (192.168.0.115:8000) and USB (localhost:8000) and selects whichever responds first.
 */
const resolveReachableBaseUrl = async (): Promise<string> => {
    if (customBaseUrl) return customBaseUrl;
    if (probePromise) return probePromise;

    const candidates = [BACKEND_LAN_URL, BACKEND_USB_URL, 'http://10.0.2.2:8000/api/v1'];

    probePromise = (async () => {
        const checkCandidate = async (base: string): Promise<string> => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            try {
                const res = await fetch(`${base}/health`, { signal: controller.signal });
                if (res.ok) return base;
                throw new Error('Not ok');
            } finally {
                clearTimeout(timer);
            }
        };

        try {
            const winner = await Promise.any(candidates.map(checkCandidate));
            customBaseUrl = winner;
            return winner;
        } catch {
            return getBaseUrl();
        } finally {
            probePromise = null;
        }
    })();

    return probePromise;
};

const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 30000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const reachableUrl = await resolveReachableBaseUrl();
    config.baseURL = reachableUrl;

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
    async (error) => {
        const config = error.config as (InternalAxiosRequestConfig & { _retriedFallback?: boolean }) | undefined;
        if (
            config &&
            !config._retriedFallback &&
            (error.message === 'Network Error' || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED')
        ) {
            config._retriedFallback = true;
            const currentBase = config.baseURL || '';
            const alternateUrl = currentBase.includes('192.168.0.115') ? BACKEND_USB_URL : BACKEND_LAN_URL;
            customBaseUrl = alternateUrl;
            config.baseURL = alternateUrl;
            return apiClient.request(config);
        }
        return Promise.reject(error);
    }
);

export default apiClient;

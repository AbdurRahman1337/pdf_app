/**
 * Firebase Configuration & Initialization
 *
 * Reads Firebase client configuration from environment variables (`EXPO_PUBLIC_FIREBASE_*`).
 * For native builds (Android/iOS), `@react-native-firebase` reads configuration from
 * `google-services.json` or `GoogleService-Info.plist`.
 *
 * In standard Expo Go or environments without native Firebase modules,
 * authentication gracefully falls back to local/guest session management.
 */
import { NativeModules } from 'react-native';

export interface FirebaseConfigOptions {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
}

/**
 * Public Firebase client configuration read from Expo environment variables.
 * Set these in your `.env` or EAS Build secrets using the `EXPO_PUBLIC_` prefix.
 */
export const firebaseCredentials: FirebaseConfigOptions = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'pdf-app-48c12',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pdf-app-48c12.firebasestorage.app',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

let firebaseApp: any = null;
let firebaseAuth: any = null;

if (NativeModules && NativeModules.RNFBAppModule) {
    try {
        const rnApp = require('@react-native-firebase/app');
        firebaseApp = typeof rnApp.getApp === 'function' ? rnApp.getApp() : rnApp.default;
        if (NativeModules.RNFBAuthModule) {
            const rnAuth = require('@react-native-firebase/auth');
            firebaseAuth = typeof rnAuth.getAuth === 'function' ? rnAuth.getAuth() : rnAuth.default;
        }
    } catch (e) {
        // Fallback for environments where native Firebase is not linked (Expo Go, Web)
    }
}

export { firebaseAuth as auth, firebaseApp as firebase };
export default firebaseApp;

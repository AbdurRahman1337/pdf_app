import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
    uid: string;
    email: string | null;
    displayName?: string | null;
    getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

type AuthStateListener = (user: AuthUser | null) => void;

// Check if native Firebase modules exist (e.g. running in Expo Dev Client or Standalone APK)
const hasNativeFirebase = Boolean(
    NativeModules &&
    NativeModules.RNFBAuthModule &&
    NativeModules.RNFBAppModule
);

let modularAuth: any = null;
let nativeAuthInstance: any = null;

if (hasNativeFirebase) {
    try {
        const rnAuth = require('@react-native-firebase/auth');
        if (typeof rnAuth.getAuth === 'function') {
            modularAuth = rnAuth;
            nativeAuthInstance = rnAuth.getAuth();
        } else if (typeof rnAuth.default === 'function') {
            nativeAuthInstance = rnAuth.default();
        }
    } catch (e) {
        modularAuth = null;
        nativeAuthInstance = null;
    }
}

export const isFirebaseAvailable = Boolean(nativeAuthInstance);

const resolveUserToken = async (fbUser: any, forceRefresh?: boolean): Promise<string> => {
    if (modularAuth && typeof modularAuth.getIdToken === 'function') {
        try {
            return await modularAuth.getIdToken(fbUser, forceRefresh);
        } catch {}
    }
    if (fbUser && typeof fbUser.getIdToken === 'function') {
        return await fbUser.getIdToken(forceRefresh);
    }
    return `token_${fbUser?.uid || 'user'}`;
};

class LocalAuthManager {
    private currentUser: AuthUser | null = null;
    private listeners: Set<AuthStateListener> = new Set();
    private storageKey = '@pdf_app_local_user';
    private initialized = false;

    constructor() {
        this.loadInitialUser();
    }

    private async loadInitialUser() {
        try {
            const saved = await AsyncStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.currentUser = this.createMockUser(parsed.uid, parsed.email);
            }
        } catch (e) {
            this.currentUser = null;
        } finally {
            this.initialized = true;
            this.notify();
        }
    }

    private createMockUser(uid: string, email: string): AuthUser {
        return {
            uid,
            email,
            displayName: email ? email.split('@')[0] : 'Student',
            getIdToken: async () => `token_${uid}`,
        };
    }

    private notify() {
        for (const listener of this.listeners) {
            listener(this.currentUser);
        }
    }

    getCurrentUser(): AuthUser | null {
        return this.currentUser;
    }

    async signInWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
        const uid = `user_${Date.now()}`;
        const user = this.createMockUser(uid, email);
        this.currentUser = user;
        await AsyncStorage.setItem(this.storageKey, JSON.stringify({ uid, email }));
        this.notify();
        return user;
    }

    async createUserWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
        return this.signInWithEmailAndPassword(email, password);
    }

    async continueAsGuest(): Promise<AuthUser> {
        return this.signInWithEmailAndPassword('guest@student.edu', 'guest123');
    }

    async signOut(): Promise<void> {
        this.currentUser = null;
        await AsyncStorage.removeItem(this.storageKey);
        this.notify();
    }

    onAuthStateChanged(listener: AuthStateListener): () => void {
        this.listeners.add(listener);
        if (this.initialized) {
            listener(this.currentUser);
        }
        return () => {
            this.listeners.delete(listener);
        };
    }
}

const localAuth = new LocalAuthManager();

export const authService = {
    isFirebaseAvailable,
    getCurrentUser: (): AuthUser | null => {
        if (isFirebaseAvailable && nativeAuthInstance) {
            try {
                const fbUser = nativeAuthInstance.currentUser;
                if (!fbUser) return null;
                return {
                    uid: fbUser.uid,
                    email: fbUser.email,
                    displayName: fbUser.displayName,
                    getIdToken: (forceRefresh) => resolveUserToken(fbUser, forceRefresh),
                };
            } catch (e) {
                return localAuth.getCurrentUser();
            }
        }
        return localAuth.getCurrentUser();
    },
    onAuthStateChanged: (listener: AuthStateListener): (() => void) => {
        if (isFirebaseAvailable && nativeAuthInstance) {
            try {
                const handleUser = (fbUser: any) => {
                    if (!fbUser) {
                        listener(null);
                    } else {
                        listener({
                            uid: fbUser.uid,
                            email: fbUser.email,
                            displayName: fbUser.displayName,
                            getIdToken: (forceRefresh) => resolveUserToken(fbUser, forceRefresh),
                        });
                    }
                };

                if (modularAuth && typeof modularAuth.onAuthStateChanged === 'function') {
                    return modularAuth.onAuthStateChanged(nativeAuthInstance, handleUser);
                }
                return nativeAuthInstance.onAuthStateChanged(handleUser);
            } catch (e) {
                return localAuth.onAuthStateChanged(listener);
            }
        }
        return localAuth.onAuthStateChanged(listener);
    },
    signInWithEmailAndPassword: async (email: string, pass: string): Promise<AuthUser> => {
        if (isFirebaseAvailable && nativeAuthInstance) {
            let cred: any;
            if (modularAuth && typeof modularAuth.signInWithEmailAndPassword === 'function') {
                cred = await modularAuth.signInWithEmailAndPassword(nativeAuthInstance, email, pass);
            } else {
                cred = await nativeAuthInstance.signInWithEmailAndPassword(email, pass);
            }
            return {
                uid: cred.user.uid,
                email: cred.user.email,
                displayName: cred.user.displayName,
                getIdToken: (forceRefresh) => resolveUserToken(cred.user, forceRefresh),
            };
        }
        return localAuth.signInWithEmailAndPassword(email, pass);
    },
    createUserWithEmailAndPassword: async (email: string, pass: string): Promise<AuthUser> => {
        if (isFirebaseAvailable && nativeAuthInstance) {
            let cred: any;
            if (modularAuth && typeof modularAuth.createUserWithEmailAndPassword === 'function') {
                cred = await modularAuth.createUserWithEmailAndPassword(nativeAuthInstance, email, pass);
            } else {
                cred = await nativeAuthInstance.createUserWithEmailAndPassword(email, pass);
            }
            try {
                if (modularAuth && typeof modularAuth.sendEmailVerification === 'function') {
                    await modularAuth.sendEmailVerification(cred.user);
                } else if (cred.user.sendEmailVerification) {
                    await cred.user.sendEmailVerification();
                }
            } catch (e) {}
            return {
                uid: cred.user.uid,
                email: cred.user.email,
                displayName: cred.user.displayName,
                getIdToken: (forceRefresh) => resolveUserToken(cred.user, forceRefresh),
            };
        }
        return localAuth.createUserWithEmailAndPassword(email, pass);
    },
    continueAsGuest: async (): Promise<AuthUser> => {
        return localAuth.continueAsGuest();
    },
    signOut: async (): Promise<void> => {
        if (isFirebaseAvailable && nativeAuthInstance) {
            try {
                if (modularAuth && typeof modularAuth.signOut === 'function') {
                    await modularAuth.signOut(nativeAuthInstance);
                } else {
                    await nativeAuthInstance.signOut();
                }
            } catch (e) {}
        }
        await localAuth.signOut();
    },
};

export default authService;


import { NativeModules } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { saveAuthSession, loadAuthSession, clearAuthSession } from '../db/database';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleDriveTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    user?: {
        email?: string;
        name?: string;
        picture?: string;
        id?: string;
    };
}

export interface AuthUser {
    uid: string;
    email: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    googleTokens?: GoogleDriveTokens | null;
    getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

type AuthStateListener = (user: AuthUser | null) => void;

// Check if native Firebase modules exist (e.g. running in EAS Dev Build)
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

class AuthService {
    private currentUser: AuthUser | null = null;
    private googleTokens: GoogleDriveTokens | null = null;
    private listeners: Set<AuthStateListener> = new Set();
    private initialized = false;

    constructor() {
        this.loadSession();
    }

    private async loadSession() {
        try {
            const session = await loadAuthSession();
            if (session) {
                this.googleTokens = session.googleTokens;
                if (session.user) {
                    this.currentUser = {
                        uid: session.user.uid,
                        email: session.user.email,
                        displayName: session.user.displayName || (session.user.email ? session.user.email.split('@')[0] : 'Student'),
                        photoURL: session.user.photoURL || null,
                        googleTokens: session.googleTokens || null,
                        getIdToken: async () => `token_${session.user.uid}`,
                    };
                }
            }
        } catch (e) {
            console.warn('[Auth] Failed to load session from SQLite:', e);
        } finally {
            this.initialized = true;
            this.notify();
        }
    }

    private notify() {
        for (const listener of this.listeners) {
            listener(this.currentUser);
        }
    }

    getCurrentUser(): AuthUser | null {
        return this.currentUser;
    }

    getGoogleAccessToken(): string | null {
        return this.googleTokens?.accessToken || null;
    }

    getGoogleTokens(): GoogleDriveTokens | null {
        return this.googleTokens;
    }

    async saveSession(user: AuthUser | null, tokens?: GoogleDriveTokens | null) {
        this.currentUser = user;
        this.googleTokens = tokens !== undefined ? tokens : this.googleTokens;
        if (this.currentUser && this.googleTokens) {
            this.currentUser.googleTokens = this.googleTokens;
        }

        if (user) {
            await saveAuthSession({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
            }, this.googleTokens);
        } else {
            await clearAuthSession();
        }
        this.notify();
    }

    async initiateGoogleDriveOAuth(backendBaseUrl: string): Promise<AuthUser> {
        try {
            const redirectUri = AuthSession.makeRedirectUri({
                scheme: 'pdfapp',
                path: 'oauth',
            });

            // 1. Fetch Google Consent URL from backend
            const cleanBase = backendBaseUrl.replace(/\/api(\/v1)?$/, '');
            const urlRes = await fetch(`${cleanBase}/api/v1/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
            if (!urlRes.ok) {
                throw new Error(`Failed to initialize Google OAuth (${urlRes.status})`);
            }
            const urlData = await urlRes.json();
            const authUrl = urlData.url;

            // 2. Open secure browser session
            const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            if (authResult.type === 'success' && authResult.url) {
                let code: string | null = null;
                try {
                    const match = authResult.url.match(/[?&]code=([^&#]+)/);
                    code = match ? decodeURIComponent(match[1]) : null;
                } catch {
                    code = null;
                }

                if (!code) {
                    throw new Error('No authorization code returned from Google.');
                }

                // 3. Exchange authorization code with backend for access token & profile
                const exchangeRes = await fetch(`${cleanBase}/api/v1/auth/google/exchange`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        redirect_uri: redirectUri,
                    }),
                });

                if (!exchangeRes.ok) {
                    const errData = await exchangeRes.json().catch(() => ({}));
                    throw new Error(errData.detail || 'Google token exchange failed.');
                }

                const tokenData = await exchangeRes.json();
                const tokens: GoogleDriveTokens = {
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    expiresIn: tokenData.expires_in,
                    user: tokenData.user,
                };

                return await this.signInWithGoogleDrive(tokens);
            }
            throw new Error('Google Drive authorization was cancelled.');
        } catch (e: any) {
            console.error('[Auth] Google Drive OAuth error:', e);
            throw e;
        }
    }

    async signInWithGoogleDrive(tokens: GoogleDriveTokens): Promise<AuthUser> {
        this.googleTokens = tokens;
        const uid = tokens.user?.id || `google_${Date.now()}`;
        const email = tokens.user?.email || 'google_user@gmail.com';
        const displayName = tokens.user?.name || email.split('@')[0];

        const user: AuthUser = {
            uid,
            email,
            displayName,
            photoURL: tokens.user?.picture || null,
            googleTokens: tokens,
            getIdToken: async () => `token_${uid}`,
        };

        await this.saveSession(user, tokens);
        return user;
    }

    async attachGoogleDriveTokens(tokens: GoogleDriveTokens): Promise<void> {
        this.googleTokens = tokens;
        if (this.currentUser) {
            this.currentUser.googleTokens = tokens;
            await this.saveSession(this.currentUser, tokens);
        } else {
            await this.signInWithGoogleDrive(tokens);
        }
    }

    async disconnectGoogleDrive(): Promise<void> {
        this.googleTokens = null;
        if (this.currentUser) {
            this.currentUser.googleTokens = null;
            await this.saveSession(this.currentUser, null);
        }
    }

    async signInWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
        if (nativeAuthInstance) {
            try {
                let userCred: any;
                if (modularAuth && typeof modularAuth.signInWithEmailAndPassword === 'function') {
                    userCred = await modularAuth.signInWithEmailAndPassword(nativeAuthInstance, email, password);
                } else if (typeof nativeAuthInstance.signInWithEmailAndPassword === 'function') {
                    userCred = await nativeAuthInstance.signInWithEmailAndPassword(email, password);
                }
                const fbUser = userCred?.user;
                const user: AuthUser = {
                    uid: fbUser.uid,
                    email: fbUser.email,
                    displayName: fbUser.displayName || email.split('@')[0],
                    photoURL: fbUser.photoURL,
                    googleTokens: this.googleTokens,
                    getIdToken: async (force) => (fbUser.getIdToken ? fbUser.getIdToken(force) : `token_${fbUser.uid}`),
                };
                await this.saveSession(user);
                return user;
            } catch (e) {
                console.warn('[Firebase Auth] Error signing in, using local auth:', e);
            }
        }

        const uid = `user_${Date.now()}`;
        const user: AuthUser = {
            uid,
            email,
            displayName: email.split('@')[0],
            googleTokens: this.googleTokens,
            getIdToken: async () => `token_${uid}`,
        };
        await this.saveSession(user);
        return user;
    }

    async createUserWithEmailAndPassword(email: string, password: string): Promise<AuthUser> {
        if (nativeAuthInstance) {
            try {
                let userCred: any;
                if (modularAuth && typeof modularAuth.createUserWithEmailAndPassword === 'function') {
                    userCred = await modularAuth.createUserWithEmailAndPassword(nativeAuthInstance, email, password);
                } else if (typeof nativeAuthInstance.createUserWithEmailAndPassword === 'function') {
                    userCred = await nativeAuthInstance.createUserWithEmailAndPassword(email, password);
                }
                const fbUser = userCred?.user;
                const user: AuthUser = {
                    uid: fbUser.uid,
                    email: fbUser.email,
                    displayName: fbUser.displayName || email.split('@')[0],
                    photoURL: fbUser.photoURL,
                    googleTokens: this.googleTokens,
                    getIdToken: async (force) => (fbUser.getIdToken ? fbUser.getIdToken(force) : `token_${fbUser.uid}`),
                };
                await this.saveSession(user);
                return user;
            } catch (e) {
                console.warn('[Firebase Auth] Error creating user, using local auth:', e);
            }
        }

        const uid = `user_${Date.now()}`;
        const user: AuthUser = {
            uid,
            email,
            displayName: email.split('@')[0],
            googleTokens: this.googleTokens,
            getIdToken: async () => `token_${uid}`,
        };
        await this.saveSession(user);
        return user;
    }

    async signInAnonymously(): Promise<AuthUser> {
        const uid = `guest_${Math.random().toString(36).substring(2, 9)}`;
        const user: AuthUser = {
            uid,
            email: 'guest@student.local',
            displayName: 'Guest Scholar',
            googleTokens: this.googleTokens,
            getIdToken: async () => `token_${uid}`,
        };
        await this.saveSession(user);
        return user;
    }

    async continueAsGuest(): Promise<AuthUser> {
        return this.signInAnonymously();
    }

    async signOut(): Promise<void> {
        if (nativeAuthInstance) {
            try {
                if (modularAuth && typeof modularAuth.signOut === 'function') {
                    await modularAuth.signOut(nativeAuthInstance);
                } else if (typeof nativeAuthInstance.signOut === 'function') {
                    await nativeAuthInstance.signOut();
                }
            } catch (e) {}
        }
        await this.saveSession(null, null);
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

export const authService = new AuthService();
export default authService;

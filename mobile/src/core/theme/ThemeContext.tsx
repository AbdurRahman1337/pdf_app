import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ThemeColors,
    darkColors,
    lightColors,
    darkShadows,
    lightShadows,
    typography,
    spacing,
    radii,
} from './tokens';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeContextValue {
    themeMode: ThemeMode;
    isDark: boolean;
    colors: ThemeColors;
    shadows: typeof darkShadows;
    typography: typeof typography;
    spacing: typeof spacing;
    radii: typeof radii;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    toggleTheme: () => Promise<void>;
}

const STORAGE_KEY = '@pdf_app_theme_mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const loadThemePreference = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored === 'light' || stored === 'dark' || stored === 'system') {
                    setThemeModeState(stored);
                }
            } catch (err) {
                console.error('[Theme] Failed to load theme preference from storage:', err);
            } finally {
                setLoaded(true);
            }
        };

        loadThemePreference();
    }, []);

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, mode);
        } catch (err) {
            console.error('[Theme] Failed to save theme preference:', err);
        }
    };

    const isDark = useMemo(() => {
        if (themeMode === 'system') {
            return systemScheme !== 'light';
        }
        return themeMode === 'dark';
    }, [themeMode, systemScheme]);

    const toggleTheme = async () => {
        const nextMode: ThemeMode = isDark ? 'light' : 'dark';
        await setThemeMode(nextMode);
    };

    const activeColors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);
    const activeShadows = useMemo(() => (isDark ? darkShadows : lightShadows), [isDark]);

    const value = useMemo<ThemeContextValue>(() => ({
        themeMode,
        isDark,
        colors: activeColors,
        shadows: activeShadows,
        typography,
        spacing,
        radii,
        setThemeMode,
        toggleTheme,
    }), [themeMode, isDark, activeColors, activeShadows]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext);
    if (!context) {
        // Fallback gracefully to default dark values if used outside provider
        return {
            themeMode: 'dark',
            isDark: true,
            colors: darkColors,
            shadows: darkShadows,
            typography,
            spacing,
            radii,
            setThemeMode: async () => {},
            toggleTheme: async () => {},
        };
    }
    return context;
};

export { useSafeTopGap, getStaticSafeTopGap } from './useSafeTopGap';

export default ThemeContext;

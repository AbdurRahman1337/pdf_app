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
    gradients,
} from './tokens';
import { motion } from './motion';

export type ThemeMode = 'dark' | 'light' | 'system';
export type TabKey = 'library' | 'courses' | 'test' | 'tutor';

export interface ThemeContextValue {
    themeMode: ThemeMode;
    isDark: boolean;
    colors: ThemeColors;
    shadows: typeof darkShadows;
    typography: typeof typography;
    spacing: typeof spacing;
    radii: typeof radii;
    gradients: typeof gradients;
    motion: typeof motion;
    getTabAccent: (tab: TabKey) => string;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    toggleTheme: () => Promise<void>;
}

const STORAGE_KEY = '@pdf_app_theme_mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const loadThemePreference = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                if (stored === 'light' || stored === 'dark' || stored === 'system') {
                    setThemeModeState(stored);
                }
            } catch (err) {
                console.error('[Theme] Failed to load theme preference:', err);
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

    const getTabAccent = (tab: TabKey) => {
        switch (tab) {
            case 'library':
                return activeColors.tabLibrary;
            case 'courses':
                return activeColors.tabCourseHub;
            case 'test':
                return activeColors.tabExamPrep;
            case 'tutor':
                return activeColors.tabAITutor;
            default:
                return activeColors.primary;
        }
    };

    const value = useMemo<ThemeContextValue>(() => ({
        themeMode,
        isDark,
        colors: activeColors,
        shadows: activeShadows,
        typography,
        spacing,
        radii,
        gradients,
        motion,
        getTabAccent,
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
        return {
            themeMode: 'light',
            isDark: false,
            colors: lightColors,
            shadows: lightShadows,
            typography,
            spacing,
            radii,
            gradients,
            motion,
            getTabAccent: () => lightColors.primary,
            setThemeMode: async () => {},
            toggleTheme: async () => {},
        };
    }
    return context;
};

export default ThemeContext;

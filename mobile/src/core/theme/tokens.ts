import { Platform } from 'react-native';

/**
 * Editorial Design Tokens for PDF AI Study App
 * Designed for calm reading and revision.
 * WCAG AA Contrast verified.
 */

export interface ThemeColors {
    // Canvas & Surfaces
    bg: string;
    surface: string;
    surfaceRaised: string;
    surfaceSubtle: string;
    surfaceHover: string;
    pdfPaper: string;

    // Borders & Dividers
    border: string;
    borderLight: string;
    borderActive: string;

    // Typography
    text: string;
    textSecondary: string;
    textMuted: string;
    textSubtle: string;
    textInverse: string;

    // Primary Interactive Accent (Editorial Spruce / Seafoam)
    accent: string;
    accentLight: string;
    accentDark: string;
    accentMuted: string;
    accentBorder: string;

    // Secondary Accents & Helpers
    indigo: string;
    indigoMuted: string;
    teal: string;
    tealMuted: string;
    purple: string;
    purpleMuted: string;

    // Feedback & Semantics
    success: string;
    successMuted: string;
    warning: string;
    warningMuted: string;
    danger: string;
    dangerMuted: string;
    info: string;

    // Citations & Highlights
    highlight: string;
    highlightText: string;

    // Overlays
    overlay: string;
    overlaySubtle: string;

    // Floating UI
    floatingBg: string;
    floatingBorder: string;
    floatingShadow: string;
}

export const lightColors: ThemeColors = {
    // Canvas & Surfaces
    bg: '#F7F5F0',          // Warm Paper
    surface: '#FFFFFF',     // Clean White Surface
    surfaceRaised: '#F0EDE6',// Subtle elevated container
    surfaceSubtle: '#EBE7DE',
    surfaceHover: '#E5E1D7',
    pdfPaper: '#FDFCF7',    // Warm Paper Page

    // Borders & Dividers
    border: '#E4E0D6',
    borderLight: 'rgba(28, 27, 24, 0.08)',
    borderActive: '#0F6B5C',

    // Typography
    text: '#1C1B18',        // High-contrast ink
    textSecondary: '#423F39',
    textMuted: '#6B675E',    // Editorial Muted
    textSubtle: '#8C877D',
    textInverse: '#FFFFFF',

    // Primary Interactive Accent (Spruce)
    accent: '#0F6B5C',
    accentLight: '#188A77',
    accentDark: '#0A4A40',
    accentMuted: 'rgba(15, 107, 92, 0.10)',
    accentBorder: 'rgba(15, 107, 92, 0.25)',

    // Secondary Accent Aliases
    indigo: '#0F6B5C',
    indigoMuted: 'rgba(15, 107, 92, 0.10)',
    teal: '#0F6B5C',
    tealMuted: 'rgba(15, 107, 92, 0.10)',
    purple: '#0A4A40',
    purpleMuted: 'rgba(10, 74, 64, 0.10)',

    // Feedback & Semantics
    success: '#2E7D4F',
    successMuted: 'rgba(46, 125, 79, 0.12)',
    warning: '#B7791F',
    warningMuted: 'rgba(183, 121, 31, 0.12)',
    danger: '#B3402F',
    dangerMuted: 'rgba(179, 64, 47, 0.12)',
    info: '#0F6B5C',

    // Citations & Highlights
    highlight: '#FFE58A',
    highlightText: '#4A3B00',

    // Overlays
    overlay: 'rgba(28, 27, 24, 0.55)',
    overlaySubtle: 'rgba(28, 27, 24, 0.25)',

    // Floating UI
    floatingBg: '#FFFFFF',
    floatingBorder: '#E4E0D6',
    floatingShadow: '#6B675E',
};

export const darkColors: ThemeColors = {
    // Canvas & Surfaces
    bg: '#121413',          // Deep Calm Neutral
    surface: '#1A1D1B',     // Elevated Dark Surface
    surfaceRaised: '#222624',
    surfaceSubtle: '#1E211F',
    surfaceHover: '#282C2A',
    pdfPaper: '#FDFCF7',    // PDF page stays paper-toned even in dark mode!

    // Borders & Dividers
    border: '#2E3330',
    borderLight: 'rgba(236, 234, 228, 0.08)',
    borderActive: '#4DB8A3',

    // Typography
    text: '#ECEAE4',        // Crisp Parchment
    textSecondary: '#C8C5BD',
    textMuted: '#A09C92',    // Dark Muted
    textSubtle: '#78746B',
    textInverse: '#121413',

    // Primary Interactive Accent (Seafoam / soft luminous spruce)
    accent: '#4DB8A3',
    accentLight: '#73CCBC',
    accentDark: '#2E8C7A',
    accentMuted: 'rgba(77, 184, 163, 0.14)',
    accentBorder: 'rgba(77, 184, 163, 0.32)',

    // Secondary Accent Aliases
    indigo: '#4DB8A3',
    indigoMuted: 'rgba(77, 184, 163, 0.14)',
    teal: '#4DB8A3',
    tealMuted: 'rgba(77, 184, 163, 0.14)',
    purple: '#2E8C7A',
    purpleMuted: 'rgba(46, 140, 122, 0.14)',

    // Feedback & Semantics
    success: '#3FA86B',
    successMuted: 'rgba(63, 168, 107, 0.14)',
    warning: '#DE9A3A',
    warningMuted: 'rgba(222, 154, 58, 0.14)',
    danger: '#E05A47',
    dangerMuted: 'rgba(224, 90, 71, 0.14)',
    info: '#4DB8A3',

    // Citations & Highlights
    highlight: '#5C4A00',
    highlightText: '#FFE58A',

    // Overlays
    overlay: 'rgba(10, 12, 11, 0.75)',
    overlaySubtle: 'rgba(10, 12, 11, 0.45)',

    // Floating UI
    floatingBg: '#1A1D1B',
    floatingBorder: '#2E3330',
    floatingShadow: '#000000',
};

// Default fallback
export const colors = lightColors;

export const typography = {
    fontFamily: {
        sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
        regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        medium: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        semiBold: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        bold: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
    },
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        base: 16,
        lg: 20,
        xl: 28,
        xxl: 28,
        display: 34,
    },
    lineHeights: {
        tight: 1.25,
        normal: 1.45,
        reading: 1.6, // 16-17px with 1.6 line height
    },
};

export const spacing = {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    huge: 48,
};

export const radii = {
    xs: 4,
    sm: 8,       // Controls (buttons, inputs)
    md: 12,      // Cards
    lg: 14,      // Cards
    xl: 20,      // Sheets / Modals
    xxl: 24,
    full: 9999,
};

// Two elevation levels using subtle borders instead of heavy drop shadows
export const lightShadows = {
    card: {
        shadowColor: '#1C1B18',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    modal: {
        shadowColor: '#1C1B18',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 4,
    },
    glowAccent: {
        shadowColor: '#0F6B5C',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    floating: {
        shadowColor: '#1C1B18',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
};

export const darkShadows = {
    card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 1,
    },
    modal: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 6,
    },
    glowAccent: {
        shadowColor: '#4DB8A3',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 2,
    },
    floating: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
    },
};

export const shadows = lightShadows;

export const theme = {
    colors,
    typography,
    spacing,
    radii,
    shadows,
};

export default theme;

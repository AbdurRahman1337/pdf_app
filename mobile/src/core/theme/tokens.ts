/**
 * Design Tokens for PDF AI Study App
 * Supports both Dark and Light themes
 */

export interface ThemeColors {
    // Canvas & Surfaces
    bg: string;
    surface: string;
    surfaceRaised: string;
    surfaceSubtle: string;
    surfaceHover: string;

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

    // Primary Accent (Sky Blue)
    accent: string;
    accentLight: string;
    accentDark: string;
    accentMuted: string;
    accentBorder: string;

    // Secondary Accents
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

    // Overlays
    overlay: string;
    overlaySubtle: string;

    // Floating Moveable Button
    floatingBg: string;
    floatingBorder: string;
    floatingShadow: string;
}

export const darkColors: ThemeColors = {
    // Canvas & Surfaces
    bg: '#0B0F19',
    surface: '#111827',
    surfaceRaised: '#1E293B',
    surfaceSubtle: '#162032',
    surfaceHover: '#1F2E45',

    // Borders & Dividers
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.14)',
    borderActive: 'rgba(56, 189, 248, 0.4)',

    // Typography
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textSubtle: '#64748B',
    textInverse: '#020617',

    // Primary Accent (Sky Blue)
    accent: '#38BDF8',
    accentLight: '#7DD3FC',
    accentDark: '#0284C7',
    accentMuted: 'rgba(56, 189, 248, 0.12)',
    accentBorder: 'rgba(56, 189, 248, 0.28)',

    // Secondary Accents
    indigo: '#818CF8',
    indigoMuted: 'rgba(129, 140, 248, 0.12)',
    teal: '#2DD4BF',
    tealMuted: 'rgba(45, 212, 191, 0.12)',
    purple: '#C084FC',
    purpleMuted: 'rgba(192, 132, 252, 0.12)',

    // Feedback & Semantics
    success: '#10B981',
    successMuted: 'rgba(16, 185, 129, 0.12)',
    warning: '#F59E0B',
    warningMuted: 'rgba(245, 158, 11, 0.12)',
    danger: '#EF4444',
    dangerMuted: 'rgba(239, 68, 68, 0.12)',
    info: '#38BDF8',

    // Overlays
    overlay: 'rgba(2, 6, 23, 0.85)',
    overlaySubtle: 'rgba(2, 6, 23, 0.5)',

    // Floating UI
    floatingBg: '#1E293B',
    floatingBorder: 'rgba(56, 189, 248, 0.35)',
    floatingShadow: '#000000',
};

export const lightColors: ThemeColors = {
    // Canvas & Surfaces
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceHover: '#E2E8F0',

    // Borders & Dividers
    border: 'rgba(0, 0, 0, 0.08)',
    borderLight: 'rgba(0, 0, 0, 0.12)',
    borderActive: 'rgba(2, 132, 199, 0.4)',

    // Typography
    text: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    textInverse: '#FFFFFF',

    // Primary Accent (Vivid Sky Blue)
    accent: '#0284C7',
    accentLight: '#38BDF8',
    accentDark: '#0369A1',
    accentMuted: 'rgba(2, 132, 199, 0.12)',
    accentBorder: 'rgba(2, 132, 199, 0.28)',

    // Secondary Accents
    indigo: '#6366F1',
    indigoMuted: 'rgba(99, 102, 241, 0.12)',
    teal: '#0D9488',
    tealMuted: 'rgba(13, 148, 136, 0.12)',
    purple: '#9333EA',
    purpleMuted: 'rgba(147, 51, 234, 0.12)',

    // Feedback & Semantics
    success: '#059669',
    successMuted: 'rgba(5, 150, 105, 0.12)',
    warning: '#D97706',
    warningMuted: 'rgba(217, 119, 6, 0.12)',
    danger: '#DC2626',
    dangerMuted: 'rgba(220, 38, 38, 0.12)',
    info: '#0284C7',

    // Overlays
    overlay: 'rgba(15, 23, 42, 0.65)',
    overlaySubtle: 'rgba(15, 23, 42, 0.35)',

    // Floating UI
    floatingBg: '#FFFFFF',
    floatingBorder: 'rgba(2, 132, 199, 0.3)',
    floatingShadow: '#64748B',
};

// Default fallback colors matching Dark theme
export const colors = darkColors;

export const typography = {
    fontFamily: {
        regular: 'System',
        medium: 'System',
        semiBold: 'System',
        bold: 'System',
    },
    sizes: {
        xs: 11,
        sm: 13,
        md: 15,
        base: 16,
        lg: 18,
        xl: 22,
        xxl: 28,
        display: 34,
    },
    lineHeights: {
        tight: 1.25,
        normal: 1.45,
        reading: 1.65,
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
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
};

export const darkShadows = {
    card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
    },
    modal: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 10,
    },
    glowAccent: {
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    floating: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 8,
    },
};

export const lightShadows = {
    card: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    modal: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 8,
    },
    glowAccent: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 2,
    },
    floating: {
        shadowColor: '#334155',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 6,
    },
};

export const shadows = darkShadows;

export const theme = {
    colors,
    typography,
    spacing,
    radii,
    shadows,
};

export default theme;

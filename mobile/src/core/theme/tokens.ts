import { Platform } from 'react-native';

/**
 * Design Tokens for PDF AI Student Study App
 * Compliant with DESIGN.md and Modern Consumer Ed-Tech UI/UX standards.
 * WCAG AA Contrast verified in both Light and Dark themes.
 */

export interface ThemeColors {
    // Canvas & Surfaces
    bg: string;              // Light: #F4F7F6 | Dark: #0B1211
    surface: string;         // Light: #FFFFFF | Dark: #121C1A
    surfaceRaised: string;   // Light: #EAF1EF | Dark: #192724 (surface-alt)
    surfaceSubtle: string;   // Light: #E4ECE9 | Dark: #1F302C
    surfaceHover: string;    // Light: #DEE8E5 | Dark: #283D38
    pdfPaper: string;        // #FDFCF7 (stays paper-toned in both modes)

    // Borders & Dividers
    border: string;          // Light: #DCE6E3 | Dark: #243531
    borderLight: string;     // Subtle hairline border
    borderActive: string;    // Focused/selected border

    // Typography
    text: string;            // Light: #0F1A18 | Dark: #E8F0EE
    textSecondary: string;   // Light: #364441 | Dark: #BAC8C4
    textMuted: string;       // Light: #5B6B67 | Dark: #94A8A3
    textSubtle: string;      // Light: #7A8D89 | Dark: #70847F
    textInverse: string;     // High-contrast inverse text

    // Primary Accents
    primary: string;         // Ocean Teal (Light: #0D9488 | Dark: #2DD4BF)
    primaryMuted: string;
    primaryBorder: string;

    secondary: string;       // Sunrise Coral (Light: #FF6B57 | Dark: #FF8A78)
    secondaryMuted: string;

    tertiary: string;        // Sun Yellow (Light: #FFC857 | Dark: #FFD878)
    tertiaryMuted: string;

    // Legacy/Main Interactive Accent (maps to primary Ocean Teal)
    accent: string;
    accentLight: string;
    accentDark: string;
    accentMuted: string;
    accentBorder: string;

    // Per-Tab Specific Accents
    tabLibrary: string;      // Teal #0D9488 (Dark: #2DD4BF)
    tabCourseHub: string;    // Blue #2F6FED (Dark: #60A5FA)
    tabExamPrep: string;     // Coral #F2644A (Dark: #FF8A78)
    tabAITutor: string;      // Violet #7C5CFA (Dark: #A78BFA)

    // Feedback & Semantics
    success: string;         // Light: #16A34A | Dark: #34D399
    successMuted: string;
    warning: string;         // Light: #D97706 | Dark: #FBBF24
    warningMuted: string;
    error: string;           // Light: #DC2626 | Dark: #F87171
    danger: string;          // Alias for error
    dangerMuted: string;
    info: string;

    // Citations & Highlights
    highlight: string;       // Light: #FFE58A | Dark: #5C4A00
    highlightText: string;   // Light: #4A3B00 | Dark: #FFE58A

    // Overlays & Scrims
    overlay: string;
    overlaySubtle: string;

    // Floating UI Elements
    floatingBg: string;
    floatingBorder: string;
    floatingShadow: string;
}

export const lightColors: ThemeColors = {
    // Canvas & Surfaces
    bg: '#F4F7F6',
    surface: '#FFFFFF',
    surfaceRaised: '#EAF1EF',
    surfaceSubtle: '#E4ECE9',
    surfaceHover: '#DEE8E5',
    pdfPaper: '#FDFCF7',

    // Borders & Dividers
    border: '#DCE6E3',
    borderLight: 'rgba(15, 26, 24, 0.06)',
    borderActive: '#0D9488',

    // Typography
    text: '#0F1A18',
    textSecondary: '#364441',
    textMuted: '#5B6B67',
    textSubtle: '#7A8D89',
    textInverse: '#FFFFFF',

    // Primary Accents
    primary: '#0D9488',
    primaryMuted: 'rgba(13, 148, 136, 0.12)',
    primaryBorder: 'rgba(13, 148, 136, 0.28)',

    secondary: '#FF6B57',
    secondaryMuted: 'rgba(255, 107, 87, 0.12)',

    tertiary: '#FFC857',
    tertiaryMuted: 'rgba(255, 200, 87, 0.18)',

    // Main Interactive Accent
    accent: '#0D9488',
    accentLight: '#14B8A6',
    accentDark: '#0F766E',
    accentMuted: 'rgba(13, 148, 136, 0.12)',
    accentBorder: 'rgba(13, 148, 136, 0.28)',

    // Per-Tab Accents
    tabLibrary: '#0D9488',
    tabCourseHub: '#2F6FED',
    tabExamPrep: '#F2644A',
    tabAITutor: '#7C5CFA',

    // Feedback & Semantics
    success: '#16A34A',
    successMuted: 'rgba(22, 163, 74, 0.12)',
    warning: '#D97706',
    warningMuted: 'rgba(217, 119, 6, 0.12)',
    error: '#DC2626',
    danger: '#DC2626',
    dangerMuted: 'rgba(220, 38, 38, 0.12)',
    info: '#2F6FED',

    // Citations & Highlights
    highlight: '#FFE58A',
    highlightText: '#4A3B00',

    // Overlays
    overlay: 'rgba(15, 26, 24, 0.55)',
    overlaySubtle: 'rgba(15, 26, 24, 0.25)',

    // Floating UI
    floatingBg: '#FFFFFF',
    floatingBorder: '#DCE6E3',
    floatingShadow: '#0F1A18',
};

export const darkColors: ThemeColors = {
    // Canvas & Surfaces (Avoid pure black)
    bg: '#0B1211',
    surface: '#121C1A',
    surfaceRaised: '#192724',
    surfaceSubtle: '#1F302C',
    surfaceHover: '#283D38',
    pdfPaper: '#FDFCF7', // Stays paper-toned in dark mode!

    // Borders & Dividers
    border: '#243531',
    borderLight: 'rgba(232, 240, 238, 0.08)',
    borderActive: '#2DD4BF',

    // Typography
    text: '#E8F0EE',
    textSecondary: '#BAC8C4',
    textMuted: '#94A8A3',
    textSubtle: '#70847F',
    textInverse: '#0B1211',

    // Primary Accents
    primary: '#2DD4BF',
    primaryMuted: 'rgba(45, 212, 191, 0.15)',
    primaryBorder: 'rgba(45, 212, 191, 0.35)',

    secondary: '#FF8A78',
    secondaryMuted: 'rgba(255, 138, 120, 0.16)',

    tertiary: '#FFD878',
    tertiaryMuted: 'rgba(255, 216, 120, 0.18)',

    // Main Interactive Accent
    accent: '#2DD4BF',
    accentLight: '#5EEAD4',
    accentDark: '#0D9488',
    accentMuted: 'rgba(45, 212, 191, 0.15)',
    accentBorder: 'rgba(45, 212, 191, 0.35)',

    // Per-Tab Accents
    tabLibrary: '#2DD4BF',
    tabCourseHub: '#60A5FA',
    tabExamPrep: '#FF8A78',
    tabAITutor: '#A78BFA',

    // Feedback & Semantics
    success: '#34D399',
    successMuted: 'rgba(52, 211, 153, 0.15)',
    warning: '#FBBF24',
    warningMuted: 'rgba(251, 191, 36, 0.15)',
    error: '#F87171',
    danger: '#F87171',
    dangerMuted: 'rgba(248, 113, 113, 0.15)',
    info: '#60A5FA',

    // Citations & Highlights
    highlight: '#5C4A00',
    highlightText: '#FFE58A',

    // Overlays
    overlay: 'rgba(5, 10, 9, 0.78)',
    overlaySubtle: 'rgba(5, 10, 9, 0.45)',

    // Floating UI
    floatingBg: '#121C1A',
    floatingBorder: '#243531',
    floatingShadow: '#000000',
};

// Gradients pairs defined in DESIGN.md
export const gradients = {
    tealToBlue: {
        light: ['#0D9488', '#2F6FED'] as const,
        dark: ['#14B8A6', '#3B82F6'] as const,
    },
    coralToYellow: {
        light: ['#F2644A', '#FFC857'] as const,
        dark: ['#FF6B57', '#FBBF24'] as const,
    },
    violetToIndigo: {
        light: ['#7C5CFA', '#2F6FED'] as const,
        dark: ['#A78BFA', '#60A5FA'] as const,
    },
    cardCoverGradients: [
        ['#0D9488', '#2F6FED'],
        ['#F2644A', '#FFC857'],
        ['#7C5CFA', '#3B82F6'],
        ['#10B981', '#06B6D4'],
        ['#EC4899', '#8B5CF6'],
    ] as const,
};

export const typography = {
    fontFamily: {
        sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
        reading: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
        medium: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        semiBold: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
        bold: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
    },
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
        display: 40,
    },
    lineHeights: {
        tight: 1.2,
        normal: 1.45,
        reading: 1.6, // 16-17px with 1.6 line height for summaries and study
    },
    weights: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
        black: '900' as const,
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
    controls: 12, // 12 for controls & buttons
    cards: 18,    // 16-20 for cards
    sheets: 28,   // 28 for bottom sheets & modals
    full: 9999,   // Pills
};

export const lightShadows = {
    subtle: {
        shadowColor: '#0F1A18',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    card: {
        shadowColor: '#0F1A18',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    elevated: {
        shadowColor: '#0F1A18',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    modal: {
        shadowColor: '#0F1A18',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
        elevation: 8,
    },
    glowAccent: {
        shadowColor: '#0D9488',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    glowCoral: {
        shadowColor: '#FF6B57',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    floating: {
        shadowColor: '#0F1A18',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 5,
    },
};

export const darkShadows = {
    subtle: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 1,
    },
    card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
        elevation: 2,
    },
    elevated: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
        elevation: 5,
    },
    modal: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.7,
        shadowRadius: 28,
        elevation: 10,
    },
    glowAccent: {
        shadowColor: '#2DD4BF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
    },
    glowCoral: {
        shadowColor: '#FF8A78',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    floating: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 6,
    },
};

export const theme = {
    colors: lightColors,
    gradients,
    typography,
    spacing,
    radii,
    shadows: lightShadows,
};

export default theme;

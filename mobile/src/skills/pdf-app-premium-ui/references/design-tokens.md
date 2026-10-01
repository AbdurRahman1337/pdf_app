# Design Token Starter

Use as a structure, not as final values. Choose a palette and typefaces specific to this app after the design-plan step; do not ship these placeholders unchanged.

## Contents
1. Token structure (CSS variables)
2. Type scale
3. Spacing, radii, elevation
4. Motion
5. Layout constants
6. Theming rules

## 1. Token structure

```css
:root {
  /* color - light */
  --bg: /* app background */;
  --surface: /* panels, cards */;
  --surface-raised: /* popovers, dialogs */;
  --border: /* hairline, low contrast */;
  --text: /* primary */;
  --text-muted: /* secondary, meets AA on --bg */;
  --accent: /* interactive + focus only */;
  --accent-contrast: /* text on accent */;
  --success: ; --warning: ; --danger: ;
  --highlight: /* citation/search highlight in PDF */;

  /* type */
  --font-ui: /* interface face */;
  --font-reading: /* summary + document-derived text */;
  --font-mono: /* only for code blocks */;
}

:root[data-theme="dark"] { /* redefine every color token; do not just invert */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* same values as dark theme */ }
}
```

## 2. Type scale (example ratios)
| Token | Size / line-height | Use |
|---|---|---|
| --text-xs | 12 / 16 | chips, captions |
| --text-sm | 14 / 20 | controls, meta |
| --text-md | 16 / 26 | body, chat |
| --text-lg | 20 / 28 | panel titles |
| --text-xl | 28 / 36 | page titles |
| --text-2xl | 40 / 46 | upload hero only |

- Reading text (summary): 16-17 px, line-height 1.6-1.7, max-width ~68ch.
- Use tabular numerals for page counts and progress.

## 3. Spacing, radii, elevation
- Spacing on a 4 px base: 4, 8, 12, 16, 24, 32, 48, 64.
- Radii by hierarchy: controls 8, cards 12-14, panels/dialogs 16-20, chips full. Do not use one radius everywhere.
- Elevation: level 0 flat with border, level 1 subtle shadow for cards on hover only if needed, level 2 for popovers and dialogs. Shadows tinted with the background hue, low opacity.

## 4. Motion
- Durations: 120 ms (micro), 200 ms (panels/tabs), 320 ms (page-level).
- Easing: `cubic-bezier(0.2, 0, 0, 1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits.
- Always provide the reduced-motion variant:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## 5. Layout constants
- Rail: 72 px collapsed / 260 px expanded.
- AI panel: default 440 px, min 360, max 640, resizable.
- Content max widths: library 1200 px, reading text ~68ch.
- Mobile bottom bar height 56 px plus safe-area inset.

## 6. Theming rules
- Every color used in a component comes from a token; no raw hex in components.
- Check contrast for text-muted on surface and accent on bg in both themes.
- The accent is not used as a decorative fill on large areas; it marks what is interactive, selected, or focused.
- PDF page canvas stays white (or paper-toned) in dark mode; offer an optional "night reading" filter rather than inverting text layers by default.

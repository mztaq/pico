/**
 * Pico IDE theme registry.
 *
 * Every theme owns a full editor palette, so switching theme changes the syntax
 * colours, the editor chrome and the surrounding interface together rather than
 * only repainting the background.
 */

export type Appearance = 'dark' | 'light';
export type ThemeId = string;

export interface SyntaxColors {
  /** Control and statement keywords: IF, WHILE, FOR, CASE, PROCEDURE, RETURN, THEN … */
  keyword: string;
  /** Cambridge data types: INTEGER, REAL, CHAR, STRING, BOOLEAN. */
  type: string;
  /** Identifiers the program declares. */
  variable: string;
  /** Calls into library routines and user-defined functions/procedures. */
  func: string;
  number: string;
  string: string;
  comment: string;
  operator: string;
  punctuation: string;
  /** TRUE and FALSE literals. */
  bool: string;
}

export interface ThemeSeed {
  id: ThemeId;
  name: string;
  appearance: Appearance;
  /** Maximum-contrast base text, with optional coloured accents. */
  highContrast?: boolean;
  /** Editor and application background. */
  bg: string;
  /** Panels, gutters and cards. */
  surface: string;
  text: string;
  muted: string;
  /** Buttons, focus rings, selection and the active line. */
  accent: string;
  /** Static gradient stops for buttons and accent previews. */
  accentGradient?: string[];
  syntax: SyntaxColors;
}

export interface PicoTheme extends ThemeSeed {
  /** Everything the interface and the editor chrome need, derived from the seed. */
  ui: {
    surfaceRaised: string;
    surfaceHover: string;
    surfaceInput: string;
    border: string;
    borderSoft: string;
    dim: string;
    accentStrong: string;
    accentSoft: string;
    gutter: string;
    gutterActive: string;
    lineHighlight: string;
    selection: string;
    cursor: string;
    indentGuide: string;
    indentGuideActive: string;
    matchBracket: string;
    tooltipBg: string;
    tooltipBorder: string;
  };
}

/* ------------------------------------------------------------------ colours */

function toRgb(hex: string): [number, number, number] {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? [...raw].map(character => character + character).join('') : raw;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function toHex(channels: number[]): string {
  return `#${channels.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

/** Blend two hex colours; t=0 returns a, t=1 returns b. */
export function mix(a: string, b: string, t: number): string {
  const first = toRgb(a);
  const second = toRgb(b);
  return toHex(first.map((value, index) => value + (second[index]! - value) * t));
}

/** Turn a hex colour into an rgba() string with the given opacity. */
export function alpha(hex: string, opacity: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** WCAG relative luminance, used by the theme tests to keep text readable. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/* ------------------------------------------------------------------- themes */

const seeds: ThemeSeed[] = [
  {
    id: 'high-contrast-red', name: 'High Contrast Red', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#ff9999',
    syntax: { keyword: '#ff9999', type: '#ffff99', variable: '#ffffff', func: '#00ffff', number: '#ffcc99', string: '#00ff00', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#ff99ff' },
  },
  {
    id: 'high-contrast-blue', name: 'High Contrast Blue', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#82baff',
    syntax: { keyword: '#82baff', type: '#00ffff', variable: '#ffffff', func: '#ffff99', number: '#ffcc99', string: '#00ff00', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#ff99ff' },
  },
  {
    id: 'high-contrast-yellow', name: 'High Contrast Yellow', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#ffe45e',
    syntax: { keyword: '#ffe45e', type: '#00ffff', variable: '#ffffff', func: '#00ff00', number: '#ffff99', string: '#ffcc99', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#ff99ff' },
  },
  {
    id: 'high-contrast-spectrum', name: 'High Contrast Spectrum', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#ff99ff',
    accentGradient: ['#ff99ff', '#00ffff', '#ffff99'],
    syntax: { keyword: '#ff99ff', type: '#00ffff', variable: '#ffffff', func: '#ffff99', number: '#ffcc99', string: '#00ff00', comment: '#cccccc', operator: '#00ffff', punctuation: '#ffffff', bool: '#ffff00' },
  },
  {
    id: 'high-contrast-sunset', name: 'High Contrast Sunset', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#ff9999',
    accentGradient: ['#ff9999', '#ffcc99', '#ffff99'],
    syntax: { keyword: '#ff9999', type: '#ffcc99', variable: '#ffffff', func: '#ffff99', number: '#ff99ff', string: '#00ff00', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#00ffff' },
  },
  {
    id: 'high-contrast-violet', name: 'High Contrast Violet', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#ff99ff',
    syntax: { keyword: '#ff99ff', type: '#00ffff', variable: '#ffffff', func: '#ffff99', number: '#ffcc99', string: '#00ff00', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#ffff00' },
  },
  {
    id: 'high-contrast-ocean', name: 'High Contrast Ocean', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#00ffff',
    syntax: { keyword: '#00ffff', type: '#ffff99', variable: '#ffffff', func: '#00ff00', number: '#ff99ff', string: '#ffcc99', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#ffff00' },
  },
  {
    id: 'high-contrast-ink', name: 'High Contrast Ink', appearance: 'light', highContrast: true,
    bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#000000', accent: '#660066',
    syntax: { keyword: '#660066', type: '#000080', variable: '#000000', func: '#005500', number: '#6b3000', string: '#800000', comment: '#333333', operator: '#000000', punctuation: '#000000', bool: '#550055' },
  },
  {
    id: 'high-contrast-forest', name: 'High Contrast Forest', appearance: 'light', highContrast: true,
    bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#000000', accent: '#005500',
    syntax: { keyword: '#005500', type: '#6b3000', variable: '#000000', func: '#000080', number: '#660066', string: '#800000', comment: '#333333', operator: '#000000', punctuation: '#000000', bool: '#550055' },
  },
  {
    id: 'high-contrast-dark', name: 'High Contrast Dark', appearance: 'dark', highContrast: true,
    bg: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', accent: '#ffffff',
    syntax: { keyword: '#ffff00', type: '#00ffff', variable: '#ffffff', func: '#00ff00', number: '#ffcc99', string: '#ffff99', comment: '#cccccc', operator: '#ffffff', punctuation: '#ffffff', bool: '#ff99ff' },
  },
  {
    id: 'high-contrast-light', name: 'High Contrast Light', appearance: 'light', highContrast: true,
    bg: '#ffffff', surface: '#ffffff', text: '#000000', muted: '#000000', accent: '#000000',
    syntax: { keyword: '#000080', type: '#005500', variable: '#000000', func: '#660066', number: '#6b3000', string: '#800000', comment: '#333333', operator: '#000000', punctuation: '#000000', bool: '#550055' },
  },
  {
    id: 'dark-plus', name: 'Dark+ (Visual Studio)', appearance: 'dark',
    bg: '#1e1e1e', surface: '#252526', text: '#d4d4d4', muted: '#8a8a8a', accent: '#0e7ad3',
    syntax: { keyword: '#c586c0', type: '#4ec9b0', variable: '#9cdcfe', func: '#dcdcaa', number: '#b5cea8', string: '#ce9178', comment: '#6a9955', operator: '#d4d4d4', punctuation: '#d4d4d4', bool: '#569cd6' },
  },
  {
    id: 'light-plus', name: 'Light+ (Visual Studio)', appearance: 'light',
    bg: '#ffffff', surface: '#f3f3f3', text: '#1f1f1f', muted: '#646464', accent: '#0066b8',
    syntax: { keyword: '#af00db', type: '#267f99', variable: '#001080', func: '#795e26', number: '#098658', string: '#a31515', comment: '#008000', operator: '#1f1f1f', punctuation: '#1f1f1f', bool: '#0000ff' },
  },
  {
    id: 'dracula', name: 'Dracula', appearance: 'dark',
    bg: '#282a36', surface: '#21222c', text: '#f8f8f2', muted: '#9298bd', accent: '#bd93f9',
    syntax: { keyword: '#ff79c6', type: '#8be9fd', variable: '#f8f8f2', func: '#50fa7b', number: '#bd93f9', string: '#f1fa8c', comment: '#7b86c0', operator: '#ff79c6', punctuation: '#f8f8f2', bool: '#bd93f9' },
  },
  {
    id: 'monokai', name: 'Monokai', appearance: 'dark',
    bg: '#272822', surface: '#2b2c26', text: '#f8f8f2', muted: '#a5a294', accent: '#a6e22e',
    syntax: { keyword: '#f92672', type: '#66d9ef', variable: '#f8f8f2', func: '#a6e22e', number: '#ae81ff', string: '#e6db74', comment: '#8d8a76', operator: '#f92672', punctuation: '#f8f8f2', bool: '#ae81ff' },
  },
  {
    id: 'one-dark', name: 'One Dark Pro', appearance: 'dark',
    bg: '#282c34', surface: '#21252b', text: '#abb2bf', muted: '#89909e', accent: '#61afef',
    syntax: { keyword: '#c678dd', type: '#e5c07b', variable: '#e06c75', func: '#61afef', number: '#d19a66', string: '#98c379', comment: '#7d8697', operator: '#56b6c2', punctuation: '#abb2bf', bool: '#d19a66' },
  },
  {
    id: 'one-light', name: 'One Light', appearance: 'light',
    bg: '#fafafa', surface: '#eaeaeb', text: '#383a42', muted: '#6f727d', accent: '#4078f2',
    syntax: { keyword: '#a626a4', type: '#c18401', variable: '#e45649', func: '#4078f2', number: '#986801', string: '#50a14f', comment: '#7b7d84', operator: '#0184bc', punctuation: '#383a42', bool: '#986801' },
  },
  {
    id: 'nord', name: 'Nord', appearance: 'dark',
    bg: '#2e3440', surface: '#3b4252', text: '#d8dee9', muted: '#98a3b8', accent: '#88c0d0',
    syntax: { keyword: '#81a1c1', type: '#8fbcbb', variable: '#d8dee9', func: '#88c0d0', number: '#b48ead', string: '#a3be8c', comment: '#8b98b0', operator: '#81a1c1', punctuation: '#eceff4', bool: '#81a1c1' },
  },
  {
    id: 'tokyo-night', name: 'Tokyo Night', appearance: 'dark',
    bg: '#1a1b26', surface: '#16161e', text: '#c0caf5', muted: '#8b93bd', accent: '#7aa2f7',
    syntax: { keyword: '#bb9af7', type: '#2ac3de', variable: '#c0caf5', func: '#7aa2f7', number: '#ff9e64', string: '#9ece6a', comment: '#828bbd', operator: '#89ddff', punctuation: '#a9b1d6', bool: '#ff9e64' },
  },
  {
    id: 'catppuccin-mocha', name: 'Catppuccin Mocha', appearance: 'dark',
    bg: '#1e1e2e', surface: '#181825', text: '#cdd6f4', muted: '#9ba0bb', accent: '#cba6f7',
    syntax: { keyword: '#cba6f7', type: '#f9e2af', variable: '#cdd6f4', func: '#89b4fa', number: '#fab387', string: '#a6e3a1', comment: '#8b90ad', operator: '#89dceb', punctuation: '#9399b2', bool: '#fab387' },
  },
  {
    id: 'catppuccin-latte', name: 'Catppuccin Latte', appearance: 'light',
    bg: '#eff1f5', surface: '#e6e9ef', text: '#4c4f69', muted: '#7b7f96', accent: '#8839ef',
    syntax: { keyword: '#8839ef', type: '#df8e1d', variable: '#4c4f69', func: '#1e66f5', number: '#fe640b', string: '#40a02b', comment: '#83879f', operator: '#04a5e5', punctuation: '#5c5f77', bool: '#fe640b' },
  },
  {
    id: 'gruvbox-dark', name: 'Gruvbox Dark', appearance: 'dark',
    bg: '#282828', surface: '#32302f', text: '#ebdbb2', muted: '#b3a894', accent: '#83a598',
    syntax: { keyword: '#fb4934', type: '#fabd2f', variable: '#ebdbb2', func: '#b8bb26', number: '#d3869b', string: '#b8bb26', comment: '#a89984', operator: '#8ec07c', punctuation: '#ebdbb2', bool: '#d3869b' },
  },
  {
    id: 'solarized-dark', name: 'Solarized Dark', appearance: 'dark',
    bg: '#002b36', surface: '#073642', text: '#93a1a1', muted: '#8a9a9e', accent: '#268bd2',
    syntax: { keyword: '#859900', type: '#b58900', variable: '#93a1a1', func: '#268bd2', number: '#d33682', string: '#2aa198', comment: '#7d939a', operator: '#859900', punctuation: '#93a1a1', bool: '#d33682' },
  },
  {
    id: 'solarized-light', name: 'Solarized Light', appearance: 'light',
    bg: '#fdf6e3', surface: '#eee8d5', text: '#586e75', muted: '#5f747c', accent: '#1f7fb8',
    syntax: { keyword: '#5f6f00', type: '#8a6800', variable: '#586e75', func: '#1a6a9e', number: '#a8266c', string: '#1c7a74', comment: '#7b8a92', operator: '#5f6f00', punctuation: '#4d6168', bool: '#a8266c' },
  },
  {
    id: 'github-dark', name: 'GitHub Dark', appearance: 'dark',
    bg: '#0d1117', surface: '#161b22', text: '#c9d1d9', muted: '#8b949e', accent: '#58a6ff',
    syntax: { keyword: '#ff7b72', type: '#7ee787', variable: '#ffa657', func: '#d2a8ff', number: '#79c0ff', string: '#a5d6ff', comment: '#8b949e', operator: '#ff7b72', punctuation: '#c9d1d9', bool: '#79c0ff' },
  },
  {
    id: 'github-light', name: 'GitHub Light', appearance: 'light',
    bg: '#ffffff', surface: '#f6f8fa', text: '#1f2328', muted: '#59636e', accent: '#0969da',
    syntax: { keyword: '#cf222e', type: '#116329', variable: '#953800', func: '#8250df', number: '#0550ae', string: '#0a3069', comment: '#6e7781', operator: '#cf222e', punctuation: '#1f2328', bool: '#0550ae' },
  },
  {
    id: 'ayu-mirage', name: 'Ayu Mirage', appearance: 'dark',
    bg: '#1f2430', surface: '#242936', text: '#cbccc6', muted: '#8b94a7', accent: '#ffcc66',
    syntax: { keyword: '#ffa759', type: '#5ccfe6', variable: '#cbccc6', func: '#ffd580', number: '#d4bfff', string: '#bae67e', comment: '#8b94a7', operator: '#f29e74', punctuation: '#cbccc6', bool: '#d4bfff' },
  },
  {
    id: 'night-owl', name: 'Night Owl', appearance: 'dark',
    bg: '#011627', surface: '#0b2942', text: '#d6deeb', muted: '#93a4b0', accent: '#82aaff',
    syntax: { keyword: '#c792ea', type: '#ffcb8b', variable: '#d6deeb', func: '#82aaff', number: '#f78c6c', string: '#ecc48d', comment: '#8ba1ac', operator: '#7fdbca', punctuation: '#d6deeb', bool: '#f78c6c' },
  },
  {
    id: 'palenight', name: 'Palenight', appearance: 'dark',
    bg: '#292d3e', surface: '#333747', text: '#a6accd', muted: '#8f96b8', accent: '#82aaff',
    syntax: { keyword: '#c792ea', type: '#ffcb6b', variable: '#a6accd', func: '#82aaff', number: '#f78c6c', string: '#c3e88d', comment: '#8f96b8', operator: '#89ddff', punctuation: '#a6accd', bool: '#f78c6c' },
  },
  {
    id: 'rose-pine', name: 'Rosé Pine', appearance: 'dark',
    bg: '#191724', surface: '#1f1d2e', text: '#e0def4', muted: '#a8a3bd', accent: '#c4a7e7',
    syntax: { keyword: '#c4a7e7', type: '#9ccfd8', variable: '#e0def4', func: '#9ccfd8', number: '#ebbcba', string: '#f6c177', comment: '#9a94ae', operator: '#eb6f92', punctuation: '#e0def4', bool: '#ebbcba' },
  },
  {
    id: 'synthwave-84', name: "SynthWave '84", appearance: 'dark',
    bg: '#262335', surface: '#2a2139', text: '#ffffff', muted: '#a9add6', accent: '#f92aad',
    syntax: { keyword: '#f92aad', type: '#fede5d', variable: '#ffffff', func: '#36f9f6', number: '#f97e72', string: '#ff8b39', comment: '#a9add6', operator: '#fede5d', punctuation: '#ffffff', bool: '#f97e72' },
  },
  {
    id: 'cobalt2', name: 'Cobalt2', appearance: 'dark',
    bg: '#193549', surface: '#122738', text: '#ffffff', muted: '#a3bacb', accent: '#ffc600',
    syntax: { keyword: '#ff9d00', type: '#9effff', variable: '#ffffff', func: '#ffc600', number: '#ff628c', string: '#3ad900', comment: '#a3bacb', operator: '#ff9d00', punctuation: '#ffffff', bool: '#ff628c' },
  },
  {
  id: 'everforest',
  name: 'Everforest',
  appearance: 'dark',
  bg: '#2d353b',
  surface: '#343f44',
  text: '#d3c6aa',
  muted: '#859289',
  accent: '#a7c080',

  syntax: {
    keyword: '#e67e80',
    type: '#dbbc7f',
    variable: '#d3c6aa',
    func: '#a7c080',
    number: '#d699b6',
    string: '#a7c080',
    comment: '#859289',
    operator: '#e69875',
    punctuation: '#d3c6aa',
    bool: '#83c092',
  },
    {
  id: 'kanagawa',
  name: 'Kanagawa',
  appearance: 'dark',

  bg: '#1f1f28',
  surface: '#16161d',
  text: '#dcd7ba',
  muted: '#727169',
  accent: '#7e9cd8',

  syntax: {
    keyword: '#957fb8',
    type: '#7e9cd8',
    variable: '#dcd7ba',
    func: '#7fb4ca',
    number: '#d27e99',
    string: '#98bb6c',
    comment: '#727169',
    operator: '#ffa066',
    punctuation: '#dcd7ba',
    bool: '#e6c384',
  },
},
},
];

export const DEFAULT_THEME_ID: ThemeId = 'catppuccin-mocha';

/** Theme names from earlier Pico versions, mapped onto the new registry. */
const LEGACY_THEME_IDS: Record<string, ThemeId> = {
  dark: 'dark-plus',
  light: 'light-plus',
  coffee: 'gruvbox-dark',
  matcha: 'gruvbox-dark',
  cappuccino: 'one-dark',
  mocha: 'rose-pine',
  raven: 'tokyo-night',
};

function buildTheme(seed: ThemeSeed): PicoTheme {
  const dark = seed.appearance === 'dark';
  const { bg, surface, text, muted, accent } = seed;
  if (seed.highContrast) return {
    ...seed,
    ui: {
      surfaceRaised: bg, surfaceHover: bg, surfaceInput: bg,
      border: accent, borderSoft: accent, dim: text,
      accentStrong: accent, accentSoft: alpha(accent, 0),
      gutter: text, gutterActive: text, lineHighlight: alpha(accent, 0),
      selection: alpha(accent, 0.3), cursor: accent,
      indentGuide: alpha(text, 0.65), indentGuideActive: text,
      matchBracket: alpha(accent, 0.2), tooltipBg: bg, tooltipBorder: accent,
    },
  };
  return {
    ...seed,
    ui: {
      surfaceRaised: mix(surface, text, dark ? 0.06 : 0.04),
      surfaceHover: mix(surface, text, dark ? 0.12 : 0.09),
      surfaceInput: mix(surface, dark ? '#000000' : '#000000', dark ? 0.4 : 0.03),
      border: mix(surface, text, dark ? 0.2 : 0.17),
      borderSoft: mix(surface, text, dark ? 0.11 : 0.09),
      dim: mix(muted, bg, 0.3),
      accentStrong: mix(accent, '#000000', dark ? 0.16 : 0.14),
      accentSoft: alpha(accent, dark ? 0.16 : 0.13),
      gutter: mix(muted, bg, 0.12),
      gutterActive: text,
      lineHighlight: alpha(accent, dark ? 0.09 : 0.07),
      selection: alpha(accent, dark ? 0.3 : 0.22),
      cursor: accent,
      indentGuide: alpha(text, dark ? 0.22 : 0.24),
      indentGuideActive: alpha(text, dark ? 0.5 : 0.48),
      matchBracket: alpha(accent, 0.32),
      tooltipBg: mix(surface, text, dark ? 0.1 : 0.03),
      tooltipBorder: mix(surface, text, dark ? 0.24 : 0.2),
    },
  };
}

export const THEMES: PicoTheme[] = seeds.map(buildTheme);

const THEME_BY_ID = new Map(THEMES.map(theme => [theme.id, theme]));

export function getTheme(id: string | undefined): PicoTheme {
  if (id && THEME_BY_ID.has(id)) return THEME_BY_ID.get(id)!;
  if (id && LEGACY_THEME_IDS[id]) return THEME_BY_ID.get(LEGACY_THEME_IDS[id]!)!;
  return THEME_BY_ID.get(DEFAULT_THEME_ID)!;
}

/** Validate a stored theme preference, migrating the names older Pico versions used. */
export function normalizeThemeId(value: unknown): ThemeId {
  if (typeof value === 'string') {
    if (THEME_BY_ID.has(value)) return value;
    if (LEGACY_THEME_IDS[value]) return LEGACY_THEME_IDS[value]!;
  }
  return DEFAULT_THEME_ID;
}

export function accentFill(theme: ThemeSeed): string {
  return theme.accentGradient ? `linear-gradient(120deg, ${theme.accentGradient.join(', ')})` : theme.accent;
}

/** Theme values that the stylesheet consumes as CSS custom properties. */
export function cssVariables(theme: PicoTheme): Record<string, string> {
  const { ui, syntax } = theme;
  return {
    '--bg': theme.bg,
    '--surface': theme.surface,
    '--surface-raised': ui.surfaceRaised,
    '--surface-hover': ui.surfaceHover,
    '--surface-input': ui.surfaceInput,
    '--border': ui.border,
    '--border-soft': ui.borderSoft,
    '--text': theme.text,
    '--reference-label': theme.appearance === 'dark' ? '#ffffff' : theme.text,
    '--muted': theme.muted,
    '--dim': ui.dim,
    '--accent': theme.accent,
    '--accent-fill': accentFill(theme),
    '--accent-strong': ui.accentStrong,
    '--accent-soft': ui.accentSoft,
    '--syntax-keyword': syntax.keyword,
    '--syntax-type': syntax.type,
    '--syntax-variable': syntax.variable,
    '--syntax-function': syntax.func,
    '--syntax-number': syntax.number,
    '--syntax-string': syntax.string,
    '--syntax-comment': syntax.comment,
    '--syntax-operator': syntax.operator,
    '--syntax-punctuation': syntax.punctuation,
    '--syntax-bool': syntax.bool,
    '--editor-bg': theme.bg,
    '--editor-gutter': ui.gutter,
    '--editor-gutter-active': ui.gutterActive,
    '--editor-line': ui.lineHighlight,
    '--editor-selection': ui.selection,
    '--editor-cursor': ui.cursor,
    '--editor-match': ui.matchBracket,
    '--indent-guide': ui.indentGuide,
    '--indent-guide-active': ui.indentGuideActive,
    '--tooltip-bg': ui.tooltipBg,
    '--tooltip-border': ui.tooltipBorder,
  };
}

export const themeIssues: string[] = [];
for (const theme of THEMES) {
  const colours: [string, string][] = [
    ['bg', theme.bg], ['surface', theme.surface], ['text', theme.text], ['muted', theme.muted], ['accent', theme.accent],
    ...Object.entries(theme.syntax) as [string, string][],
  ];
  for (const [name, value] of colours) if (!isHex(value)) themeIssues.push(`${theme.id}: ${name} is not a hex colour (${value})`);
  for (const [name, value] of Object.entries(theme.ui) as [string, string][]) if (!/^(#[0-9a-fA-F]{6}|rgba?\()/.test(value)) themeIssues.push(`${theme.id}: ${name} is not a colour (${value})`);
  if (contrastRatio(theme.text, theme.bg) < 4.5) themeIssues.push(`${theme.id}: text contrast is below 4.5:1`);
  if (contrastRatio(theme.muted, theme.bg) < 3) themeIssues.push(`${theme.id}: muted text contrast is below 3:1`);
}

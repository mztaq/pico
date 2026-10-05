import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, THEMES, contrastRatio, cssVariables, getTheme, mix, normalizeThemeId, themeIssues } from './themes';

describe('theme registry', () => {
  it('ships a large set of IDE themes with unique ids', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(THEMES.map(theme => theme.id)).size).toBe(THEMES.length);
  });

  it('covers both dark and light appearances', () => {
    expect(THEMES.filter(theme => theme.appearance === 'dark').length).toBeGreaterThan(8);
    expect(THEMES.filter(theme => theme.appearance === 'light').length).toBeGreaterThan(2);
  });

  it('gives every theme its own syntax colours rather than only a background', () => {
    for (const theme of THEMES) {
      const tokens = Object.values(theme.syntax);
      // Some roles legitimately share a colour (operators and punctuation, for example).
      expect(new Set(tokens).size).toBeGreaterThanOrEqual(6);
      for (const token of tokens) expect(contrastRatio(token, theme.bg)).toBeGreaterThan(2.2);
    }
    const signatures = new Set(THEMES.map(theme => Object.values(theme.syntax).join()));
    expect(signatures.size).toBe(THEMES.length);
  });

  it('keeps text readable in every theme', () => {
    expect(themeIssues).toEqual([]);
  });

  it('exposes the derived interface variables', () => {
    const variables = cssVariables(getTheme('dracula'));
    for (const key of ['--bg', '--surface', '--text', '--accent', '--syntax-keyword', '--indent-guide', '--editor-bg']) {
      expect(variables[key]).toBeTruthy();
    }
    expect(Object.keys(variables).length).toBeGreaterThan(25);
  });

  it('resolves ids and migrates the palettes older versions stored', () => {
    expect(getTheme('nord').id).toBe('nord');
    expect(getTheme('dark').id).toBe('dark-plus');
    expect(getTheme('light').id).toBe('light-plus');
    expect(getTheme('nonsense').id).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemeId('coffee')).toBe('gruvbox-dark');
    expect(normalizeThemeId(undefined)).toBe(DEFAULT_THEME_ID);
  });
});

it('provides 21:1 interface contrast and readable coloured syntax in all eleven high-contrast themes',()=>{
  const highContrastThemes = THEMES.filter(theme => theme.highContrast);
  expect(highContrastThemes).toHaveLength(11);
  for(const {id} of highContrastThemes) {
    const theme=getTheme(id);
    expect(theme.highContrast).toBe(true);expect(normalizeThemeId(id)).toBe(id);
    expect(contrastRatio(theme.text,theme.bg)).toBe(21);
    expect(contrastRatio(theme.muted,theme.surface)).toBe(21);
    for(const background of [theme.ui.surfaceRaised,theme.ui.surfaceHover,theme.ui.surfaceInput,theme.ui.tooltipBg]) {
      expect(background).toBe(theme.bg);expect(contrastRatio(theme.text,background)).toBe(21);
    }
    for(const token of Object.values(theme.syntax))expect(contrastRatio(token,theme.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(theme.accent,theme.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(theme.ui.border,theme.bg)).toBeGreaterThanOrEqual(7);
    expect(theme.ui.gutter).toBe(theme.text);expect(theme.ui.dim).toBe(theme.text);
  }
});


it('keeps coloured button text readable throughout both static gradients', () => {
  const gradientThemes = THEMES.filter(theme => theme.accentGradient);
  expect(gradientThemes.map(theme => theme.id)).toEqual(['high-contrast-spectrum', 'high-contrast-sunset']);
  for (const theme of gradientThemes) {
    expect(cssVariables(theme)['--accent-fill']).toContain('linear-gradient(');
    const foreground = contrastRatio('#ffffff', theme.accent) >= contrastRatio('#000000', theme.accent) ? '#ffffff' : '#000000';
    const stops = theme.accentGradient!;
    for (let segment = 1; segment < stops.length; segment++) {
      for (let sample = 0; sample <= 100; sample++) {
        const background = mix(stops[segment - 1]!, stops[segment]!, sample / 100);
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(background, theme.bg)).toBeGreaterThanOrEqual(7);
      }
    }
  }
});

it('preserves the original black and white high-contrast options alongside coloured accents', () => {
  expect(getTheme('high-contrast-dark').accent).toBe('#ffffff');
  expect(getTheme('high-contrast-light').accent).toBe('#000000');
  for (const id of ['high-contrast-red', 'high-contrast-blue', 'high-contrast-yellow', 'high-contrast-violet', 'high-contrast-ocean', 'high-contrast-ink', 'high-contrast-forest']) {
    const theme = getTheme(id);
    expect(theme.highContrast).toBe(true);
    expect(theme.accent).not.toBe(theme.text);
    expect(cssVariables(theme)['--accent-fill']).toBe(theme.accent);
    expect(contrastRatio('#ffffff', theme.accent) >= 7 || contrastRatio('#000000', theme.accent) >= 7).toBe(true);
  }
});

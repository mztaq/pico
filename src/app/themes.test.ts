import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, THEMES, contrastRatio, cssVariables, getTheme, normalizeThemeId, themeIssues } from './themes';

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
    expect(getTheme('dark').id).toBe(DEFAULT_THEME_ID);
    expect(getTheme('light').id).toBe('light-plus');
    expect(getTheme('nonsense').id).toBe(DEFAULT_THEME_ID);
    expect(normalizeThemeId('coffee')).toBe('gruvbox-dark');
    expect(normalizeThemeId(undefined)).toBe(DEFAULT_THEME_ID);
  });
});

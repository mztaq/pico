import { describe, expect, it } from 'vitest';
import { THEMES, contrastRatio } from '../app/themes';
import { learningThemeVariables } from './theme';

describe('Pico Learn theme isolation', () => {
  it.each(THEMES.map(theme => [theme.id, theme] as const))(
    'uses the correct sidebar, note, and control colors in %s',
    (_id, theme) => {
      const colors = learningThemeVariables(theme) as Record<string, string>;
      expect(colors['--bg']).toBe(theme.bg);
      expect(colors['--ds-panel']).toBe(theme.ui.surfaceRaised);
      expect(colors['--ds-text']).toBe(theme.text);
      expect(colors['--ds-muted']).toBe(theme.muted);
      expect(colors['--ds-line']).toBe(theme.ui.borderSoft);
      expect(colors['--ds-line-strong']).toBe(theme.ui.border);
      expect(colors['--ds-hover']).toBe(theme.ui.surfaceHover);
      expect(colors['--ds-accent-soft']).toBe(theme.ui.accentSoft);
      expect(colors.colorScheme).toBe(theme.appearance);
      expect(contrastRatio(colors['--ds-on-accent'], theme.accent)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('uses readable error colors for high contrast themes', () => {
    for (const theme of THEMES.filter(theme => theme.highContrast)) {
      const colors = learningThemeVariables(theme) as Record<string, string>;
      expect(colors['--learn-danger']).toBe(theme.accent);
      expect(colors['--learn-success']).toBe(theme.accent);
    }
  });
});

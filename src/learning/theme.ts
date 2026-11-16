import type { CSSProperties } from 'react';
import { contrastRatio, cssVariables, type PicoTheme } from '../app/themes';

/**
 * Design-system tokens are computed at the app root.
 * Rebind them on Learn itself so a different workspace's theme never
 * leaks into the topic sidebar, notes, or interactive examples.
 */
export function learningThemeVariables(theme: PicoTheme): CSSProperties {
  const contrastOnAccent = contrastRatio(theme.accent, '#ffffff') >= contrastRatio(theme.accent, '#000000')
    ? '#ffffff'
    : '#000000';

  return {
    ...cssVariables(theme),
    '--ds-panel': theme.ui.surfaceRaised,
    '--ds-panel-raised': theme.ui.surfaceRaised,
    '--ds-text': theme.text,
    '--ds-muted': theme.muted,
    '--ds-line': theme.ui.borderSoft,
    '--ds-line-strong': theme.ui.border,
    '--ds-hover': theme.ui.surfaceHover,
    '--ds-accent-soft': theme.ui.accentSoft,
    '--ds-on-accent': contrastOnAccent,
    '--learn-danger': theme.highContrast ? theme.accent : theme.appearance === 'dark' ? '#f38ba8' : '#b42336',
    '--learn-success': theme.highContrast ? theme.accent : theme.appearance === 'dark' ? '#a6e3a1' : '#216e46',
    colorScheme: theme.appearance,
  } as CSSProperties;
}

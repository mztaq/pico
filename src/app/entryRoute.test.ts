import { describe, expect, it } from 'vitest';
import { shouldOpenWorkspace } from './entryRoute';

describe('landing / workspace entry routing', () => {
  it('shows the landing page on the browser root', () => {
    expect(shouldOpenWorkspace('/', '', false)).toBe(false);
  });
  it('opens the browser workspaces at both /app URLs', () => {
    expect(shouldOpenWorkspace('/app', '', false)).toBe(true);
    expect(shouldOpenWorkspace('/app/', '', false)).toBe(true);
  });
  it('preserves existing installed desktop users at the original root URL', () => {
    expect(shouldOpenWorkspace('/', '', true)).toBe(true);
  });
  it('preserves legal and team deep links', () => {
    for (const hash of ['#team', '#privacy', '#terms', '#cookies']) {
      expect(shouldOpenWorkspace('/', hash, false)).toBe(true);
    }
  });
});

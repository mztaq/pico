// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { installInspectionDeterrents } from './inspectionDeterrents';

describe('inspection deterrents', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it('blocks common inspection/source shortcuts but leaves ordinary shortcuts alone', () => {
    cleanup = installInspectionDeterrents();
    for (const key of ['i', 'j', 'c']) {
      const blocked = new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: true, cancelable: true });
      window.dispatchEvent(blocked);
      expect(blocked.defaultPrevented).toBe(true);
    }
    const f12 = new KeyboardEvent('keydown', { key: 'F12', cancelable: true });
    window.dispatchEvent(f12);
    expect(f12.defaultPrevented).toBe(true);
    const source = new KeyboardEvent('keydown', { key: 'u', metaKey: true, cancelable: true });
    window.dispatchEvent(source);
    expect(source.defaultPrevented).toBe(true);
    const save = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    window.dispatchEvent(save);
    expect(save.defaultPrevented).toBe(false);
  });

  it('blocks the context menu and removes all handlers during cleanup', () => {
    cleanup = installInspectionDeterrents();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    cleanup(); cleanup = undefined;
    const after = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});

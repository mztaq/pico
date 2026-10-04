import { describe, expect, it } from 'vitest';
import { computePanelBox } from './FloatingPanel';

const viewport = { width: 1280, height: 800 };
const anchor = { top: 30, bottom: 62, left: 900, right: 1230 };

describe('floating panel placement', () => {
  it('opens below the anchor when the panel fits', () => {
    const box = computePanelBox({ anchor, naturalHeight: 400, preferredWidth: 320, viewport });
    expect(box.top).toBe(70);
    expect(box.maxHeight).toBe(400);
    expect(box.left + box.width).toBeLessThanOrEqual(viewport.width);
  });

  it('never leaves the viewport on either axis', () => {
    const cases = [
      { anchor: { top: 0, bottom: 40, left: -20, right: 200 }, naturalHeight: 2000 },
      { anchor: { top: 700, bottom: 760, left: 1000, right: 1300 }, naturalHeight: 900 },
      { anchor: { top: 380, bottom: 420, left: 600, right: 640 }, naturalHeight: 5000 },
      { anchor: { top: 10, bottom: 50, left: 0, right: 40 }, naturalHeight: 30 },
    ];
    for (const item of cases) {
      const box = computePanelBox({ ...item, preferredWidth: 320, viewport });
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.top + box.maxHeight).toBeLessThanOrEqual(viewport.height);
    }
  });

  it('flips above the anchor when the space below is too small', () => {
    const low = { top: 720, bottom: 760, left: 900, right: 1230 };
    const box = computePanelBox({ anchor: low, naturalHeight: 400, preferredWidth: 320, viewport });
    expect(box.top).toBeLessThan(low.top);
    expect(box.top + box.maxHeight).toBeLessThanOrEqual(low.top);
  });

  it('caps the height and scrolls when the content is taller than the screen', () => {
    const box = computePanelBox({ anchor, naturalHeight: 5000, preferredWidth: 320, viewport });
    expect(box.maxHeight).toBeLessThanOrEqual(viewport.height - anchor.bottom - 18);
    expect(box.top + box.maxHeight).toBeLessThanOrEqual(viewport.height);
  });

  it('shrinks the width on narrow screens instead of overflowing', () => {
    const box = computePanelBox({ anchor: { top: 30, bottom: 62, left: 40, right: 300 }, naturalHeight: 300, preferredWidth: 320, viewport: { width: 260, height: 800 } });
    expect(box.width).toBeLessThanOrEqual(260 - 20);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.left + box.width).toBeLessThanOrEqual(260);
  });

  it('aligns to the left edge of the anchor when asked', () => {
    const box = computePanelBox({ anchor, naturalHeight: 300, preferredWidth: 320, viewport, align: 'left' });
    expect(box.left).toBe(anchor.left);
  });
});
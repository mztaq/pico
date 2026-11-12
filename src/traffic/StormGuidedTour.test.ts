import { describe, expect, it } from 'vitest';
import { placeStormTourCard } from './StormGuidedTour';

describe('Traffic Storm guided tour placement', () => {
  it('places the card next to the target when space permits', () => {
    const target = { left: 260, top: 90, width: 600, height: 240 };
    const card = placeStormTourCard(target, 360, 280, 1440, 900);
    expect(card.left).toBeGreaterThanOrEqual(target.left + target.width);
    expect(card.top + card.height).toBeLessThanOrEqual(884);
  });

  it('keeps the card inside mobile viewports even with a large spotlight', () => {
    for (const target of [null, { left: 8, top: 48, width: 360, height: 520 }, { left: 260, top: 10, width: 60, height: 45 }]) {
      const card = placeStormTourCard(target, 328, 250, 375, 667);
      expect(card.left).toBeGreaterThanOrEqual(16);
      expect(card.top).toBeGreaterThanOrEqual(16);
      expect(card.left + card.width).toBeLessThanOrEqual(359);
      expect(card.top + card.height).toBeLessThanOrEqual(651);
    }
  });
});

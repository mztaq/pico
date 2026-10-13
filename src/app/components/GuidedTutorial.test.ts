import { describe, expect, it } from 'vitest';
import { placeTutorialCard, tutorialCompletionTip, tutorialSteps } from './GuidedTutorial';

describe('tutorial placement', () => {
  it('keeps the card beside an editor spotlight on desktop', () => {
    const target = { left: 240, top: 120, width: 760, height: 450 };
    const card = placeTutorialCard(target, 400, 430, 1440, 900);
    expect(card.left).toBeGreaterThan(target.left + target.width);
    expect(card.top + card.height).toBeLessThan(900);
  });
  it('keeps every card edge within a small viewport, including a large target', () => {
    for (const target of [null, { left: 8, top: 60, width: 374, height: 500 }, { left: 350, top: 10, width: 30, height: 35 }]) {
      const card = placeTutorialCard(target, 358, 500, 390, 640);
      expect(card.left).toBeGreaterThanOrEqual(16);
      expect(card.top).toBeGreaterThanOrEqual(16);
      expect(card.left + card.width).toBeLessThanOrEqual(374);
      expect(card.top + card.height).toBeLessThanOrEqual(624);
    }
  });
});

it('shows the exact names hint on both compiler tutorial completion screens', () => {
  expect(tutorialSteps.find(step => step.label === 'RUN')?.tip).toContain('special greeting');
  expect(tutorialCompletionTip).toBe('Try Mustaqim, Amar or Hamza when your program asks for a name. Some familiar faces from the Computer Science department receive a special greeting when you enter their names. Help opens this tour again.');
});

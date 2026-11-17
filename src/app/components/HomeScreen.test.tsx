// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('Pico homepage learning navigation', () => {
  it('shows six direct learning destinations rather than hiding them in one Learn link', () => {
    const html = renderToStaticMarkup(<HomeScreen onChoose={() => {}} />);
    const links = ['studio', 'challenges', 'notes', 'exam', 'classroom', 'arcade'];
    for (const section of links) {
      expect(html).toContain('/app/learn?section=' + section);
    }
    expect((html.match(/class="home-learning-card/g) || []).length).toBe(links.length);
    expect(html).toContain('Live Studio');
    expect(html).toContain('Exam practice');
    expect(html).toContain('Retro Arcade');
    expect(html).toContain('Pseudocode Compiler');
    expect(html).toContain('CPU Studio');
    expect(html).not.toContain('New to a topic?');
    expect(html).not.toContain('Choose your workspace');
  });
});

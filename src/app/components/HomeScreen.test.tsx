// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('Pico homepage navigation', () => {
  it('starts with only Learn and practise or Workspaces', () => {
    window.history.replaceState(null, '', '/app');
    const html = renderToStaticMarkup(<HomeScreen onChoose={() => {}} />);
    const markup = document.createElement('div');
    markup.innerHTML = html;
    expect(markup.querySelectorAll('.home-entry-card')).toHaveLength(2);
    expect(markup.querySelector('.home-entry')?.textContent).toContain('Learn and practise');
    expect(markup.querySelector('.home-entry')?.textContent).toContain('Workspaces');
    expect(markup.querySelector('.compiler-choices')).toBeNull();
    expect(markup.querySelector('.home-learning-card')).toBeNull();
  });

  it('shows all existing workspace cards only after the Workspaces choice', () => {
    window.history.replaceState(null, '', '/app?view=workspaces');
    const markup = document.createElement('div');
    markup.innerHTML = renderToStaticMarkup(<HomeScreen onChoose={() => {}} />);
    expect(markup.querySelector('.home-entry')).toBeNull();
    expect(markup.querySelectorAll('.compiler-choice')).toHaveLength(7);
    expect(markup.querySelector('.home-workspaces-heading h1')?.textContent).toBe('Workspaces');
    expect(markup.querySelector('.home-section-back')).not.toBeNull();
    window.history.replaceState(null, '', '/app');
  });
});

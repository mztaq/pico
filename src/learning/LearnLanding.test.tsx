// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearnLanding } from './LearnLanding';

const host = document.createElement('div');
const root = createRoot(host);
afterEach(async () => { await act(async () => root.render(<></>)); host.remove(); vi.unstubAllGlobals(); });

function press(label: string) {
  const button = [...host.querySelectorAll('button')].find(element => element.textContent?.includes(label));
  if (!button) throw Error('Missing button: ' + label);
  return act(async () => button.click());
}

describe('Learn game-first selection', () => {
  it('shows a real preview for each hosted game mode and launches the chosen mode', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    document.body.append(host);
    const onArena = vi.fn();
    await act(async () => root.render(<LearnLanding onArena={onArena} onNotes={() => {}} />));

    expect(host.textContent).toContain('Pico Arena');
    expect(host.textContent).toContain('Computer Science notes');
    expect(host.querySelectorAll('.learn-landing-modes button')).toHaveLength(4);
    expect(host.querySelectorAll('.learn-demo-cell')).toHaveLength(20);

    await press('Hacker Heist');
    expect(host.querySelector('.learn-demo--hacker')).not.toBeNull();
    await press('Data Sprint');
    expect(host.querySelectorAll('.learn-demo-racer')).toHaveLength(3);
    await press('Classic Quiz');
    expect(host.querySelector('.learn-demo-quiz')).not.toBeNull();

    await press('RAM');
    expect(host.textContent).toContain('Correct. RAM is volatile memory.');
    await press('Play Pico Arena');
    expect(onArena).toHaveBeenCalledWith('classic');
  });

  it('keeps one clear Notes destination separate from the game', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    document.body.append(host);
    const onNotes = vi.fn();
    await act(async () => root.render(<LearnLanding onNotes={onNotes} onArena={() => {}} />));
    await press('Open notes');
    expect(onNotes).toHaveBeenCalledOnce();
  });
});

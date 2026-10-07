// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordUpdatesDialog } from './DiscordUpdatesDialog';

let container: HTMLDivElement;
let root: Root;
const updates = [
  { id: 'u1', content: 'Daily update: shipped a lesson', timestamp: '2026-10-06T10:00:00.000Z', category: 'daily' as const },
  { id: 'u2', content: 'Weekly update: improved examples <script>not markup</script>', timestamp: '2026-10-01T10:00:00.000Z', category: 'weekly' as const },
];
async function render(onClose = vi.fn()) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<DiscordUpdatesDialog updates={updates} onClose={onClose} />));
  return onClose;
}
beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove(); vi.unstubAllGlobals(); });

describe('Discord updates dialog', () => {
  it('renders sorted update text as escaped text with dates and the human-only notice', async () => {
    await render();
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(container.querySelectorAll('.update-card')).toHaveLength(2);
    expect(container.querySelectorAll('.update-category-daily')).toHaveLength(1);
    expect(container.querySelectorAll('.update-category-weekly')).toHaveLength(1);
    expect(container.querySelectorAll('.update-content')[0]?.textContent).toContain('Daily update');
    expect(container.querySelector('.update-content script')).toBeNull();
    expect(container.textContent).toContain('<script>not markup</script>');
    expect(container.textContent).toContain('Only human-authored posts are shown.');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close updates');
  });

  it('closes on Escape and from the close button', async () => {
    const onClose = await render();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close updates"]')!.click());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes on backdrop clicks but not clicks inside the dialog', async () => {
    const onClose = await render();
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLElement>('.updates-backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

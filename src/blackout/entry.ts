/* First-visit graphics setup loads before WebGL and before the full game scene.
   The chosen quality therefore applies to initial 3D geometry as well as FPS. */
// Keep the public URL clean even if a browser reused a cached folder slash.
if (location.pathname === '/app/game/blackout-protocol/') {
  history.replaceState(history.state, '', '/app/game/blackout-protocol' + location.search + location.hash);
}
type Quality = 'auto' | 'low' | 'high';
const QUALITY_KEY = 'pico.blackout.graphics';
const validQuality = (value: string | null): Quality | null =>
  value === 'auto' || value === 'low' || value === 'high' ? value : null;

const setup = document.getElementById('graphics-setup') as HTMLDialogElement;
const loading = document.getElementById('loading');
let stored: Quality | null = null;
try { stored = validQuality(localStorage.getItem(QUALITY_KEY)); }
catch { /* Storage is optional. This visit still works without it. */ }

async function loadGame(quality: Quality) {
  // In-memory fallback also works in browsers that block localStorage.
  (window as Window & { __picoBlackoutQuality?: Quality }).__picoBlackoutQuality = quality;
  loading?.removeAttribute('hidden');
  try {
    await import('./game');
  } catch (error) {
    console.error('[Blackout Protocol] Unable to load game', error);
    if (loading) {
      loading.replaceChildren();
      const message = document.createElement('p');
      message.className = 'bp-load-error';
      message.textContent = 'Blackout Protocol failed to load. Refresh this page to try again.';
      loading.append(message);
    }
  }
}

if (stored) {
  void loadGame(stored);
} else if (typeof setup?.showModal === 'function') {
  // Show the game menu behind the dialog, not a skeleton screen.
  loading?.setAttribute('hidden', '');
  const form = setup.querySelector<HTMLFormElement>('form')!;
  setup.addEventListener('cancel', event => event.preventDefault());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = new FormData(form).get('quality');
    const quality = validQuality(typeof value === 'string' ? value : null) ?? 'auto';
    try { localStorage.setItem(QUALITY_KEY, quality); }
    catch { /* Session fallback lives on window until the page is refreshed. */ }
    setup.close();
    void loadGame(quality);
  });
  setup.showModal();
} else {
  // No HTMLDialogElement support: use safe automatic quality and keep gameplay playable.
  void loadGame('auto');
}

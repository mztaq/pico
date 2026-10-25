/**
 * Pico sound effects — tiny synthesized cues (no audio files).
 * Interface feedback only: it never changes app behaviour, and it stays silent
 * when muted, when storage is blocked, or when the browser has no Web Audio.
 */
const KEY = 'pico.sound.v1';
type Cue = 'tap' | 'toggle' | 'run' | 'stop' | 'success' | 'error' | 'open' | 'step';

let context: AudioContext | null = null;
let installed = false;
const listeners = new Set<(enabled: boolean) => void>();

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return false; }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* Preference simply isn't remembered. */ }
  listeners.forEach(listener => listener(enabled));
  if (enabled) playCue('toggle');
}

export function onSoundChange(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch { return null; }
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency?: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playCue(cue: Cue): void {
  if (!soundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  switch (cue) {
    case 'tap': tone(ctx, 1250, t, 0.035, 0.035, 'triangle'); break;
    case 'toggle': tone(ctx, 880, t, 0.05, 0.05, 'triangle'); tone(ctx, 1320, t + 0.045, 0.06, 0.04, 'triangle'); break;
    case 'open': tone(ctx, 620, t, 0.07, 0.04, 'sine', 900); break;
    case 'step': tone(ctx, 1600, t, 0.03, 0.03, 'square'); break;
    case 'run': tone(ctx, 523, t, 0.08, 0.06, 'triangle'); tone(ctx, 784, t + 0.07, 0.11, 0.06, 'triangle'); break;
    case 'stop': tone(ctx, 440, t, 0.12, 0.06, 'triangle', 260); break;
    case 'success': tone(ctx, 659, t, 0.09, 0.05, 'sine'); tone(ctx, 988, t + 0.08, 0.16, 0.05, 'sine'); break;
    case 'error': tone(ctx, 196, t, 0.16, 0.07, 'sawtooth', 150); break;
  }
}

function cueFor(target: Element): Cue | null {
  const control = target.closest<HTMLElement>('button, [role="button"], [role="tab"], [role="switch"], [role="option"], summary, a[href], label:has(input[type="radio"]), label:has(input[type="checkbox"])');
  if (!control || control.matches(':disabled, [aria-disabled="true"]')) return null;
  if (control.matches('.run-button, .logic-run, .cpu-play')) return 'run';
  if (control.matches('.stop-button')) return 'stop';
  if (control.matches('[aria-label^="Step forward"], .logic-sim-controls button')) return 'step';
  if (control.matches('[role="switch"], [role="option"], label')) return 'toggle';
  if (control.matches('.compiler-choice, summary, [aria-haspopup], [data-tour="files"], [aria-label="Open settings"]')) return 'open';
  return 'tap';
}

/** Installs one document-level listener for interface cues and watches for new errors. */
export function installSoundEffects(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const cue = cueFor(event.target);
    if (cue) playCue(cue);
  }, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if ((event.key !== 'Enter' && event.key !== ' ') || !(event.target instanceof Element)) return;
    if (event.target.matches('input, textarea, [contenteditable="true"], .cm-content')) return;
    const cue = cueFor(event.target);
    if (cue) playCue(cue);
  }, { capture: true });
  if (typeof MutationObserver === 'undefined') return;
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches('.runtime-error-card, .console-entry-error') || node.querySelector('.runtime-error-card')) { playCue('error'); return; }
      if (node.matches('.cpu-phase-halted, .update-toast')) { playCue('success'); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

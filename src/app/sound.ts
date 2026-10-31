/**
 * Pico sound effects — tiny synthesized cues (no audio files).
 * Interface feedback only: it never changes app behaviour, and it stays silent
 * when muted, when storage is blocked, or when the browser has no Web Audio.
 */
const KEY = 'pico.sound.v1';
type Cue = 'tap' | 'toggleOn' | 'toggleOff' | 'run' | 'stop' | 'success' | 'error' | 'open' | 'close' | 'step' | 'stepBack' | 'tab' | 'add' | 'remove' | 'undo' | 'redo' | 'theme' | 'file' | 'notify' | 'zoomIn' | 'zoomOut' | 'place' | 'zap' | 'lampOn' | 'type' | 'typeEnter' | 'typeErase';

let context: AudioContext | null = null;
let installed = false;
const UI_CUE_GAIN = 1.7;
const NOISE_CUE_GAIN = 1.25;
const MIN_TYPING_INTERVAL_MS = 24;
let lastTypingAt = -Infinity;
let lastPhysicalTypingAt = -Infinity;
const listeners = new Set<(enabled: boolean) => void>();

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return false; }
}

export function setSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* Preference simply isn't remembered. */ }
  listeners.forEach(listener => listener(enabled));
  if (enabled) playCue('toggleOn');
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

/** A short filtered noise burst: the crackle of current jumping along a wire. */
function crackle(ctx: AudioContext, start: number, duration: number, volume: number, frequency: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Sparse, jittery impulses read as electricity rather than plain hiss.
  for (let i = 0; i < length; i += 1) data[i] = Math.random() < 0.18 ? (Math.random() * 2 - 1) * (1 - i / length) : 0;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 1.4;
  gain.gain.setValueAtTime(Math.min(volume * NOISE_CUE_GAIN, 0.55), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency?: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.min(volume * UI_CUE_GAIN, 0.20), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/**
 * Pico's tiny, friendly digital key tones. Rounded attacks, quick soft decays
 * and a hint of glassy overtones replace the earlier noisy mechanical switch.
 *
 * The three original waveforms are generated in-memory and cached per context.
 * No eDEX-UI recordings or third-party samples are used.
 */
type KeyKind = 'normal' | 'enter' | 'erase';
const keyBuffers = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
let keyVariation = 0;

function buildKeyBuffer(ctx: AudioContext, kind: KeyKind, variation: number): AudioBuffer {
  const duration = kind === 'enter' ? 0.118 : kind === 'erase' ? 0.062 : 0.079;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const tau = Math.PI * 2;
  // Subtle pitch changes prevent a repetitive computer beep without harsh noise.
  const variationHz = [-14, 0, 11, -6][variation] ?? 0;
  const frequency = (kind === 'enter' ? 635 : kind === 'erase' ? 550 : 725) + variationHz;

  // A 4ms round onset and a short decay prevent both a click at sample start
  // and a hard cut at the end. No distorted/sawtooth or random-noise layer.
  const envelope = (time: number, since: number, decay: number) => {
    if (time < since) return 0;
    const t = time - since;
    return Math.sin(Math.min(1, t / 0.0045) * Math.PI / 2) * Math.exp(-t * decay);
  };

  for (let i = 0; i < length; i += 1) {
    const t = i / ctx.sampleRate;
    const tail = Math.min(1, Math.max(0, (duration - t) / 0.012));
    const baseEnvelope = envelope(t, 0, kind === 'enter' ? 52 : 65);
    // A tiny downward pitch bend gives normal keys a soft, rounded 'bloop'.
    const bend = kind === 'erase' ? 30 * Math.exp(-t * 85) : 55 * Math.exp(-t * 90);
    const pitch = frequency + bend;
    const base = Math.sin(tau * pitch * t) * 0.68 * baseEnvelope;
    const sparkle = Math.sin(tau * pitch * 1.68 * t + 0.4) * 0.12
      * envelope(t, 0, 105);
    // Backspace gently falls; Enter answers with a small higher note.
    const eraseTail = kind === 'erase'
      ? Math.sin(tau * 430 * t) * 0.11 * envelope(t, 0.012, 85)
      : 0;
    const enterResponse = kind === 'enter'
      ? (Math.sin(tau * (880 + variationHz) * (t - 0.041)) * 0.40
        + Math.sin(tau * 1320 * (t - 0.041)) * 0.055)
        * envelope(t, 0.041, 65)
      : 0;
    data[i] = Math.max(-0.9, Math.min(0.9, (base + sparkle + eraseTail + enterResponse) * tail));
  }
  return buffer;
}

function playKeyboardClick(ctx: AudioContext, start: number, kind: KeyKind): void {
  let cached = keyBuffers.get(ctx);
  if (!cached) {
    cached = new Map();
    keyBuffers.set(ctx, cached);
  }
  const variant = keyVariation++ % 4;
  const id = kind + ':' + variant;
  let buffer = cached.get(id);
  if (!buffer) {
    buffer = buildKeyBuffer(ctx, kind, variant);
    cached.set(id, buffer);
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  // Lower than the other UI cues so fast typing stays gentle and unobtrusive.
  gain.gain.setValueAtTime(kind === 'enter' ? 0.24 : kind === 'erase' ? 0.19 : 0.21, start);
  source.connect(gain).connect(ctx.destination);
  source.start(start);
}

export function playCue(cue: Cue): void {
  if (!soundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  switch (cue) {
    case 'tap': tone(ctx, 1250, t, 0.035, 0.035, 'triangle'); break;
    case 'type': playKeyboardClick(ctx, t, 'normal'); break;
    case 'typeEnter': playKeyboardClick(ctx, t, 'enter'); break;
    case 'typeErase': playKeyboardClick(ctx, t, 'erase'); break;
    case 'toggleOn': tone(ctx, 880, t, 0.05, 0.05, 'triangle'); tone(ctx, 1320, t + 0.045, 0.06, 0.04, 'triangle'); break;
    case 'toggleOff': tone(ctx, 1100, t, 0.05, 0.045, 'triangle'); tone(ctx, 740, t + 0.045, 0.06, 0.04, 'triangle'); break;
    case 'open': tone(ctx, 620, t, 0.07, 0.04, 'sine', 900); break;
    case 'close': tone(ctx, 900, t, 0.07, 0.035, 'sine', 600); break;
    case 'tab': tone(ctx, 1500, t, 0.025, 0.03, 'sine'); tone(ctx, 1900, t + 0.02, 0.03, 0.02, 'sine'); break;
    case 'step': tone(ctx, 1600, t, 0.03, 0.03, 'square'); break;
    case 'stepBack': tone(ctx, 1200, t, 0.03, 0.03, 'square'); break;
    case 'run': tone(ctx, 523, t, 0.08, 0.06, 'triangle'); tone(ctx, 784, t + 0.07, 0.11, 0.06, 'triangle'); break;
    case 'stop': tone(ctx, 440, t, 0.12, 0.06, 'triangle', 260); break;
    case 'success': tone(ctx, 659, t, 0.09, 0.05, 'sine'); tone(ctx, 988, t + 0.08, 0.16, 0.05, 'sine'); break;
    case 'error': tone(ctx, 196, t, 0.16, 0.07, 'sawtooth', 150); break;
    case 'add': tone(ctx, 700, t, 0.06, 0.05, 'sine', 1150); tone(ctx, 1400, t + 0.05, 0.05, 0.03, 'sine'); break;
    case 'remove': tone(ctx, 520, t, 0.1, 0.05, 'triangle', 220); break;
    case 'undo': tone(ctx, 1000, t, 0.08, 0.035, 'sine', 650); break;
    case 'redo': tone(ctx, 650, t, 0.08, 0.035, 'sine', 1000); break;
    case 'theme': [784, 988, 1175, 1568].forEach((f, i) => tone(ctx, f, t + i * 0.035, 0.09, 0.03, 'sine')); break;
    case 'file': tone(ctx, 300, t, 0.12, 0.045, 'triangle', 700); break;
    case 'notify': tone(ctx, 1046, t, 0.12, 0.04, 'sine'); tone(ctx, 1318, t + 0.1, 0.18, 0.035, 'sine'); break;
    case 'zoomIn': tone(ctx, 900, t, 0.05, 0.03, 'sine', 1300); break;
    case 'zoomOut': tone(ctx, 1300, t, 0.05, 0.03, 'sine', 900); break;
    case 'zap':
      // Layer a bright electrical snap over two noisy arcs and a short low-voltage thump.
      crackle(ctx, t, 0.2, 0.42, 3000 + Math.random() * 1800);
      crackle(ctx, t + 0.045, 0.1, 0.24, 1700 + Math.random() * 900);
      tone(ctx, 1450 + Math.random() * 500, t, 0.12, 0.075, 'sawtooth', 180);
      tone(ctx, 110, t, 0.18, 0.075, 'sawtooth', 58);
      break;
    case 'lampOn': tone(ctx, 1568, t, 0.06, 0.04, 'sine'); tone(ctx, 2093, t + 0.05, 0.14, 0.035, 'sine'); crackle(ctx, t, 0.12, 0.3, 3800); tone(ctx, 170, t, 0.11, 0.045, 'triangle', 90); break;
    case 'place': tone(ctx, 180, t, 0.06, 0.08, 'sine', 90); tone(ctx, 1200, t, 0.02, 0.02, 'triangle'); break;
  }
}

function cueFor(target: Element): Cue | null {
  const control = target.closest<HTMLElement>('button, [role="button"], [role="tab"], [role="switch"], [role="option"], summary, a[href], label:has(input[type="radio"]), label:has(input[type="checkbox"])');
  if (!control || control.matches(':disabled, [aria-disabled="true"]')) return null;
  const label = `${control.getAttribute('aria-label') ?? ''} ${control.getAttribute('title') ?? ''} ${control.textContent ?? ''}`.toLowerCase();
  const checkbox = control.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (control.matches('.run-button, .logic-run, .cpu-play')) return 'run';
  if (control.matches('.stop-button')) return 'stop';
  if (/step backward|^\s*back\b/.test(label) && control.closest('.cpu-playback')) return 'stepBack';
  if (/step forward|\bstep\b/.test(label) && control.closest('.cpu-playback, .logic-sim-controls, .debugger-controls, .step-actions')) return 'step';
  if (control.matches('[role="switch"]')) return control.getAttribute('aria-checked') === 'true' ? 'toggleOff' : 'toggleOn';
  if (checkbox) return checkbox.checked ? 'toggleOff' : 'toggleOn';
  if (control.matches('.theme-option')) return 'theme';
  if (control.matches('[role="tab"], .dock-tab, .project-select, .file-tab-select, .keyword-pill')) return 'tab';
  if (/\bundo\b/.test(label)) return 'undo';
  if (/\bredo\b/.test(label)) return 'redo';
  if (/zoom in/.test(label)) return 'zoomIn';
  if (/zoom out/.test(label)) return 'zoomOut';
  if (/\b(delete|remove|reset|reject)\b|close .*\.(pico|py)/.test(label)) return 'remove';
  if (/\b(new|add)\b/.test(label) || control.matches('.new-workspace, .file-tab-new')) return 'add';
  if (/\b(export|import|download|upload|save)\b/.test(label)) return 'file';
  if (control.matches('.flow-palette-block, .logic-symbol-button')) return 'place';
  if (/\b(close|dismiss|not now|skip|done|cancel)\b/.test(label)) return 'close';
  if (control.matches('.compiler-choice, summary, [aria-haspopup], [data-tour="files"], .update-trigger') || /settings|theme|help|tutorial|reference/.test(label)) return 'open';
  return 'tap';
}

/** Keep typing feedback within the Python/pseudocode editors and their input prompt. */
export function isCompilerTypingKey(event: KeyboardEvent): boolean {
  if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (!(event.target instanceof Element)) return false;
  if (!event.target.closest('.code-editor .cm-content, .console-input-form input')) return false;
  return event.key.length === 1 || ['Enter', 'Backspace', 'Delete', 'Tab'].includes(event.key);
}

function playTypingCue(physical: boolean, cue: 'type' | 'typeEnter' | 'typeErase'): void {
  if (!soundEnabled()) return;
  const now = performance.now();
  // Track ALL physical keys, even throttled ones, so beforeinput never doubles them.
  if (physical) lastPhysicalTypingAt = now;
  if (!physical && now - lastPhysicalTypingAt < 90) return;
  if (now - lastTypingAt < MIN_TYPING_INTERVAL_MS) return;
  lastTypingAt = now;
  playCue(cue);
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
    if (isCompilerTypingKey(event)) playTypingCue(true,
      event.key === 'Enter' ? 'typeEnter' : event.key === 'Backspace' || event.key === 'Delete' ? 'typeErase' : 'type'
    );
    if ((event.key !== 'Enter' && event.key !== ' ') || !(event.target instanceof Element)) return;
    if (event.target.matches('input, textarea, [contenteditable="true"], .cm-content')) return;
    const cue = cueFor(event.target);
    if (cue) playCue(cue);
  }, { capture: true });
  // On-screen keyboards trigger beforeinput without keyboard keydown events.
  // Do not duplicate the click after a physical keypress or for pasted code.
  document.addEventListener('beforeinput', event => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.code-editor .cm-content, .console-input-form input')) return;
    if (event.isComposing || !['insertText', 'insertLineBreak', 'insertParagraph', 'deleteContentBackward', 'deleteContentForward'].includes(event.inputType)) return;
    playTypingCue(false,
      event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph' ? 'typeEnter'
      : event.inputType.startsWith('delete') ? 'typeErase' : 'type'
    );
  }, { capture: true });
  if (typeof MutationObserver === 'undefined') return;
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches('.runtime-error-card, .console-entry-error') || node.querySelector('.runtime-error-card')) { playCue('error'); return; }
      if (node.matches('.cpu-phase-halted, .tutorial-complete')) { playCue('success'); return; }
      if (node.matches('.update-toast')) { playCue('notify'); return; }
      if (node.matches('.console-input-form') || node.querySelector('.console-input-form')) { playCue('notify'); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
}


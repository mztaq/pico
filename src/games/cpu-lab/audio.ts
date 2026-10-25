/**
 * CPU Lab audio — synthesized, no files. Positional cues use PannerNodes so a
 * door opening behind you sounds behind you. Silent when Pico sound is off.
 */
import { soundEnabled, onSoundChange } from '../../app/sound';
import type { Bus } from '../../cpu/engine';

type Vec = { x: number; y: number; z: number };
const BUS_PITCH: Record<Bus, number> = { address: 660, data: 880, control: 440, internal: 990 };

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: { gain: GainNode; stop: () => void } | null = null;
  private enabled = soundEnabled();
  private volume = 0.7;
  private unsubscribe: (() => void) | null = null;
  constructor() { this.listen(); }
  private listen() { this.unsubscribe ??= onSoundChange(on => { this.enabled = on; this.applyVolume(); }); }

  /** Must be called from a user gesture (browsers block autoplay). */
  start() {
    this.listen();
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try { this.ctx = new Ctor(); } catch { return; }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    this.startHum();
  }
  setVolume(v: number) { this.volume = v; this.applyVolume(); }
  private applyVolume() { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.6 : 0, this.ctx.currentTime, 0.05); }
  setPower(level: number) { if (this.hum && this.ctx) this.hum.gain.gain.setTargetAtTime(0.03 + level * 0.05, this.ctx.currentTime, 0.8); }

  listener(pos: Vec, forward: Vec) {
    const l = this.ctx?.listener; if (!l) return;
    if (l.positionX) { l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z; l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
  }

  private out(at?: Vec): AudioNode | null {
    if (!this.ctx || !this.master || !this.enabled) return null;
    if (!at) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.2;
    p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z;
    p.connect(this.master);
    return p;
  }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at?: Vec, delay = 0, slideTo?: number) {
    const dest = this.out(at); if (!dest || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  private startHum() {
    if (!this.ctx || !this.master) return;
    const gain = this.ctx.createGain(); gain.gain.value = 0.03;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 180;
    const a = this.ctx.createOscillator(), b = this.ctx.createOscillator();
    a.type = 'sawtooth'; a.frequency.value = 55; b.type = 'sine'; b.frequency.value = 82.6;
    a.connect(filter); b.connect(filter); filter.connect(gain).connect(this.master);
    a.start(); b.start();
    this.hum = { gain, stop: () => { a.stop(); b.stop(); } };
  }

  transfer(bus: Bus, at?: Vec) { this.tone(BUS_PITCH[bus], 0.09, 'triangle', 0.18, at); }
  step(at?: Vec) { this.tone(1200, 0.03, 'square', 0.05, at); }
  interact() { this.tone(520, 0.06, 'sine', 0.15); this.tone(780, 0.08, 'sine', 0.12, undefined, 0.05); }
  error(at?: Vec) { this.tone(110, 0.35, 'sawtooth', 0.22, at); this.tone(104, 0.35, 'square', 0.1, at); }
  door(at?: Vec) { this.tone(70, 1.4, 'sawtooth', 0.2, at, 0, 160); this.tone(240, 0.12, 'square', 0.08, at, 1.3); }
  success(at?: Vec) { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, at, i * 0.09)); }
  footstep() { this.tone(90 + Math.random() * 30, 0.05, 'sine', 0.05); }
  finale() { [262, 330, 392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 1.2, 'triangle', 0.13, undefined, i * 0.16)); }

  dispose() { this.unsubscribe?.(); this.unsubscribe = null; this.hum?.stop(); this.hum = null; void this.ctx?.close(); this.ctx = null; }
}

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSoundEffects, isCompilerTypingKey, soundEnabled } from './sound';

const bursts = vi.fn();
const startedSampleLengths: number[] = [];
const waveforms: Float32Array[] = [];
const playedWaveforms: Float32Array[] = [];
let clock = 100_000;

type FakeNode = { connect: (destination?: unknown) => FakeNode };
function fakeNode(): FakeNode { return { connect: () => fakeNode() }; }

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume() { return Promise.resolve(); }
  createBuffer(_channels: number, length: number) {
    const values = new Float32Array(length);
    waveforms.push(values);
    return { getChannelData: () => values };
  }
  createBufferSource() {
    const source = {
      ...fakeNode(),
      buffer: null as { getChannelData: (channel: number) => Float32Array } | null,
      start() {
        bursts();
        const samples = source.buffer?.getChannelData(0) ?? new Float32Array();
        startedSampleLengths.push(samples.length);
        playedWaveforms.push(samples);
      },
    };
    return source;
  }
  createBiquadFilter() { return { ...fakeNode(), type: 'bandpass', frequency: { value: 0 }, Q: { value: 0 } }; }
  createGain() {
    return { ...fakeNode(), gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } };
  }
  createOscillator() {
    return { ...fakeNode(), type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {} };
  }
}

function sendKey(target: Element, key: string, props: KeyboardEventInit = {}): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...props });
  let accepted = false;
  target.addEventListener('keydown', e => { accepted = isCompilerTypingKey(e as KeyboardEvent); }, { once: true });
  target.dispatchEvent(event);
  return accepted;
}

function sendInput(target: Element, inputType: string): void {
  target.dispatchEvent(new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true, data: 'a' }));
}

beforeAll(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  installSoundEffects();
});

beforeEach(() => {
  localStorage.setItem('pico.sound.v1', 'on');
  clock += 1000;
  bursts.mockClear();
  startedSampleLengths.length = 0;
  waveforms.length = 0;
  playedWaveforms.length = 0;
});
afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('compiler typing sounds', () => {
  it('recognizes edits in code editors and console input, not other fields or shortcuts', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="code-editor"><div class="cm-content" contenteditable="true"></div></div><form class="console-input-form"><input /></form><textarea></textarea>';
    document.body.append(root);
    const editor = root.querySelector('.cm-content')!;
    const input = root.querySelector('.console-input-form input')!;
    const other = root.querySelector('textarea')!;
    expect(sendKey(editor, 'a')).toBe(true);
    expect(sendKey(editor, 'Backspace')).toBe(true);
    expect(sendKey(editor, 'Enter')).toBe(true);
    expect(sendKey(editor, 'Tab')).toBe(true);
    expect(sendKey(input, '1')).toBe(true);
    expect(sendKey(other, 'a')).toBe(false);
    expect(sendKey(editor, 'a', { ctrlKey: true })).toBe(false);
    expect(sendKey(editor, 'v', { metaKey: true })).toBe(false);
    expect(sendKey(editor, 'e', { altKey: true })).toBe(false);
    expect(sendKey(editor, 'a', { repeat: true })).toBe(false);
    expect(sendKey(editor, 'Enter', { repeat: true })).toBe(true);
    expect(sendKey(editor, 'Backspace', { repeat: true })).toBe(true);
    expect(sendKey(editor, 'Delete', { repeat: true })).toBe(false);
    expect(sendKey(editor, 'Tab', { repeat: true })).toBe(false);
    expect(sendKey(editor, 'a', { isComposing: true })).toBe(false);
    expect(sendKey(editor, 'Shift')).toBe(false);
    expect(sendKey(editor, 'ArrowLeft')).toBe(false);
  });

  it('plays one short click for typing, deduplicates mobile input and respects mute', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="code-editor"><div class="cm-content" contenteditable="true"></div></div><input />';
    document.body.append(root);
    const editor = root.querySelector('.cm-content')!;
    const unrelated = root.querySelector('input')!;
    const count = () => bursts.mock.calls.length;

    sendKey(editor, 'p');
    expect(count()).toBe(1);
    clock += 5;
    sendInput(editor, 'insertText'); // Physical keyboard also triggers beforeinput.
    expect(count()).toBe(1);
    clock += 60;
    sendKey(editor, 'y');
    expect(count()).toBe(2);
    clock += 60;
    sendKey(editor, 'z', { repeat: true });
    sendKey(editor, 's', { ctrlKey: true });
    sendInput(editor, 'insertFromPaste');
    sendInput(unrelated, 'insertText');
    expect(count()).toBe(2);

    clock += 100;
    sendInput(editor, 'insertText'); // On-screen keyboard with no keydown.
    expect(count()).toBe(3);

    localStorage.setItem('pico.sound.v1', 'off');
    expect(soundEnabled()).toBe(false);
    clock += 150;
    sendKey(editor, 'q');
    sendInput(editor, 'insertText');
    expect(count()).toBe(3);
  });

  it('repeats Enter and Backspace sounds on held keys without doubling beforeinput', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="code-editor"><div class="cm-content" contenteditable="true"></div></div><form class="console-input-form"><input /></form>';
    document.body.append(host);
    const editor = host.querySelector('.cm-content')!;
    const consoleInput = host.querySelector('input')!;
    const count = () => bursts.mock.calls.length;

    sendKey(editor, 'Enter');
    expect(count()).toBe(1);
    clock += 45;
    sendKey(editor, 'Enter', { repeat: true });
    expect(count()).toBe(2);
    clock += 45;
    sendKey(editor, 'Enter', { repeat: true });
    expect(count()).toBe(3);
    // Keydown and beforeinput from the same repeat must produce one cue.
    clock += 1;
    sendInput(editor, 'insertLineBreak');
    expect(count()).toBe(3);
    expect(playedWaveforms[0]).toBe(playedWaveforms[1]);
    expect(playedWaveforms[1]).toBe(playedWaveforms[2]);

    clock += 45;
    sendKey(editor, 'Backspace');
    clock += 45;
    sendKey(editor, 'Backspace', { repeat: true });
    clock += 45;
    sendKey(editor, 'Backspace', { repeat: true });
    expect(count()).toBe(6);
    sendInput(editor, 'deleteContentBackward');
    expect(count()).toBe(6);
    expect(playedWaveforms[3]).toBe(playedWaveforms[4]);
    expect(playedWaveforms[4]).toBe(playedWaveforms[5]);

    clock += 45;
    sendKey(editor, 'a', { repeat: true });
    expect(count()).toBe(6);
    clock += 45;
    sendKey(consoleInput, 'Backspace', { repeat: true });
    expect(count()).toBe(7);

    localStorage.setItem('pico.sound.v1', 'off');
    clock += 45;
    sendKey(editor, 'Enter', { repeat: true });
    sendKey(editor, 'Backspace', { repeat: true });
    expect(count()).toBe(7);
  });

  it('plays exactly the same cached waveform for the first and every later normal key', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="code-editor"><div class="cm-content" contenteditable="true"></div></div>';
    document.body.append(wrapper);
    const editor = wrapper.querySelector('.cm-content')!;

    sendKey(editor, 'a');
    clock += 85;
    sendKey(editor, 'b');
    clock += 85;
    sendKey(editor, 'c');
    clock += 85;
    sendKey(editor, 'Enter');
    clock += 85;
    sendKey(editor, 'd');

    expect(bursts).toHaveBeenCalledTimes(5);
    expect(playedWaveforms).toHaveLength(5);
    expect(playedWaveforms[1]).toBe(playedWaveforms[0]);
    expect(playedWaveforms[2]).toBe(playedWaveforms[0]);
    expect(playedWaveforms[4]).toBe(playedWaveforms[0]);
    expect(playedWaveforms[3]).not.toBe(playedWaveforms[0]);
    expect(playedWaveforms[0]!.some(value => Math.abs(value) > 0.025)).toBe(true);
    // One cached normal sample, even when users type many different characters.
    expect(playedWaveforms[0]!.length).toBe(startedSampleLengths[4]);
  });

  it('uses distinct, softly rounded Pico blips for typing, erase and Enter', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="code-editor"><div class="cm-content" contenteditable="true"></div></div>';
    document.body.append(wrapper);
    const editor = wrapper.querySelector('.cm-content')!;
    sendKey(editor, 'a');
    clock += 70;
    sendKey(editor, 'Backspace');
    clock += 70;
    sendKey(editor, 'Enter');
    expect(bursts).toHaveBeenCalledTimes(3);
    expect(startedSampleLengths).toHaveLength(3);
    // Enter's playful two-note response is longer, while erase stays short.
    expect(startedSampleLengths[2]).toBeGreaterThan(startedSampleLengths[0]);
    expect(startedSampleLengths[1]).toBeLessThan(startedSampleLengths[0]);
    // Original synthesized audio. Smooth onset/tail, no noisy clipped transients.
    expect(startedSampleLengths.every(length => length > 1700 && length < 6000)).toBe(true);
    expect(playedWaveforms).toHaveLength(3);
    for (const samples of playedWaveforms) {
      expect(samples[0]).toBe(0);
      expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.015);
      expect(samples.some(value => Math.abs(value) > 0.025)).toBe(true);
      expect(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 0.9)).toBe(true);
    }
  });
});

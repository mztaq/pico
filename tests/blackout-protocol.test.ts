import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../public/blackout-protocol.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? '';

describe('Blackout Protocol 3D browser game', () => {
  it('parses the embedded browser module, including audio samples', () => {
    expect(script).not.toBe('');
    const offlineParse = script.replace(
      "await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js')",
      'null',
    );
    expect(() => new Function(offlineParse)).not.toThrow();
    expect(html).toContain('RECORDED_SFX');
  });

  it('keeps traffic fictional and moves actions to in-world terminals', () => {
    expect(html).toContain('const GAME_SECONDS=420;');
    expect(html).toContain('function bpOpenTerminal()');
    expect(html).toContain("e.code==='KeyE'");
    expect(html).toContain('function bpWalkable(x,z)');
    expect(html).toContain('const bpFanRotors=[]');
    expect(html).toContain('function bpNpcUpdate(dt)');
    expect(html).toContain('function bpDrawScreen(');
    expect(html).toContain('ALL OPERATIONS ARE SIMULATED');
  });
});

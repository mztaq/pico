import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const game = readFileSync(new URL('../src/blackout/game.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../blackout-protocol/index.html', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

describe('Blackout Protocol 3D', () => {
  it('parses the TypeScript game module as JavaScript and bundles the graphics engine locally', () => {
    expect(game).toContain("import * as THREE from 'three'");
    expect(() => new Function(game.replace("import * as THREE from 'three';", 'const THREE = {};'))).not.toThrow();
    expect(vite).toContain("blackout: resolve(process.cwd(), 'blackout-protocol/index.html')");
    expect(html).toContain('src="/src/blackout/game.ts"');
    expect(html).toContain('src="/pico-logo.svg"');
  });

  it('supports an extended first-person mission with independent patrols', () => {
    expect(game).toContain('const GAME_SECONDS=720;');
    expect(game).toContain('function bpOpenTerminal()');
    expect(game).toContain("e.code==='KeyE'");
    expect(game).toContain('function bpWalkable(x,z)');
    expect(game).toContain('const bpFanRotors=[]');
    expect(game).toContain('function bpPatrolStep(p,dt)');
    expect(game).toContain('function bpWorldEvents()');
    expect(game).toContain("if(bp?.active)return;");
  });

  it('has a wall-mounted live graph and an adaptive graphics setting', () => {
    expect(game).toContain('function bpWallGraph(t)');
    expect(game).toContain('const bpWallHistory=[]');
    expect(game).toContain('const bpWallDisplay=new THREE.Mesh(');
    expect(game).toContain("const gpuCores=Number(navigator.hardwareConcurrency)||4");
    expect(html).toContain('id="quality"');
    expect(html).not.toContain('FICTIONAL NETWORK SIMULATION');
  });
});

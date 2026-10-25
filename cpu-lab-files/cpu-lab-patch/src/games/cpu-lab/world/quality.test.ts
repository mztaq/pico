import { describe, expect, it } from 'vitest';
import { DynamicResolution, PROFILES, resolveQuality } from './quality';

describe('CPU Lab quality profiles', () => {
  it('honours an explicit choice', () => { expect(resolveQuality('high', { renderer: 'SwiftShader' }).level).toBe('high'); });
  it('picks low for software rendering and typical school integrated graphics', () => {
    expect(resolveQuality('auto', { renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))' }).level).toBe('low');
    expect(resolveQuality('auto', { renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 600 Direct3D11)', cores: 2 }).level).toBe('low');
    expect(resolveQuality('auto', { renderer: 'ANGLE (Intel, Intel(R) HD Graphics 520)', cores: 4, memoryGb: 8 }).level).toBe('low');
  });
  it('picks high for discrete GPUs and balanced when unsure', () => {
    expect(resolveQuality('auto', { renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)', cores: 12, memoryGb: 16 }).level).toBe('high');
    expect(resolveQuality('auto', { renderer: 'Unknown', cores: 8, memoryGb: 8 }).level).toBe('balanced');
  });
  it('low profile drops the expensive features', () => {
    const p = PROFILES.low;
    expect([p.shadows, p.environment, p.antialias, p.rubble, p.cheapMaterials]).toEqual([false, false, false, false, true]);
    expect(p.maxScale).toBeLessThan(1);
  });
});

describe('Dynamic resolution', () => {
  it('drops resolution when frames are slow and never below the floor', () => {
    const d = new DynamicResolution(0.5, 1, 1);
    for (let i = 0; i < 400; i++) d.sample(1 / 10);
    expect(d.scale).toBe(0.5);
  });
  it('recovers slowly when there is headroom, up to the ceiling', () => {
    const d = new DynamicResolution(0.5, 1, 0.5);
    for (let i = 0; i < 2000; i++) d.sample(1 / 120);
    expect(d.scale).toBe(1);
  });
  it('holds steady at a comfortable frame rate', () => {
    const d = new DynamicResolution(0.5, 1, 0.8);
    for (let i = 0; i < 600; i++) d.sample(1 / 40);
    expect(d.scale).toBe(0.8);
  });
});

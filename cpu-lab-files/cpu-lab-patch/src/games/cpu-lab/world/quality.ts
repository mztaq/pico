/**
 * Performance profiles for CPU Lab. Pure logic so it can be unit-tested.
 * "auto" picks a profile from the GPU/CPU the browser reports, then dynamic
 * resolution keeps the frame rate playable on weak school machines.
 */
export type QualitySetting = 'auto' | 'high' | 'balanced' | 'low';
export type QualityLevel = Exclude<QualitySetting, 'auto'>;

export interface Profile {
  level: QualityLevel;
  cheapMaterials: boolean;   // MeshLambertMaterial instead of PBR
  shadows: boolean;
  environment: boolean;      // image-based lighting
  antialias: boolean;
  rubble: boolean;           // decorative instanced debris
  pooledLights: number;      // room lights that follow the player
  maxScale: number;          // render-resolution ceiling (× CSS pixels)
  minScale: number;          // dynamic-resolution floor
  far: number;               // camera far plane (rooms beyond are culled)
  fog: number;               // FogExp2 density, hides the far plane
}

export const PROFILES: Record<QualityLevel, Profile> = {
  high: { level: 'high', cheapMaterials: false, shadows: true, environment: true, antialias: true, rubble: true, pooledLights: 2, maxScale: 1.75, minScale: 0.75, far: 90, fog: 0.03 },
  balanced: { level: 'balanced', cheapMaterials: false, shadows: false, environment: true, antialias: false, rubble: true, pooledLights: 2, maxScale: 1, minScale: 0.6, far: 60, fog: 0.034 },
  low: { level: 'low', cheapMaterials: true, shadows: false, environment: false, antialias: false, rubble: false, pooledLights: 1, maxScale: 0.8, minScale: 0.5, far: 36, fog: 0.05 },
};

export interface DeviceHints { renderer?: string; cores?: number; memoryGb?: number; dpr?: number; mobile?: boolean; }
const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i;
const WEAK_GPU = /intel.*\b(hd|uhd)\b|mali-[gt]?[0-7]\d|adreno.*\b[3-5]\d{2}\b|powervr|vivante/i;
const STRONG_GPU = /nvidia|geforce|radeon rx|rtx|quadro|apple m[1-9]|iris xe|arc /i;

/** Pick a starting profile. Unknown hardware starts at "balanced" and adapts. */
export function resolveQuality(setting: QualitySetting, hints: DeviceHints = {}): Profile {
  if (setting !== 'auto') return PROFILES[setting];
  const gpu = hints.renderer ?? '';
  const weakCpu = (hints.cores ?? 8) <= 4 || (hints.memoryGb ?? 8) <= 4;
  if (SOFTWARE_GPU.test(gpu) || hints.mobile) return PROFILES.low;
  if (STRONG_GPU.test(gpu)) return weakCpu ? PROFILES.balanced : PROFILES.high;
  if (WEAK_GPU.test(gpu)) return PROFILES.low;
  return weakCpu ? PROFILES.low : PROFILES.balanced;
}

export function deviceHints(gl: WebGLRenderingContext | WebGL2RenderingContext | null): DeviceHints {
  let renderer = '';
  try {
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    renderer = String(ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '');
  } catch { /* privacy-restricted browsers */ }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { renderer, cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory, dpr: window.devicePixelRatio, mobile: /Android|iPhone|iPad/i.test(navigator.userAgent) };
}

/**
 * Adjusts render scale from measured frame times: drops quickly when slow,
 * recovers slowly when there is headroom (avoids oscillation).
 */
export class DynamicResolution {
  private avg = 1 / 60;
  private since = 0;
  scale: number;
  constructor(private readonly min: number, private readonly max: number, start = max) { this.scale = Math.min(max, Math.max(min, start)); }
  /** Feed one frame's duration (seconds). Returns the new scale when it changes, else null. */
  sample(dt: number): number | null {
    this.avg += (Math.min(dt, 0.5) - this.avg) * 0.08;
    this.since += dt;
    if (this.since < 1.2) return null;
    this.since = 0;
    let next = this.scale;
    if (this.avg > 1 / 26) next = Math.max(this.min, +(this.scale - 0.1).toFixed(2));
    else if (this.avg < 1 / 55) next = Math.min(this.max, +(this.scale + 0.05).toFixed(2));
    if (next === this.scale) return null;
    this.scale = next;
    return next;
  }
  get fps() { return 1 / this.avg; }
}

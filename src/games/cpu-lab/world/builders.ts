/**
 * Low-poly building blocks: flat-shaded materials, canvas screens that render
 * simulation state, CPU register rigs, data packets and room furniture.
 */
import * as THREE from 'three';
import type { Bus, Machine, Register, Transfer } from '../../../cpu/engine';
import { binary4, binary8, disassemble, registerValue } from '../sim/puzzles';

export const PALETTE = {
  floor: 0x232832, floorAlt: 0x272d38, wall: 0x2c323e, wallTrim: 0x3a4252, metal: 0x4a5263, dark: 0x15181e,
  rust: 0x7a5236, panel: 0x1a1e26, warm: 0xffb36b,
  address: 0xf2a541, data: 0x4cc9d6, control: 0xa98bf5, internal: 0xdfe6f2, good: 0x7bd88f, bad: 0xe05a5a,
};
export const BUS_COLOR: Record<Bus, number> = { address: PALETTE.address, data: PALETTE.data, control: PALETTE.control, internal: PALETTE.internal };
export const BUS_CSS: Record<Bus, string> = { address: '#f2a541', data: '#4cc9d6', control: '#a98bf5', internal: '#dfe6f2' };

/** Lit material: PBR on capable GPUs, cheap Lambert on low-end machines. Both expose color/emissive. */
export type LitMat = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
const matCache = new Map<string, LitMat>();
let cheap = false;
/** Low quality swaps every lit surface to MeshLambertMaterial — far fewer shader instructions per pixel. */
export function setCheapMaterials(on: boolean) { if (on !== cheap) { cheap = on; matCache.clear(); } }
/** Flat shading is what gives the facility its faceted low-poly look. */
export function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; ei?: number } = {}): LitMat {
  const key = [color, opts.rough, opts.metal, opts.emissive, opts.ei].join(':');
  let m = matCache.get(key);
  if (!m) {
    const base = { color, flatShading: true, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 };
    m = cheap ? new THREE.MeshLambertMaterial(base) : new THREE.MeshStandardMaterial({ ...base, roughness: opts.rough ?? 0.82, metalness: opts.metal ?? 0.15 });
    matCache.set(key, m);
  }
  return m;
}
/** Unique (non-cached) emissive material for parts whose glow animates. */
export const glowMat = (color: number, ei = 1): LitMat => cheap
  ? new THREE.MeshLambertMaterial({ color: 0x111111, emissive: color, emissiveIntensity: ei, flatShading: true })
  : new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: ei, flatShading: true, roughness: 0.6 });

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
export const boxGeo = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const hexGeo = (r: number, h: number, rTop = r) => new THREE.CylinderGeometry(rTop, r, h, 6);
export const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);

/* ───────────── canvas screens ───────────── */
export class Screen {
  readonly mesh: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D | null;
  private readonly texture: THREE.CanvasTexture;
  constructor(width: number, height: number, readonly px = 256) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px; this.canvas.height = Math.round(px * (height / width));
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = cheap ? 1 : 4;
    this.texture.generateMipmaps = !cheap;
    if (cheap) this.texture.minFilter = THREE.LinearFilter;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
  }
  get w() { return this.canvas.width; }
  get h() { return this.canvas.height; }
  draw(fn: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (!this.ctx) return;
    fn(this.ctx, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
  dispose() { this.texture.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const SANS = '"DM Sans", system-ui, sans-serif';
export function drawRegister(s: Screen, title: string, value: string, opts: { color?: string; sub?: string; active?: boolean; dim?: boolean } = {}) {
  s.draw((c, w, h) => {
    c.fillStyle = opts.dim ? '#0b0d11' : '#10141b'; c.fillRect(0, 0, w, h);
    const accent = opts.color ?? '#dfe6f2';
    c.strokeStyle = opts.active ? accent : '#2b3240'; c.lineWidth = opts.active ? 10 : 4; c.strokeRect(5, 5, w - 10, h - 10);
    c.fillStyle = opts.dim ? '#4a5263' : accent; c.font = `700 ${Math.round(h * 0.2)}px ${SANS}`; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(title, w * 0.07, h * 0.1);
    c.fillStyle = opts.dim ? '#3a4150' : '#f4f6fb'; c.font = `600 ${Math.round(Math.min(h * 0.3, (w * 0.86) / Math.max(4, value.length) * 1.6))}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(value, w / 2, h * 0.58);
    if (opts.sub) { c.fillStyle = '#8a93a6'; c.font = `500 ${Math.round(h * 0.12)}px ${MONO}`; c.fillText(opts.sub, w / 2, h * 0.86); }
  });
}
export function drawText(s: Screen, lines: { text: string; color?: string; size?: number; mono?: boolean }[], bg = '#10141b', border = '#2b3240') {
  s.draw((c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = border; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    let y = h * 0.12;
    for (const l of lines) {
      const size = Math.round(h * (l.size ?? 0.13));
      c.font = `${l.mono ? 500 : 700} ${size}px ${l.mono ? MONO : SANS}`; c.fillStyle = l.color ?? '#e9edf5'; c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText(l.text, w / 2, y); y += size * 1.3;
    }
  });
}
export function drawRam(s: Screen, m: Machine, title = 'RAM', highlight?: number) {
  s.draw((c, w, h) => {
    c.fillStyle = '#0f1218'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2b3240'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#4cc9d6'; c.font = `700 ${Math.round(h * 0.07)}px ${SANS}`; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(title, w * 0.04, h * 0.03);
    const rows = 8, rowH = (h * 0.86) / rows, colW = w / 2, top = h * 0.12;
    for (let i = 0; i < 16; i++) {
      const col = Math.floor(i / 8), row = i % 8, x = col * colW + w * 0.02, y = top + row * rowH;
      const kind = m.kind[i];
      if (i === highlight) { c.fillStyle = 'rgba(242,165,65,.28)'; c.fillRect(x, y, colW - w * 0.04, rowH - 3); }
      if (i === m.pc && !m.halted) { c.fillStyle = 'rgba(223,230,242,.12)'; c.fillRect(x, y, colW - w * 0.04, rowH - 3); }
      c.font = `500 ${Math.round(rowH * 0.5)}px ${MONO}`; c.textBaseline = 'middle';
      c.fillStyle = '#f2a541'; c.fillText(binary4(i), x + 6, y + rowH / 2);
      c.fillStyle = kind === 'instruction' ? '#e9edf5' : kind === 'data' ? '#4cc9d6' : '#3a4150';
      c.fillText(kind === 'instruction' ? disassemble(m.memory[i]!) : kind === 'data' ? binary8(m.memory[i]!) : '········', x + colW * 0.3, y + rowH / 2);
    }
  });
}

/* ───────────── data packets ───────────── */
interface Packet { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; }
export class Packets {
  private pool: THREE.Mesh[] = [];
  private live: Packet[] = [];
  private geo = new THREE.OctahedronGeometry(0.16, 0);
  private mats = new Map<number, THREE.MeshBasicMaterial>();
  constructor(private readonly scene: THREE.Scene) {}
  emit(from: THREE.Vector3, to: THREE.Vector3, color: number, dur = 0.42, arc = 0.8) {
    let m = this.pool.pop();
    if (!m) { m = new THREE.Mesh(this.geo); this.scene.add(m); }
    let material = this.mats.get(color);
    if (!material) { material = new THREE.MeshBasicMaterial({ color, toneMapped: false }); this.mats.set(color, material); }
    m.material = material; m.visible = true; m.position.copy(from);
    this.live.push({ mesh: m, from: from.clone(), to: to.clone(), t: 0, dur, arc });
  }
  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]!;
      p.t += dt / p.dur;
      const t = Math.min(1, p.t), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      p.mesh.position.lerpVectors(p.from, p.to, e);
      p.mesh.position.y += Math.sin(Math.PI * e) * p.arc;
      p.mesh.rotation.y += dt * 8; p.mesh.scale.setScalar(1 + Math.sin(Math.PI * e) * 0.5);
      if (p.t >= 1) { p.mesh.visible = false; this.pool.push(p.mesh); this.live.splice(i, 1); }
    }
  }
}

/* ───────────── CPU rig: registers rendered from a live Machine ───────────── */
export const REGISTER_COLOR: Record<Register, string> = { PC: '#f2a541', MAR: '#f2a541', MDR: '#4cc9d6', CIR: '#e9edf5', ACC: '#7bd88f', ALU: '#7bd88f', CU: '#a98bf5', RAM: '#4cc9d6' };
const REGISTER_SUB: Record<Register, string> = { PC: 'next address', MAR: 'address in use', MDR: 'data in transit', CIR: 'current instruction', ACC: 'accumulator', ALU: 'last result', CU: 'stage', RAM: 'signal' };
export class CpuRig {
  readonly group = new THREE.Group();
  readonly screens = new Map<Register, Screen>();
  readonly glows = new Map<Register, LitMat>();
  ram: Screen | null = null;
  constructor(readonly anchors: Partial<Record<Register, THREE.Vector3>>, private readonly style: 'pedestal' | 'wall' | 'mini', facing = 0) {
    for (const [r, p] of Object.entries(anchors) as [Register, THREE.Vector3][]) {
      const holder = new THREE.Group(); holder.position.copy(p); holder.rotation.y = facing;
      const glow = glowMat(new THREE.Color(REGISTER_COLOR[r]).getHex(), 0.15);
      this.glows.set(r, glow);
      if (style === 'pedestal' && r !== 'RAM') {
        holder.add(mesh(hexGeo(0.75, 0.9, 0.62), mat(PALETTE.metal, { metal: 0.4, rough: 0.6 }), 0, -1.55, 0));
        holder.add(mesh(hexGeo(0.66, 0.08), glow, 0, -1.06, 0, false));
        holder.add(mesh(boxGeo(0.18, 0.9, 0.18), mat(PALETTE.wallTrim), 0, -0.65, 0));
      }
      if (style === 'mini' && r !== 'RAM') {
        holder.add(mesh(hexGeo(0.45, 1.2, 0.38), mat(PALETTE.metal, { metal: 0.4 }), 0, -1.0, 0));
        holder.add(mesh(hexGeo(0.4, 0.06), glow, 0, -0.38, 0, false));
      }
      if (r === 'RAM' && style !== 'wall') {
        const s = new Screen(3.6, 1.9, 512); s.mesh.position.set(0, 0.1, 0.16); holder.add(s.mesh); this.ram = s;
        holder.add(mesh(boxGeo(4.0, 2.3, 0.3), mat(PALETTE.panel), 0, 0.1, 0));
        holder.add(mesh(boxGeo(4.2, 0.9, 1.0), mat(PALETTE.metal, { metal: 0.4 }), 0, -1.45, 0));
        holder.add(mesh(boxGeo(4.0, 0.08, 0.9), glow, 0, -0.97, 0, false));
      } else {
        const w = style === 'wall' ? 1.35 : style === 'mini' ? 1.0 : 1.5, h = w * 0.62;
        const s = new Screen(w, h, 256); s.mesh.position.z = 0.05; holder.add(s.mesh);
        holder.add(mesh(boxGeo(w + 0.12, h + 0.12, 0.08), mat(PALETTE.panel), 0, 0, 0, false));
        this.screens.set(r, s);
      }
      this.group.add(holder);
    }
  }
  update(m: Machine, powered = true) {
    const active = new Set(m.frame.active);
    for (const [r, s] of this.screens) {
      drawRegister(s, r, registerValue(m, r), { color: REGISTER_COLOR[r], sub: r === 'CIR' && m.micro >= 6 ? disassemble(m.cir) : REGISTER_SUB[r], active: active.has(r), dim: !powered });
    }
    if (this.ram) drawRam(this.ram, m, 'RAM · ' + (m.frame.phase === 'ready' ? 'ready' : m.frame.phase), m.frame.transfer && (m.frame.transfer.from === 'RAM' || m.frame.transfer.to === 'RAM') ? m.mar : undefined);
    for (const [r, g] of this.glows) g.emissiveIntensity = active.has(r) ? 2.2 : powered ? 0.35 : 0.08;
  }
  anchor(r: Register): THREE.Vector3 { const a = this.anchors[r]; return a ? a.clone() : new THREE.Vector3(); }
  transfer(t: Transfer, packets: Packets) { packets.emit(this.anchor(t.from), this.anchor(t.to), BUS_COLOR[t.bus], this.style === 'pedestal' ? 0.5 : 0.36, this.style === 'wall' ? 0.25 : 0.9); }
  dispose() { this.screens.forEach(s => s.dispose()); this.ram?.dispose(); }
}

/* ───────────── doors ───────────── */
export class SlidingDoor {
  readonly group = new THREE.Group();
  private left: THREE.Mesh; private right: THREE.Mesh; private lamp: LitMat;
  open = 0; target = 0;
  constructor(z: number, width = 3.2) {
    this.group.position.set(0, 0, z);
    const leaf = boxGeo(width / 2, 3.2, 0.3);
    this.left = mesh(leaf, mat(PALETTE.metal, { metal: 0.5, rough: 0.5 }), -width / 4, 1.6, 0);
    this.right = mesh(leaf, mat(PALETTE.metal, { metal: 0.5, rough: 0.5 }), width / 4, 1.6, 0);
    const stripe = boxGeo(width / 2 - 0.2, 0.18, 0.32);
    this.left.add(mesh(stripe, mat(PALETTE.address, { emissive: PALETTE.address, ei: 0.3 }), 0, 0.4, 0, false));
    this.right.add(mesh(stripe, mat(PALETTE.address, { emissive: PALETTE.address, ei: 0.3 }), 0, 0.4, 0, false));
    this.lamp = glowMat(PALETTE.bad, 1.6);
    this.group.add(this.left, this.right,
      mesh(boxGeo(0.5, 3.8, 0.6), mat(PALETTE.wallTrim), -width / 2 - 0.25, 1.9, 0), mesh(boxGeo(0.5, 3.8, 0.6), mat(PALETTE.wallTrim), width / 2 + 0.25, 1.9, 0),
      mesh(boxGeo(width + 1, 0.5, 0.6), mat(PALETTE.wallTrim), 0, 3.55, 0), mesh(new THREE.OctahedronGeometry(0.16, 0), this.lamp, 0, 3.55, 0.36, false));
  }
  update(dt: number) {
    this.open += (this.target - this.open) * Math.min(1, dt * 2.2);
    const w = 1.6 * this.open;
    this.left.position.x = -0.8 - w; this.right.position.x = 0.8 + w;
    this.lamp.emissive.setHex(this.target > 0 ? PALETTE.good : PALETTE.bad);
  }
}

/* ───────────── the player & BIT ───────────── */
export function buildEngineer(): { group: THREE.Group; legs: THREE.Mesh[]; arms: THREE.Mesh[] } {
  const g = new THREE.Group();
  const suit = mat(0x3d5a73, { rough: 0.7 }), vest = mat(PALETTE.address, { rough: 0.6 }), dark = mat(0x1d2128);
  const legs = [-0.13, 0.13].map(x => { const l = mesh(boxGeo(0.18, 0.62, 0.2), dark, x, 0.31, 0); l.geometry.translate(0, -0.31, 0); l.position.y = 0.62; return l; });
  const torso = mesh(hexGeo(0.27, 0.62, 0.3), suit, 0, 0.95, 0);
  const vestM = mesh(hexGeo(0.29, 0.3, 0.31), vest, 0, 1.0, 0);
  const head = mesh(new THREE.IcosahedronGeometry(0.21, 0), mat(0xe2c3a2), 0, 1.45, 0);
  const helmet = mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.16, 6), vest, 0, 1.6, 0);
  const visor = mesh(boxGeo(0.3, 0.08, 0.06), mat(0x111111, { emissive: PALETTE.data, ei: 1.2 }), 0, 1.5, -0.19, false);
  const pack = mesh(boxGeo(0.36, 0.42, 0.18), mat(PALETTE.metal), 0, 1.0, 0.27);
  const arms = [-0.36, 0.36].map(x => { const a = mesh(boxGeo(0.13, 0.55, 0.14), suit, x, 1.2, 0); a.geometry.translate(0, -0.25, 0); return a; });
  g.add(...legs, torso, vestM, head, helmet, visor, pack, ...arms);
  return { group: g, legs, arms };
}
export function buildBit(): { group: THREE.Group; eye: LitMat; ring: THREE.Mesh } {
  const g = new THREE.Group();
  const body = mesh(new THREE.OctahedronGeometry(0.22, 0), mat(0xd9dee8, { metal: 0.3, rough: 0.4 }), 0, 0, 0);
  body.scale.set(1, 0.8, 1);
  const eye = glowMat(PALETTE.address, 2.4);
  const eyeM = mesh(new THREE.IcosahedronGeometry(0.07, 0), eye, 0, 0.02, -0.17, false);
  const ring = mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 8), mat(PALETTE.metal, { metal: 0.6 }), 0, 0, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(body, eyeM, ring);
  return { group: g, eye, ring };
}

/* ───────────── seeded randomness for stable decoration ───────────── */
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

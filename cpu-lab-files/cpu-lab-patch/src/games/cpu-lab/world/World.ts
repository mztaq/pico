/**
 * The 3D facility. Owns the renderer, player, camera and input; renders the
 * GameStore's simulation state and reports interactions back to it.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Register } from '../../../cpu/engine';
import { BUS_LINKS, binary8, registerValue, type PuzzleId } from '../sim/puzzles';
import type { GameStore, WorldEvent } from '../state/store';
import type { GameAudio } from '../audio';
import { CONCEPTS } from '../story/script';
import {
  blockers, BRIDGE, CHAMBER_RIG, CHASM, CORE_CENTER, CORE_RIG, CORRIDORS, DOORS, findInteractable, INTERACTABLES, isFree,
  moveWithCollision, ROOMS, roomAt, VAULT_PILLARS, type Interactable, type Rect,
} from './layout';
import {
  boxGeo, buildBit, buildEngineer, BUS_COLOR, CpuRig, drawRegister, drawText, glowMat, hexGeo, mat, mesh, Packets, PALETTE, rng, rock, Screen, SlidingDoor, setCheapMaterials, type LitMat,
} from './builders';
import { deviceHints, DynamicResolution, resolveQuality, type Profile } from './quality';

const WALL_H = 3.6;
const PLAYER_R = 0.35;
const ROOM_PUZZLE: Record<string, PuzzleId> = { Workshop: 'workshop', 'Memory Vault': 'vault', 'Bus Bridge': 'bus', 'Processor Chamber': 'chamber', Core: 'core' };
const REG_INFO: Record<Register, string> = Object.fromEntries(([
  ['PC', 'pc'], ['MAR', 'mar'], ['MDR', 'mdr'], ['CIR', 'cir'], ['CU', 'cu'], ['ACC', 'acc'], ['ALU', 'alu'], ['RAM', 'ram'],
] as const).map(([r, id]) => [r, CONCEPTS.find(c => c.id === id)!.short])) as Record<Register, string>;

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();
  private packets: Packets;
  private resize: ResizeObserver;
  private disposers: (() => void)[] = [];

  // player
  private player = buildEngineer();
  private bit = buildBit();
  private pos = new THREE.Vector2();
  private facing = 0;
  private yaw = 0;
  private pitch = -0.28;
  private firstPerson = false;
  private keys = new Set<string>();
  private walkPhase = 0;
  private stepClock = 0;
  private torch: THREE.PointLight;
  private key: THREE.DirectionalLight;

  // world objects
  private doors = new Map<string, SlidingDoor>();
  private roomLights = new Map<string, { pos: THREE.Vector3; range: number; strips: LitMat[]; color: THREE.Color; level: number; target: number }>();
  /** Two pooled lights follow the nearest rooms — a fixed, small light count keeps shading cheap. */
  private lightPool: THREE.PointLight[] = [];
  private workshopRig!: CpuRig;
  private vaultBoard!: CpuRig;
  private chamberRig!: CpuRig;
  private coreRig!: CpuRig;
  private pillarScreens: Screen[] = [];
  private pillarGlows: LitMat[] = [];
  private pillarFlash = new Array(16).fill(0) as number[];
  private lockScreen!: Screen;
  private junction!: { screens: Map<string, Screen> };
  private spark = 0;
  private conduits: { mat: LitMat; gap: THREE.Group; bus: 'address' | 'data' | 'control' }[] = [];
  private bridge!: THREE.Group;
  private bridgeExtend = 0;
  private turbines: THREE.Group[] = [];
  private turbineSpeed = 0;
  private core!: { gem: THREE.Mesh; gemMat: LitMat; rings: THREE.Mesh[]; beam: THREE.Mesh };
  private corePower = 0;
  private markers = new Map<string, THREE.Mesh>();
  private errorFlash = 0;
  private shake = 0;
  private cinematic: { t: number; done: boolean } | null = null;
  private nearest: Interactable | null = null;
  private dragging = false;
  private lastSave = 0;
  private ready = false;
  readonly profile: Profile;
  private dynres: DynamicResolution;
  private frameNo = 0;
  /** Top-level objects tagged with the room they belong to; only nearby rooms are drawn. */
  private cullables: { obj: THREE.Object3D; room: number }[] = [];
  private currentRoom = 0;

  constructor(private readonly container: HTMLElement, private readonly store: GameStore, private readonly audio: GameAudio) {
    const settings = store.get().settings;
    // Probe the GPU once with a throwaway context, then build the scene for that profile.
    const probe = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    this.profile = resolveQuality(settings.quality, deviceHints(probe));
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
    setCheapMaterials(this.profile.cheapMaterials);
    this.renderer = new THREE.WebGLRenderer({ antialias: this.profile.antialias, powerPreference: 'high-performance', stencil: false });
    const startScale = Math.min(window.devicePixelRatio, this.profile.maxScale);
    this.dynres = new DynamicResolution(this.profile.minScale, Math.min(Math.max(window.devicePixelRatio, 1), this.profile.maxScale), startScale);
    this.renderer.setPixelRatio(this.dynres.scale);
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'cpulab-canvas';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'CPU Lab 3D view. Click to look around; WASD to move; E to interact.');
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.08, this.profile.far);
    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.FogExp2(0x0b0d12, this.profile.fog);
    if (this.profile.environment) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.22;
      pmrem.dispose();
    }

    this.scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x2a2018, this.profile.environment ? 0.55 : 0.95));
    this.key = new THREE.DirectionalLight(0xdfe8ff, 1.1);
    this.key.castShadow = this.profile.shadows;
    this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
    this.key.shadow.bias = -0.0008; this.key.shadow.normalBias = 0.03;
    this.scene.add(this.key, this.key.target);
    this.torch = new THREE.PointLight(0xffd9a8, 5, 8, 1.6);
    this.scene.add(this.torch);

    this.packets = new Packets(this.scene);
    this.build();
    this.bit.group.scale.setScalar(0.62);
    this.scene.add(this.player.group, this.bit.group);

    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(container);
    this.onResize();
    this.bindInput();
    this.disposers.push(store.onEvent(e => this.onEvent(e)));
    this.disposers.push(store.subscribe(() => this.syncFromStore()));
    this.timer.connect(document);
    this.resetFromStore(true);
    this.renderer.setAnimationLoop(t => this.frame(t));
    this.ready = true;
  }

  /* ════════════════════ construction ════════════════════ */
  private build() {
    this.buildShell();
    this.buildWorkshop();
    this.buildVault();
    this.buildBus();
    this.buildChamber();
    this.buildCore();
    this.buildMarkers();
    this.mergeStatic();
    this.tagRooms();
  }

  /** Which room an object belongs to, by the z of its bounds (rooms run along −z). */
  private roomIndexAt(z: number) {
    let best = 0, bestD = Infinity;
    ROOMS.forEach((r, i) => { const d = z > r.area.z1 ? z - r.area.z1 : z < r.area.z0 ? r.area.z0 - z : 0; if (d < bestD) { bestD = d; best = i; } });
    return best;
  }
  private tagRooms() {
    const box = new THREE.Box3(), c = new THREE.Vector3();
    for (const o of this.scene.children) {
      if (o instanceof THREE.Light || o === this.player.group || o === this.bit.group) continue;
      box.setFromObject(o); if (box.isEmpty()) continue;
      box.getCenter(c);
      this.cullables.push({ obj: o, room: this.roomIndexAt(c.z) });
    }
  }
  /** Draw only the player's room and its neighbours — the rest is behind doors and fog anyway. */
  private cull() {
    const room = this.roomIndexAt(this.pos.y);
    if (room === this.currentRoom && this.frameNo > 1) return;
    this.currentRoom = room;
    for (const c of this.cullables) c.obj.visible = Math.abs(c.room - room) <= 1;
  }

  /** Merge static top-level meshes that share a material: hundreds of draw calls become a few dozen. */
  private mergeStatic() {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const o of [...this.scene.children]) {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || !(o.material instanceof THREE.MeshStandardMaterial || o.material instanceof THREE.MeshLambertMaterial)) continue;
      // Merge per room so whole rooms can still be culled.
      const key = o.material.uuid + ':' + this.roomIndexAt(o.position.z);
      const list = groups.get(key) ?? []; list.push(o); groups.set(key, list);
    }
    for (const meshes of groups.values()) {
      const material = meshes[0]!.material as THREE.Material;
      if (meshes.length < 2) continue;
      const geos = meshes.map(m => { m.updateMatrixWorld(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; });
      const merged = mergeGeometries(geos, false);
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      meshes.forEach(m => { this.scene.remove(m); m.geometry.dispose(); });
      const big = new THREE.Mesh(merged, material);
      big.castShadow = this.profile.shadows && meshes.some(m => m.castShadow); big.receiveShadow = this.profile.shadows;
      this.scene.add(big);
    }
  }

  private buildShell() {
    // Floor plates — one instanced mesh, per-plate colour variation for a hand-laid low-poly feel.
    const plates: { x: number; z: number; w: number; d: number }[] = [];
    for (const r of [...ROOMS.map(r => r.area), ...CORRIDORS]) {
      for (let x = r.x0; x < r.x1 - 0.01; x += 2) for (let z = r.z0; z < r.z1 - 0.01; z += 2) {
        const w = Math.min(2, r.x1 - x), d = Math.min(2, r.z1 - z), cx = x + w / 2, cz = z + d / 2;
        if (cx > CHASM.x0 && cx < CHASM.x1 && cz > CHASM.z0 && cz < CHASM.z1) continue;
        plates.push({ x: cx, z: cz, w, d });
      }
    }
    const floor = new THREE.InstancedMesh(boxGeo(1, 0.2, 1), mat(0xffffff, { rough: 0.9 }), plates.length);
    const r = rng(7), m4 = new THREE.Matrix4(), col = new THREE.Color();
    plates.forEach((p, i) => {
      m4.makeScale(p.w - 0.06, 1, p.d - 0.06).setPosition(p.x, -0.1 + r() * 0.03, p.z);
      floor.setMatrixAt(i, m4);
      floor.setColorAt(i, col.setHex(r() > 0.5 ? PALETTE.floor : PALETTE.floorAlt).offsetHSL(0, 0, (r() - 0.5) * 0.03));
    });
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Walls: each room edge minus corridor openings; corridors get side walls.
    const wallMat = mat(PALETTE.wall), trimMat = mat(PALETTE.wallTrim);
    const addWall = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) return;
      const w = mesh(boxGeo(x1 === x0 ? 0.4 : len + 0.4, WALL_H, x1 === x0 ? len + 0.4 : 0.4), wallMat, (x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2);
      const trim = mesh(boxGeo(x1 === x0 ? 0.6 : len + 0.6, 0.25, x1 === x0 ? len + 0.6 : 0.6), trimMat, (x0 + x1) / 2, WALL_H, (z0 + z1) / 2, false);
      this.scene.add(w, trim);
    };
    const openings = (z: number) => CORRIDORS.filter(c => Math.abs(c.z0 - z) < 0.01 || Math.abs(c.z1 - z) < 0.01);
    for (const room of ROOMS) {
      const a = room.area;
      for (const z of [a.z0, a.z1]) {
        let x = a.x0;
        for (const c of openings(z).sort((p, q) => p.x0 - q.x0)) { addWall(x, z, c.x0, z); x = c.x1; }
        addWall(x, z, a.x1, z);
      }
      addWall(a.x0, a.z0, a.x0, a.z1); addWall(a.x1, a.z0, a.x1, a.z1);
      this.buildRoomLighting(room.name, a, room.light);
      this.decorate(a, room.name);
    }
    for (const c of CORRIDORS) { addWall(c.x0, c.z0, c.x0, c.z1); addWall(c.x1, c.z0, c.x1, c.z1); }
    for (const d of DOORS) { const door = new SlidingDoor(d.z); this.doors.set(d.id, door); this.scene.add(door.group); }

    // Room signs over the entrances.
    const signs: [string, number][] = [['MEMORY VAULT', -9], ['BUS BRIDGE', -26], ['PROCESSOR CHAMBER', -41], ['THE CORE', -64]];
    for (const [text, z] of signs) {
      const s = new Screen(3.4, 0.55, 512); drawText(s, [{ text, size: 0.48, color: '#e9edf5' }], '#151922', '#151922');
      s.mesh.position.set(0, 4.15, z + 0.31); this.scene.add(s.mesh);
      const back = s.mesh.clone(); back.rotation.y = Math.PI; back.position.z = z - 0.31; this.scene.add(back);
    }
  }

  private buildRoomLighting(name: string, a: Rect, color: number) {
    const pos = new THREE.Vector3((a.x0 + a.x1) / 2, 3.4, (a.z0 + a.z1) / 2), range = Math.max(a.x1 - a.x0, a.z1 - a.z0) * 1.3;
    if (this.lightPool.length < this.profile.pooledLights) { const l = new THREE.PointLight(0xff4b3a, 6, range, 1); this.lightPool.push(l); this.scene.add(l); }
    const strips: LitMat[] = [];
    for (const x of [a.x0 + 0.26, a.x1 - 0.26]) {
      const m = glowMat(0xff4b3a, 0.6); strips.push(m);
      this.scene.add(mesh(boxGeo(0.06, 0.08, a.z1 - a.z0 - 1), m, x, 0.25, (a.z0 + a.z1) / 2, false));
    }
    const lamp = glowMat(color, 0.2); strips.push(lamp);
    this.scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.8, 0.3, 6), lamp, pos.x, 3.75, pos.z, false));
    this.roomLights.set(name, { pos, range, strips, color: new THREE.Color(color), level: 0, target: 0 });
  }

  private decorate(a: Rect, name: string) {
    const r = rng(name.length * 97 + Math.round(a.z0));
    // Pipes along the top of the side walls.
    for (const [x, c] of [[a.x0 + 0.35, PALETTE.rust], [a.x1 - 0.35, PALETTE.metal]] as const) {
      const pipe = mesh(new THREE.CylinderGeometry(0.11, 0.11, a.z1 - a.z0 - 0.6, 6), mat(c, { metal: 0.5, rough: 0.5 }), x, 2.9, (a.z0 + a.z1) / 2, false);
      pipe.rotation.x = Math.PI / 2; this.scene.add(pipe);
    }
    if (!this.profile.rubble) return this.ribs(a);
    // Rubble along the walls — instanced, static.
    const count = Math.round((a.x1 - a.x0 + a.z1 - a.z0) * 0.9);
    const rubble = new THREE.InstancedMesh(rock(0.18), mat(0x3b3f48, { rough: 1 }), count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const side = Math.floor(r() * 4), t = r();
      const x = side === 0 ? a.x0 + 0.35 : side === 1 ? a.x1 - 0.35 : a.x0 + 0.6 + t * (a.x1 - a.x0 - 1.2);
      const z = side === 2 ? a.z0 + 0.35 : side === 3 ? a.z1 - 0.35 : a.z0 + 0.6 + t * (a.z1 - a.z0 - 1.2);
      if (Math.abs(x) < 2.2 && (side === 2 || side === 3)) { m4.makeScale(0, 0, 0); rubble.setMatrixAt(i, m4); continue; }
      const k = 0.5 + r() * 1.3;
      rubble.setMatrixAt(i, m4.compose(p.set(x, 0.08 * k, z), q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3)), s.set(k, k * 0.7, k)));
    }
    rubble.castShadow = true; rubble.receiveShadow = true;
    this.scene.add(rubble);
    this.ribs(a);
  }
  private ribs(a: Rect) {
    for (let z = a.z0 + 2; z < a.z1 - 1; z += 3) for (const x of [a.x0 + 0.25, a.x1 - 0.25]) this.scene.add(mesh(boxGeo(0.25, WALL_H, 0.35), mat(PALETTE.wallTrim), x, WALL_H / 2, z));
  }

  private log(x: number, z: number, y = 1, rotY = 0, style: 'plaque' | 'terminal' | 'note' = 'plaque') {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    if (style === 'terminal') {
      g.add(mesh(boxGeo(0.6, 1.0, 0.4), mat(PALETTE.metal), 0, 0.5, 0));
      g.add(mesh(boxGeo(0.5, 0.32, 0.05), glowMat(PALETTE.data, 0.9), 0, 0.85, 0.2, false));
    } else if (style === 'note') {
      g.add(mesh(boxGeo(0.35, 0.02, 0.45), mat(0xe8dcc0, { emissive: 0x332a18, ei: 0.4 }), 0, y, 0, false));
    } else {
      g.add(mesh(boxGeo(0.7, 0.5, 0.06), mat(0x2e3542, { metal: 0.6, rough: 0.4 }), 0, y, 0, false));
      g.add(mesh(boxGeo(0.56, 0.06, 0.07), glowMat(PALETTE.data, 0.8), 0, y - 0.12, 0.01, false));
    }
    this.scene.add(g);
  }

  private buildWorkshop() {
    // Workbench, crates, cabinet, a fallen robot arm — the room where work stopped mid-step.
    this.scene.add(mesh(boxGeo(2.4, 0.12, 1.2), mat(PALETTE.rust), -5.4, 0.9, 2.4), ...[[-6.4, 1.95], [-4.4, 1.95], [-6.4, 2.85], [-4.4, 2.85]].map(([x, z]) => mesh(boxGeo(0.12, 0.9, 0.12), mat(PALETTE.metal), x!, 0.45, z!)));
    this.log(-5.4, 2.0, 0.97, 0, 'note');
    const crate = mat(0x6b5a3e);
    this.scene.add(mesh(boxGeo(1, 1, 1), crate, 5.0, 0.5, 3.3), mesh(boxGeo(0.8, 0.8, 0.8), crate, 5.6, 0.4, 4.1), mesh(boxGeo(0.7, 0.7, 0.7), crate, 5.2, 1.35, 3.4));
    this.scene.add(mesh(boxGeo(1.2, 2.4, 2.4), mat(PALETTE.metal), 5.6, 1.2, -2.0));
    const arm = new THREE.Group(); arm.position.set(-3, 0, -1.5); arm.rotation.y = 0.6;
    arm.add(mesh(hexGeo(0.4, 0.4), mat(PALETTE.address), 0, 0.2, 0), mesh(boxGeo(0.25, 1.6, 0.25), mat(PALETTE.metal), 0.5, 0.5, 0).rotateZ(-1.1), mesh(boxGeo(0.2, 1.1, 0.2), mat(PALETTE.metal), 1.5, 0.25, 0).rotateZ(1.4));
    this.scene.add(arm);
    // Door controller console + a wall-mounted register board on each side of the door.
    this.scene.add(mesh(boxGeo(3.4, 1.0, 1.0), mat(PALETTE.metal, { metal: 0.35 }), 0, 0.5, -4.4), mesh(boxGeo(3.2, 0.1, 0.9), mat(PALETTE.panel), 0, 1.05, -4.4));
    const status = new Screen(2.4, 0.6, 512); status.mesh.position.set(0, 1.45, -4.6); status.mesh.rotation.x = -0.35; status.mesh.name = 'workshop-status'; this.scene.add(status.mesh);
    this.statusScreens.workshop = status;
    this.log(1.9, -4.6, 1.12, 0, 'note');
    const zWall = -5.7, y = 2.3;
    this.workshopRig = new CpuRig({
      PC: new THREE.Vector3(-6.0, y, zWall), MAR: new THREE.Vector3(-4.5, y, zWall), CIR: new THREE.Vector3(-3.0, y, zWall),
      CU: new THREE.Vector3(-4.5, y - 1.0, zWall), MDR: new THREE.Vector3(3.0, y, zWall), ACC: new THREE.Vector3(4.5, y, zWall),
      ALU: new THREE.Vector3(4.5, y - 1.0, zWall), RAM: new THREE.Vector3(6.0, y, zWall),
    }, 'wall');
    this.scene.add(this.workshopRig.group);
  }
  private statusScreens: Partial<Record<PuzzleId, Screen>> = {};

  private buildVault() {
    for (const p of VAULT_PILLARS) {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
      const glow = glowMat(PALETTE.data, 0.2); this.pillarGlows.push(glow);
      g.add(mesh(hexGeo(0.5, 2.6, 0.38), mat(PALETTE.metal, { metal: 0.45, rough: 0.55 }), 0, 1.3, 0));
      g.add(mesh(hexGeo(0.52, 0.12), glow, 0, 2.66, 0, false), mesh(hexGeo(0.52, 0.12), glow, 0, 0.5, 0, false));
      const face = p.address < 8 ? 1 : -1;
      const s = new Screen(0.82, 0.62, 256); s.mesh.position.set(0, 1.55, 0.42 * face); if (face < 0) s.mesh.rotation.y = Math.PI;
      g.add(s.mesh);
      this.pillarScreens.push(s);
      this.scene.add(g);
    }
    // Vault controller and its lock read-out.
    this.scene.add(mesh(boxGeo(1.8, 1.0, 0.8), mat(PALETTE.metal, { metal: 0.35 }), 3.6, 0.5, -21.6));
    const status = new Screen(1.7, 0.5, 512); status.mesh.position.set(3.6, 1.35, -21.75); status.mesh.rotation.x = -0.35; this.scene.add(status.mesh);
    this.statusScreens.vault = status;
    this.lockScreen = new Screen(1.6, 0.9, 256); this.lockScreen.mesh.position.set(-3.2, 2.2, -22.75); this.scene.add(this.lockScreen.mesh);
    this.vaultBoard = new CpuRig({ PC: new THREE.Vector3(5.2, 2.6, -22.75), ACC: new THREE.Vector3(6.7, 2.6, -22.75), MAR: new THREE.Vector3(5.2, 1.7, -22.75), MDR: new THREE.Vector3(6.7, 1.7, -22.75) }, 'wall');
    this.scene.add(this.vaultBoard.group);
    this.log(-8.65, -10.5, 1.4, Math.PI / 2); this.log(8.65, -21.5, 0, -Math.PI / 2, 'terminal');
  }

  private buildBus() {
    // The chasm: a dark pit with a faint glow far below.
    const pit = mesh(boxGeo(CHASM.x1 - CHASM.x0, 0.1, CHASM.z1 - CHASM.z0), glowMat(0x1a1030, 0.6), 0, -6, (CHASM.z0 + CHASM.z1) / 2, false);
    this.scene.add(pit);
    for (const z of [CHASM.z0, CHASM.z1]) this.scene.add(mesh(boxGeo(CHASM.x1 - CHASM.x0, 6, 0.3), mat(PALETTE.dark), 0, -3, z, false));
    for (const x of [CHASM.x0, CHASM.x1]) this.scene.add(mesh(boxGeo(0.3, 6, CHASM.z1 - CHASM.z0), mat(PALETTE.dark), x, -3, (CHASM.z0 + CHASM.z1) / 2, false));
    // The bridge (extends when the buses are wired).
    this.bridge = new THREE.Group(); this.bridge.position.set(0, 0, CHASM.z1);
    const deck = mesh(boxGeo(BRIDGE.x1 - BRIDGE.x0, 0.22, CHASM.z1 - CHASM.z0), mat(PALETTE.metal, { metal: 0.5 }), 0, -0.11, -(CHASM.z1 - CHASM.z0) / 2);
    const rail = (x: number) => mesh(boxGeo(0.08, 0.7, CHASM.z1 - CHASM.z0), glowMat(PALETTE.data, 0.6), x, 0.35, -(CHASM.z1 - CHASM.z0) / 2, false);
    this.bridge.add(deck, rail(BRIDGE.x0), rail(BRIDGE.x1));
    this.scene.add(this.bridge);
    // Three conduits, broken over the chasm.
    const buses = ['address', 'data', 'control'] as const;
    buses.forEach((bus, i) => {
      const x = -4.8 + i * 0.45, y = 0.4 + i * 0.35;
      const m = glowMat(BUS_COLOR[bus], 0.35);
      const len = (pz0: number, pz1: number) => { const c = mesh(new THREE.CylinderGeometry(0.11, 0.11, Math.abs(pz1 - pz0), 6), m, x, y, (pz0 + pz1) / 2, false); c.rotation.x = Math.PI / 2; return c; };
      this.scene.add(len(-26.2, CHASM.z1), len(CHASM.z0, -37.8));
      const gap = new THREE.Group(); gap.add(len(CHASM.z1, CHASM.z0)); this.scene.add(gap);
      this.conduits.push({ mat: m, gap, bus });
    });
    // Junction with four sockets.
    this.scene.add(mesh(boxGeo(2.0, 1.2, 0.9), mat(PALETTE.metal, { metal: 0.4 }), -3.6, 0.6, -28.6));
    const screens = new Map<string, Screen>();
    BUS_LINKS.forEach((link, i) => { const s = new Screen(0.42, 0.42, 128); s.mesh.position.set(-4.25 + i * 0.44, 1.0, -28.13); this.scene.add(s.mesh); screens.set(link, s); });
    const status = new Screen(1.8, 0.45, 512); status.mesh.position.set(-3.6, 1.55, -28.6); status.mesh.rotation.x = -0.25; this.scene.add(status.mesh);
    this.statusScreens.bus = status;
    this.junction = { screens };
    this.log(5.65, -27.5, 1.4, -Math.PI / 2);
  }

  private buildChamber() {
    const v = (r: Register, y = 2.3) => new THREE.Vector3(CHAMBER_RIG[r].x, y, CHAMBER_RIG[r].z);
    this.chamberRig = new CpuRig({ PC: v('PC'), MAR: v('MAR'), MDR: v('MDR'), CIR: v('CIR'), CU: v('CU'), ACC: v('ACC'), ALU: v('ALU'), RAM: v('RAM', 1.75) }, 'pedestal');
    this.scene.add(this.chamberRig.group);
    // Floor channels between components, coloured by the bus they represent.
    const channel = (a: Register, b: Register, color: number) => {
      const pa = CHAMBER_RIG[a], pb = CHAMBER_RIG[b], len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const c = mesh(boxGeo(0.14, 0.04, len), glowMat(color, 0.5), (pa.x + pb.x) / 2, 0.03, (pa.z + pb.z) / 2, false);
      c.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z); this.scene.add(c);
    };
    channel('PC', 'MAR', PALETTE.internal); channel('MAR', 'RAM', PALETTE.address); channel('MDR', 'RAM', PALETTE.data); channel('CU', 'RAM', PALETTE.control);
    channel('MDR', 'CIR', PALETTE.internal); channel('CIR', 'CU', PALETTE.internal); channel('MDR', 'ACC', PALETTE.internal); channel('ACC', 'ALU', PALETTE.internal);
    this.scene.add(mesh(boxGeo(2.6, 1.0, 0.9), mat(PALETTE.metal, { metal: 0.35 }), 0, 0.5, -43.2));
    const status = new Screen(2.4, 0.6, 512); status.mesh.position.set(0, 1.4, -43.4); status.mesh.rotation.x = -0.35; this.scene.add(status.mesh);
    this.statusScreens.chamber = status;
    // Turbines on both walls: they spin with the sequencer.
    for (const x of [-10.2, 10.2]) {
      const t = new THREE.Group(); t.position.set(x, 2.0, -52); t.rotation.y = Math.PI / 2;
      t.add(mesh(new THREE.TorusGeometry(1.5, 0.16, 4, 8), mat(PALETTE.metal, { metal: 0.6 }), 0, 0, 0));
      const blades = new THREE.Group();
      for (let i = 0; i < 6; i++) { const b = mesh(boxGeo(0.25, 1.3, 0.06), mat(PALETTE.address), 0, 0.65, 0); b.geometry.translate(0, 0, 0); const holder = new THREE.Group(); holder.rotation.z = (i / 6) * Math.PI * 2; b.rotation.y = 0.5; holder.add(b); blades.add(holder); }
      blades.add(mesh(hexGeo(0.3, 0.3), mat(PALETTE.dark), 0, 0, 0).rotateX(Math.PI / 2));
      t.add(blades); this.turbines.push(blades); this.scene.add(t);
    }
    this.log(-10.65, -43.5, 1.4, Math.PI / 2); this.log(10.2, -59.5, 0, -Math.PI / 2, 'terminal');
  }

  private buildCore() {
    const g = new THREE.Group(); g.position.set(CORE_CENTER.x, 0, CORE_CENTER.z);
    g.add(mesh(hexGeo(2.0, 0.6, 1.7), mat(PALETTE.metal, { metal: 0.5 }), 0, 0.3, 0));
    const gemMat = glowMat(PALETTE.warm, 0.15);
    const gem = mesh(new THREE.IcosahedronGeometry(1.1, 0), gemMat, 0, 2.4, 0);
    const rings = [1.7, 2.1, 2.5].map((r, i) => { const t = mesh(new THREE.TorusGeometry(r, 0.07, 4, 10), mat(PALETTE.metal, { metal: 0.7, rough: 0.35 }), 0, 2.4, 0); t.rotation.set(Math.PI / 2 + i * 0.5, i * 0.7, 0); return t; });
    const beam = mesh(new THREE.CylinderGeometry(0.35, 0.6, 30, 6, 1, true), new THREE.MeshBasicMaterial({ color: PALETTE.warm, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 0, 17, 0, false);
    g.add(gem, ...rings, beam);
    this.scene.add(g);
    this.core = { gem, gemMat, rings, beam };
    const v = (r: Register) => new THREE.Vector3(CORE_RIG[r].x, 1.8, CORE_RIG[r].z);
    this.coreRig = new CpuRig({ PC: v('PC'), MAR: v('MAR'), MDR: v('MDR'), CIR: v('CIR'), CU: v('CU'), ACC: v('ACC'), ALU: v('ALU'), RAM: v('RAM') }, 'mini');
    // Face each mini screen toward the core's console side for readability.
    this.coreRig.group.children.forEach(h => { h.lookAt(0, h.position.y, -66); });
    this.scene.add(this.coreRig.group);
    this.scene.add(mesh(boxGeo(2.6, 1.0, 0.9), mat(PALETTE.metal, { metal: 0.35 }), 0, 0.5, -67.4));
    const status = new Screen(2.4, 0.6, 512); status.mesh.position.set(0, 1.4, -67.6); status.mesh.rotation.x = -0.35; this.scene.add(status.mesh);
    this.statusScreens.core = status;
    this.log(-7.65, -65.5, 1.4, Math.PI / 2);
  }

  /** Floating diamond over each main machine; logs get a small one until read. */
  private buildMarkers() {
    for (const it of INTERACTABLES) {
      if (it.kind !== 'machine' && it.kind !== 'log') continue;
      const m = mesh(new THREE.OctahedronGeometry(it.kind === 'machine' ? 0.14 : 0.08, 0), new THREE.MeshBasicMaterial({ color: it.kind === 'machine' ? PALETTE.address : PALETTE.data, toneMapped: false }), it.x, it.y + 1.3, it.z, false);
      this.markers.set(it.id, m); this.scene.add(m);
    }
  }

  /* ════════════════════ state → visuals ════════════════════ */
  private powered(id: PuzzleId) { return this.store.get().progress.solved[id]; }
  private resetFromStore(snap: boolean) {
    const s = this.store.get();
    const p = s.progress.player;
    this.pos.set(p.x, p.z);
    if (!isFree(p.x, p.z, PLAYER_R, blockers(s.progress))) this.pos.set(0, 3.5);
    this.yaw = p.yaw; this.facing = p.yaw;
    for (const d of DOORS) { const door = this.doors.get(d.id)!; door.target = s.progress.solved[d.opensWhen] ? 1 : 0; if (snap) door.open = door.target; }
    this.bridgeExtend = s.progress.solved.bus ? 1 : 0;
    this.corePower = s.progress.solved.core ? 1 : 0;
    for (const [name, rl] of this.roomLights) { rl.target = s.progress.solved[ROOM_PUZZLE[name]!] ? 1 : 0; if (snap) rl.level = rl.target; }
    this.cinematic = null;
    this.drawAll();
  }
  private syncFromStore() {
    const s = this.store.get();
    if (this.camera.fov !== s.settings.fov) { this.camera.fov = s.settings.fov; this.camera.updateProjectionMatrix(); }
    this.audio.setVolume(s.settings.volume);
    if (s.phase !== 'playing') { this.keys.clear(); if (document.pointerLockElement === this.renderer.domElement) { this.expectUnlock = true; document.exitPointerLock(); } }
    for (const it of INTERACTABLES) { const m = this.markers.get(it.id); if (m && it.kind === 'log') m.visible = !s.progress.logs.includes(it.id); }
  }
  private expectUnlock = false;

  private drawAll() {
    const s = this.store.get(), m = s.machines;
    this.workshopRig.update(m.workshop, true);
    this.vaultBoard.update(m.vault, this.powered('workshop'));
    this.chamberRig.update(m.chamber, this.powered('bus'));
    this.coreRig.update(m.core, this.powered('chamber'));
    this.drawPillars(); this.drawJunction(); this.drawStatus();
  }
  private drawPillars() {
    const m = this.store.get().machines.vault;
    VAULT_PILLARS.forEach((p, i) => {
      const kind = m.kind[i];
      drawRegister(this.pillarScreens[i]!, p.address.toString(2).padStart(4, '0'), kind === 'empty' ? '········' : binary8(m.memory[i]!), {
        color: '#f2a541', sub: kind === 'instruction' ? 'instruction' : kind === 'data' ? 'data · ' + m.memory[i] : 'empty', active: this.pillarFlash[i]! > 0, dim: kind === 'empty',
      });
    });
    const lock = m.memory[14]!;
    drawRegister(this.lockScreen, 'LOCK reads 1110', binary8(lock), { color: lock === 9 ? '#7bd88f' : '#e05a5a', sub: lock === 9 ? 'accepted' : 'needs 00001001', active: true });
  }
  private drawJunction() {
    const routing = this.store.get().progress.busRouting;
    for (const [link, s] of this.junction.screens) {
      const bus = routing[link as keyof typeof routing];
      s.draw((c, w, h) => {
        c.fillStyle = bus ? '#' + BUS_COLOR[bus].toString(16).padStart(6, '0') : '#1b1f27'; c.fillRect(0, 0, w, h);
        c.fillStyle = bus ? '#10141b' : '#5d6578'; c.font = '700 22px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(link.replace('→', '›'), w / 2, h * 0.35); c.fillText(bus ? bus.slice(0, 4).toUpperCase() : '—', w / 2, h * 0.7);
      });
    }
  }
  private drawStatus() {
    const s = this.store.get();
    for (const [id, screen] of Object.entries(this.statusScreens) as [PuzzleId, Screen][]) {
      const m = s.machines[id], v = s.verdicts[id], solved = s.progress.solved[id];
      const head = solved ? 'ONLINE' : !this.store.isUnlocked(id) ? 'NO POWER' : m.error ? 'FAULT' : m.halted ? 'HALTED' : m.frame.phase === 'ready' ? 'STANDBY' : m.frame.phase.toUpperCase();
      const color = solved ? '#7bd88f' : m.error || (v && !v.ok) ? '#e05a5a' : '#f2a541';
      drawText(screen, [{ text: head, color, size: 0.34 }, { text: v ? v.title : m.frame.description.slice(0, 46), size: 0.17, mono: true, color: '#b8c0d0' }]);
    }
  }

  private onEvent(e: WorldEvent) {
    if (e.type === 'reset') { this.resetFromStore(true); return; }
    const s = this.store.get();
    if (e.type === 'step') {
      const m = s.machines[e.id];
      const t = m.frame.transfer;
      if (e.id === 'workshop') this.workshopRig.update(m);
      if (e.id === 'vault') {
        this.vaultBoard.update(m, this.powered('workshop'));
        if (t && (t.from === 'RAM' || t.to === 'RAM')) {
          this.pillarFlash[m.mar] = 0.7;
          const p = VAULT_PILLARS[m.mar]!;
          const a = new THREE.Vector3(p.x, 2.7, p.z), b = new THREE.Vector3(3.6, 1.4, -21.6);
          this.packets.emit(t.from === 'RAM' ? a : b, t.from === 'RAM' ? b : a, BUS_COLOR[t.bus], 0.45, 1.5);
          this.audio.transfer(t.bus, a);
        }
        this.drawPillars();
      }
      if (e.id === 'bus') {
        if (t && t.bus !== 'internal') {
          const idx = ['address', 'data', 'control'].indexOf(t.bus), x = -4.8 + idx * 0.45, y = 0.4 + idx * 0.35;
          const toRam = t.to === 'RAM';
          this.packets.emit(new THREE.Vector3(x, y, toRam ? -27 : -37.5), new THREE.Vector3(x, y, toRam ? -37.5 : -27), BUS_COLOR[t.bus], 0.5, 0.2);
          this.audio.transfer(t.bus, new THREE.Vector3(x, y, -32));
        }
      }
      if (e.id === 'chamber') { this.chamberRig.update(m, this.powered('bus')); if (t) { this.chamberRig.transfer(t, this.packets); this.audio.transfer(t.bus, this.chamberRig.anchor(t.to)); } if (m.frame.description.startsWith('Store')) this.turbineSpeed += 2.5; }
      if (e.id === 'core') { this.coreRig.update(m, this.powered('chamber')); if (t) { this.coreRig.transfer(t, this.packets); this.audio.transfer(t.bus, this.coreRig.anchor(t.to)); } this.corePower = Math.max(this.corePower, 0.15); }
      if (e.id === 'workshop' && t) { this.workshopRig.transfer(t, this.packets); this.audio.transfer(t.bus, this.workshopRig.anchor(t.to)); }
      else if (e.id === 'workshop') this.audio.step();
      this.drawStatus();
      return;
    }
    if (e.type === 'fail') {
      this.errorFlash = 1; this.shake = 0.15;
      if (e.id === 'bus') this.spark = 1;
      this.audio.error(this.machinePos(e.id));
      this.drawStatus();
      return;
    }
    if (e.type === 'solved') {
      const door = DOORS.find(d => d.opensWhen === e.id);
      if (door) { this.doors.get(door.id)!.target = 1; this.audio.door(new THREE.Vector3(0, 1.5, door.z)); }
      const room = ROOMS.find(r => ROOM_PUZZLE[r.name] === e.id);
      if (room) this.roomLights.get(room.name)!.target = 1;
      this.audio.success(this.machinePos(e.id));
      this.shake = 0.25;
      if (e.id === 'core') { this.cinematic = { t: 0, done: false }; this.audio.finale(); }
      this.drawAll();
    }
  }
  private machinePos(id: PuzzleId) { const it = INTERACTABLES.find(i => i.id === id)!; return new THREE.Vector3(it.x, 1.2, it.z); }

  /* ════════════════════ input ════════════════════ */
  private bindInput() {
    const el = this.renderer.domElement;
    const on = <K extends keyof WindowEventMap | 'pointerlockchange'>(t: K, f: (e: K extends keyof WindowEventMap ? WindowEventMap[K] : Event) => void, target: Window | Document | HTMLElement = window) => {
      target.addEventListener(t, f as EventListener); this.disposers.push(() => target.removeEventListener(t, f as EventListener));
    };
    on('keydown', e => {
      if (this.store.get().phase !== 'playing') return;
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'z'].includes(k)) { this.keys.add(k); e.preventDefault(); }
      if (k === 'e' || k === 'enter' && document.activeElement === el) { this.interact(); e.preventDefault(); }
      if (k === 'v') this.firstPerson = !this.firstPerson;
      if (k === 'j' || k === 'tab') { e.preventDefault(); this.store.setPhase('journal'); }
      if (k === 'm') this.store.setPhase('map');
      if (k === 'f5') { e.preventDefault(); this.store.saveGame(); }
    });
    on('keyup', e => { this.keys.delete(e.key.toLowerCase()); });
    on('blur', () => this.keys.clear());
    on('click', () => { if (this.store.get().phase === 'playing' && document.pointerLockElement !== el) { this.audio.start(); el.requestPointerLock?.()?.catch?.(() => { /* drag-look fallback */ }); } }, el);
    on('mousedown', () => { this.dragging = true; }, el);
    on('mouseup', () => { this.dragging = false; });
    on('mousemove', e => {
      if (this.store.get().phase !== 'playing') return;
      const locked = document.pointerLockElement === el;
      if (!locked && !this.dragging) return;
      const sens = 0.0024 * this.store.get().settings.sensitivity;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens * (this.store.get().settings.invertY ? -1 : 1);
      this.pitch = Math.max(-1.2, Math.min(0.55, this.pitch));
    });
    on('pointerlockchange', () => {
      if (document.pointerLockElement === el) return;
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (this.store.get().phase === 'playing') this.store.pause();
    }, document);
  }
  focus() { this.renderer.domElement.focus(); }
  /** Read-only snapshot for automated play-testing (exposed only with ?cpulab-debug). */
  debugState() { return { profile: this.profile.level, scale: this.dynres.scale, x: this.pos.x, z: this.pos.y, yaw: this.yaw, nearest: this.nearest?.id ?? null, room: roomAt(this.pos.x, this.pos.y), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  lock() { this.audio.start(); const el = this.renderer.domElement; el.focus(); try { void el.requestPointerLock?.()?.catch?.(() => undefined); } catch { /* not available */ } }

  private interact() {
    const it = this.nearest; if (!it) return;
    this.audio.start(); this.audio.interact();
    if (it.inspect) {
      const r = it.inspect as Register, m = this.store.get().machines.chamber;
      this.store.toast(`${r} = ${registerValue(m, r)} — ${REG_INFO[r]}`, 'info');
      return;
    }
    if (it.panel) this.store.openPanel(it.panel);
  }

  /* ════════════════════ loop ════════════════════ */
  private onResize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  private frame(time: number) {
    this.timer.update(time);
    const raw = Math.min(0.25, this.timer.getDelta());
    const dt = Math.min(0.05, raw);
    const s = this.store.get();
    this.frameNo++;
    const t = time / 1000;
    const reduced = s.settings.reducedMotion;
    // Fixed sub-steps keep movement and collision frame-rate independent on slow machines.
    if (s.phase === 'playing' && !this.cinematic) for (let left = raw; left > 1e-4; left -= 0.05) this.updatePlayer(Math.min(0.05, left), s);
    this.animate(dt, t, reduced);
    this.updateCamera(dt, t, reduced);
    if (s.phase === 'playing' || s.phase === 'panel') {
      this.nearest = s.phase === 'playing' && !this.cinematic ? findInteractable(this.pos.x, this.pos.y, this.facingForInteract(), INTERACTABLES) : null;
      this.store.setPrompt(this.nearest ? this.nearest.label : null);
    }
    this.cull();
    // Behind menus and machine panels the world only needs to tick slowly — saves weak GPUs.
    const backdrop = s.phase !== 'playing' && s.phase !== 'intro' && !this.cinematic;
    if (backdrop && this.frameNo % 4 !== 0) return;
    if (!backdrop) { const scale = this.dynres.sample(raw); if (scale !== null) { this.renderer.setPixelRatio(scale); this.onResize(); } }
    this.renderer.render(this.scene, this.camera);
  }
  /** Live performance numbers for the optional FPS readout. */
  stats() { return { fps: Math.round(this.dynres.fps), scale: this.dynres.scale, profile: this.profile.level, calls: this.renderer.info.render.calls }; }
  private facingForInteract() { return this.firstPerson ? this.yaw : this.yaw; }

  private updatePlayer(dt: number, s: ReturnType<GameStore['get']>) {
    const k = this.keys;
    const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
    this.yaw += turn * dt * 2.2;
    const fwd = (k.has('w') || k.has('arrowup') || k.has('z') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const strafe = (k.has('d') ? 1 : 0) - (k.has('a') || k.has('q') ? 1 : 0);
    const moving = fwd !== 0 || strafe !== 0;
    if (moving) {
      const speed = (k.has('shift') ? 6.2 : 3.6) * dt;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      let dx = -sin * fwd + cos * strafe, dz = -cos * fwd - sin * strafe;
      const len = Math.hypot(dx, dz); dx = (dx / len) * speed; dz = (dz / len) * speed;
      const next = moveWithCollision(this.pos.x, this.pos.y, dx, dz, PLAYER_R, blockers(s.progress));
      this.pos.set(next.x, next.z);
      const target = Math.atan2(-dx, -dz);
      let diff = target - this.facing; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 12);
      this.walkPhase += dt * (k.has('shift') ? 13 : 9);
      this.stepClock += dt; if (this.stepClock > (k.has('shift') ? 0.28 : 0.4)) { this.stepClock = 0; this.audio.footstep(); }
    } else this.walkPhase *= 0.85;
    if (this.firstPerson) this.facing = this.yaw;
    const room = roomAt(this.pos.x, this.pos.y);
    if (room) this.store.enterRoom(room);
    if (time() - this.lastSave > 2000) { this.lastSave = time(); this.store.setPlayer(+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.yaw.toFixed(3)); }
  }

  private animate(dt: number, t: number, reduced: boolean) {
    const s = this.store.get();
    // player rig
    const g = this.player.group;
    g.position.set(this.pos.x, 0, this.pos.y); g.rotation.y = this.facing;
    g.visible = !this.firstPerson;
    const swing = Math.sin(this.walkPhase) * 0.6 * Math.min(1, Math.abs(this.walkPhase) > 0.01 ? 1 : 0);
    this.player.legs[0]!.rotation.x = swing; this.player.legs[1]!.rotation.x = -swing;
    this.player.arms[0]!.rotation.x = -swing * 0.8; this.player.arms[1]!.rotation.x = swing * 0.8;
    // BIT hovers at the shoulder and faces where the player looks.
    const bitTarget = new THREE.Vector3(this.pos.x + Math.cos(this.facing) * 0.55 + Math.sin(this.facing) * 0.25, 2.05 + (reduced ? 0 : Math.sin(t * 2.1) * 0.06), this.pos.y - Math.sin(this.facing) * 0.55 + Math.cos(this.facing) * 0.25);
    this.bit.group.position.lerp(bitTarget, Math.min(1, dt * 4));
    this.bit.group.rotation.y = this.yaw;
    this.bit.ring.rotation.z += dt * 2;
    this.bit.eye.emissiveIntensity = s.dialogue.length ? 2.4 + Math.sin(t * 18) * 1.2 : 2.2;
    this.torch.position.set(this.pos.x, 2.4, this.pos.y);
    this.key.position.set(this.pos.x + 6, 14, this.pos.y + 4); this.key.target.position.set(this.pos.x, 0, this.pos.y - 2);

    for (const d of this.doors.values()) d.update(dt);
    // Room power: dim red emergency light → full colour.
    let total = 0;
    const emergency = new THREE.Color(0xff4b3a);
    for (const rl of this.roomLights.values()) {
      rl.level += (rl.target - rl.level) * Math.min(1, dt * 0.9);
      total += rl.level;
      rl.strips.forEach((m, i) => { const last = i === rl.strips.length - 1; m.emissive.copy(last ? rl.color : emergency.clone().lerp(rl.color, rl.level)); m.emissiveIntensity = last ? 0.2 + rl.level * 2.5 : 0.6 + rl.level * 0.8; });
    }
    const near = [...this.roomLights.entries()].sort((a, b) => Math.hypot(a[1].pos.x - this.pos.x, a[1].pos.z - this.pos.y) - Math.hypot(b[1].pos.x - this.pos.x, b[1].pos.z - this.pos.y));
    this.lightPool.forEach((light, i) => {
      const [name, rl] = near[i]!;
      light.position.copy(rl.pos); light.distance = rl.range;
      light.color.copy(emergency).lerp(rl.color, rl.level);
      const flicker = rl.level < 0.5 && !reduced ? (Math.sin(t * 23 + i * 10) > 0.93 ? 0.4 : 1) : 1;
      const coreBoost = name === 'Core' ? this.corePower * 40 : 0;
      light.intensity = (4 + rl.level * 22) * flicker + coreBoost + (name === s.room ? this.errorFlash * 30 : 0) + (name === 'Bus Bridge' ? this.spark * 25 : 0);
    });
    this.audio.setPower(total / this.roomLights.size);
    this.errorFlash = Math.max(0, this.errorFlash - dt * 1.6);
    this.spark *= Math.pow(0.02, dt);
    // Bridge, conduits.
    const solvedBus = s.progress.solved.bus;
    this.bridgeExtend += ((solvedBus ? 1 : 0) - this.bridgeExtend) * Math.min(1, dt * 1.2);
    this.bridge.scale.z = Math.max(0.001, this.bridgeExtend);
    this.conduits.forEach(c => { c.gap.visible = solvedBus; c.mat.emissiveIntensity = solvedBus ? 1.2 + Math.sin(t * 3) * 0.2 : 0.35; });
    // Pillars flash when the vault controller touches their address.
    this.pillarGlows.forEach((m, i) => { const f = this.pillarFlash[i]!; if (f > 0) this.pillarFlash[i] = Math.max(0, f - dt); m.emissiveIntensity = 0.2 + f * 4 + (s.progress.solved.vault ? 0.4 : 0); m.emissive.setHex(f > 0 ? PALETTE.address : PALETTE.data); });
    // Turbines.
    if (s.progress.solved.chamber) this.turbineSpeed = Math.max(this.turbineSpeed, 3);
    this.turbineSpeed *= s.progress.solved.chamber ? 1 : Math.pow(0.4, dt);
    this.turbines.forEach((b, i) => { b.rotation.z += dt * this.turbineSpeed * (i ? -1 : 1) * (reduced ? 0.4 : 1); });
    // Core.
    const target = s.progress.solved.core ? 1 : this.corePower > 0 && s.running === 'core' ? 0.3 : 0;
    this.corePower += (target - this.corePower) * Math.min(1, dt * 0.8);
    const cp = this.corePower;
    this.core.gemMat.emissiveIntensity = 0.15 + cp * 3.2 + (reduced ? 0 : Math.sin(t * 3) * cp * 0.4);
    this.core.gem.rotation.y += dt * (0.1 + cp * 0.8);
    this.core.rings.forEach((r, i) => { r.rotation.z += dt * cp * (1.2 + i * 0.6) * (i % 2 ? -1 : 1); });
    (this.core.beam.material as THREE.MeshBasicMaterial).opacity = cp * 0.35;
    // Markers bob; solved machines lose their marker.
    for (const [id, m] of this.markers) {
      if (s.progress.solved[id as PuzzleId]) m.visible = false;
      if (INTERACTABLES.find(i => i.id === id)?.kind === 'machine' && !this.store.isUnlocked(id as PuzzleId)) m.visible = false;
      else if (INTERACTABLES.find(i => i.id === id)?.kind === 'machine' && !s.progress.solved[id as PuzzleId]) m.visible = true;
      m.rotation.y += dt * 1.5; m.position.y += reduced ? 0 : Math.sin(t * 2 + m.position.x) * 0.002;
    }
    this.packets.update(dt);
    // Cinematic after the Core restarts.
    if (this.cinematic) {
      this.cinematic.t += dt;
      ROOMS.forEach((r, i) => { if (this.cinematic!.t > i * 0.6) this.roomLights.get(r.name)!.target = 1; });
      if (this.cinematic.t > 7 && !this.cinematic.done) { this.cinematic.done = true; this.store.enterEnding(); }
    }
  }

  private updateCamera(dt: number, t: number, reduced: boolean) {
    const s = this.store.get();
    const head = new THREE.Vector3(this.pos.x, 1.55, this.pos.y);
    if (this.cinematic) {
      const a = this.cinematic.t * 0.35, r = 9 - Math.min(3, this.cinematic.t * 0.4);
      this.camera.position.set(CORE_CENTER.x + Math.sin(a) * r, 2.2 + this.cinematic.t * 0.35, CORE_CENTER.z + Math.cos(a) * r);
      this.camera.lookAt(CORE_CENTER.x, 2.4, CORE_CENTER.z);
    } else if (s.phase === 'menu') {
      const a = t * 0.05;
      this.camera.position.set(Math.sin(a) * 5, 2.6, 1 + Math.cos(a) * 3);
      this.camera.lookAt(0, 1.4, -4);
    } else if (this.firstPerson) {
      this.camera.position.copy(head).add(new THREE.Vector3(0, 0.1, 0));
      this.camera.rotation.set(this.pitch + 0.2, this.yaw, 0, 'YXZ');
    } else {
      const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      // Pull the camera in if a wall is between it and the player.
      let dist = 4.2;
      const b = blockers(s.progress).filter(r => r.x1 - r.x0 < 6 || r.z1 - r.z0 < 6);
      for (let d = 0.6; d <= 4.2; d += 0.2) {
        const cx = head.x + dir.x * d, cz = head.z + dir.z * d;
        if (!isFree(cx, cz, 0.15, b.filter(r => r !== CHASM))) { dist = Math.max(0.6, d - 0.3); break; }
      }
      const want = head.clone().addScaledVector(dir, dist).add(new THREE.Vector3(0, 0.25, 0));
      this.camera.position.lerp(want, Math.min(1, dt * 14));
      this.camera.lookAt(head.x, head.y + 0.1, head.z);
    }
    if (this.shake > 0 && !reduced) { this.shake = Math.max(0, this.shake - dt); this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4; this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4; }
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    this.audio.listener(this.camera.position, fwd);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    if (this.ready) this.store.setPlayer(this.pos.x, this.pos.y, this.yaw);
    this.resize.disconnect();
    this.disposers.forEach(d => d());
    this.timer.dispose();
    this.workshopRig.dispose(); this.chamberRig.dispose(); this.coreRig.dispose(); this.vaultBoard.dispose();
    this.pillarScreens.forEach(s => s.dispose()); Object.values(this.statusScreens).forEach(s => s?.dispose());
    this.scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); } });
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
const time = () => performance.now();

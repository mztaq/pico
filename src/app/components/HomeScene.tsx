import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './home-scene.css';
import { HomeSceneFallback } from './HomeSceneFallback';

type Workspace = 'pseudocode' | 'python' | 'flowchart' | 'logic' | 'cpu';

const modules: { id: Workspace; label: string; x: number; z: number }[] = [
  { id: 'pseudocode', label: 'PSEUDOCODE', x: -3.55, z: -1.35 },
  { id: 'python', label: 'PYTHON', x: -3.55, z: 1.35 },
  { id: 'flowchart', label: 'FLOWCHART', x: 0, z: -2 },
  { id: 'logic', label: 'LOGIC', x: 3.55, z: 1.35 },
  { id: 'cpu', label: 'CPU', x: 3.55, z: -1.35 },
];

export function HomeScene({ onChoose }: { onChoose: (workspace: Workspace) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    if (!canvas.getContext('webgl2', { antialias: true, alpha: true })) return;
    canvas.className = 'home-scene-canvas';
    // Every destination is available in the keyboard-accessible workspace cards below.
    canvas.setAttribute('aria-hidden', 'true');
    element.append(canvas);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      canvas.remove();
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const mobile = window.matchMedia('(max-width: 640px)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.2 : 1.5));

    const style = getComputedStyle(element);
    const color = (name: string, fallback: string) => new THREE.Color(style.getPropertyValue(name).trim() || fallback);
    const dark = style.colorScheme !== 'light';
    const accent = color('--accent', '#cba6f7');
    // The light theme presents the board as a dark physical object against the page.
    const text = dark ? color('--text', '#cdd6f4') : new THREE.Color('#f2f3ff');
    const boardColor = dark ? color('--surface', '#181825') : new THREE.Color('#35374d');
    const background = dark ? color('--bg', '#1e1e2e') : new THREE.Color('#25273b');
    const scene = new THREE.Scene();
    const cameraWidth = mobile ? 5.8 : 6.4;
    const camera = new THREE.OrthographicCamera(-cameraWidth, cameraWidth, 3, -3, .1, 60);
    camera.position.set(0, 8.5, 11.5);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, dark ? 1.1 : 1.5));
    const key = new THREE.DirectionalLight(dark ? 0xdde2ff : 0xffffff, dark ? 2.2 : 2.3);
    key.position.set(-4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.normalBias = .03;
    scene.add(key);
    const rim = new THREE.PointLight(accent, dark ? 17 : 13, 14);
    rim.position.set(4, 4, -3);
    scene.add(rim);

    const root = new THREE.Group();
    root.scale.setScalar(mobile ? .92 : 1);
    scene.add(root);
    const disposable: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
    const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(item: T) => { disposable.push(item); return item; };
    const material = (value: THREE.Color, metalness = .3, roughness = .52) =>
      keep(new THREE.MeshStandardMaterial({ color: value, metalness, roughness }));
    const metal = material(boardColor.clone().lerp(text, dark ? .18 : .12), .72, .3);
    const boardMat = material(boardColor.clone().lerp(background, .2), .46, .48);
    const insetMat = material(boardColor.clone().lerp(background, dark ? .4 : .12), .24, .66);
    const traceMat = material(accent.clone().lerp(boardColor, .24), .68, .31);
    const activeMat = material(accent, .35, .37);
    const raisedMat = material(boardColor.clone().lerp(text, dark ? .12 : .05), .58, .35);
    const addBox = (parent: THREE.Object3D, width: number, height: number, depth: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(width, height, depth)), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const addLabel = (parent: THREE.Object3D, label: string, x: number, y: number, z: number, width: number, value: THREE.Color, size = 36) => {
      const surface = document.createElement('canvas');
      surface.width = 512; surface.height = 128;
      const context = surface.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, 512, 128);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `700 ${size}px "JetBrains Mono", monospace`;
      context.fillStyle = '#' + value.getHexString();
      context.fillText(label, 256, 64, 460);
      const texture = keep(new THREE.CanvasTexture(surface));
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, width / 4)), keep(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      parent.add(mesh);
    };

    // A real board, raised modules, and routed copper paths make the spatial layout legible.
    addBox(root, 10.7, .24, 5.9, 0, -.14, 0, metal);
    addBox(root, 10.48, .06, 5.68, 0, .01, 0, boardMat);
    addBox(root, 2.55, .15, 2.03, 0, .17, 0, insetMat);
    addBox(root, 2.32, .45, 1.8, 0, .47, 0, raisedMat);
    addBox(root, 2.12, .025, 1.6, 0, .71, 0, boardMat);
    addLabel(root, 'PICO', 0, .735, -.15, 1.55, text, 126);
    addLabel(root, 'WORKBENCH', 0, .737, .42, 1.48, accent, 58);
    for (let i = -5; i <= 5; i++) {
      addBox(root, .12, .045, .27, i * .19, .17, -1.07, traceMat);
      addBox(root, .12, .045, .27, i * .19, .17, 1.07, traceMat);
    }

    const targets: THREE.Mesh[] = [];
    const mats: THREE.MeshStandardMaterial[] = [];
    for (const module of modules) {
      const group = new THREE.Group();
      group.position.set(module.x, 0, module.z);
      root.add(group);
      addBox(group, 1.8, .12, .92, 0, .1, 0, insetMat);
      const topMat = keep(new THREE.MeshStandardMaterial({ color: boardColor.clone().lerp(text, dark ? .16 : .08), metalness: .48, roughness: .38, emissive: accent, emissiveIntensity: 0 }));
      mats.push(topMat);
      const hit = addBox(group, 1.65, .24, .79, 0, .28, 0, topMat);
      hit.userData.workspace = module.id;
      targets.push(hit);
      addLabel(group, module.label, 0, .405, -.02, 1.46, text, module.label.length > 8 ? 80 : 106);
      if (module.id === 'pseudocode' || module.id === 'python') {
        for (let index = 0; index < 3; index++) addBox(group, .38 - index * .05, .022, .035, -.42, .41 + index * .028, .19 + index * .09, activeMat);
      } else if (module.id === 'flowchart') {
        for (let index = 0; index < 3; index++) addBox(group, .14, .04, .12, -.3 + index * .3, .42, .2, activeMat);
      } else if (module.id === 'logic') {
        addBox(group, .47, .045, .06, -.05, .42, .19, activeMat);
        addBox(group, .06, .045, .3, .19, .42, .19, activeMat);
      } else {
        for (let index = -2; index <= 2; index++) addBox(group, .055, .06, .15, index * .21, .41, .25, activeMat);
      }
      const endX = module.x * .72;
      const endZ = module.z * .74;
      const points = [new THREE.Vector3(Math.sign(module.x) * 1.3, .067, Math.sign(module.z) * .5),
        new THREE.Vector3(endX, .067, Math.sign(module.z) * .5),
        new THREE.Vector3(endX, .067, endZ)];
      if (module.id === 'flowchart') points.splice(0, points.length,
        new THREE.Vector3(0, .067, -1.05), new THREE.Vector3(0, .067, -1.5));
      const curve = new THREE.CatmullRomCurve3(points);
      const trace = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 16, .018, 4, false)), traceMat);
      root.add(trace);
      const terminal = new THREE.Mesh(keep(new THREE.SphereGeometry(.055, 8, 6)), activeMat);
      terminal.position.copy(points[points.length - 1]);
      root.add(terminal);
    }

    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(18, 10)), keep(new THREE.ShadowMaterial({ opacity: dark ? .28 : .13 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.38;
    floor.receiveShadow = true;
    root.add(floor);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let targetX = 0, targetY = 0;
    let frame = 0;
    let visible = true;
    const render = () => { if (visible) renderer.render(scene, camera); };
    const settle = () => {
      frame = 0;
      root.rotation.x += (targetX - root.rotation.x) * .17;
      root.rotation.y += (targetY - root.rotation.y) * .17;
      render();
      if (visible && (Math.abs(targetX - root.rotation.x) > .001 || Math.abs(targetY - root.rotation.y) > .001)) frame = requestAnimationFrame(settle);
    };
    const schedule = () => { if (!frame && visible) frame = requestAnimationFrame(settle); };
    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const halfWidth = cameraWidth;
      const halfHeight = halfWidth * height / width;
      camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      render();
    };
    const pickWorkspace = (event: PointerEvent | MouseEvent): Workspace | null => {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
      raycaster.setFromCamera(pointer, camera);
      return (raycaster.intersectObjects(targets)[0]?.object.userData.workspace as Workspace | undefined) ?? null;
    };
    const onMove = (event: PointerEvent) => {
      const hit = pickWorkspace(event);
      targetY = pointer.x * .085;
      targetX = pointer.y * .035;
      canvas.style.cursor = hit ? 'pointer' : 'default';
      mats.forEach((mat, index) => { mat.emissiveIntensity = modules[index].id === hit ? .28 : 0; });
      setHovered(hit ?? null);
      schedule();
    };
    const onLeave = () => {
      targetX = 0; targetY = 0;
      mats.forEach(mat => { mat.emissiveIntensity = 0; });
      setHovered(null); schedule();
    };
    const onClick = (event: MouseEvent) => { const hit = pickWorkspace(event); if (hit) onChoose(hit); };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      visible = false;
      cancelAnimationFrame(frame);
      canvas.style.display = 'none';
      setAvailable(false);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('webglcontextlost', onContextLost);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    const visibilityObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) render();
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    visibilityObserver.observe(element);
    resize();
    setAvailable(true);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      disposable.forEach(item => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [onChoose]);

  return <div className="home-scene" ref={host}>
    {!available && <HomeSceneFallback />}
    {hovered && <span className="home-scene-hint" aria-hidden="true">Open {modules.find(module => module.id === hovered)?.label.toLowerCase()}</span>}
  </div>;
}

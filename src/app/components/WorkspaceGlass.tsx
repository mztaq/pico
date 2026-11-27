import { useEffect, useId, useRef, useState } from 'react';

// Rounded-rectangle normal field. The center is neutral; the convex bezel
// samples inward along the surface normal, rather than using random noise.
export function glassDisplacement(x: number, y: number, width: number, height: number, radius: number): [number, number] {
  const r = Math.max(1, Math.min(radius, width / 2, height / 2));
  const dx = x - width / 2, dy = y - height / 2;
  const qx = Math.abs(dx) - (width / 2 - r);
  const qy = Math.abs(dy) - (height / 2 - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  const len = Math.hypot(ox, oy);
  const distance = r - (len + Math.min(Math.max(qx, qy), 0));
  const bevel = Math.min(24, width / 4, height / 4);
  if (distance >= bevel) return [128, 128];
  const u = Math.max(0, Math.min(1, distance / bevel));
  const strength = (1 - u) * (1 - u) * (0.7 + 0.3 * Math.sin(Math.PI * u));
  const nx = len > 0 ? ox / len * Math.sign(dx) : qx > qy ? Math.sign(dx) : 0;
  const ny = len > 0 ? oy / len * Math.sign(dy) : qx > qy ? 0 : Math.sign(dy);
  return [Math.round(128 - nx * strength * 127), Math.round(128 - ny * strength * 127)];
}

type Lens = { width: number; height: number; image: string };
const maps = new Map<string, string>();

function makeMap(width: number, height: number, radius: number) {
  const key = [width, height, radius].join(':');
  const cached = maps.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  // Half-resolution maps are interpolated by SVG; no per-frame canvas work.
  canvas.width = Math.max(1, Math.ceil(width / 2));
  canvas.height = Math.max(1, Math.ceil(height / 2));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const [red, green] = glassDisplacement((x + .5) * width / canvas.width, (y + .5) * height / canvas.height, width, height, radius);
      const i = (y * canvas.width + x) * 4;
      image.data[i] = red; image.data[i + 1] = green; image.data[i + 2] = 128; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const url = canvas.toDataURL('image/png');
  if (maps.size >= 16) maps.delete(maps.keys().next().value!);
  maps.set(key, url);
  return url;
}

export function useWorkspaceGlass() {
  const ref = useRef<HTMLButtonElement>(null);
  const id = 'pico-workspace-glass-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [lens, setLens] = useState<Lens | null>(null);
  useEffect(() => {
    const card = ref.current;
    // Some WebKit builds parse the URL syntax without rendering it correctly.
    // Explicitly restrict the native backdrop path to Chromium-based engines.
    if (!card || !['Chrome/', 'Chromium/', 'Edg/'].some(brand => navigator.userAgent.includes(brand)) || /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent) ||
      !window.CSS?.supports('backdrop-filter', 'url(#test)')) return;
    let lastKey = '';
    let frame = 0;
    const update = () => {
      frame = 0;
      const width = card.offsetWidth, height = card.offsetHeight;
      const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 20;
      const key = [width, height, radius].join(':');
      if (key === lastKey || width < 2 || height < 2) return;
      lastKey = key;
      try {
        const image = makeMap(width, height, radius);
        setLens(image ? { width, height, image } : null);
      } catch { setLens(null); }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(card);
    window.addEventListener('resize', schedule, { passive: true });
    update();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return { ref, id, lens };
}

export function WorkspaceGlassFilter({ id, lens }: { id: string; lens: Lens | null }) {
  return <svg className="home-glass-filter-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={lens?.image} x="0" y="0" width={lens?.width ?? 1} height={lens?.height ?? 1} preserveAspectRatio="none" result="bezel" />
        <feDisplacementMap in="SourceGraphic" in2="bezel" scale={64} xChannelSelector="R" yChannelSelector="G" />
        <feGaussianBlur stdDeviation=".65" />
      </filter>
    </defs>
  </svg>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';

export const WALLPAPERS = [
  { id: 'aurora', name: 'Aurora', category: 'Abstract', description: 'Soft northern lights', animated: true },
  { id: 'tidepool', name: 'Tidepool', category: 'Nature', description: 'Deep blue currents', animated: true },
  { id: 'orbit', name: 'Orbit', category: 'Space', description: 'A quiet field of stars', animated: false },
  { id: 'violet-grid', name: 'Violet Grid', category: 'Cyberpunk', description: 'Neon lines at dusk', animated: true },
  { id: 'soft-focus', name: 'Soft Focus', category: 'Minimal', description: 'Warm, gentle light', animated: true },
  { id: 'ember', name: 'Ember', category: 'Ambient', description: 'A slow copper glow', animated: true },
  { id: 'sakura-dream', name: 'Sakura Dream', category: 'Anime', description: 'Petals beneath a pastel moon', animated: true },
  { id: 'neon-tokyo', name: 'Neon Tokyo', category: 'Anime', description: 'A dreamy city after dark', animated: true },
] as const;

export type WallpaperId = typeof WALLPAPERS[number]['id'];
const wallpaperIds = new Set<string>(WALLPAPERS.map(wallpaper => wallpaper.id));
export function isWallpaperId(value: unknown): value is WallpaperId {
  return typeof value === 'string' && wallpaperIds.has(value);
}

interface WallpaperPickerProps {
  value?: string;
  onChange: (id: string | undefined) => void;
  highContrast?: boolean;
}

export function WallpaperPicker({ value, onChange, highContrast = false }: WallpaperPickerProps) {
  const categories = useMemo(() => ['All', ...new Set(WALLPAPERS.map(wallpaper => wallpaper.category))], []);
  const [category, setCategory] = useState('All');
  const visible = category === 'All' ? WALLPAPERS : WALLPAPERS.filter(wallpaper => wallpaper.category === category);

  return <section className="wallpaper-picker" aria-label="Workspace wallpaper">
    <div className="wallpaper-picker-head">
      <span>Workspace wallpaper</span>
      <small>Saved with this workspace</small>
    </div>
    <div className="wallpaper-categories" role="group" aria-label="Filter wallpapers">
      {categories.map(item => <button key={item} type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
    </div>
    <div className="wallpaper-grid" role="radiogroup" aria-label="Choose a workspace wallpaper">
      <button type="button" role="radio" aria-checked={!value} className={`wallpaper-option wallpaper-none ${!value ? 'active' : ''}`} onClick={() => onChange(undefined)}>
        <span className="wallpaper-preview" aria-hidden="true"><i /></span>
        <span className="wallpaper-option-copy"><strong>None</strong><small>Theme background</small></span>
        {!value && <Check size={14} aria-hidden="true" />}
      </button>
      {visible.map(wallpaper => <button key={wallpaper.id} type="button" role="radio" aria-checked={value === wallpaper.id} className={`wallpaper-option ${value === wallpaper.id ? 'active' : ''}`} onClick={() => onChange(wallpaper.id)}>
        <span className={`wallpaper-preview wallpaper-${wallpaper.id}`} aria-hidden="true"><i /></span>
        <span className="wallpaper-option-copy"><strong>{wallpaper.name}</strong><small>{wallpaper.description}</small></span>
        {value === wallpaper.id && <Check size={14} aria-hidden="true" />}
      </button>)}
    </div>
    <p className="wallpaper-note">{highContrast ? 'Wallpapers are hidden while a high contrast theme is active.' : 'Decorative backgrounds sit behind your workspace panels.'}</p>
  </section>;
}

export function WallpaperLayer({ wallpaper }: { wallpaper?: string }) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const layer = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0.5, y: 0.5, active: false });
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    const move = (event: PointerEvent) => {
      const rect = layer.current?.getBoundingClientRect();
      if (!rect || document.visibilityState === 'hidden') return;
      pointer.current = {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1))),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1))),
        active: true,
      };
    };
    const leave = () => { pointer.current.active = false; };
    const onPointerOut = (event: PointerEvent) => { if (!event.relatedTarget) leave(); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', onPointerOut);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', onPointerOut);
    };
  }, [layer]);
  useEffect(() => {
    const node = layer.current;
    const canvas = node?.querySelector('canvas');
    const context = canvas?.getContext('2d', { alpha: true });
    if (!node || !canvas || !context || !isWallpaperId(wallpaper)) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colors = getComputedStyle(node);
    const accent = colors.getPropertyValue('--accent').trim() || '#8b78ff';
    const secondary = colors.getPropertyValue('--syntax-string').trim() || accent;
    const tertiary = colors.getPropertyValue('--syntax-type').trim() || accent;
    const number = colors.getPropertyValue('--syntax-number').trim() || accent;
    const particles = Array.from({ length: wallpaper === 'orbit' ? 120 : wallpaper === 'sakura-dream' ? 34 : 54 }, (_, index) => ({
      x: Math.random(), y: Math.random(), size: 1 + Math.random() * 3,
      speed: 0.018 + Math.random() * 0.05, phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.1, color: index % 3 === 0 ? tertiary : index % 2 ? accent : secondary,
    }));
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let lastFrame = 0;
    let startedAt = performance.now();
    const resize = () => {
      const rect = node.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();

    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.visibilityState === 'hidden') return;
      if (!reducedMotion.matches && now - lastFrame < 32) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastFrame = now;
      const time = (now - startedAt) / 1000;
      const { x: px, y: py, active } = pointer.current;
      const focusX = active ? px * width : width * 0.5;
      const focusY = active ? py * height : height * 0.5;
      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';
      context.lineJoin = 'round';

      if (wallpaper === 'aurora') {
        for (let band = 0; band < 3; band++) {
          const center = height * (0.33 + band * 0.16) + Math.sin(time * 0.24 + band) * height * 0.08 + (active ? (py - 0.5) * height * 0.12 : 0);
          const gradient = context.createLinearGradient(0, center - 100, width, center + 100);
          gradient.addColorStop(0, 'transparent'); gradient.addColorStop(.3, band % 2 ? tertiary : secondary); gradient.addColorStop(.65, accent); gradient.addColorStop(1, 'transparent');
          context.globalAlpha = .23 + band * .055; context.strokeStyle = gradient; context.lineWidth = height * (.11 - band * .018); context.shadowColor = band % 2 ? tertiary : secondary; context.shadowBlur = 38;
          context.beginPath();
          for (let x = -40; x <= width + 40; x += 18) {
            const y = center + Math.sin(x / width * Math.PI * 2 + time * (.38 + band * .1) + band) * height * (.1 + band * .025) + Math.sin(x / width * Math.PI * 4 - time * .22) * height * .028;
            if (x === -40) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.stroke();
        }
        context.shadowBlur = 0; context.globalAlpha = 1;
      } else if (wallpaper === 'tidepool') {
        const cx = active ? focusX : width * (.5 + Math.sin(time * .19) * .12);
        const cy = active ? focusY : height * (.5 + Math.cos(time * .17) * .12);
        for (let ring = 0; ring < 9; ring++) {
          const radius = ((time * 42 + ring * 42) % Math.max(width, height));
          context.globalAlpha = Math.max(0, .25 * (1 - radius / Math.max(width, height)));
          context.strokeStyle = ring % 2 ? tertiary : secondary; context.lineWidth = 1.5 + (1 - radius / Math.max(width, height)) * 2;
          context.beginPath(); context.ellipse(cx, cy, radius, radius * .54, Math.sin(time * .1) * .15, 0, Math.PI * 2); context.stroke();
        }
        context.globalAlpha = .34; context.strokeStyle = accent; context.lineWidth = 2;
        for (let row = 0; row < 5; row++) {
          context.beginPath();
          for (let x = 0; x <= width; x += 12) {
            const y = height * (.2 + row * .16) + Math.sin(x / width * Math.PI * 4 + time * .65 + row) * 16 + Math.sin(x / width * Math.PI * 2 - time * .4) * 12;
            if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.stroke();
        }
        context.globalAlpha = 1;
      } else if (wallpaper === 'orbit') {
        const cx = width * .5 + (active ? (px - .5) * width * .12 : Math.sin(time * .15) * width * .025);
        const cy = height * .5 + (active ? (py - .5) * height * .12 : Math.cos(time * .15) * height * .025);
        context.strokeStyle = accent; context.lineWidth = 1; context.globalAlpha = .5;
        for (let orbit = 0; orbit < 3; orbit++) { context.beginPath(); context.ellipse(cx, cy, width * (.15 + orbit * .12), height * (.11 + orbit * .085), orbit * .8 + time * .035, 0, Math.PI * 2); context.stroke(); }
        context.globalAlpha = 1;
        particles.forEach((p, i) => {
          const x = p.x * width + (active ? (px - .5) * 20 : 0); const y = p.y * height + (active ? (py - .5) * 14 : 0);
          context.globalAlpha = .35 + (Math.sin(time * 1.5 + p.phase) + 1) * .32; context.fillStyle = i % 5 === 0 ? accent : '#ffffff';
          context.beginPath(); context.arc(x, y, p.size * (i % 11 === 0 ? 1.6 : 1), 0, Math.PI * 2); context.fill();
        }); context.globalAlpha = 1;
        context.fillStyle = accent; context.shadowColor = accent; context.shadowBlur = 28; context.beginPath(); context.arc(cx, cy, Math.max(5, width * .012), 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
      } else if (wallpaper === 'violet-grid') {
        const horizon = height * (.46 + (active ? (py - .5) * .15 : Math.sin(time * .15) * .025));
        const vanishingX = width * (.5 + (active ? (px - .5) * .35 : Math.sin(time * .12) * .04));
        const phase = (time * .22) % 1;
        context.strokeStyle = accent; context.lineWidth = 1.1; context.globalAlpha = .65;
        for (let line = -12; line <= 12; line++) { context.beginPath(); context.moveTo(vanishingX, horizon); context.lineTo(vanishingX + line * width * .12, height); context.stroke(); }
        for (let line = 0; line < 18; line++) {
          const p = ((line / 18 + phase) % 1); const y = horizon + (height - horizon) * p * p;
          context.globalAlpha = .18 + p * .52; context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
        }
        context.globalAlpha = .9; context.shadowColor = accent; context.shadowBlur = 14; context.fillStyle = accent; context.fillRect(vanishingX - 2, horizon - 2, 4, 4); context.shadowBlur = 0; context.globalAlpha = 1;
      } else if (wallpaper === 'soft-focus') {
        particles.forEach((p, i) => {
          const x = (p.x * width + Math.sin(time * .12 + p.phase) * 34 + (active ? (px - .5) * (i % 2 ? 24 : -24) : 0) + width) % width;
          const y = ((p.y * height - time * (5 + p.speed * 40) + height * 2) % (height * 1.4)) - height * .2;
          const radius = 14 + p.size * 12 + Math.sin(time * .4 + p.phase) * 3;
          const glow = context.createRadialGradient(x, y, 0, x, y, radius); glow.addColorStop(0, p.color); glow.addColorStop(1, 'transparent');
          context.globalAlpha = .19; context.fillStyle = glow; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
        }); context.globalAlpha = 1;
      } else if (wallpaper === 'ember') {
        particles.forEach(p => {
          const x = (p.x * width + Math.sin(time * .7 + p.phase) * 26 + (active ? (px - .5) * 38 : 0) + width) % width;
          const y = height - ((p.y * height + time * (18 + p.speed * 90)) % (height + 20));
          const alpha = Math.max(.08, 1 - y / height) * (.45 + (Math.sin(time * 3 + p.phase) + 1) * .25);
          context.globalAlpha = alpha; context.fillStyle = p.color; context.shadowColor = p.color; context.shadowBlur = 12;
          context.beginPath(); context.ellipse(x, y, p.size * .8, p.size * (1.3 + p.speed * 12), time * .2 + p.phase, 0, Math.PI * 2); context.fill();
        }); context.globalAlpha = 1; context.shadowBlur = 0;
      } else if (wallpaper === 'sakura-dream') {
        particles.forEach((p, i) => {
          const x = (p.x * width + Math.sin(time * .45 + p.phase) * 28 + time * (8 + p.speed * 48) + (active ? (px - .5) * 42 : 0)) % (width + 24);
          const y = (p.y * height + time * (9 + p.speed * 48)) % (height + 20);
          context.save(); context.translate(x, y); context.rotate(Math.sin(time * .8 + p.phase) * 1.4 + time * .25);
          context.globalAlpha = .32 + p.size * .13; context.fillStyle = i % 2 ? secondary : accent;
          context.beginPath(); context.ellipse(0, 0, p.size * 1.8, p.size * .8, 0, 0, Math.PI * 2); context.fill(); context.restore();
        });
        context.globalAlpha = .75; context.shadowColor = number; context.shadowBlur = 22; context.fillStyle = number;
        context.beginPath(); context.arc(width * .78 + (active ? (px - .5) * 14 : 0), height * .22 + (active ? (py - .5) * 10 : 0), Math.min(width, height) * .055, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; context.globalAlpha = 1;
      } else if (wallpaper === 'neon-tokyo') {
        const horizon = height * .53;
        context.globalAlpha = .42; context.fillStyle = accent; context.shadowColor = accent; context.shadowBlur = 24;
        context.beginPath(); context.arc(width * .76 + (active ? (px - .5) * 18 : 0), height * .2, Math.min(width, height) * .06, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
        particles.forEach((p, i) => {
          const bw = width / 18; const x = (i * bw + (active ? (px - .5) * (i % 2 ? 18 : -18) : 0)); const bh = height * (.12 + p.size * .07);
          context.globalAlpha = .68; context.fillStyle = i % 3 ? '#111426' : '#19152d'; context.fillRect(x, horizon + height * .4 - bh, bw * .82, bh);
          for (let wy = horizon + height * .4 - bh + 8; wy < horizon + height * .4 - 5; wy += 12) for (let wx = x + 5; wx < x + bw * .7; wx += 10) {
            context.globalAlpha = .2 + (Math.sin(time * 2 + p.phase + wx) + 1) * .28; context.fillStyle = i % 2 ? number : secondary; context.fillRect(wx, wy, 3, 5);
          }
        });
        const streakX = ((time * 100 + focusX) % (width + 100)) - 50;
        context.globalAlpha = .72; context.strokeStyle = secondary; context.lineWidth = 2; context.beginPath(); context.moveTo(streakX, horizon + height * .28); context.lineTo(streakX + 55, horizon + height * .28); context.stroke(); context.globalAlpha = 1;
      }
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };
    const start = () => { if (visible && document.visibilityState !== 'hidden' && !frame) { startedAt = performance.now(); lastFrame = 0; frame = requestAnimationFrame(draw); } };
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
    const onMotion = () => { stop(); if (visible && document.visibilityState !== 'hidden') { if (reducedMotion.matches) draw(performance.now()); else start(); } };
    if (visible && document.visibilityState !== 'hidden') onMotion();
    reducedMotion.addEventListener('change', onMotion);
    return () => { stop(); observer.disconnect(); reducedMotion.removeEventListener('change', onMotion); };
  }, [wallpaper, visible]);
  if (!isWallpaperId(wallpaper)) return null;
  return <div ref={node => { layer.current = node; }} className={`workspace-wallpaper wallpaper-${wallpaper}`} data-paused={!visible || undefined} aria-hidden="true"><canvas /><i /></div>;
}

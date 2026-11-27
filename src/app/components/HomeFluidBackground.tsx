import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { checkHomeFluidSupport } from './home-fluid-context.js';
import { startFluid } from './home-fluid-engine.js';
import type { PicoTheme } from '../themes';
import type { FluidColor, FluidController, FluidPalette } from './home-fluid-engine.js';

function rgb(hex: string): FluidColor {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map(c => c + c).join('') : value;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255) as FluidColor;
}

export function homeFluidPalette(theme: PicoTheme): FluidPalette {
  const accents = theme.accentGradient?.length ? theme.accentGradient : [theme.accent, theme.syntax.func, theme.syntax.number];
  return [rgb(accents[0] ?? theme.accent), rgb(accents[1] ?? theme.accent), rgb(accents[2] ?? theme.accent)];
}

export function HomeFluidBackground({ theme, disabled = false, fallback }: { theme: PicoTheme; disabled?: boolean; fallback?: ReactNode }) {
  const [showFallback, setShowFallback] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = useRef<FluidController | null>(null);
  const palette = useRef(homeFluidPalette(theme));

  useLayoutEffect(() => {
    palette.current = homeFluidPalette(theme);
    controller.current?.setPalette(palette.current);
  }, [theme]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (disabled) { setShowFallback(false); return; }
    if (!checkHomeFluidSupport()) { setShowFallback(true); return; }
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const forced = window.matchMedia?.('(forced-colors: active)');
    let canvas: HTMLCanvasElement | null = null;
    function stop() {
      controller.current?.dispose();
      controller.current = null;
      canvas?.remove();
      canvas = null;
      if (host) delete host.dataset.fluidReady;
    }
    function fail() {
      stop();
      setShowFallback(true);
    }
    function sync() {
      stop();
      if (!host || motion?.matches || forced?.matches) { setShowFallback(true); return; }
      setShowFallback(false);
      // The engine is a static dependency, so the initial seeded frame is drawn
      // in this layout effect before the browser paints the workspace chooser.
      canvas = document.createElement('canvas');
      host.append(canvas);
      try {
        controller.current = startFluid(canvas, palette.current, fail);
        host.dataset.fluidReady = 'true';
      } catch {
        fail();
      }
    }
    sync();
    motion?.addEventListener('change', sync);
    forced?.addEventListener('change', sync);
    return () => {
      motion?.removeEventListener('change', sync);
      forced?.removeEventListener('change', sync);
      stop();
    };
  }, [disabled]);

  return <><div className="pico-home-fluid" ref={hostRef} aria-hidden="true" />{showFallback && fallback}</>;
}

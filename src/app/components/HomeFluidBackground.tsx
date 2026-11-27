import { useLayoutEffect, useRef } from 'react';
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

export function HomeFluidBackground({ theme, disabled = false }: { theme: PicoTheme; disabled?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = useRef<FluidController | null>(null);
  const palette = useRef(homeFluidPalette(theme));

  useLayoutEffect(() => {
    palette.current = homeFluidPalette(theme);
    controller.current?.setPalette(palette.current);
  }, [theme]);

  const highContrast = Boolean(theme.highContrast);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || disabled || highContrast || (!window.WebGLRenderingContext && !window.WebGL2RenderingContext)) return;
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
    function sync() {
      stop();
      if (!host || motion?.matches || forced?.matches) return;
      // The engine is a static dependency, so the initial seeded frame is drawn
      // in this layout effect before the browser paints the workspace chooser.
      canvas = document.createElement('canvas');
      host.append(canvas);
      try {
        controller.current = startFluid(canvas, palette.current, stop);
        host.dataset.fluidReady = 'true';
      } catch {
        stop();
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
  }, [disabled, highContrast]);

  return <div className="pico-home-fluid" ref={hostRef} aria-hidden="true" />;
}

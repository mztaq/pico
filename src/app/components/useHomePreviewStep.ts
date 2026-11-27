import { useEffect, useRef, useState } from 'react';

/** Tiny local preview clock; never starts a workspace, interpreter or worker. */
export function useHomePreviewStep(interval = 1050) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const traffic = stage.querySelector<SVGSVGElement>('svg.home-traffic-preview');
    traffic?.pauseAnimations?.();
    if (typeof IntersectionObserver === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let visible = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    function sync() {
      if (timer !== undefined) { clearInterval(timer); timer = undefined; }
      if (visible && !document.hidden && !reduced?.matches) {
        traffic?.unpauseAnimations?.();
        timer = setInterval(() => setStep(previous => (previous + 1) % 12), interval);
      } else {
        traffic?.pauseAnimations?.();
      }
    }
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      sync();
    }, { threshold: 0.15 });
    observer.observe(stage);
    document.addEventListener('visibilitychange', sync);
    reduced?.addEventListener?.('change', sync);
    return () => {
      observer.disconnect();
      traffic?.pauseAnimations?.();
      if (timer !== undefined) clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      reduced?.removeEventListener?.('change', sync);
    };
  }, [interval]);
  return { ref, step };
}

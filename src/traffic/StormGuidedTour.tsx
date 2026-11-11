import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import './storm-guided-tour.css';

type TourStep = { readonly target: string; readonly title: string; readonly text: string };
export type StormTourBox = { left: number; top: number; width: number; height: number };

/** Place the explanatory card beside the spotlight where the viewport allows. */
export function placeStormTourCard(
  target: StormTourBox | null, width: number, height: number, viewportWidth: number, viewportHeight: number,
): StormTourBox {
  const margin = 16;
  const gap = 16;
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - height - margin);
  let left = (viewportWidth - width) / 2;
  let top = (viewportHeight - height) / 2;
  if (target) {
    if (viewportWidth - target.left - target.width >= width + gap + margin) {
      left = target.left + target.width + gap;
      top = target.top;
    } else if (target.left >= width + gap + margin) {
      left = target.left - width - gap;
      top = target.top;
    } else if (viewportHeight - target.top - target.height >= height + gap + margin) {
      left = target.left;
      top = target.top + target.height + gap;
    } else if (target.top >= height + gap + margin) {
      left = target.left;
      top = target.top - height - gap;
    } else {
      top = target.top + target.height / 2 > viewportHeight / 2 ? margin : maxTop;
    }
  }
  return {
    left: Math.min(maxLeft, Math.max(margin, left)),
    top: Math.min(maxTop, Math.max(margin, top)),
    width, height,
  };
}

export function StormGuidedTour({ steps, step, onStep, onClose }: {
  steps: readonly TourStep[];
  step: number;
  onStep: (index: number) => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const maskId = useId().replace(/:/g, '');
  const [target, setTarget] = useState<StormTourBox | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const current = steps[step];

  useLayoutEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { if (prior?.isConnected) prior.focus(); };
  }, []);

  useLayoutEffect(() => {
    if (!current) return;
    const element = document.querySelector<HTMLElement>('[data-storm-tour="' + current.target + '"]');
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    let frame = 0;
    function measure() {
      const rect = element?.getBoundingClientRect();
      const left = Math.max(8, (rect?.left ?? 0) - 5);
      const top = Math.max(8, (rect?.top ?? 0) - 5);
      const right = Math.min(window.innerWidth - 8, (rect?.right ?? 0) + 5);
      const bottom = Math.min(window.innerHeight - 8, (rect?.bottom ?? 0) + 5);
      const box = rect && rect.width > 0 && rect.height > 0 && right > left && bottom > top
        ? { left, top, width: right - left, height: bottom - top } : null;
      setTarget(box);
      const size = cardRef.current?.getBoundingClientRect();
      const pos = placeStormTourCard(
        box, size?.width || Math.min(360, window.innerWidth - 32),
        size?.height || 260, window.innerWidth, window.innerHeight,
      );
      setPosition({ left: pos.left, top: pos.top });
    }
    frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (element) observer?.observe(element);
    if (cardRef.current) observer?.observe(cardRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, current]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls[controls.length - 1]?.focus();
    } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
      event.preventDefault();
      controls[0]?.focus();
    }
  }

  if (!current) return null;
  return <div className="storm-tour-layer" onKeyDown={handleKeyDown}>
    <svg className="storm-tour-shade" width="100%" height="100%" aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white"/>
          {target && <rect x={target.left} y={target.top} width={target.width} height={target.height} rx="10" fill="black"/>}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,.76)" mask={'url(#' + maskId + ')'}/>
    </svg>
    {target && <div className="storm-tour-spotlight" style={{ left: target.left, top: target.top, width: target.width, height: target.height }}/>}
    <div ref={cardRef} className="storm-tour-card" role="dialog" aria-modal="true"
      aria-labelledby="storm-tour-title" aria-describedby="storm-tour-description" style={position}>
      <button ref={closeRef} type="button" className="storm-tour-close" onClick={onClose} aria-label="Close tutorial"><X size={18}/></button>
      <h2 id="storm-tour-title">{current.title}</h2>
      <p id="storm-tour-description">{current.text}</p>
      <div className="storm-tour-progress" aria-label={'Step ' + (step + 1) + ' of ' + steps.length}>
        {steps.map((item, index) =>
          <button key={item.title} type="button" className={index <= step ? 'is-active' : ''}
            onClick={() => onStep(index)} aria-current={index === step ? 'step' : undefined}
            aria-label={'Go to step ' + (index + 1) + ': ' + item.title}/>
        )}
      </div>
      <div className="storm-tour-actions">
        <button type="button" className="storm-tour-back" disabled={step === 0}
          onClick={() => onStep(Math.max(0, step - 1))}><ArrowLeft size={15}/> Back</button>
        <button type="button" className="storm-tour-next"
          onClick={() => step === steps.length - 1 ? onClose() : onStep(step + 1)}>
          {step === steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={15}/>
        </button>
      </div>
      <button type="button" className="storm-tour-skip" onClick={onClose}>Skip tutorial</button>
    </div>
  </div>;
}

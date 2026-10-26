import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { placeTutorialCard } from '../app/components/GuidedTutorial';
import './binary-tutorial.css';

export const BINARY_TUTORIAL_KEY = 'pico.binary.tutorial.v1';

export const BINARY_TOUR_STEPS = [
  { title: 'Binary Lab', description: 'Change an 8-bit number and see how it works.', selector: null },
  { title: 'Toggle bits', description: 'Click a 0 or 1 to switch that bit. The numbers below show each bit’s value.', selector: '.binary-bit-grid' },
  { title: 'Read the value', description: 'Decimal, hexadecimal, and signed two’s complement all describe the same 8 bits. You can edit decimal or hex directly.', selector: '.binary-value-grid' },
  { title: 'Shift bits', description: 'Shift left or right by 1–4 places. Bits that leave the register are discarded.', selector: '.binary-operations > section:nth-child(1)' },
  { title: 'Add a number', description: 'Add another byte. The result stays within 8 bits; carry and signed overflow are shown below.', selector: '.binary-operations > section:nth-child(2)' },
  { title: 'Two’s complement', description: 'Flip the bits and add 1 to negate the signed number. Use Apply to register to try it.', selector: '.binary-operations > section:nth-child(3)' },
] as const;

type Rect = { top: number; left: number; width: number; height: number };

export function BinaryTutorial({ step, onStep, onClose }: { step: number; onStep: (step: number) => void; onClose: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [position, setPosition] = useState({ top: 16, left: 16 });
  const current = BINARY_TOUR_STEPS[step] ?? BINARY_TOUR_STEPS[0];

  useLayoutEffect(() => {
    const element = current.selector ? document.querySelector<HTMLElement>(current.selector) : null;
    element?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    let frame = 0;
    const measure = () => {
      const r = element?.getBoundingClientRect();
      const bounds = r ? {
        top: Math.max(4, r.top - 5),
        left: Math.max(4, r.left - 5),
        width: Math.max(0, Math.min(window.innerWidth - 4, r.right + 5) - Math.max(4, r.left - 5)),
        height: Math.max(0, Math.min(window.innerHeight - 4, r.bottom + 5) - Math.max(4, r.top - 5)),
      } : null;
      setSpot(bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null);
      const width = Math.min(380, window.innerWidth - 32);
      const height = Math.min(240, window.innerHeight - 32);
      const next = placeTutorialCard(bounds, width, height, window.innerWidth, window.innerHeight);
      setPosition({ top: next.top, left: next.left });
    };
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (element) observer?.observe(element);
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [step, current.selector]);

  useEffect(() => { closeRef.current?.focus(); }, [step]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
    };
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, [onClose]);

  return <div className="binary-tour" role="presentation">
    <svg className="binary-tour-shade" width="100%" height="100%" aria-hidden="true">
      <defs><mask id="binary-tour-cutout"><rect width="100%" height="100%" fill="white" />{spot && <rect x={spot.left} y={spot.top} width={spot.width} height={spot.height} rx="9" fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,.72)" mask="url(#binary-tour-cutout)" />
    </svg>
    {spot && <div className="binary-tour-focus" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />}
    <section className="binary-tour-card" role="dialog" aria-modal="true" aria-labelledby="binary-tour-title" aria-describedby="binary-tour-description" style={position} ref={cardRef}>
      <div className="binary-tour-top"><span>{step + 1} / {BINARY_TOUR_STEPS.length}</span><button ref={closeRef} aria-label="Close tutorial" onClick={onClose}><X size={17} /></button></div>
      <h2 id="binary-tour-title">{current.title}</h2>
      <p id="binary-tour-description">{current.description}</p>
      <div className="binary-tour-actions">
        <button onClick={onClose}>Skip</button>
        <span />
        <button disabled={step === 0} onClick={() => onStep(step - 1)}><ArrowLeft size={14} /> Back</button>
        <button className="binary-tour-next" onClick={() => step === BINARY_TOUR_STEPS.length - 1 ? onClose() : onStep(step + 1)}>{step === BINARY_TOUR_STEPS.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={14} /></button>
      </div>
    </section>
  </div>;
}

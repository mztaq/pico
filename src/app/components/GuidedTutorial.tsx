import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, X } from 'lucide-react';
import { starterCode } from '../../starter';

export const tutorialSteps = [
  { target: 'workspace', title: 'Name your workspace', label: 'WORKSPACE', description: 'Click the workspace name in the top bar and type a name for your project. It updates in the sidebar and saves automatically.', tip: 'On a small screen, open File to edit the workspace name.' },
  { target: 'editor', title: 'Start with your code', label: 'WRITE', description: 'Write Cambridge pseudocode here. Use the file tabs for separate programs. Open File and choose Format code to tidy your indentation.', tip: 'DECLARE gives Name its type. Declared names appear as you type. Tab or Enter accepts a suggestion. Ctrl + Space opens the list.', example: starterCode },
  { target: 'run', title: 'Run your program', label: 'RUN', description: 'Run in the top bar executes the current file. When your program reaches INPUT, type a value in the Console and press Enter to continue.', tip: 'Shortcut: Ctrl + Enter on Windows, or ⌘ + Enter on Mac.' },
  { target: 'tools', title: 'Read the result', label: 'OUTPUT', description: 'The Console shows each OUTPUT line. Errors include a line number so you can return to the part that needs fixing.', tip: 'INPUT waits in the Console. Type a value and press Enter to continue.', example: starterCode },
  { target: 'tools', title: 'Understand each step', label: 'EXPLORE', description: 'Debug runs your code and records its steps. Move through the recorded steps to see variables change. Test cases compare expected output; Flowchart shows the program’s paths.', tip: 'Coverage shows which lines ran. Drag the divider above this panel to give your tools more room.' },
  { target: 'reference', title: 'Keep the syntax close', label: 'REFERENCE', description: 'Search for a keyword, then select it to read its explanation. Select and copy the examples when you need a starting point.', tip: 'Use A− / A+ to change the text size. On a wide screen, drag the left divider to resize this panel.' },
  { target: 'settings', title: 'Choose your settings', label: 'CUSTOMISE', description: 'Settings lets you change your theme, editor text size, layout, and typing helpers. Auto-declare is optional when you want to practise declarations yourself.', tip: 'Panel sizes and settings are remembered in this browser.' },
  { target: 'files', title: 'Keep a copy of your work', label: 'SAVE', description: 'Pico saves projects on this device. In File, Export .pico downloads a copy, and Import .pico opens one again. History keeps snapshots before you experiment.', tip: 'Your source tabs use .pico too. Double-click a tab to rename it.' },
] as const;

interface Props {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onReference: () => void;
}
interface Box { top: number; left: number; width: number; height: number; }

/** Keep the card beside the spotlight where possible, and on screen at every size. */
export function placeTutorialCard(target: Box | null, width: number, height: number, viewportWidth: number, viewportHeight: number): Box {
  const gap = 18;
  const margin = 16;
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - height - margin);
  let left = (viewportWidth - width) / 2;
  let top = (viewportHeight - height) / 2;
  if (target) {
    if (target.left >= width + gap + margin) {
      left = target.left - width - gap;
      top = target.top;
    } else if (viewportWidth - target.left - target.width >= width + gap + margin) {
      left = target.left + target.width + gap;
      top = target.top;
    } else if (viewportHeight - target.top - target.height >= height + gap + margin) {
      top = target.top + target.height + gap;
    } else if (target.top >= height + gap + margin) {
      top = target.top - height - gap;
    } else {
      // Large targets / small screens: dock toward the opposite end of the target.
      top = target.top + target.height / 2 < viewportHeight / 2 ? maxTop : margin;
    }
  }
  return { left: Math.min(maxLeft, Math.max(margin, left)), top: Math.min(maxTop, Math.max(margin, top)), width, height };
}

export function GuidedTutorial({ step, onStep, onClose, onReference }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [target, setTarget] = useState<Box | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const current = tutorialSteps[step];
  const complete = !current;

  useLayoutEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  useLayoutEffect(() => {
    const element = current ? document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`) : null;
    const fallback = current?.target === 'workspace' ? document.querySelector<HTMLElement>('[data-tour="files"]') : null;
    function measure() {
      let rect = element?.getBoundingClientRect();
      if ((!rect?.width || !rect.height) && fallback) rect = fallback.getBoundingClientRect();
      const left = Math.max(8, (rect?.left ?? 0) - 5);
      const top = Math.max(8, (rect?.top ?? 0) - 5);
      const right = Math.min(window.innerWidth - 8, (rect?.right ?? 0) + 5);
      const bottom = Math.min(window.innerHeight - 8, (rect?.bottom ?? 0) + 5);
      const box = rect && rect.width > 0 && rect.height > 0 && right > left && bottom > top
        ? { left, top, width: right - left, height: bottom - top } : null;
      setTarget(box);
      const size = card.current?.getBoundingClientRect();
      const next = placeTutorialCard(box, size?.width || Math.min(400, window.innerWidth - 32), size?.height || 360, window.innerWidth, window.innerHeight);
      setPosition({ left: next.left, top: next.top });
    }
    measure();
    closeButton.current?.focus();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (element) observer?.observe(element);
    if (fallback) observer?.observe(fallback);
    if (card.current) observer?.observe(card.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, current]);

  return <div className="tutorial-layer" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...(card.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [])];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <svg className="tutorial-shade" width="100%" height="100%" aria-hidden="true">
      <defs><mask id="pico-tour-mask"><rect width="100%" height="100%" fill="white" />{target && <rect width={target.width} height={target.height} x={target.left} y={target.top} rx="10" fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,.72)" mask="url(#pico-tour-mask)" />
    </svg>
    {target && <div className="tutorial-spotlight" style={{ left: target.left, top: target.top, width: target.width, height: target.height }} />}
    <div ref={card} className={`tutorial-card ${complete ? 'tutorial-complete' : ''}`} style={position} role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description">
      <div className="tutorial-card-top"><span><CircleHelp size={16} /> PICO IN A MINUTE</span><button ref={closeButton} className="tutorial-icon" onClick={onClose} aria-label="Close tutorial"><X size={20} /></button></div>
      {complete ? <>
        <div className="tutorial-success"><Check size={28} /></div>
        <span className="tutorial-eyebrow">YOU’RE READY</span>
        <h2 id="tutorial-title">Tour complete</h2>
        <p id="tutorial-description">Write a program, press Run, and follow what happens. Your code is right where you left it.</p>
        <div className="tutorial-recap"><span><Check size={16} /> Write and run</span><span><Check size={16} /> Explore and debug</span><span><Check size={16} /> Save as .pico</span></div>
        <p className="tutorial-tip">Try Mustaqim or Amar when your program asks for a name. A couple of familiar faces from your Computer Science department get a special greeting too. "Help" opens this tour again.</p>
        <button className="tutorial-reference-link" onClick={onReference}>Open quick reference <ArrowRight size={16} /></button>
      </> : <>
        <div className="tutorial-progress" aria-label={`Step ${step + 1} of ${tutorialSteps.length}`}>{tutorialSteps.map((item, index) => <button key={item.label} className={index <= step ? 'filled' : ''} onClick={() => onStep(index)} aria-label={`Go to step ${index + 1}: ${item.title}`} aria-current={index === step ? 'step' : undefined} />)}</div>
        <span className="tutorial-eyebrow">{String(step + 1).padStart(2, '0')} / {String(tutorialSteps.length).padStart(2, '0')} · {current.label}</span>
        <h2 id="tutorial-title">{current.title}</h2>
        <p id="tutorial-description">{current.description}</p>
        {'example' in current && <pre className="tutorial-example"><code>{current.example}</code></pre>}
        <p className="tutorial-tip">{current.tip}</p>
      </>}
      <div className="tutorial-navigation"><button className="tutorial-secondary" disabled={!complete && step === 0} onClick={() => onStep(complete ? 0 : step - 1)}>{complete ? 'Replay tour' : <><ArrowLeft size={16} /> Back</>}</button><button className="tutorial-primary" onClick={() => complete ? onClose() : onStep(step + 1)}>{complete ? 'Start coding' : step === tutorialSteps.length - 1 ? 'Finish tour' : 'Next'}<ArrowRight size={16} /></button></div>
      {!complete && <button className="tutorial-skip" onClick={onClose}>Skip for now</button>}
    </div>
  </div>;
}

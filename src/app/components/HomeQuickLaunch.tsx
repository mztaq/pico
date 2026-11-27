import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Search, X, Terminal, Code2, GitBranch, Binary, Cpu, Network, Calculator, BookOpen, Gamepad2 } from 'lucide-react';
import type { PicoWorkspace } from '../workspace-deeplink';

const destinations = [
  { id: 'pseudocode', title: 'Pseudocode Compiler', keywords: 'code cambridge programming', icon: Terminal },
  { id: 'python', title: 'Python Compiler', keywords: 'code programming py', icon: Code2 },
  { id: 'flowchart', title: 'Flowchart Builder', keywords: 'diagram algorithm', icon: GitBranch },
  { id: 'logic', title: 'Logic Sim', keywords: 'circuit gates truth table', icon: Binary },
  { id: 'cpu', title: 'CPU Studio', keywords: 'processor fetch decode execute', icon: Cpu },
  { id: 'traffic', title: 'Traffic Storm', keywords: 'network server traffic', icon: Network },
  { id: 'binary', title: 'Binary Lab', keywords: 'hexadecimal data bits numbers', icon: Calculator },
  { id: 'learn', title: 'Learn', keywords: 'practice revision topics', icon: BookOpen },
  { id: 'games', title: 'Games', keywords: 'blackout protocol play', icon: Gamepad2 },
] satisfies { id: PicoWorkspace; title: string; keywords: string; icon: typeof Search }[];

export function HomeQuickLaunch({ onChoose, disabled = false }: { onChoose: (workspace: PicoWorkspace) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const results = destinations.filter(item => query.trim().toLowerCase().split(/\s+/).every(term => (item.title + ' ' + item.keywords).toLowerCase().includes(term)));
  const active = Math.min(selected, Math.max(0, results.length - 1));
  function launch() {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setSelected(0);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    (previousFocus.current?.isConnected ? previousFocus.current : trigger.current)?.focus();
  }
  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);
  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || disabled) return;
      if (!open && document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      if (open) { setOpen(false); (previousFocus.current?.isConnected ? previousFocus.current : trigger.current)?.focus(); }
      else {
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setQuery('');
        setSelected(0);
        setOpen(true);
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [open, disabled]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  function select(id: PicoWorkspace) {
    setOpen(false);
    onChoose(id);
  }
  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    if (event.target !== input.current || !results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      setSelected(next);
      document.getElementById('home-quick-result-' + results[next]!.id)?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(results[active]!.id);
    }
  }
  return <>
    <button className="home-quick-trigger" type="button" ref={trigger} disabled={disabled} onClick={launch} aria-label="Quick Launch" aria-haspopup="dialog" aria-expanded={open}>
      <Search size={17} aria-hidden="true"/><span>Quick Launch</span><kbd>Ctrl / ⌘ K</kbd>
    </button>
    {open && !disabled && <div className="home-quick-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="home-quick-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label="Quick Launch" onKeyDown={handleKeys}>
        <div className="home-quick-search">
          <Search size={20} aria-hidden="true"/>
          <input ref={input} aria-label="Search workspaces" placeholder="Search workspaces…" value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} />
          <button type="button" className="home-quick-close" aria-label="Close Quick Launch" onClick={close}><X size={18}/></button>
        </div>
        <div className="home-quick-results">
          {results.map((item, index) => <button key={item.id} id={'home-quick-result-' + item.id} type="button" className="home-quick-result" data-selected={index === active} onClick={() => select(item.id)} onMouseEnter={() => setSelected(index)}>
            <item.icon size={18} aria-hidden="true"/><span>{item.title}</span><span aria-hidden="true">↵</span>
          </button>)}
          {!results.length && <p className="home-quick-empty" role="status">No matching workspaces.</p>}
        </div>
        <div className="home-quick-hints"><span>↑ ↓ Navigate</span><span>Enter Open</span><span>Esc Close</span></div>
      </section>
    </div>}
  </>;
}

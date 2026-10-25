import type { ReactNode } from 'react';
import { HighlightedCode } from '../HighlightedCode';

function MiniWindow({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <div className="home-mini-window">
    <div className="home-mini-bar"><span className="home-mini-file">{title}</span><span className="home-mini-detail">{detail}</span></div>
    {children}
  </div>;
}

export function PseudocodePreview() {
  return <MiniWindow title="hello.pico" detail="Pseudocode">
    <div className="home-mini-editor">
      <div className="home-mini-lines" aria-hidden="true">1<br/>2<br/>3</div>
      <pre><HighlightedCode code={'DECLARE name : STRING\nINPUT name\nOUTPUT "Hello ", name'} /></pre>
    </div>
    <div className="home-mini-output"><span className="home-mini-output-label">OUTPUT</span><code>Hello, Pico</code></div>
  </MiniWindow>;
}

export function PythonPreview() {
  return <MiniWindow title="main.py" detail="Python">
    <div className="home-mini-editor">
      <div className="home-mini-lines" aria-hidden="true">1<br/>2<br/>3</div>
      <pre><HighlightedCode language="python" code={'def greet(name):\n    return f"Hello, {name}"\nprint(greet("Pico"))'} /></pre>
    </div>
    <div className="home-mini-output"><span className="home-mini-output-label">TERMINAL</span><code>Hello, Pico</code></div>
  </MiniWindow>;
}

export function FlowchartPreview() {
  return <MiniWindow title="Untitled flowchart" detail="Canvas">
    <div className="home-mini-canvas">
      <svg viewBox="0 0 300 104" role="presentation">
        <path className="home-mini-wire" d="M52 52H84M166 52H199M256 52H272"/>
        <rect className="home-mini-node" x="4" y="36" width="48" height="32" rx="16"/>
        <path className="home-mini-node" d="M92 29H167L159 75H84Z"/>
        <path className="home-mini-node" d="M227 22L256 52L227 82L199 52Z"/>
        <rect className="home-mini-node" x="272" y="38" width="26" height="28" rx="12"/>
        <text x="28" y="56">Start</text><text x="125" y="55">Input n</text><text x="227" y="56">n &gt; 0?</text><text x="285" y="56">End</text>
      </svg>
    </div>
    <div className="home-mini-status"><span>4 nodes</span><span>3 connections</span></div>
  </MiniWindow>;
}

export function LogicPreview() {
  return <MiniWindow title="Untitled circuit" detail="Logic Sim">
    <div className="home-mini-canvas">
      <svg viewBox="0 0 300 104" role="presentation">
        <path className="home-mini-wire" d="M54 32H108M54 73H108M198 52H243"/>
        <rect className="home-mini-input" x="12" y="19" width="42" height="26" rx="5"/>
        <rect className="home-mini-input" x="12" y="60" width="42" height="26" rx="5"/>
        <path className="home-mini-node" d="M108 20H150C175 20 188 33 198 52C188 71 175 84 150 84H108Z"/>
        <circle className="home-mini-output-node" cx="258" cy="52" r="15"/>
        <text x="33" y="37">1</text><text x="33" y="78">0</text><text x="149" y="56">AND</text><text x="258" y="56">0</text>
      </svg>
    </div>
    <div className="home-mini-status"><span className="home-mini-indicator"/> <span>Simulation paused</span><span>3 components</span></div>
  </MiniWindow>;
}

export function CpuPreview() {
  return <MiniWindow title="CPU Studio" detail="Execution">
    <div className="home-mini-cpu">
      <div className="home-mini-cpu-left">
        <div className="home-mini-cpu-step"><span>PC</span><code>0004</code></div>
        <div className="home-mini-cpu-step"><span>IR</span><code>ADD R1, R2</code></div>
        <div className="home-mini-cpu-step"><span>ACC</span><code>0012</code></div>
      </div>
      <div className="home-mini-cpu-right">
        <div className="home-mini-cpu-phase">FETCH <span>→</span> DECODE <span>→</span> EXECUTE</div>
        <div className="home-mini-cpu-unit"><span>CONTROL UNIT</span><strong>ALU</strong><span>MEMORY</span></div>
      </div>
    </div>
    <div className="home-mini-status"><span>Clock cycle 04</span><span>Paused</span></div>
  </MiniWindow>;
}

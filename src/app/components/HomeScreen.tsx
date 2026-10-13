import { useEffect, useState } from 'react';
import { loadSettings } from '../../storage/settings';
import type { CompilerLanguage } from '../../storage/projects';
import { cssVariables, getTheme } from '../themes';
import { HighlightedCode } from './HighlightedCode';
import { UpdateCenter } from './UpdateCenter';

export function Credits({ logic = false }: { logic?: boolean } = {}) {
  return <div className={`attribution${logic ? ' logic-attribution' : ''}`}>
    <span className="credit-item"><span>Deployed by</span> <strong>Mustaqim</strong> <small>11 Boys Red</small></span>
    <span className="credit-divider" aria-hidden="true">·</span>
    {logic && <>
      <span className="credit-item"><span>Logic Sim conceptualised by</span> <strong>Mohamed Hamza</strong> <small>11 Boys Red</small></span>
      <span className="credit-divider" aria-hidden="true">·</span>
    </>}
    <span className="credit-item"><span>Made by</span> <strong>Amar</strong> <small>11 Boys Blue</small></span>
  </div>;
}
export function HomeScreen({ onChoose }: { onChoose: (language: CompilerLanguage | 'flowchart' | 'logic') => void }) {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);
  return <main className="pico-home" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <div className="home-updates"><UpdateCenter /></div>
    <div className="home-brand"><img src="/pico-logo.svg" alt="" /><span>Pico<span className="brand-period">.</span></span></div>
    <h1>Choose your workspace</h1>
    <div className="compiler-choices">
      <button className="compiler-choice" onClick={() => onChoose('pseudocode')}>
        <div className="compiler-choice-copy">
        <div className="compiler-choice-title"><h2>Pseudocode Compiler</h2><span>Open</span></div>
        <p>Run .pico programs with typed input and a debugger.</p>
        </div>
        <pre className="compiler-choice-preview" aria-hidden="true"><HighlightedCode code={'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello ", Name, "!"'} /></pre>
      </button>
      <button className="compiler-choice" onClick={() => onChoose('python')}>
        <div className="compiler-choice-copy">
        <div className="compiler-choice-title"><h2>Python Compiler</h2><span>Open</span></div>
        <p>Run Python with console input and a debugger.</p>
        </div>
        <pre className="compiler-choice-preview" aria-hidden="true"><HighlightedCode language="python" code={'name = input("Enter your name: ")\nprint(f"Hello {name}!")'} /></pre>
      </button>
      <button className="compiler-choice" onClick={() => onChoose('flowchart')}>
        <div className="compiler-choice-copy">
        <div className="compiler-choice-title"><h2>Flowchart Builder</h2><span>Open</span></div>
        <p>Connect blocks, run your chart, or turn it into pseudocode.</p>
        </div>
        <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <rect x="1" y="22" width="68" height="32" rx="16"/>
          <path className="home-chart-link" d="M 70 38 H 103 M 97 33 L 103 38 L 97 43 M 233 38 H 279 M 273 33 L 279 38 L 273 43"/>
          <path d="M 116 16 H 242 L 229 60 H 103 Z"/>
          <rect x="280" y="22" width="69" height="32" rx="16"/>
          <text x="35" y="43">Start</text><text className="home-chart-output" x="172" y="43">Output "Hello!"</text><text x="314" y="43">End</text>
        </svg>
      </button>
      <button className="compiler-choice" onClick={() => onChoose('logic')}>
        <div className="compiler-choice-copy">
          <div className="compiler-choice-title"><h2>Logic Sim</h2><span>Open</span></div>
          <p>Build digital circuits with gates, switches, clocks, and live outputs.</p>
        </div>
        <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <path className="home-chart-link" d="M49 23 H95 M49 53 H95 M202 38 H261"/>
          <rect x="1" y="11" width="47" height="24" rx="5"/><rect x="1" y="41" width="47" height="24" rx="5"/>
          <path d="M 95 13 H 146 C 174 13 190 20 202 38 C 190 56 174 63 146 63 H 95 Z" />
          <circle cx="288" cy="38" r="18"/>
          <text x="24" y="27">1</text><text x="24" y="57">0</text><text x="142" y="42">AND</text><text x="288" y="43">0</text>
        </svg>
      </button>
    </div>
    <footer className="home-credits"><Credits /></footer>
  </main>;
}

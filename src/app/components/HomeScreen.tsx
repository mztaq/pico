import { ArrowRight, Code2, FileCode2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadSettings } from '../../storage/settings';
import type { CompilerLanguage } from '../../storage/projects';
import { cssVariables, getTheme } from '../themes';
import { HighlightedCode } from './HighlightedCode';
import { UpdateCenter } from './UpdateCenter';

export function Credits() {
  return <div className="attribution"><span className="credit-item"><span>Deployed by</span> <strong>Mustaqim</strong> <small>11 Boys Red</small></span><span className="credit-divider" aria-hidden="true">·</span><span className="credit-item"><span>Made by</span> <strong>Amar</strong> <small>11 Boys Blue</small></span></div>;
}
export function HomeScreen({ onChoose }: { onChoose: (language: CompilerLanguage) => void }) {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);
  return <main className="pico-home" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <div className="home-updates"><UpdateCenter /></div>
    <div className="home-brand"><img src="/pico-logo.svg" alt="" /><span>Pico<span className="brand-period">.</span></span></div>
    <h1>Choose your compiler</h1>
    <div className="compiler-choices">
      <button className="compiler-choice" onClick={() => onChoose('pseudocode')}>
        <div className="compiler-choice-title"><FileCode2 size={25} /><h2>Pseudocode Compiler</h2><ArrowRight size={22} /></div>
        <p>Run .pico programs with typed input and a debugger.</p>
        <pre aria-hidden="true"><HighlightedCode code={'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello ", Name, "!"'} /></pre>
      </button>
      <button className="compiler-choice" onClick={() => onChoose('python')}>
        <div className="compiler-choice-title"><Code2 size={25} /><h2>Python Compiler</h2><ArrowRight size={22} /></div>
        <p>Run Python with console input and a debugger.</p>
        <pre aria-hidden="true"><HighlightedCode language="python" code={'name = input("Enter your name: ")\nprint(f"Hello {name}!")'} /></pre>
      </button>
    </div>
    <footer className="home-credits"><Credits /></footer>
  </main>;
}

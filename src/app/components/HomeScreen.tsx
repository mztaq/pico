import '../../styles/home.css';
import { useEffect, useState } from 'react';
import { Binary, Code2, Cpu, GitBranch, Terminal } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import type { CompilerLanguage } from '../../storage/projects';
import { cssVariables, getTheme } from '../themes';
import { HighlightedCode } from './HighlightedCode';
import { UpdateCenter } from './UpdateCenter';
import { SiteInfoLinks } from './SiteInfo';
import { SoundButton } from './SoundToggle';
import { HomeGroup, WorkspaceChoice } from './home/HomeWorkspace';

export function HomeScreen({ onChoose }: { onChoose: (language: CompilerLanguage | 'flowchart' | 'logic' | 'cpu') => void }) {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  const [active, setActive] = useState(0);
  const workspaces = [
    { title: 'Pseudocode Compiler', detail: 'Cambridge-style pseudocode', category: 'Code', onChoose: () => onChoose('pseudocode') },
    { title: 'Python Compiler', detail: 'Interactive Python runtime', category: 'Code', onChoose: () => onChoose('python') },
    { title: 'Flowchart Builder', detail: 'Visual algorithms', category: 'Visual lab', onChoose: () => onChoose('flowchart') },
    { title: 'Logic Sim', detail: 'Digital logic circuits', category: 'Visual lab', onChoose: () => onChoose('logic') },
    { title: 'CPU Studio', detail: 'Processor execution', category: 'Visual lab', onChoose: () => onChoose('cpu') },
  ];
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);
  return <main className="pico-home" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <div className="home-nav">
      <div className="home-updates"><SoundButton /><UpdateCenter /></div>
    </div>
    <div className="home-inner">
      <div className="home-hero">
        <div className="home-brand"><img src="/pico-logo.svg" alt="" width="30" height="30" /><span>Pico<span className="brand-period">.</span></span></div>
        <h1>Choose your workspace</h1>
      </div>
      <div className="home-launcher"><div className="compiler-choices">
        <HomeGroup label="Code" detail="Write, run and debug programs">
          <WorkspaceChoice icon={<Terminal size={18} /></WorkspaceChoice>
          <WorkspaceChoice icon={<Code2 size={18} /></WorkspaceChoice>
        </HomeGroup>
        <HomeGroup label="Visual labs" detail="Build and explore interactive models">
          <WorkspaceChoice icon={<GitBranch size={18} /></WorkspaceChoice>
          <WorkspaceChoice icon={<Binary size={18} /></WorkspaceChoice>
          <WorkspaceChoice icon={<Cpu size={18} /></WorkspaceChoice>
        </HomeGroup>
      </div>
      <aside className="home-showcase" aria-label="Selected workspace"><div className="home-showcase-top"><span>{workspaces[active].category}</span><span>0{active+1} / 05</span></div><div className="home-showcase-body"><span className="home-showcase-index">0{active+1}</span><div className="home-showcase-copy"><h2>{workspaces[active].title}</h2><p>{workspaces[active].detail}</p></div><div className="home-showcase-art" aria-hidden="true">{active===0?<pre><HighlightedCode code={'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello ", Name, "!"'} /></pre>:active===1?<pre><HighlightedCode language="python" code={'name = input("Enter your name: ")\nprint(f"Hello {name}!")'} /></pre>:active===2?<svg viewBox="0 0 350 76"><rect x="1" y="22" width="68" height="32" rx="16"/><path className="home-chart-link" d="M70 38H103M233 38H279"/><path d="M116 16H242L229 60H103Z"/><rect x="280" y="22" width="69" height="32" rx="16"/><text x="35" y="43">Start</text><text x="172" y="43">Output</text><text x="314" y="43">End</text></svg>:active===3?<svg viewBox="0 0 350 76"><path className="home-chart-link" d="M49 23H95M49 53H95M202 38H261"/><rect x="1" y="11" width="47" height="24" rx="5"/><rect x="1" y="41" width="47" height="24" rx="5"/><path d="M95 13H146C174 13 190 20 202 38C190 56 174 63 146 63H95Z"/><circle cx="288" cy="38" r="18"/><text x="24" y="27">1</text><text x="24" y="57">0</text><text x="142" y="42">AND</text><text x="288" y="43">0</text></svg>:<svg viewBox="0 0 350 76"><rect x="16" y="7" width="233" height="62" rx="8"/><rect x="29" y="19" width="60" height="39" rx="4"/><rect x="99" y="19" width="139" height="39" rx="4"/><text x="59" y="43">CU</text><text x="168" y="43">ALU + REGISTERS</text><path className="home-chart-link" d="M250 38H271"/><rect x="273" y="15" width="71" height="45" rx="5"/><text x="308" y="42">RAM</text></svg>}</div></div><button className="home-showcase-launch" type="button" onClick={workspaces[active].onChoose}>Launch {workspaces[active].title} <span aria-hidden="true">↗</span></button></aside></div>
      <SiteInfoLinks />
    </div>
  </main>;
}

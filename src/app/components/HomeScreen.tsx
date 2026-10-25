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
      <div className="compiler-choices">
        <HomeGroup label="Code" detail="Write, run and debug programs">
          <WorkspaceChoice kind="pseudocode" icon={<Terminal size={18} />} tag=".pico" title="Pseudocode Compiler" description="Run and debug Cambridge-style pseudocode." onClick={() => onChoose('pseudocode')}>
            <pre className="compiler-choice-preview" aria-hidden="true"><HighlightedCode code={'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello ", Name, "!"'} /></pre>
          </WorkspaceChoice>
          <WorkspaceChoice kind="python" icon={<Code2 size={18} />} tag=".py" title="Python Compiler" description="Run Python with interactive input and debugging." onClick={() => onChoose('python')}>
            <pre className="compiler-choice-preview" aria-hidden="true"><HighlightedCode language="python" code={'name = input("Enter your name: ")\nprint(f"Hello {name}!")'} /></pre>
          </WorkspaceChoice>
        </HomeGroup>
        <HomeGroup label="Visual labs" detail="Build and explore interactive models">
          <WorkspaceChoice kind="flowchart" icon={<GitBranch size={18} />} title="Flowchart Builder" description="Build, run and convert flowcharts to pseudocode." onClick={() => onChoose('flowchart')}>
            <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <rect x="1" y="22" width="68" height="32" rx="16"/>
          <path className="home-chart-link" d="M 70 38 H 103 M 97 33 L 103 38 L 97 43 M 233 38 H 279 M 273 33 L 279 38 L 273 43"/>
          <path d="M 116 16 H 242 L 229 60 H 103 Z"/>
          <rect x="280" y="22" width="69" height="32" rx="16"/>
          <text x="35" y="43">Start</text><text className="home-chart-output" x="172" y="43">Output "Hello!"</text><text x="314" y="43">End</text>
        </svg>
          </WorkspaceChoice>
          <WorkspaceChoice kind="logic" icon={<Binary size={18} />} title="Logic Sim" description="Build circuits and inspect live signals." onClick={() => onChoose('logic')}>
            <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <path className="home-chart-link" d="M49 23 H95 M49 53 H95 M202 38 H261"/>
          <rect x="1" y="11" width="47" height="24" rx="5"/><rect x="1" y="41" width="47" height="24" rx="5"/>
          <path d="M 95 13 H 146 C 174 13 190 20 202 38 C 190 56 174 63 146 63 H 95 Z" />
          <circle cx="288" cy="38" r="18"/>
          <text x="24" y="27">1</text><text x="24" y="57">0</text><text x="142" y="42">AND</text><text x="288" y="43">0</text>
        </svg>
          </WorkspaceChoice>
          <WorkspaceChoice kind="cpu" icon={<Cpu size={18} />} title="CPU Studio" description="Explore fetch, decode and execute." onClick={() => onChoose('cpu')}>
            <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <rect x="16" y="7" width="233" height="62" rx="8"/>
          <rect x="29" y="19" width="60" height="39" rx="4"/><rect x="99" y="19" width="139" height="39" rx="4"/>
          <text x="59" y="43">CU</text><text className="home-cpu-label" x="168.5" y="43" textLength={124} lengthAdjust="spacingAndGlyphs" style={{fontSize:"14px",fontWeight:700,whiteSpace:"nowrap"}}>ALU + REGISTERS</text>
          <path className="home-chart-link" d="M 250 38 H 271"/>
          <rect x="273" y="15" width="71" height="45" rx="5"/>
          <text x="308.5" y="42">RAM</text>
        </svg>
          </WorkspaceChoice>
        </HomeGroup>
      </div>
      <SiteInfoLinks />
    </div>
  </main>;
}

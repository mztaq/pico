import '../../styles/home.css';
import { useEffect, useState } from 'react';
import { Binary, Code2, Cpu, GitBranch, Terminal } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import type { CompilerLanguage } from '../../storage/projects';
import { cssVariables, getTheme } from '../themes';
import { PseudocodePreview, PythonPreview, FlowchartPreview, LogicPreview, CpuPreview } from './home/HomePreviews';
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
            <PseudocodePreview />
          </WorkspaceChoice>
          <WorkspaceChoice kind="python" icon={<Code2 size={18} />} tag=".py" title="Python Compiler" description="Run Python with interactive input and debugging." onClick={() => onChoose('python')}>
            <PythonPreview />
          </WorkspaceChoice>
        </HomeGroup>
        <HomeGroup label="Visual labs" detail="Build and explore interactive models">
          <WorkspaceChoice kind="flowchart" icon={<GitBranch size={18} />} title="Flowchart Builder" description="Build, run and convert flowcharts to pseudocode." onClick={() => onChoose('flowchart')}>
            <FlowchartPreview />
          </WorkspaceChoice>
          <WorkspaceChoice kind="logic" icon={<Binary size={18} />} title="Logic Sim" description="Build circuits and inspect live signals." onClick={() => onChoose('logic')}>
            <LogicPreview />
          </WorkspaceChoice>
          <WorkspaceChoice kind="cpu" icon={<Cpu size={18} />} title="CPU Studio" description="Explore fetch, decode and execute." onClick={() => onChoose('cpu')}>
            <CpuPreview />
          </WorkspaceChoice>
        </HomeGroup>
      </div>
      <SiteInfoLinks />
    </div>
  </main>;
}

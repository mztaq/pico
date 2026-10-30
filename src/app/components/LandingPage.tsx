import { ArrowDown, ArrowRight, Binary, Braces, CircuitBoard, Code2, Cpu, Download, ExternalLink, Laptop, Monitor, Workflow } from 'lucide-react';
import { useEffect } from 'react';
import { cssVariables, getTheme } from '../themes';
import './landing.css';

const release = 'https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const downloads = [
  { platform: 'Windows', label: 'Setup for Windows', format: '.exe', href: release + 'Pico_x64-setup.exe' },
  { platform: 'macOS', label: 'Apple Silicon', format: '.dmg', href: release + 'Pico_aarch64.dmg' },
  { platform: 'macOS', label: 'Intel', format: '.dmg', href: release + 'Pico_x64.dmg' },
  { platform: 'Linux', label: 'AppImage', format: '.AppImage', href: release + 'Pico_amd64.AppImage' },
  { platform: 'Linux', label: 'Debian / Ubuntu', format: '.deb', href: release + 'Pico_amd64.deb' },
];

const workspaces = [
  { no: '01', title: 'Pseudocode', caption: 'Write, run and debug', Icon: Code2 },
  { no: '02', title: 'Python', caption: 'Learn through execution', Icon: Braces },
  { no: '03', title: 'Flowchart Builder', caption: 'Build visual algorithms', Icon: Workflow },
  { no: '04', title: 'Logic Sim', caption: 'Connect digital circuits', Icon: CircuitBoard },
  { no: '05', title: 'CPU Studio', caption: 'Step inside a processor', Icon: Cpu },
  { no: '06', title: 'Binary Lab', caption: 'Understand data', Icon: Binary },
];

const people = [
  { name: 'Muhammad Mustaqim', role: 'Co-founder', focus: 'Deployment & development' },
  { name: 'Amar Ayache', role: 'Co-founder', focus: 'Development & frontend' },
  { name: 'Mohamed Hamza', role: 'Concept developer', focus: 'Ideas & outreach' },
  { name: 'Mithunan Yogeswaran', role: 'Concept developer', focus: 'Ideas & UX feedback' },
];

/** Decorative visualization, not a fake code editor. Every label is an actual Pico workspace. */
function WorkspaceOrbit() {
  return <div className="landing-orbit" aria-hidden="true">
    <div className="landing-orbit-halo"/>
    <svg className="landing-orbit-paths" viewBox="0 0 620 620" fill="none">
      <circle cx="310" cy="310" r="224" className="orbit-ring orbit-ring-outer"/>
      <circle cx="310" cy="310" r="154" className="orbit-ring orbit-ring-inner"/>
      <path d="M310 86 L310 156 M504 198 L444 233 M504 422 L444 387 M310 534 L310 464 M116 422 L176 387 M116 198 L176 233" className="orbit-connectors"/>
      <path d="M86 310 C86 186 186 86 310 86" className="orbit-highlight"/>
      <circle cx="310" cy="86" r="4" className="orbit-bead"/><circle cx="504" cy="198" r="4" className="orbit-bead"/>
      <circle cx="504" cy="422" r="4" className="orbit-bead"/><circle cx="310" cy="534" r="4" className="orbit-bead"/>
      <circle cx="116" cy="422" r="4" className="orbit-bead"/><circle cx="116" cy="198" r="4" className="orbit-bead"/>
    </svg>
    <div className="landing-orbit-core"><img src="/pico-logo.svg" alt=""/><strong>Pico</strong><span>one place to learn</span></div>
    <div className="orbit-node orbit-node-top"><Code2 size={16}/><span>Pseudocode</span></div>
    <div className="orbit-node orbit-node-tr"><Braces size={16}/><span>Python</span></div>
    <div className="orbit-node orbit-node-br"><Workflow size={16}/><span>Flowcharts</span></div>
    <div className="orbit-node orbit-node-bottom"><CircuitBoard size={16}/><span>Logic Sim</span></div>
    <div className="orbit-node orbit-node-bl"><Cpu size={16}/><span>CPU Studio</span></div>
    <div className="orbit-node orbit-node-tl"><Binary size={16}/><span>Binary Lab</span></div>
  </div>;
}

function FlowIllustration() {
  return <div className="landing-flow-art" aria-label="A visual representation of a flowchart with a decision and output">
    <svg viewBox="0 0 620 350" role="img" aria-labelledby="flow-art-title">
      <title id="flow-art-title">A simple flowchart with a start, decision, and two branches</title>
      <g className="landing-flow-connectors" fill="none">
        <path d="M310 66 V112" /><path d="M310 214 V247 H164 V279"/><path d="M310 247 H456 V279"/><path d="M310 214 V247"/>
      </g>
      <rect x="245" y="18" width="130" height="48" rx="24" className="landing-flow-node"/>
      <text x="310" y="49" textAnchor="middle">START</text>
      <path d="M310 112 L389 163 L310 214 L231 163 Z" className="landing-flow-node landing-flow-decision"/>
      <text x="310" y="167" textAnchor="middle">DECIDE</text>
      <rect x="103" y="279" width="122" height="51" rx="12" className="landing-flow-node"/>
      <rect x="395" y="279" width="122" height="51" rx="12" className="landing-flow-node"/>
      <text x="164" y="310" textAnchor="middle">YES</text><text x="456" y="310" textAnchor="middle">NO</text>
      <circle cx="310" cy="247" r="5" className="landing-flow-junction"/>
      <circle cx="164" cy="247" r="4" className="landing-flow-junction"/>
      <circle cx="456" cy="247" r="4" className="landing-flow-junction"/>
    </svg>
  </div>;
}

function SignalIllustration() {
  return <div className="landing-signal-art" aria-label="A logic gate and eight binary bits">
    <svg viewBox="0 0 620 350" role="img" aria-labelledby="signal-art-title">
      <title id="signal-art-title">Two input signals feed an AND logic gate producing an output</title>
      <g className="landing-signal-lines" fill="none">
        <path d="M74 118 H231" /><path d="M74 223 H231" /><path d="M389 171 H545"/>
      </g>
      <circle className="landing-signal-end" cx="74" cy="118" r="9"/><circle className="landing-signal-end" cx="74" cy="223" r="9"/><circle className="landing-signal-end" cx="545" cy="171" r="11"/>
      <text x="71" y="87" textAnchor="middle" className="landing-signal-label">1</text><text x="71" y="262" textAnchor="middle" className="landing-signal-label">0</text><text x="547" y="140" textAnchor="middle" className="landing-signal-label">0</text>
      <path d="M231 90 H306 A81 81 0 0 1 306 252 H231 Z" className="landing-signal-gate"/>
      <text x="289" y="178" textAnchor="middle" className="landing-signal-gate-text">AND</text>
      <text x="310" y="313" textAnchor="middle" className="landing-signal-hint">INPUT  ·  PROCESS  ·  OUTPUT</text>
    </svg>
  </div>;
}

export function LandingPage() {
  // The public site has a consistent Pico identity. Workspace preferences are unchanged.
  const theme = getTheme('catppuccin-mocha');
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
    document.title = 'Pico | Computer Science Studio';
  }, [theme]);

  return <div className="pico-landing" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="landing-topbar">
      <a className="landing-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt=""/><span>Pico<span className="landing-brand-period">.</span></span></a>
      <nav className="landing-nav-links" aria-label="Main navigation">
        <a href="#workspaces">Workspaces</a><a href="#about-pico">How Pico works</a><a href="#download">Download</a><a href="#people">Team</a>
      </nav>
      <a className="landing-nav-cta" href="/app/">Open Pico <ArrowRight size={16}/></a>
    </header>
    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><span className="landing-eyebrow-line"/> PICO · COMPUTER SCIENCE STUDIO</span>
          <h1 id="landing-title">Learn by<br/><span>building.</span></h1>
          <p className="landing-hero-description">Run pseudocode and Python. Build flowcharts and logic circuits. See how a CPU works. All in one learning space.</p>
          <div className="landing-hero-actions">
            <a className="landing-button-primary" href="/app/">Use Pico in Browser <ArrowRight size={18}/></a>
            <a className="landing-button-secondary" href="#download"><Download size={17}/> Download Pico</a>
          </div>
          <p className="landing-hero-footnote">Free to use <span>·</span> Six workspaces <span>·</span> Internet required</p>
        </div>
        <WorkspaceOrbit/>
        <a href="#workspaces" className="landing-scroll-cue">Explore the workspaces <ArrowDown size={16}/></a>
      </section>

      <section className="landing-workspaces" id="workspaces" aria-labelledby="landing-workspaces-title">
        <div className="landing-section-head">
          <span className="landing-eyebrow">THE TOOLKIT</span>
          <h2 id="landing-workspaces-title">Six workspaces.<br/><span>One Pico.</span></h2>
          <p>From writing your first program to exploring the systems behind it, every workspace has a purpose.</p>
        </div>
        <div className="landing-workspace-grid">
          {workspaces.map(({ no, title, caption, Icon }) => <a className="landing-workspace-item" href="/app/" key={no}>
            <div className="landing-workspace-meta"><span>{no} / 06</span><ArrowRight size={17}/></div>
            <div className="landing-workspace-icon"><Icon size={25} strokeWidth={1.6}/></div>
            <h3>{title}</h3><p>{caption}</p>
          </a>)}
        </div>
      </section>

      <section className="landing-story" id="about-pico">
        <div className="landing-section-head landing-section-head--story">
          <span className="landing-eyebrow">LEARN BY DOING</span>
          <h2>Understand what<br/><span>your code does.</span></h2>
          <p>Experiment with algorithms and digital systems instead of relying on explanations alone.</p>
        </div>
        <div className="landing-story-row">
          <div className="landing-story-copy">
            <span className="landing-story-index">01 / FLOWCHART BUILDER</span>
            <h3>Turn a process<br/>into a picture.</h3>
            <p>Build a flowchart, follow every decision and convert the logic into pseudocode.</p>
            <a href="/app/">Explore flowcharts <ArrowRight size={17}/></a>
          </div>
          <FlowIllustration/>
        </div>
        <div className="landing-story-row landing-story-row-reverse">
          <SignalIllustration/>
          <div className="landing-story-copy">
            <span className="landing-story-index">02 / LOGIC SIM & CPU STUDIO</span>
            <h3>Look inside<br/>the system.</h3>
            <p>Wire logic gates, inspect outputs and step through the CPU's fetch, decode and execute cycle.</p>
            <a href="/app/">Explore the visual labs <ArrowRight size={17}/></a>
          </div>
        </div>
      </section>

      <section className="landing-download" id="download">
        <div className="landing-section-head">
          <span className="landing-eyebrow">GET STARTED</span>
          <h2>Use Pico <span>your way.</span></h2>
          <p>No account needed. Open Pico in the browser or install the online desktop app.</p>
        </div>
        <div className="landing-download-panels">
          <div className="landing-download-browser">
            <div className="landing-download-symbol"><Monitor size={26} strokeWidth={1.6}/></div>
            <span className="landing-download-label">IN YOUR BROWSER</span>
            <h3>Ready when<br/>you are.</h3>
            <p>Launch all six workspaces directly in your browser. Nothing to install.</p>
            <a className="landing-button-primary" href="/app/">Launch Pico <ArrowRight size={17}/></a>
            <span className="landing-browser-mark" aria-hidden="true">π</span>
          </div>
          <div className="landing-download-desktop">
            <div className="landing-download-symbol"><Laptop size={26} strokeWidth={1.6}/></div>
            <span className="landing-download-label">ON YOUR DESKTOP</span>
            <h3>Install Pico.</h3>
            <p>Choose your platform. The desktop app needs an internet connection.</p>
            <div className="landing-download-list">
              {downloads.map(item => <a href={item.href} key={item.href} aria-label={`Download Pico for ${item.platform} ${item.label}`}><span><strong>{item.platform}</strong><small>{item.label}</small></span><span className="landing-download-format">{item.format}</span><Download size={16}/></a>)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-team" id="people">
        <div className="landing-team-header">
          <div><span className="landing-eyebrow">THE PEOPLE BEHIND PICO</span><h2>Made by students.<br/><span>For students.</span></h2></div>
          <p>Meet the team developing Pico and shaping its features.</p>
        </div>
        <div className="landing-people">
          {people.map(person => <article key={person.name}><span>{person.role}</span><h3>{person.name}</h3><p>{person.focus}</p></article>)}
        </div>
        <a href="/#team" className="landing-team-more">View the full team <ArrowRight size={17}/></a>
      </section>
      <section className="landing-cta" aria-labelledby="landing-cta-heading">
        <div><span className="landing-eyebrow">READY TO START?</span><h2 id="landing-cta-heading">Open Pico and get building.</h2></div>
        <a href="/app/" className="landing-button-primary">Use Pico in Browser <ArrowRight size={18}/></a>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-footer-brand"><img src="/pico-logo.svg" alt=""/><span>Pico.</span><p>A computer science learning studio.</p></div>
      <nav aria-label="Footer"><a href="/app/">Launch Pico</a><a href="/#privacy">Privacy</a><a href="/#cookies">Cookies</a><a href="/#terms">Terms</a><a href="https://github.com/mztaq/pico" target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={13}/></a></nav>
    </footer>
  </div>;
}

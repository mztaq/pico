import { ArrowDown, ArrowRight, Binary, ChevronRight, Cpu, Download, ExternalLink, GitBranch, Laptop, Monitor, Terminal, Workflow } from 'lucide-react';
import { useEffect } from 'react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import './landing.css';

const release = 'https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const downloads = [
  { platform: 'Windows', label: 'Windows 10+', format: '.exe', href: release + 'Pico_x64-setup.exe' },
  { platform: 'macOS', label: 'Apple Silicon', format: '.dmg', href: release + 'Pico_aarch64.dmg' },
  { platform: 'macOS', label: 'Intel', format: '.dmg', href: release + 'Pico_x64.dmg' },
  { platform: 'Linux', label: 'AppImage', format: '.AppImage', href: release + 'Pico_amd64.AppImage' },
  { platform: 'Linux', label: 'Debian / Ubuntu', format: '.deb', href: release + 'Pico_amd64.deb' },
];

const workspaces = [
  { no: '01', title: 'Pseudocode & Python', caption: 'Write, run and debug', Icon: Terminal },
  { no: '02', title: 'Flowchart Builder', caption: 'Think in diagrams', Icon: Workflow },
  { no: '03', title: 'Logic Sim & CPU Studio', caption: 'Explore every step', Icon: Cpu },
  { no: '04', title: 'Binary Lab', caption: 'Understand your data', Icon: Binary },
];

const people = [
  { name: 'Muhammad Mustaqim', role: 'Co-founder', focus: 'Deployment & development' },
  { name: 'Amar Ayache', role: 'Co-founder', focus: 'Development & frontend' },
  { name: 'Mohamed Hamza', role: 'Concept developer', focus: 'Ideas & outreach' },
  { name: 'Mithunan Yogeswaran', role: 'Concept developer', focus: 'Ideas & UX feedback' },
];

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
  const theme = getTheme(loadSettings().theme);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
    document.title = 'Pico | Computer Science Studio';
  }, [theme]);

  return <div className="pico-landing" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <header className="landing-topbar">
      <a className="landing-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt="" /><span>Pico<span className="landing-brand-period">.</span></span></a>
      <nav className="landing-nav-links" aria-label="Main navigation"><a href="#what-is-pico">Overview</a><a href="#workspaces">Workspaces</a><a href="#download">Download</a><a href="#people">Team</a></nav>
      <a className="landing-nav-cta" href="/app/">Open Pico <ArrowRight size={16}/></a>
    </header>
    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-badge"><span className="landing-pulse" /> BUILT FOR COMPUTER SCIENCE STUDENTS</div>
        <h1 id="landing-title">Understand it.<br /><span>Build it.</span></h1>
        <p className="landing-hero-description">From your first line of pseudocode to understanding how a CPU works. Explore computer science through tools made for learning.</p>
        <div className="landing-hero-actions">
          <a href="/app/" className="landing-button-primary">Use Pico in Browser <ArrowRight size={18}/></a>
          <a href="#download" className="landing-button-secondary"><Download size={18}/> Get the desktop app</a>
        </div>
        <span className="landing-hero-footnote">Free to use · No account needed · Internet required</span>
        <a href="#what-is-pico" className="landing-scroll-cue">EXPLORE PICO <ArrowDown size={15}/></a>
        <div className="landing-hero-orbit" aria-hidden="true">
          <svg viewBox="0 0 900 550" preserveAspectRatio="xMidYMid meet">
            <path d="M68 515 C 155 316 175 78 416 64 C 689 50 756 212 896 423" />
            <path d="M-12 463 C 127 214 237 37 459 110 C 681 183 791 308 923 516" />
            <path d="M72 563 C 191 418 226 260 445 234 C 677 206 782 381 921 572" />
            <circle cx="416" cy="64" r="5"/><circle cx="445" cy="234" r="5"/>
          </svg>
        </div>
      </section>

      <section className="landing-workspace-rail" id="what-is-pico" aria-label="An overview of Pico tools">
        <div className="landing-rail-intro"><span>ONE STUDIO</span><p>Six workspaces.<br/>One place to learn.</p></div>
        {workspaces.map(({ no, title, caption, Icon }) => <div className="landing-rail-item" key={no}><div className="landing-rail-number">{no}</div><Icon size={20} strokeWidth={1.7}/><h2>{title}</h2><p>{caption}</p></div>)}
      </section>

      <section className="landing-story" id="workspaces">
        <div className="landing-section-intro">
          <span className="landing-eyebrow">LEARN THROUGH EXPLORATION</span>
          <h2>See what's happening<br/>behind the answer.</h2>
          <p>Computer science makes more sense when you watch each step. Pico brings code, decisions and digital systems into the same learning space.</p>
        </div>
        <div className="landing-story-row">
          <div className="landing-story-copy">
            <span className="landing-story-index">01 / VISUAL THINKING</span>
            <h3>Start with the idea.<br/>See where it goes.</h3>
            <p>Make a flowchart, follow the decisions and convert the result into pseudocode.</p>
            <a href="/app/">Explore Flowchart Builder <ArrowRight size={17}/></a>
          </div>
          <FlowIllustration/>
        </div>
        <div className="landing-story-row landing-story-row-reverse">
          <SignalIllustration/>
          <div className="landing-story-copy">
            <span className="landing-story-index">02 / DIGITAL SYSTEMS</span>
            <h3>Go beyond the code.</h3>
            <p>Connect logic gates, inspect live outputs and explore the CPU's fetch, decode and execute cycle.</p>
            <a href="/app/">Explore the visual labs <ArrowRight size={17}/></a>
          </div>
        </div>
      </section>

      <section className="landing-download" id="download">
        <div className="landing-section-intro">
          <span className="landing-eyebrow">START LEARNING</span>
          <h2>Pick how you use Pico.</h2>
          <p>Same workspaces in your browser or on your desktop. Both versions use an internet connection.</p>
        </div>
        <div className="landing-download-panels">
          <div className="landing-download-browser">
            <div className="landing-download-symbol"><Monitor size={25} strokeWidth={1.6}/></div>
            <span className="landing-download-label">ON THE WEB</span>
            <h3>Open and go.</h3>
            <p>Launch Pico in your browser. No installation and no account required.</p>
            <a className="landing-button-primary" href="/app/">Use Pico in Browser <ArrowRight size={17}/></a>
            <span className="landing-browser-mark" aria-hidden="true">π</span>
          </div>
          <div className="landing-download-desktop">
            <div className="landing-download-symbol"><Laptop size={25} strokeWidth={1.6}/></div>
            <span className="landing-download-label">ON YOUR DESKTOP</span>
            <h3>Install Pico.</h3>
            <p>Choose your platform. The app opens directly into your workspaces.</p>
            <div className="landing-download-list">
              {downloads.map(item => <a href={item.href} key={item.href} aria-label={`Download Pico for ${item.platform} ${item.label}`}><span><strong>{item.platform}</strong><small>{item.label}</small></span><span className="landing-download-format">{item.format}</span><Download size={16}/></a>)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-team" id="people">
        <div className="landing-team-header"><div><span className="landing-eyebrow">THE PICO TEAM</span><h2>Built by students.<br/>For students.</h2></div><p>Pico is developed by students who want better tools for learning computer science.</p></div>
        <div className="landing-people">
          {people.map(person => <article key={person.name}><span>{person.role}</span><h3>{person.name}</h3><p>{person.focus}</p></article>)}
        </div>
        <a href="/#team" className="landing-team-more">Meet the full team <ArrowRight size={17}/></a>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-footer-brand"><img src="/pico-logo.svg" alt="" /><span>Pico.</span><p>Computer science, made clearer.</p></div>
      <nav aria-label="Footer"><a href="/app/">Launch Pico <ChevronRight size={14}/></a><a href="/#privacy">Privacy</a><a href="/#cookies">Cookies</a><a href="/#terms">Terms</a><a href="https://github.com/mztaq/pico" target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={13}/></a></nav>
    </footer>
  </div>;
}

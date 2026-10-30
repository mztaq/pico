import { ArrowDown, ArrowRight, ArrowUpRight, Download, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { cssVariables, getTheme } from '../themes';
import './landing.css';

const release = 'https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const downloads = [
  { platform: 'Windows', detail: 'Installer', extension: '.exe', href: release + 'Pico_x64-setup.exe' },
  { platform: 'macOS', detail: 'Apple Silicon', extension: '.dmg', href: release + 'Pico_aarch64.dmg' },
  { platform: 'macOS', detail: 'Intel', extension: '.dmg', href: release + 'Pico_x64.dmg' },
  { platform: 'Linux', detail: 'AppImage', extension: '.AppImage', href: release + 'Pico_amd64.AppImage' },
  { platform: 'Linux', detail: 'Debian / Ubuntu', extension: '.deb', href: release + 'Pico_amd64.deb' },
] as const;

const workspaces = [
  { name: 'Pseudocode', detail: 'Write and run Cambridge-style pseudocode with a built-in debugger.' },
  { name: 'Python', detail: 'Experiment with Python directly in Pico.' },
  { name: 'Flowchart Builder', detail: 'Arrange flowchart blocks, run the logic and convert it into pseudocode.' },
  { name: 'Logic Sim', detail: 'Wire gates together and watch their outputs change.' },
  { name: 'CPU Studio', detail: 'Follow instructions through the fetch, decode and execute cycle.' },
  { name: 'Binary Lab', detail: 'Explore binary, hexadecimal and the way computers represent data.' },
] as const;

const people = [
  { name: 'Muhammad Mustaqim', role: 'Co-founder', contribution: 'Development and deployment' },
  { name: 'Amar Ayache', role: 'Co-founder', contribution: 'Development and frontend' },
  { name: 'Mohamed Hamza', role: 'Concept developer', contribution: 'Ideas and outreach' },
  { name: 'Mithunan Yogeswaran', role: 'Concept developer', contribution: 'Ideas and UX feedback' },
] as const;

/** Original illustrations of Pico's actual learning concepts, not product mockups. */
function FlowIllustration() {
  return <svg className="landing-diagram landing-diagram-flow" viewBox="0 0 560 350" role="img" aria-labelledby="pico-flow-title">
    <title id="pico-flow-title">Flowchart with a start, decision, and two outputs</title>
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="226" y="23" width="108" height="48" rx="24" />
      <path d="M280 71 V100" />
      <path d="M280 100 L361 164 L280 228 L199 164 Z" />
      <path d="M199 164 H110 V280 M361 164 H450 V280" />
      <path d="M280 280 H110 M280 280 H450" opacity="0" />
      <rect x="44" y="280" width="132" height="48" rx="4"/>
      <rect x="384" y="280" width="132" height="48" rx="4"/>
    </g>
    <g className="landing-diagram-heads" fill="currentColor">
      <path d="M110 280 L105 272 H115 Z"/><path d="M450 280 L445 272 H455 Z"/>
    </g>
    <g className="landing-diagram-type" fill="currentColor" textAnchor="middle">
      <text x="280" y="53">START</text><text x="280" y="168">DECISION</text><text x="110" y="309">OUTPUT A</text><text x="450" y="309">OUTPUT B</text>
      <text x="165" y="153" className="landing-diagram-small">TRUE</text><text x="393" y="153" className="landing-diagram-small">FALSE</text>
    </g>
  </svg>;
}

function LogicIllustration() {
  return <svg className="landing-diagram landing-diagram-logic" viewBox="0 0 450 260" role="img" aria-labelledby="pico-logic-title">
    <title id="pico-logic-title">Two binary input values enter an AND gate producing a zero output</title>
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M32 80 H165 M32 180 H165 M291 130 H422" />
      <path d="M165 54 H216 A76 76 0 0 1 216 206 H165 Z" fill="none"/>
    </g>
    <g fill="currentColor"><circle cx="32" cy="80" r="5"/><circle cx="32" cy="180" r="5"/><circle cx="422" cy="130" r="7"/></g>
    <g className="landing-diagram-type" fill="currentColor" textAnchor="middle">
      <text x="32" y="61">1</text><text x="32" y="166">0</text><text x="422" y="110">0</text><text x="220" y="137">AND</text>
    </g>
  </svg>;
}

export function LandingPage() {
  // Keep the public site consistently Pico purple without changing workspace themes.
  const theme = getTheme('catppuccin-mocha');
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) {
      document.documentElement.style.setProperty(property, value);
    }
    document.documentElement.style.colorScheme = theme.appearance;
    document.title = 'Pico | Computer Science Studio';
  }, [theme]);

  return <div className="pico-landing" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="Pico home">
        <img src="/pico-logo.svg" alt=""/><span>Pico<span className="landing-brand-period">.</span></span>
      </a>
      <nav className="landing-nav" aria-label="Main navigation">
        <a href="#workspaces">Workspaces</a>
        <a href="#learn">How it works</a>
        <a href="#download">Download</a>
        <a href="#team">Team</a>
      </nav>
      <a className="landing-header-launch" href="/app/">Use Pico <ArrowUpRight size={17}/></a>
    </header>

    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-main">
          <div className="landing-hero-text">
            <h1 id="landing-title">Computer science,<br/><span>made practical.</span></h1>
            <p>Write pseudocode and Python. Build flowcharts. Connect logic gates. Step through a CPU. Pico puts all six tools in one place.</p>
            <div className="landing-hero-actions">
              <a className="landing-action-primary" href="/app/">Use Pico in Browser <ArrowRight size={19}/></a>
              <a className="landing-action-text" href="#download">Download the desktop app <Download size={17}/></a>
            </div>
          </div>
          <div className="landing-hero-symbol" aria-hidden="true">
            <span>π</span>
            <div className="landing-symbol-footer"><span>PICO</span><span>01 - 06</span></div>
          </div>
        </div>
        <div className="landing-hero-bottom">
          <span>Six connected ways to learn computer science.</span>
          <a href="#workspaces">Explore the tools <ArrowDown size={17}/></a>
        </div>
      </section>

      <section className="landing-workspaces" id="workspaces" aria-labelledby="landing-workspaces-title">
        <div className="landing-section-title">
          <h2 id="landing-workspaces-title">Inside Pico</h2>
          <p>Choose a workspace and start experimenting. Each tool focuses on something specific.</p>
        </div>
        <div className="landing-workspace-list">
          {workspaces.map((workspace, index) => <a className="landing-workspace-row" href="/app/" key={workspace.name}>
            <span className="landing-workspace-index">{String(index + 1).padStart(2, '0')}</span>
            <h3>{workspace.name}</h3>
            <p>{workspace.detail}</p>
            <ArrowUpRight size={22} strokeWidth={1.6} aria-hidden="true"/>
          </a>)}
        </div>
      </section>

      <section className="landing-learning" id="learn" aria-labelledby="landing-learning-title">
        <div className="landing-learning-header">
          <h2 id="landing-learning-title">Follow the logic.<br/><span>See the result.</span></h2>
          <p>Visual tools make it easier to follow a process and understand what changes between one step and the next.</p>
        </div>
        <div className="landing-learning-visuals">
          <article className="landing-feature-flow">
            <FlowIllustration/>
            <div className="landing-feature-note">
              <h3>Flowchart Builder</h3>
              <p>Draw a process, test the path and turn the flowchart into pseudocode.</p>
            </div>
          </article>
          <article className="landing-feature-logic">
            <div className="landing-feature-note">
              <h3>Logic Sim</h3>
              <p>Connect gates and see what each input does to the output.</p>
            </div>
            <LogicIllustration/>
          </article>
        </div>
      </section>

      <section className="landing-access" id="download" aria-labelledby="landing-access-title">
        <div className="landing-section-title">
          <h2 id="landing-access-title">Start using Pico.</h2>
          <p>Both options give you the same six workspaces and require an internet connection.</p>
        </div>
        <div className="landing-access-layout">
          <div className="landing-browser-choice">
            <h3>In your browser</h3>
            <p>Open Pico without installing anything or creating an account.</p>
            <a className="landing-action-primary" href="/app/">Open Pico <ArrowUpRight size={18}/></a>
          </div>
          <div className="landing-desktop-choice">
            <h3>On your desktop</h3>
            <p>Install Pico on Windows, macOS or Linux. Select a download below.</p>
            <div className="landing-download-list">
              {downloads.map(item => <a href={item.href} key={item.href} aria-label={`Download Pico for ${item.platform} ${item.detail}`}>
                <span>{item.platform}</span><span>{item.detail}</span><span>{item.extension}</span><Download size={17} aria-hidden="true"/>
              </a>)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-team" id="team" aria-labelledby="landing-team-title">
        <div className="landing-team-intro">
          <h2 id="landing-team-title">People behind Pico.</h2>
          <p>Pico is developed by students, with ideas and feedback from the wider team.</p>
        </div>
        <div className="landing-team-list">
          {people.map(person => <div className="landing-team-row" key={person.name}>
            <h3>{person.name}</h3><p>{person.contribution}</p><span>{person.role}</span>
          </div>)}
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="landing-footer-identity"><img src="/pico-logo.svg" alt=""/><span>Pico.</span></div>
      <nav aria-label="Footer">
        <a href="/app/">Open Pico</a><a href="/#privacy">Privacy</a><a href="/#cookies">Cookies</a>
        <a href="/#terms">Terms</a>
        <a href="https://github.com/mztaq/pico" target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={13}/></a>
      </nav>
      <span className="landing-footer-note">For learning computer science.</span>
    </footer>
  </div>;
}

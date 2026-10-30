import { ArrowRight, Download, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { cssVariables, getTheme } from '../themes';
import './landing.css';

const release = 'https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const downloads = [
  { platform: 'Windows', edition: 'Installer', href: release + 'Pico_x64-setup.exe' },
  { platform: 'macOS', edition: 'Apple Silicon', href: release + 'Pico_aarch64.dmg' },
  { platform: 'macOS', edition: 'Intel', href: release + 'Pico_x64.dmg' },
  { platform: 'Linux', edition: 'AppImage', href: release + 'Pico_amd64.AppImage' },
  { platform: 'Linux', edition: 'Debian / Ubuntu', href: release + 'Pico_amd64.deb' },
] as const;

const workspaceGroups = [
  { name: 'Write', workspaces: 'Pseudocode / Python', description: 'Run code, inspect the output and find errors.' },
  { name: 'Build', workspaces: 'Flowchart Builder / Logic Sim', description: 'Create algorithms and circuits, then test how they behave.' },
  { name: 'Explore', workspaces: 'CPU Studio / Binary Lab', description: 'Follow CPU instructions and work with binary data.' },
] as const;

const people = [
  { name: 'Muhammad Mustaqim', role: 'Co-founder' },
  { name: 'Amar Ayache', role: 'Co-founder' },
  { name: 'Mohamed Hamza', role: 'Concept developer' },
  { name: 'Mithunan Yogeswaran', role: 'Concept developer' },
] as const;

export function LandingPage() {
  // The website has a consistent Pico identity, independent of workspace preferences.
  const theme = getTheme('catppuccin-mocha');
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) {
      document.documentElement.style.setProperty(property, value);
    }
    document.documentElement.style.colorScheme = theme.appearance;
    document.title = 'Pico | Built by students, for students';
  }, [theme]);

  return <div className="pico-landing" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="Pico home">
        <img src="/pico-logo.svg" alt=""/><span>Pico<span className="landing-brand-period">.</span></span>
      </a>
      <nav className="landing-nav" aria-label="Main navigation">
        <a href="#workspaces">Workspaces</a>
        <a href="#download">Download</a>
        <a href="#team">Team</a>
      </nav>
      <a className="landing-header-launch" href="/app/">Use Pico in Browser <ArrowRight size={16} aria-hidden="true"/></a>
    </header>

    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <h1 id="landing-title">Built by students,<br/><span>for students</span></h1>
        <p>Pico brings pseudocode, Python, flowcharts, logic circuits, CPU simulation and binary tools together for students learning computer science.</p>
        <div className="landing-hero-actions">
          <a className="landing-primary" href="/app/">Use Pico in Browser <ArrowRight size={18} aria-hidden="true"/></a>
          <a className="landing-secondary" href="#download">Download for desktop <Download size={17} aria-hidden="true"/></a>
        </div>
      </section>

      <section className="landing-workspaces" id="workspaces" aria-labelledby="landing-workspaces-title">
        <div className="landing-section-heading">
          <h2 id="landing-workspaces-title">What Pico does</h2>
          <p>Six workspaces for writing programs and understanding computer systems.</p>
        </div>
        <div className="landing-workspace-list">
          {workspaceGroups.map((group, index) => <div className="landing-workspace-row" key={group.name}>
            <span className="landing-workspace-index">0{index + 1}</span>
            <div><h3>{group.name}</h3><p className="landing-workspace-names">{group.workspaces}</p></div>
            <p className="landing-workspace-description">{group.description}</p>
          </div>)}
        </div>
      </section>

      <section className="landing-download" id="download" aria-labelledby="landing-download-title">
        <div className="landing-section-heading">
          <h2 id="landing-download-title">Get Pico</h2>
          <p>Choose the browser version or install the desktop app. Both need an internet connection.</p>
        </div>
        <div className="landing-download-layout">
          <div className="landing-browser-option">
            <h3>No installation</h3>
            <p>Open all six workspaces in your browser.</p>
            <a className="landing-primary" href="/app/">Use Pico in Browser <ArrowRight size={18} aria-hidden="true"/></a>
          </div>
          <div className="landing-desktop-option">
            <h3>Desktop downloads</h3>
            <div className="landing-download-list">
              {downloads.map(item => <a href={item.href} key={item.href} aria-label={`Download Pico for ${item.platform}, ${item.edition}`}>
                <span>{item.platform}</span><small>{item.edition}</small><Download size={16} aria-hidden="true"/>
              </a>)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-team" id="team" aria-labelledby="landing-team-title">
        <div className="landing-section-heading">
          <h2 id="landing-team-title">Pico Team</h2>
          <p>The students behind Pico.</p>
        </div>
        <div className="landing-team-list">
          {people.map(person => <div className="landing-team-row" key={person.name}>
            <h3>{person.name}</h3><span>{person.role}</span>
          </div>)}
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <a className="landing-footer-brand" href="/">Pico<span>.</span></a>
      <nav aria-label="Footer">
        <a href="/app/">Use Pico in Browser</a>
        <a href="/#privacy">Privacy</a><a href="/#cookies">Cookies</a><a href="/#terms">Terms</a>
        <a href="https://github.com/mztaq/pico" target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={13} aria-hidden="true"/></a>
      </nav>
    </footer>
  </div>;
}

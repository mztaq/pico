import { ArrowRight, Code2, Cpu, Download, GitBranch, Laptop, Monitor, Terminal } from 'lucide-react';
import { useEffect } from 'react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import './landing.css';

const release = 'https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const downloads = [
  { platform: 'Windows', detail: 'Windows setup', href: release + 'Pico_x64-setup.exe' },
  { platform: 'macOS', detail: 'Apple Silicon', href: release + 'Pico_aarch64.dmg' },
  { platform: 'macOS', detail: 'Intel', href: release + 'Pico_x64.dmg' },
  { platform: 'Linux', detail: 'AppImage', href: release + 'Pico_amd64.AppImage' },
  { platform: 'Linux', detail: 'Debian package', href: release + 'Pico_amd64.deb' },
];

export function LandingPage() {
  const theme = getTheme(loadSettings().theme);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
    document.title = 'Pico | Computer Science Studio';
  }, [theme]);

  return <div className="pico-landing" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <header className="landing-topbar">
      <a href="/" className="landing-brand" aria-label="Pico home"><img src="/pico-logo.svg" alt="" /> Pico<span>.</span></a>
      <nav aria-label="Main navigation"><a href="#features">Features</a><a href="#download">Download</a><a href="#team">Pico Team</a></nav>
      <a className="landing-nav-launch" href="/app">Open Pico <ArrowRight size={15} /></a>
    </header>
    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span className="landing-eyebrow-dot" /> COMPUTER SCIENCE STUDIO</div>
          <h1 id="landing-title">Write code.<br /><span>Explore how it works.</span></h1>
          <p>Pseudocode, Python, flowcharts, logic circuits, CPU simulation and binary tools. All in one place.</p>
          <div className="landing-actions">
            <a className="landing-primary" href="/app">Use Pico in Browser <ArrowRight size={18} /></a>
            <a className="landing-secondary" href="#download"><Download size={17} /> Download Pico</a>
          </div>
          <p className="landing-note">Free to use. Internet connection required.</p>
        </div>
        <div className="landing-demo" aria-label="Preview of Pico programming tools">
          <div className="landing-demo-toolbar"><span className="landing-demo-dot" /><span className="landing-demo-dot" /><span className="landing-demo-dot" /><span className="landing-demo-label"><Terminal size={14} /> Pseudocode Compiler</span><span className="landing-demo-ready">● Ready</span></div>
          <div className="landing-demo-content">
            <div className="landing-demo-tab"><Code2 size={14}/> main.pico</div>
            <pre><span>01</span> <b>DECLARE</b> Name : STRING{'\n'}<span>02</span> <b>INPUT</b> Name{'\n'}<span>03</span> <b>OUTPUT</b> <em>"Hello "</em>, Name</pre>
            <div className="landing-demo-console"><div>OUTPUT</div><code>Hello Pico</code></div>
          </div>
        </div>
      </section>
      <section className="landing-section landing-features" id="features" aria-labelledby="landing-features-title">
        <div className="landing-section-top"><span className="landing-kicker">THE WORKSPACES</span><h2 id="landing-features-title">Everything you need to experiment.</h2><p>Move between programming and visual tools without changing platforms.</p></div>
        <div className="landing-feature-grid">
          <article><div className="landing-feature-icon"><Code2 size={20}/></div><h3>Code</h3><p>Run and debug Cambridge-style pseudocode and Python.</p><span>Pseudocode · Python</span></article>
          <article><div className="landing-feature-icon"><GitBranch size={20}/></div><h3>Visual labs</h3><p>Build flowcharts and logic circuits. Explore CPU execution step by step.</p><span>Flowchart · Logic Sim · CPU Studio</span></article>
          <article><div className="landing-feature-icon"><Cpu size={20}/></div><h3>Data lab</h3><p>Work with binary, hexadecimal, shifts and two's complement.</p><span>Binary Lab</span></article>
        </div>
      </section>
      <section className="landing-section landing-download" id="download" aria-labelledby="landing-download-title">
        <div className="landing-section-top"><span className="landing-kicker">GET PICO</span><h2 id="landing-download-title">Your way to use Pico.</h2><p>Open it in a browser or install the desktop app.</p></div>
        <div className="landing-download-grid">
          <div className="landing-download-card landing-browser"><div className="landing-card-top"><Monitor size={21}/><span>NO INSTALL REQUIRED</span></div><h3>Use in your browser</h3><p>Open Pico directly on your device.</p><a href="/app">Launch Pico <ArrowRight size={17}/></a></div>
          <div className="landing-download-card"><div className="landing-card-top"><Laptop size={21}/><span>DESKTOP APP</span></div><h3>Download Pico</h3><p>Install Pico for Windows, macOS or Linux. The desktop app requires an internet connection.</p><div className="landing-download-list">{downloads.map((item) => <a key={item.href} href={item.href}><Download size={15}/><span>{item.platform}</span><small>{item.detail}</small><ArrowRight size={15}/></a>)}</div></div>
        </div>
      </section>
      <section className="landing-team" aria-labelledby="landing-team-title"><div><span className="landing-kicker">THE PEOPLE BEHIND PICO</span><h2 id="landing-team-title">Made by students, for students.</h2><p>Meet the co-founders and concept developers building Pico.</p></div><a href="#team">Meet the Pico Team <ArrowRight size={17}/></a></section>
    </main>
    <footer className="landing-footer"><div className="landing-brand"><img src="/pico-logo.svg" alt=""/>Pico<span>.</span></div><nav aria-label="Footer"><a href="#team">Pico Team</a><a href="#privacy">Privacy</a><a href="#cookies">Cookies</a><a href="#terms">Terms</a></nav></footer>
  </div>;
}

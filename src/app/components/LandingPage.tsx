import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, ExternalLink } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cssVariables, getTheme } from '../themes';
import { HomeScreen } from './HomeScreen';
import './landing.css';

const release = 'https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const downloads = [
  { platform: 'Windows', edition: 'Setup', href: release + 'Pico_x64-setup.exe' },
  { platform: 'macOS', edition: 'Apple Silicon', href: release + 'Pico_aarch64.dmg' },
  { platform: 'macOS', edition: 'Intel', href: release + 'Pico_x64.dmg' },
  { platform: 'Linux', edition: 'AppImage', href: release + 'Pico_amd64.AppImage' },
  { platform: 'Linux', edition: 'Debian / Ubuntu', href: release + 'Pico_amd64.deb' },
] as const;

const tools = [
  { title: 'Write', names: 'Pseudocode Compiler / Python Compiler', detail: 'Run programs and inspect their output.' },
  { title: 'Build', names: 'Flowchart Builder / Logic Sim', detail: 'Create algorithms and digital circuits.' },
  { title: 'Understand', names: 'CPU Studio / Binary Lab', detail: 'Step through instructions and represent data.' },
] as const;

/**
 * The real Pico HomeScreen is displayed below, not a fabricated mockup.
 * A single scroll listener adjusts CSS transforms. No animation runs when
 * reduced motion is preferred and the actual tool routes are untouched.
 */
function useShowcaseMotion(scrollRef: React.RefObject<HTMLDivElement | null>, sectionRef: React.RefObject<HTMLElement | null>, screenRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const scroller = scrollRef.current;
    const section = sectionRef.current;
    const screen = screenRef.current;
    if (!scroller || !section || !screen) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let queued = 0;

    const update = () => {
      queued = 0;
      const previewWidth = screen.clientWidth;
      // A fixed-size authentic app UI scales into its display, without
      // changing HomeScreen's own layout or adding an iframe.
      screen.style.setProperty('--pico-ui-scale', String(previewWidth / 1440));
      if (reduce.matches || window.innerWidth < 640) {
        section.style.setProperty('--showcase-rx', '0deg');
        section.style.setProperty('--showcase-ry', '0deg');
        section.style.setProperty('--showcase-lift', '0px');
        section.style.setProperty('--showcase-scale', '1');
        return;
      }
      const area = scroller.getBoundingClientRect();
      const box = section.getBoundingClientRect();
      const top = box.top - area.top;
      const total = Math.max(1, scroller.clientHeight * 0.65 + box.height * 0.52);
      const progress = Math.max(0, Math.min(1, (scroller.clientHeight * 0.68 - top) / total));
      section.style.setProperty('--showcase-rx', `${(19 * (1 - progress)).toFixed(2)}deg`);
      section.style.setProperty('--showcase-ry', `${(-12 * (1 - progress)).toFixed(2)}deg`);
      section.style.setProperty('--showcase-lift', `${(65 * (1 - progress)).toFixed(1)}px`);
      section.style.setProperty('--showcase-scale', String((0.87 + 0.13 * progress).toFixed(3)));
    };
    const queue = () => { if (!queued) queued = window.requestAnimationFrame(update); };
    scroller.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    reduce.addEventListener('change', queue);
    const observer = new ResizeObserver(queue);
    observer.observe(screen);
    observer.observe(section);
    update();
    return () => {
      scroller.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      reduce.removeEventListener('change', queue);
      observer.disconnect();
      if (queued) window.cancelAnimationFrame(queued);
    };
  }, [scrollRef, sectionRef, screenRef]);
}

export function LandingPage() {
  const theme = getTheme('catppuccin-mocha');
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  useShowcaseMotion(scrollRef, stageRef, screenRef);

  useEffect(() => {
    for (const [key, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(key, value);
    document.documentElement.style.colorScheme = theme.appearance;
    document.title = 'Pico | Built by students, for students';
  }, [theme]);

  return <div className="pico-landing" ref={scrollRef} data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt="" /><span>Pico<span className="landing-brand-dot">.</span></span></a>
      <nav className="landing-nav" aria-label="Main navigation">
        <a href="#workspaces">Workspaces</a>
        <a href="#download">Download</a>
        <a href="#team">Team</a>
      </nav>
      <a className="landing-header-launch" href="/app/">Use Pico in Browser <ArrowUpRight size={17} aria-hidden="true" /></a>
    </header>

    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Built by students,<br /><span>for students.</span></h1>
          <p>Six tools for learning computer science. Write code, build circuits and understand how computers work.</p>
          <div className="landing-hero-actions">
            <a className="landing-primary" href="/app/">Use Pico in Browser <ArrowRight size={18} aria-hidden="true" /></a>
            <a className="landing-secondary" href="#download">Download Pico <Download size={17} aria-hidden="true" /></a>
          </div>
        </div>
        <a className="landing-scroll-label" href="#showcase">See Pico in action <ArrowDownRight size={17} aria-hidden="true"/></a>
      </section>

      <section className="landing-showcase" id="showcase" aria-label="Preview of Pico's actual workspace selection" ref={stageRef}>
        <div className="landing-showcase-sticky">
          <div className="landing-showcase-bar">
            <span>Pico workspace selection</span>
            <span>Real interface, not a mockup</span>
          </div>
          <div className="landing-scene">
            <div className="landing-scene-depth landing-scene-depth-back" aria-hidden="true"/>
            <div className="landing-scene-depth landing-scene-depth-middle" aria-hidden="true"/>
            <div className="landing-preview-panel">
              <div className="landing-preview-toolbar"><span>Pico.</span><span>Choose your workspace</span><span>● &nbsp; Browser preview</span></div>
              <div className="landing-preview-screen" ref={screenRef} aria-hidden="true" inert>
                <div className="landing-preview-viewport">
                  <HomeScreen onChoose={() => {}} />
                </div>
              </div>
            </div>
          </div>
          <div className="landing-showcase-foot">
            <span>Actual Pico workspace selector</span>
            <a href="/app/">Open the full application <ArrowUpRight size={16} aria-hidden="true"/></a>
          </div>
        </div>
      </section>

      <section className="landing-workspaces" id="workspaces" aria-labelledby="landing-workspaces-title">
        <div className="landing-section-heading">
          <h2 id="landing-workspaces-title">Everything in one place.</h2>
          <p>Pico has six workspaces. Start in the browser or install the desktop app.</p>
        </div>
        <div className="landing-tool-list">
          {tools.map((item, index) => <div className="landing-tool-row" key={item.title}>
            <span className="landing-tool-index">0{index + 1}</span>
            <h3>{item.title}</h3>
            <div className="landing-tool-detail"><strong>{item.names}</strong><p>{item.detail}</p></div>
          </div>)}
        </div>
      </section>

      <section className="landing-download" id="download" aria-labelledby="landing-download-title">
        <div className="landing-section-heading">
          <h2 id="landing-download-title">Get Pico.</h2>
          <p>Free to use. An internet connection is required.</p>
        </div>
        <div className="landing-download-content">
          <div className="landing-download-browser">
            <h3>Use it in your browser</h3>
            <p>No installation. No account.</p>
            <a className="landing-primary" href="/app/">Use Pico in Browser <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
          <div className="landing-download-desktop">
            <h3>Desktop downloads</h3>
            <div className="landing-platform-list">
              {downloads.map(item => <a key={item.href} href={item.href} aria-label={`Download Pico for ${item.platform}, ${item.edition}`}>
                <span>{item.platform}</span><span>{item.edition}</span><Download size={16} aria-hidden="true"/></a>)}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-team" id="team" aria-labelledby="landing-team-title">
        <div className="landing-section-heading"><h2 id="landing-team-title">The Pico Team.</h2><p>The students building Pico.</p></div>
        <div className="landing-founders">
          <div><span>Co-founder</span><h3>Muhammad Mustaqim</h3></div>
          <div><span>Co-founder</span><h3>Amar Ayache</h3></div>
        </div>
        <div className="landing-contributors">
          <span>Concept developers</span><p>Mohamed Hamza <span>·</span> Mithunan Yogeswaran</p>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <a className="landing-footer-brand" href="/">Pico<span>.</span></a>
      <nav aria-label="Footer">
        <a href="/app/">Use Pico in Browser</a><a href="/#privacy">Privacy</a><a href="/#cookies">Cookies</a><a href="/#terms">Terms</a>
        <a href="https://github.com/mztaq/pico" target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={13} aria-hidden="true"/></a>
      </nav>
    </footer>
  </div>;
}

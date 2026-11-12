import '../../styles/home.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Binary, Bug, Calculator, Code2, Cpu, GitBranch, Network, Palette, Terminal, WifiOff, X as CloseIcon } from 'lucide-react';
import { loadSettings, saveSettings } from '../../storage/settings';
import type { CompilerLanguage } from '../../storage/projects';
import { cssVariables, getTheme, normalizeThemeId } from '../themes';
import { HighlightedCode } from './HighlightedCode';
import { UpdateCenter } from './UpdateCenter';
import { SiteInfoLinks } from './SiteInfo';
import { SoundButton } from './SoundToggle';
import { ThemePicker } from './ThemePicker';
import { BugReportDialog } from './BugReportDialog';
import { BugReportNotice } from './BugReportNotice';
import { picoIsOnline } from './pico-connection';

const HOME_AMBIENT_CURVES = [
  { d: 'M -170 -160 C 40 26 230 186 210 362 C 186 520 -27 624 104 814 C 222 981 376 1028 500 1108', width: 2.6, opacity: .72 },
  { d: 'M -230 -120 C -10 46 186 200 168 370 C 149 548 -75 659 62 850 C 174 1008 341 1080 476 1163', width: 1.5, opacity: .39 },
  { d: 'M 1260 -185 C 1080 30 1183 190 1375 350 C 1564 506 1459 670 1390 805 C 1334 954 1429 1075 1684 1176', width: 2.6, opacity: .72 },
  { d: 'M 1332 -220 C 1150 22 1246 193 1428 353 C 1599 511 1520 676 1441 819 C 1375 960 1478 1096 1743 1200', width: 1.5, opacity: .40 },
  { d: 'M 1010 -170 C 1080 -75 1162 -28 1190 105 C 1221 217 1286 251 1387 304', width: 1.3, opacity: .28 },
] as const;

export function HomeScreen({ onChoose }: { onChoose: (language: CompilerLanguage | 'flowchart' | 'logic' | 'cpu' | 'binary' | 'traffic') => void }) {
  const [settings, setSettings] = useState(loadSettings);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [offlineReportWarning, setOfflineReportWarning] = useState(false);
  const [reportNotice, setReportNotice] = useState<{type: 'success' | 'error'; message: string} | null>(null);
  const setReportRoute = (open: boolean) => {
    const target = open ? '/app/report' : '/app';
    if (window.location.pathname !== target) window.history.pushState(window.history.state, '', target);
    setReportOpen(open);
  };
  const openReport = async () => {
    if (await picoIsOnline()) { setOfflineReportWarning(false); setReportRoute(true); }
    else setOfflineReportWarning(true);
  };
  useEffect(() => {
    const syncRoute = () => {
      if (!/^\/app\/report\/?$/.test(window.location.pathname)) { setReportOpen(false); return; }
      void picoIsOnline().then(online => {
        if (online) setReportOpen(true);
        else {
          setReportRoute(false);
          setOfflineReportWarning(true);
        }
      });
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);
  const theme = getTheme(settings.theme);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);
  useEffect(() => {
    if (!themeOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) setThemeOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setThemeOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [themeOpen]);
  const changeTheme = (id: string) => {
    const next = { ...settings, theme: normalizeThemeId(id) };
    setSettings(next);
    try { saveSettings(next); } catch { /* Keep the selected theme active if storage is unavailable. */ }
  };
  useEffect(() => {
    if (!reportNotice) return;
    const timeout = window.setTimeout(() => setReportNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [reportNotice]);
  return <main className="pico-home" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? "true" : undefined} style={cssVariables(theme) as React.CSSProperties}>
      <svg className="pico-home-curves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        {HOME_AMBIENT_CURVES.map((curve, index) => (
          <path key={index} d={curve.d} strokeWidth={curve.width} opacity={curve.opacity} />
        ))}
        {[0, 2].map(index => (
          <path key={`flow-${index}`} d={HOME_AMBIENT_CURVES[index].d} pathLength={1000}
            className={index === 0 ? 'pico-home-curve-flow' : 'pico-home-curve-flow pico-home-curve-flow--right'} />
        ))}
      </svg>
    <div className="home-nav">
      <div className="home-theme-anchor" ref={themeMenuRef}>
        <button type="button" className="home-theme-trigger" aria-label="Change theme" aria-expanded={themeOpen} aria-controls="home-theme-menu" onClick={() => setThemeOpen(open => !open)}>
            <Palette size={16} aria-hidden="true" /><span>Theme</span>
          </button>
          {themeOpen && <div id="home-theme-menu" className="home-theme-menu" aria-label="Choose a theme">
            <ThemePicker value={settings.theme} onChange={changeTheme} showSound={false} />
        </div>}
      </div>
      <div className="home-updates">
        <SoundButton /><UpdateCenter />
      </div>
    </div>
    <div className="home-inner">
      <div className="home-hero">
      <div className="home-brand"><img src="/pico-logo.svg" alt="" width="30" height="30" /><span>Pico<span className="brand-period">.</span></span></div>
        <h1>Choose your workspace</h1>
      </div>
      <div className="compiler-choices">
        <HomeGroup label="Code" detail="Write, run and debug programs">
          <WorkspaceChoice icon={<Terminal size={18} />} tag=".pico" title="Pseudocode Compiler" description="Run and debug Cambridge-style pseudocode." onClick={() => onChoose('pseudocode')}>
            <pre className="compiler-choice-preview" aria-hidden="true"><HighlightedCode code={'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello ", Name, "!"'} /></pre>
          </WorkspaceChoice>
          <WorkspaceChoice icon={<Code2 size={18} />} tag=".py" title="Python Compiler" description="Run Python with interactive input and debugging." onClick={() => onChoose('python')}>
            <pre className="compiler-choice-preview" aria-hidden="true"><HighlightedCode language="python" code={'name = input("Enter your name: ")\nprint(f"Hello {name}!")'} /></pre>
          </WorkspaceChoice>
        </HomeGroup>
        <HomeGroup label="Visual labs" detail="Build and explore interactive models" kind="visual">
          <WorkspaceChoice icon={<GitBranch size={18} />} title="Flowchart Builder" description="Build, run and convert flowcharts to pseudocode." onClick={() => onChoose('flowchart')}>
            <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <rect x="1" y="22" width="68" height="32" rx="16"/>
          <path className="home-chart-link" d="M 70 38 H 103 M 97 33 L 103 38 L 97 43 M 233 38 H 279 M 273 33 L 279 38 L 273 43"/>
          <path d="M 116 16 H 242 L 229 60 H 103 Z"/>
          <rect x="280" y="22" width="69" height="32" rx="16"/>
          <text x="35" y="43">Start</text><text className="home-chart-output" x="172" y="43">Output "Hello!"</text><text x="314" y="43">End</text>
        </svg>
          </WorkspaceChoice>
          <WorkspaceChoice icon={<Binary size={18} />} title="Logic Sim" description="Build circuits and inspect live signals." onClick={() => onChoose('logic')}>
            <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <path className="home-chart-link" d="M49 23 H95 M49 53 H95 M202 38 H261"/>
          <rect x="1" y="11" width="47" height="24" rx="5"/><rect x="1" y="41" width="47" height="24" rx="5"/>
          <path d="M 95 13 H 146 C 174 13 190 20 202 38 C 190 56 174 63 146 63 H 95 Z" />
          <circle cx="288" cy="38" r="18"/>
          <text x="24" y="27">1</text><text x="24" y="57">0</text><text x="142" y="42">AND</text><text x="288" y="43">0</text>
        </svg>
          </WorkspaceChoice>
          <WorkspaceChoice icon={<Cpu size={18} />} title="CPU Studio" description="Explore fetch, decode and execute." onClick={() => onChoose('cpu')}>
            <svg className="compiler-choice-preview home-chart-preview" viewBox="0 0 350 76" aria-hidden="true">
          <rect x="16" y="7" width="233" height="62" rx="8"/>
          <rect x="29" y="19" width="60" height="39" rx="4"/><rect x="99" y="19" width="139" height="39" rx="4"/>
          <text x="59" y="43">CU</text><text className="home-cpu-label" x="168.5" y="43" textLength={124} lengthAdjust="spacingAndGlyphs" style={{fontSize:"14px",fontWeight:700,whiteSpace:"nowrap"}}>ALU + REGISTERS</text>
          <path className="home-chart-link" d="M 250 38 H 271"/>
          <rect x="273" y="15" width="71" height="45" rx="5"/>
          <text x="308.5" y="42">RAM</text>
        </svg>
          </WorkspaceChoice>
          <WorkspaceChoice icon={<Network size={18}/>} title="Traffic Storm" description="Watch simulated request floods and server overload." onClick={() => onChoose('traffic')}>
            <svg className="compiler-choice-preview home-chart-preview home-traffic-preview" viewBox="0 0 350 76" aria-hidden="true">
              <path className="home-chart-link" d="M 57 12 C 126 12 131 38 192 38 H 259 M 57 38 H 259 M 57 64 C 126 64 131 38 192 38 H 259"/>
              {[12,38,64].map(y => <g key={y}><rect x="7" y={y-10} width="50" height="20" rx="5"/><circle cx="21" cy={y} r="4"/><path d={`M 33 ${y} h 14`} className="home-chart-link"/></g>)}
              <rect x="259" y="10" width="71" height="56" rx="7"/><rect x="269" y="21" width="51" height="12" rx="3"/><rect x="269" y="41" width="51" height="12" rx="3"/><circle cx="278" cy="27" r="2.5"/><circle cx="278" cy="47" r="2.5"/>
              <circle cx="164" cy="38" r="5" className="home-traffic-packet"/><circle cx="220" cy="38" r="3" className="home-traffic-packet"/>
            </svg>
          </WorkspaceChoice>
          <WorkspaceChoice icon={<Network size={18}/>} title="Blackout Protocol 3D" description="Play an interactive 3D attack-or-defend server security mission." onClick={() => { window.location.href = '/blackout-protocol.html'; }}>
            <svg className="compiler-choice-preview home-chart-preview home-traffic-preview" viewBox="0 0 350 76" aria-hidden="true">
              <path className="home-chart-link" d="M35 54 L92 30 L152 50 L220 22 L300 38 M92 30 L92 10 M220 22 L220 7"/>
              <rect x="7" y="32" width="46" height="36" rx="5"/><rect x="144" y="27" width="44" height="39" rx="5"/><rect x="284" y="20" width="51" height="47" rx="5"/>
              <path d="M17 43 H42 M17 51 H42 M154 40 H178 M154 49 H178 M296 34 H322 M296 44 H322 M296 54 H322"/>
              <circle cx="92" cy="30" r="5" className="home-traffic-packet"/><circle cx="220" cy="22" r="5" className="home-traffic-packet"/>
            </svg>
          </WorkspaceChoice>
        </HomeGroup>
        <HomeGroup label="Data lab" detail="Understand how computers represent numbers" kind="data">
          <WorkspaceChoice icon={<Calculator size={18} />} title="Binary Lab" description="Explore bits, hexadecimal, logical shifts, overflow and two’s complement." onClick={() => onChoose('binary')}>
            <div className="compiler-choice-preview home-binary-preview" aria-hidden="true">
              <div className="home-binary-byte">{'00101010'.split('').map((bit, index) => <span className={bit === '1' ? 'on' : ''} key={index}>{bit}</span>)}</div>
              <div className="home-binary-equation"><code>0010 1010</code><span>=</span><strong>42</strong><span>=</span><code>0x2A</code></div>
            </div>
          </WorkspaceChoice>
        </HomeGroup>
      </div>
      <div className="home-footer-links">
        <SiteInfoLinks />
        <button type="button" className="bug-report-trigger" onClick={() => { void openReport(); }}>
          <Bug size={17} aria-hidden="true" /><span>Report a Bug</span>
        </button>
      </div>
    </div>
    {offlineReportWarning && <div className="pico-offline-backdrop" role="presentation">
      <section className="pico-offline-dialog" role="dialog" aria-modal="true" aria-labelledby="pico-report-offline-title">
        <button type="button" className="pico-offline-close" aria-label="Close offline report notice" onClick={() => setOfflineReportWarning(false)}><CloseIcon size={17}/></button>
        <WifiOff size={23} aria-hidden="true" />
        <h2 id="pico-report-offline-title">You're offline</h2>
        <p>Connect to the internet to report a bug.</p>
        <button type="button" className="pico-offline-continue" onClick={() => setOfflineReportWarning(false)}>Close</button>
      </section>
    </div>}
    {reportOpen && <BugReportDialog onClose={() => setReportRoute(false)} onResult={(type, message) => { setReportRoute(false); setReportNotice({type, message}); }} />}
    {reportNotice && <BugReportNotice type={reportNotice.type} message={reportNotice.message} onClose={() => setReportNotice(null)} />}

  </main>;
}

function HomeGroup({ label, detail, children, kind }: { label: string; detail: string; children: ReactNode; kind?: 'visual' | 'data' }) {
  return <section className={`home-group${kind ? ` home-group--${kind}` : ''}`} aria-label={label}>
    <div className="home-group-head"><span className="home-group-label">{label}</span><span className="home-group-detail">{detail}</span></div>
    <div className="home-group-grid">{children}</div>
  </section>;
}

function WorkspaceChoice({ icon, tag, title, description, onClick, children }: { icon: ReactNode; tag?: string; title: string; description: string; onClick: () => void; children: ReactNode }) {
  return <button className="compiler-choice" onClick={onClick}>
    <div className="compiler-choice-stage" aria-hidden="true">{children}</div>
    <div className="compiler-choice-copy">
      <div className="compiler-choice-title"><i className="compiler-choice-icon" aria-hidden="true">{icon}</i><h2>{title}</h2>{tag && <code className="compiler-choice-tag" aria-hidden="true">{tag}</code>}</div>
      <p>{description}</p>
    </div>
  </button>;
}

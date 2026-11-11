import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Activity, ArrowLeft, Bot, CircleHelp, Pause, Play, RotateCcw, Server, Settings2, Shield, ShieldAlert, Users, Waves, X } from 'lucide-react';
import { SoundButton } from '../app/components/SoundToggle';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { soundEnabled } from '../app/sound';
import { loadSettings, saveSettings } from '../storage/settings';
import './traffic-storm.css';

const SERVER_CAPACITY = 3200;
const PACKET_PATHS = [
  'M 150 70 C 300 70 310 165 490 165 S 700 185 835 185',
  'M 150 138 C 350 138 370 185 490 185 S 700 185 835 185',
  'M 150 240 C 350 240 380 205 490 205 S 700 185 835 185',
  'M 150 310 C 320 310 345 225 490 225 S 700 185 835 185',
];
const initialStats = () => ({ seconds: 0, health: 100, rps: 0, total: 0, dropped: 0, history: [] as number[] });
type Scenario = { hacker: string; bots: number; ip: string };
type Mode = 'setup' | 'running' | 'paused' | 'offline';
type EffectName = 'start' | 'fan' | 'warning' | 'shutdown';

function validIPv4(value: string): boolean {
  const octets = value.split('.');
  return octets.length === 4 && octets.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function compact(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

export function TrafficStorm({ onHome }: { onHome: () => void }) {
  // Nothing is sent to this address. The IP is a label in a browser-only model.
  const [hacker, setHacker] = useState('');
  const [botsDraft, setBotsDraft] = useState('3000');
  const [ipDraft, setIpDraft] = useState('203.0.113.10');
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [mode, setMode] = useState<Mode>('setup');
  const [stats, setStats] = useState(initialStats);
  const [showHelp, setShowHelp] = useState(false);
  const [themeId, setThemeId] = useState(() => loadSettings().theme);
  const [themeOpen, setThemeOpen] = useState(false);
  const theme = getTheme(themeId);
  const audioRef = useRef<AudioContext | null>(null);
  const fanPlayed = useRef(false);
  const warningPlayed = useRef(false);
  const lastFrame = useRef(0);

  useEffect(() => {
    for (const [key, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(key, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);

  useEffect(() => () => { if (audioRef.current) void audioRef.current.close(); }, []);

  function playEffect(name: EffectName) {
    if (!soundEnabled() || typeof window.AudioContext === 'undefined') return;
    try {
      const ctx = audioRef.current ?? new window.AudioContext();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const start = ctx.currentTime;
      const tone = (from: number, to: number, length: number, volume: number, delay = 0, wave: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(from, start + delay);
        osc.frequency.exponentialRampToValueAtTime(to, start + delay + length);
        filter.type = 'lowpass';
        filter.frequency.value = 480;
        gain.gain.setValueAtTime(0.0001, start + delay);
        gain.gain.exponentialRampToValueAtTime(volume, start + delay + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + length);
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start(start + delay);
        osc.stop(start + delay + length + 0.02);
      };
      if (name === 'start') {
        tone(220, 480, 0.23, 0.035);
        tone(380, 660, 0.25, 0.028, 0.12);
      } else if (name === 'fan') {
        tone(56, 175, 1.5, 0.045, 0, 'sawtooth');
        tone(110, 205, 1.25, 0.018, 0.22, 'triangle');
      } else if (name === 'warning') {
        tone(600, 420, 0.2, 0.045);
        tone(600, 420, 0.2, 0.045, 0.32);
      } else {
        tone(260, 42, 1.55, 0.082, 0, 'sawtooth');
        tone(120, 32, 1.7, 0.042, 0.15, 'triangle');
      }
    } catch { /* Sound is optional and never blocks the model. */ }
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bots = Number(botsDraft);
    if (!hacker.trim()) { setError('Give the operator a name.'); return; }
    if (!Number.isInteger(bots) || bots < 100 || bots > 20000) { setError('Choose between 100 and 20,000 fictional bots.'); return; }
    if (!validIPv4(ipDraft.trim())) { setError('Enter an IPv4 address with four numbers between 0 and 255.'); return; }
    setScenario({ hacker: hacker.trim().slice(0, 32), bots, ip: ipDraft.trim() });
    setStats(initialStats());
    fanPlayed.current = false;
    warningPlayed.current = false;
    lastFrame.current = performance.now();
    setError('');
    setMode('running');
    playEffect('start');
  }

  useEffect(() => {
    if (mode !== 'running' || !scenario) return;
    lastFrame.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.4, Math.max(0, (now - lastFrame.current) / 1000));
      lastFrame.current = now;
      setStats(previous => {
        if (previous.health <= 0) return previous;
        // Synthetic traffic only. No fetch, sockets, or network packets.
        const variation = 0.93 + 0.07 * Math.sin(now / 370) + 0.06 * Math.sin(now / 850);
        const rps = Math.round(scenario.bots * 1.65 * variation);
        const overload = rps / SERVER_CAPACITY;
        const damage = overload > 1 ? (overload - 1) * 8.5 * dt : -3 * dt;
        const health = Math.max(0, Math.min(100, previous.health - damage));
        return {
          seconds: previous.seconds + dt,
          health,
          rps,
          total: previous.total + rps * dt,
          dropped: previous.dropped + Math.max(0, rps - SERVER_CAPACITY) * dt,
          history: [...previous.history.slice(-65), rps],
        };
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [mode, scenario]);

  useEffect(() => {
    if (mode !== 'running') return;
    if (stats.rps > SERVER_CAPACITY && !fanPlayed.current) {
      fanPlayed.current = true;
      playEffect('fan');
    }
    if (stats.health <= 35 && !warningPlayed.current) {
      warningPlayed.current = true;
      playEffect('warning');
    }
    if (stats.health === 0) {
      setMode('offline');
      playEffect('shutdown');
    }
  }, [mode, stats.rps, stats.health]);

  function restart() {
    setStats(initialStats());
    fanPlayed.current = false;
    warningPlayed.current = false;
    lastFrame.current = performance.now();
    setMode('running');
    playEffect('start');
  }

  function newScenario() {
    setMode('setup');
    setScenario(null);
    setError('');
    setStats(initialStats());
    setShowHelp(false);
  }

  const pressure = stats.rps / SERVER_CAPACITY;
  const status = mode === 'offline' ? 'OFFLINE' : pressure >= 1 ? 'OVERLOADED' : stats.health < 65 ? 'DEGRADED' : 'ONLINE';
  const cpu = mode === 'offline' ? 0 : Math.round(Math.min(100, 15 + pressure * 64));
  const points = stats.history.map((value, index) => {
    const x = stats.history.length <= 1 ? 0 : index / (stats.history.length - 1) * 600;
    const y = 104 - Math.min(1, value / Math.max(6000, (scenario?.bots ?? 3000) * 1.9)) * 95;
    return String(x) + ',' + String(y);
  }).join(' ');
  const safeName = scenario?.hacker ?? 'Operator';

  return <main className="storm-app" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as CSSProperties}>
    <header className="storm-header pico-appbar">
      <div className="pico-appbar-lead">
        <button type="button" className="storm-icon-button" aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={17}/></button>
        <div className="brand-lockup"><img className="brand-mark" src="/pico-logo.svg" alt="" width="24" height="24"/><span>Pico<span className="brand-period">.</span></span></div>
        <span className="pico-appbar-sep" aria-hidden="true">/</span>
        <strong className="pico-appbar-tool">Traffic Storm</strong>
      </div>
      <div className="storm-header-actions">
        <span className="storm-local"><span/> LOCAL MODEL</span>
        <button type="button" className="storm-icon-button" aria-label="About Traffic Storm" title="About this lab" onClick={() => setShowHelp(value => !value)}><CircleHelp size={17}/></button>
        <SoundButton/>
        <div className="storm-theme-wrap">
          <button type="button" className="storm-icon-button" aria-label="Change Traffic Storm theme" onClick={() => setThemeOpen(value => !value)}><Settings2 size={17}/></button>
          {themeOpen && <div className="storm-theme-popover"><ThemePicker value={themeId} onChange={id => { setThemeId(id); try { saveSettings({ ...loadSettings(), theme: id }); } catch { /* Keep session theme. */ } setThemeOpen(false); }}/></div>}
        </div>
      </div>
    </header>

    {mode === 'setup' ? <section className="storm-setup" aria-labelledby="storm-setup-title">
      <div className="storm-setup-orbit" aria-hidden="true"><div className="storm-orbit-core"><Server size={45}/></div>{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ transform: 'rotate(' + (i * 30) + 'deg) translateX(116px)' }}/>)}</div>
      <div className="storm-setup-title"><span className="storm-eyebrow"><Waves size={14}/> NETWORK LAB</span><h1 id="storm-setup-title">Traffic Storm<span>.</span></h1><p>Watch a fictional server handle a growing wave of requests.</p></div>
      <form onSubmit={start} className="storm-setup-form">
        <label>Operator name<input autoFocus type="text" maxLength={32} value={hacker} placeholder="Enter hacker name" onChange={event => setHacker(event.target.value)}/></label>
        <label>Botnet army size<span className="storm-field-sub">Simulated clients, not real devices</span><div className="storm-bot-field"><input type="number" min={100} max={20000} step={100} value={botsDraft} onChange={event => setBotsDraft(event.target.value)}/><Users size={17}/></div><input aria-label="Botnet army size slider" type="range" min={100} max={20000} step={100} value={Math.min(20000, Math.max(100, Number(botsDraft) || 100))} onChange={event => setBotsDraft(event.target.value)}/></label>
        <label>Server IP address<input type="text" inputMode="decimal" placeholder="203.0.113.10" value={ipDraft} onChange={event => setIpDraft(event.target.value)}/></label>
        {error && <p className="storm-error" role="alert">{error}</p>}
        <button type="submit" className="storm-primary"><Play size={17} fill="currentColor"/> Start simulation</button>
        <p className="storm-disclaimer"><Shield size={14}/> No real requests are made. IP addresses are displayed only.</p>
      </form>
    </section> : <>
      <section className="storm-intro">
        <div><span className="storm-eyebrow"><Activity size={14}/> LIVE TRAFFIC VISUALIZATION</span><h1>Traffic Storm<span>.</span></h1><p><strong>{safeName}</strong> · {compact(scenario?.bots ?? 0)} fictional bots · Target <code>{scenario?.ip}</code></p></div>
        <div className="storm-controls">
          {mode === 'offline' ? <button type="button" className="storm-primary" onClick={restart}><RotateCcw size={16}/> Restart server</button> : <button type="button" className="storm-primary" onClick={() => setMode(value => value === 'paused' ? 'running' : 'paused')}>{mode === 'paused' ? <Play size={16}/> : <Pause size={16}/>} {mode === 'paused' ? 'Resume' : 'Pause'}</button>}
          <button type="button" className="storm-secondary" onClick={newScenario}>New scenario</button>
        </div>
      </section>
      <section className="storm-metrics" aria-label="Simulation metrics">
        <div className="storm-metric"><span>SIMULATED REQUESTS / SEC</span><strong>{compact(mode === 'offline' ? 0 : stats.rps)}</strong><small>Server capacity: {compact(SERVER_CAPACITY)} / sec</small></div>
        <div className="storm-metric"><span>ACTIVE BOTNET</span><strong>{compact(scenario?.bots ?? 0)}</strong><small>Fictional client nodes</small></div>
        <div className="storm-metric"><span>CPU LOAD</span><strong>{cpu}%</strong><div className="storm-meter"><i style={{ width: cpu + '%' }}/></div></div>
        <div className="storm-metric"><span>SERVER HEALTH</span><strong className={stats.health < 35 ? 'storm-danger' : ''}>{Math.ceil(stats.health)}%</strong><div className="storm-meter"><i className="storm-health" style={{ width: stats.health + '%' }}/></div></div>
      </section>
      <div className="storm-main-grid">
        <section className="storm-panel storm-network" aria-label="Animated network traffic">
          <div className="storm-panel-heading"><div><h2>Network activity</h2><p>Requests moving from simulated bot nodes to the server</p></div><span className={'storm-status storm-status--' + status.toLowerCase()}><i/>{status}</span></div>
          <svg viewBox="0 0 960 375" className="storm-network-svg" role="img" aria-label={mode === 'offline' ? 'The fictional server is offline' : 'Animated fictional request packets flowing towards a server'}>
            <defs>
              <linearGradient id="storm-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent)" stopOpacity=".18"/><stop offset="1" stopColor="var(--accent)" stopOpacity=".75"/></linearGradient>
              <filter id="storm-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            {PACKET_PATHS.map((path, index) => <path key={'line-' + index} d={path} className="storm-path"/>)}
            {[70, 138, 240, 310].map((y, index) => <g key={y} className="storm-bot-node"><rect x="83" y={y - 26} width="100" height="52" rx="11"/><circle cx="112" cy={y} r="9"/><path d={'M 132 ' + (y - 6) + ' h 31 M 132 ' + (y + 6) + ' h 20'}/><text x="133" y={y - 34}>NODE 0{index + 1}</text></g>)}
            {mode === 'running' && Array.from({ length: 28 }, (_, index) => <circle key={index} className="storm-packet" r={index % 5 === 0 ? 4 : 2.8}><animateMotion path={PACKET_PATHS[index % 4]} dur={(1.5 + index % 5 * 0.24) + 's'} begin={(-index * 0.18) + 's'} repeatCount="indefinite"/></circle>)}
            <g className={'storm-server-graphic' + (mode === 'offline' ? ' is-offline' : '')}>
              <rect x="804" y="115" width="110" height="144" rx="16"/>
              <rect x="825" y="140" width="69" height="27" rx="5"/><rect x="825" y="179" width="69" height="27" rx="5"/><rect x="825" y="218" width="69" height="20" rx="5"/>
              {[152, 191, 228].map(y => <circle key={y} cx="839" cy={y} r="4" className="storm-led"/>)}
              <text x="859" y="105">WEB SERVER</text><text x="859" y="287">{status}</text>
            </g>
            {mode === 'offline' && <g className="storm-offline-symbol"><circle cx="859" cy="187" r="64"/><path d="M 841 169 L 877 205 M 877 169 L 841 205"/></g>}
          </svg>
          <div className="storm-network-foot"><span><i/> Simulated packets</span><span><i/> Server throughput</span><span>Elapsed {stats.seconds.toFixed(1)} s</span></div>
        </section>
        <aside className="storm-side">
          <section className="storm-panel storm-server-details">
            <div className="storm-panel-heading"><div><h2>Server monitor</h2><p>{scenario?.ip}</p></div><Server size={19}/></div>
            <div className={'storm-thermometer' + (mode === 'offline' ? ' storm-dead' : '')}><Server size={44}/><span>{mode === 'offline' ? 'CONNECTION LOST' : pressure >= 1 ? 'FANS AT MAX SPEED' : 'SYSTEM OPERATIONAL'}</span></div>
            <div className="storm-key-row"><span>Requests processed</span><strong>{compact(stats.total - stats.dropped)}</strong></div>
            <div className="storm-key-row"><span>Requests dropped</span><strong>{compact(stats.dropped)}</strong></div>
            <div className="storm-key-row"><span>Elapsed time</span><strong>{stats.seconds.toFixed(1)} s</strong></div>
            <div className="storm-key-row"><span>Protection</span><strong>Not enabled</strong></div>
          </section>
          <section className="storm-panel storm-event-panel"><div className="storm-panel-heading"><div><h2>Event log</h2><p>What is happening inside the model</p></div><ShieldAlert size={18}/></div>
            <ol aria-live="off">
              <li>00:00 · {safeName} started the model</li>
              {stats.rps > 0 && <li>{stats.seconds.toFixed(1)}s · {compact(stats.rps)} simulated requests/s</li>}
              {stats.rps > SERVER_CAPACITY && <li>Over capacity · Cooling fans spin up</li>}
              {stats.dropped > 0 && <li>Overload · Requests begin dropping</li>}
              {stats.health <= 35 && <li>Critical · Server health below 35%</li>}
              {mode === 'offline' && <li className="storm-log-alert">Shutdown · Site unavailable</li>}
              {mode === 'paused' && <li>Paused · Clock stopped</li>}
            </ol>
          </section>
        </aside>
      </div>
      <section className="storm-panel storm-chart-panel"><div className="storm-panel-heading"><div><h2>Traffic over time</h2><p>Generated locally from the size of the fictional botnet</p></div><strong>{compact(stats.rps)} req/s</strong></div><svg viewBox="0 0 600 115" preserveAspectRatio="none" aria-label="Recent simulated requests per second" role="img"><path d="M 0 104 H 600" className="storm-chart-axis"/><path d="M 0 53 H 600" className="storm-chart-axis"/>{points && <polyline points={points} className="storm-chart-line"/>}</svg><div className="storm-chart-footer"><span>Recent traffic</span><span>Higher bot counts create more simulated load</span></div></section>
      {mode === 'offline' && <div className="storm-outcome" role="status"><ShieldAlert size={22}/><div><strong>Server offline. The simulated website is unavailable.</strong><p>A request flood exceeded the server's synthetic capacity. Real services defend against overload with rate limits, traffic filtering and distributed protection.</p></div><button type="button" onClick={restart}>Try again</button></div>}
      <p className="storm-disclaimer storm-bottom-note"><Shield size={14}/> This is an educational, browser-only model. It does not contact the entered IP or generate network traffic.</p>
    </>}
    {showHelp && <div className="storm-dialog-backdrop" role="presentation" onClick={() => setShowHelp(false)}><section role="dialog" aria-modal="true" aria-labelledby="storm-help-heading" className="storm-dialog" onClick={event => event.stopPropagation()}><button type="button" aria-label="Close help" className="storm-dialog-close" onClick={() => setShowHelp(false)}><X size={17}/></button><h2 id="storm-help-heading">How Traffic Storm works</h2><p>The botnet size controls a synthetic requests-per-second number. Once simulated traffic exceeds server capacity, health declines until the website goes offline.</p><p>Packets, server failures and sound effects are generated entirely in your browser. The server IP is only text on the screen.</p><p>Small botnets might not overload the server. Increase the fictional bot count to compare outcomes.</p><button type="button" className="storm-primary" onClick={() => setShowHelp(false)}>Got it</button></section></div>}
  </main>;
}

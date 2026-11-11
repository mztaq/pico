import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, CircleHelp, Fan, Pause, Play, RotateCcw, Server, Settings2, Shield, Terminal, Users, X } from 'lucide-react';
import { SoundButton } from '../app/components/SoundToggle';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { soundEnabled } from '../app/sound';
import { loadSettings, saveSettings } from '../storage/settings';
import './traffic-storm.css';

const SERVER_CAPACITY = 3200;
const BITS_PER_REQUEST = 256000; // Explicit synthetic 32 kB average request size.
const PROXY_FILTER_RATIO = 0.82; // Simplified defensive reverse-proxy scenario, not a guarantee.
const BOT_Y = [70, 145, 225, 300] as const;
const DIRECT_PATHS = [
  'M 334 70 C 505 70 675 176 825 185',
  'M 334 145 C 545 145 690 180 825 185',
  'M 334 225 C 545 225 690 190 825 185',
  'M 334 300 C 505 300 675 194 825 185',
];
const TO_EDGE_PATHS = [
  'M 334 70 C 445 70 506 185 591 185',
  'M 334 145 C 440 145 510 185 591 185',
  'M 334 225 C 440 225 510 185 591 185',
  'M 334 300 C 445 300 506 185 591 185',
];
const THROUGH_EDGE_PATHS = TO_EDGE_PATHS.map(path => path + ' L 645 185 C 740 185 780 185 825 185');
const initialStats = () => ({ seconds: 0, health: 100, rps: 0, total: 0, blocked: 0, dropped: 0, history: [] as number[] });

export function forwardedRequests(rps: number, protectedByProxy: boolean): number {
  return Math.round(Math.max(0, rps) * (protectedByProxy ? 1 - PROXY_FILTER_RATIO : 1));
}

export function formatTraffic(rps: number): string {
  const gbps = Math.max(0, rps) * BITS_PER_REQUEST / 1e9;
  return gbps >= 1000 ? (gbps / 1000).toFixed(2) + ' Tbps' : gbps.toFixed(2) + ' Gbps';
}

type Scenario = { hacker: string; bots: number; ip: string };
type Mode = 'setup' | 'running' | 'paused' | 'offline';
type EffectName = 'start' | 'fan' | 'warning' | 'shutdown' | 'packet';

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
  const [proxyEnabled, setProxyEnabled] = useState(false);
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
      if (name === 'packet') {
        tone(430, 350, 0.038, 0.008, 0, 'triangle');
      } else if (name === 'start') {
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
        // No real traffic. Each displayed packet and number is a browser-only model.
        const ramp = Math.min(1, 0.18 + previous.seconds / 4);
        const variation = 0.96 + 0.045 * Math.sin(now / 330) + 0.035 * Math.sin(now / 860);
        const rps = Math.round(scenario.bots * 1.65 * variation * ramp);
        const forwarded = forwardedRequests(rps, proxyEnabled);
        const overload = forwarded / SERVER_CAPACITY;
        const health = Math.max(0, Math.min(100, previous.health - (overload > 1 ? (overload - 1) * 12 : -5) * dt));
        return {
          seconds: previous.seconds + dt,
          health, rps,
          total: previous.total + rps * dt,
          blocked: previous.blocked + (rps - forwarded) * dt,
          dropped: previous.dropped + Math.max(0, forwarded - SERVER_CAPACITY) * dt,
          history: [...previous.history.slice(-65), rps],
        };
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [mode, scenario, proxyEnabled]);

  // One quiet synthesized cue per on-screen packet group, capped below 10/s.
  // Thousands of modeled requests never become thousands of audio oscillators.
  useEffect(() => {
    if (mode !== 'running') return;
    const id = window.setInterval(() => {
      if (document.hidden || !audioRef.current) return;
      playEffect('packet');
    }, 130);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'running') return;
    if (forwardedRequests(stats.rps, proxyEnabled) > SERVER_CAPACITY && !fanPlayed.current) {
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
  }, [mode, stats.rps, stats.health, proxyEnabled]);

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

  const arriving = forwardedRequests(stats.rps, proxyEnabled);
  const pressure = arriving / SERVER_CAPACITY;
  const status = mode === 'offline' ? 'OFFLINE' : pressure >= 1 ? 'OVERLOADED' : stats.health < 65 ? 'DEGRADED' : 'ONLINE';
  const cpu = mode === 'offline' ? 0 : Math.round(Math.min(100, 14 + pressure * 72));
  const fanRpm = mode === 'offline' ? 0 : Math.round(800 + cpu * 49);
  const responseMs = mode === 'offline' ? null : Math.round(38 + Math.pow(pressure, 2) * 165);
  const trafficLabel = formatTraffic(stats.rps);
  const serverTrafficLabel = formatTraffic(arriving);
  const lastMessage = mode === 'offline' ? 'Target offline.' : proxyEnabled && pressure < 1 ? 'Protection is absorbing the flood.' : stats.health < 40 ? 'Target struggling to respond.' : stats.rps > 0 ? 'Traffic climbing.' : 'Botnet standing by.';
  const points = stats.history.map((value, index) => {
    const x = stats.history.length <= 1 ? 0 : index / (stats.history.length - 1) * 600;
    const y = 82 - Math.min(1, value / Math.max(6000, (scenario?.bots ?? 3000) * 1.9)) * 74;
    return String(x) + ',' + String(y);
  }).join(' ');
  const safeName = scenario?.hacker ?? 'Operator';

  return <main className={'storm-app' + (mode === 'setup' ? ' storm-start' : ' storm-in-session')} data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as CSSProperties}>
    <header className="storm-header pico-appbar">
      <div className="pico-appbar-lead">
        <button type="button" className="storm-icon-button" aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={17}/></button>
        <div className="brand-lockup"><img className="brand-mark" src="/pico-logo.svg" alt="" width="24" height="24"/><span>Pico<span className="brand-period">.</span></span></div>
        <span className="pico-appbar-sep" aria-hidden="true">/</span>
        <strong className="pico-appbar-tool">Traffic Storm</strong>
      </div>
      <div className="storm-header-actions">
        <button type="button" className="storm-icon-button" aria-label="About Traffic Storm" title="About this lab" onClick={() => setShowHelp(value => !value)}><CircleHelp size={17}/></button>
        <SoundButton/>
        <div className="storm-theme-wrap">
          <button type="button" className="storm-icon-button" aria-label="Change Traffic Storm theme" onClick={() => setThemeOpen(value => !value)}><Settings2 size={17}/></button>
          {themeOpen && <div className="storm-theme-popover"><ThemePicker value={themeId} onChange={id => { setThemeId(id); try { saveSettings({ ...loadSettings(), theme: id }); } catch { /* Session theme still updates. */ } setThemeOpen(false); }}/></div>}
        </div>
      </div>
    </header>

    {mode === 'setup' ? <section className="storm-setup" aria-labelledby="storm-setup-title">
      <div className="storm-setup-mark" aria-hidden="true"><Server size={35}/></div>
      <div className="storm-setup-title">
        <h1 id="storm-setup-title">Traffic Storm<span>.</span></h1>
        <p>See how a botnet floods a server, and what changes when a defensive reverse proxy filters traffic.</p>
      </div>
      <form onSubmit={start} className="storm-setup-form">
        <label>Hacker name<input autoFocus type="text" maxLength={32} value={hacker} placeholder="Enter hacker name" onChange={event => setHacker(event.target.value)}/></label>
        <label>Botnet army size<div className="storm-bot-field"><input type="number" min={100} max={20000} step={100} value={botsDraft} onChange={event => setBotsDraft(event.target.value)}/><Users size={17}/></div><input aria-label="Botnet army size slider" type="range" min={100} max={20000} step={100} value={Math.min(20000, Math.max(100, Number(botsDraft) || 100))} onChange={event => setBotsDraft(event.target.value)}/></label>
        <label>Server IP address<input type="text" inputMode="decimal" placeholder="203.0.113.10" value={ipDraft} onChange={event => setIpDraft(event.target.value)}/></label>
        <label className="storm-proxy-setup">
          <input type="checkbox" checked={proxyEnabled} onChange={event => setProxyEnabled(event.target.checked)}/>
          <span><strong>Reverse proxy protection</strong><small>Filter a modeled share of attack traffic before it reaches the web server.</small></span>
        </label>
        {error && <p className="storm-error" role="alert">{error}</p>}
        <button type="submit" className="storm-primary"><Play size={16} fill="currentColor"/> Start simulation</button>
        <p className="storm-disclaimer"><Shield size={14}/> Browser-only model. No requests are sent to the IP.</p>
      </form>
    </section> : <div className="storm-session">
      <div className="storm-intro">
        <div className="storm-titleline"><h1>Traffic Storm<span>.</span></h1><p>{safeName} · {compact(scenario?.bots ?? 0)} bots · <code>{scenario?.ip}</code></p></div>
        <div className="storm-controls">
          <button type="button" className={'storm-proxy-switch' + (proxyEnabled ? ' is-on' : '')} role="switch" aria-checked={proxyEnabled} aria-label="Reverse proxy protection" onClick={() => setProxyEnabled(value => !value)}><Shield size={15}/> Proxy {proxyEnabled ? 'ON' : 'OFF'}<span className="storm-toggle-track"><i/></span></button>
          {mode === 'offline' ? <button type="button" className="storm-primary" onClick={restart}><RotateCcw size={15}/> Restart</button> : <button type="button" className="storm-primary" onClick={() => setMode(value => value === 'paused' ? 'running' : 'paused')}>{mode === 'paused' ? <Play size={15}/> : <Pause size={15}/>} {mode === 'paused' ? 'Resume' : 'Pause'}</button>}
          <button type="button" className="storm-secondary" onClick={newScenario}>New scenario</button>
        </div>
      </div>

      <section className="storm-metrics" aria-label="Simulation metrics">
        <div className="storm-metric"><span>INCOMING TRAFFIC</span><strong>{trafficLabel}</strong><small>Modeled, 32 kB per request</small></div>
        <div className="storm-metric"><span>REACHING SERVER</span><strong>{serverTrafficLabel}</strong><small>{proxyEnabled ? '82% filtered by edge' : 'Direct traffic'}</small></div>
        <div className="storm-metric"><span>SERVER HEALTH</span><strong className={stats.health < 35 ? 'storm-danger' : ''}>{Math.ceil(stats.health)}%</strong><div className="storm-meter"><i className="storm-health" style={{ width: stats.health + '%' }}/></div></div>
        <div className="storm-metric"><span>RESPONSE TIME</span><strong>{responseMs === null ? 'OFFLINE' : responseMs + ' ms'}</strong><small>Modeled website response</small></div>
      </section>

      <div className="storm-main-grid">
        <div className="storm-left-stack">
          <section className="storm-panel storm-network" aria-label="Animated network traffic">
            <div className="storm-panel-heading"><div><h2>Network traffic</h2><p>Hacker → botnet → {proxyEnabled ? 'protective edge →' : ''} server</p></div><span className={'storm-status storm-status--' + status.toLowerCase()}><i/>{status}</span></div>
            <svg viewBox="0 0 1000 370" className="storm-network-svg" role="img" aria-label={proxyEnabled ? 'Simulated hacker, distributed botnet, defensive reverse proxy filtering requests, and target web server' : 'Simulated hacker controlling botnet clients sending requests directly to a web server'}>
              <defs><linearGradient id="storm-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent)" stopOpacity=".16"/><stop offset="1" stopColor="var(--accent)" stopOpacity=".75"/></linearGradient><filter id="storm-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <text x="77" y="25" className="storm-diagram-label">HACKER</text>
              <text x="282" y="25" className="storm-diagram-label">BOTNET · {compact(scenario?.bots ?? 0)}</text>
              <text x="871" y="25" className="storm-diagram-label">TARGET SERVER</text>
              {proxyEnabled && <><text x="617" y="25" className="storm-diagram-label">REVERSE PROXY</text><text x="617" y="44" className="storm-diagram-count">DEFENSIVE EDGE</text></>}
              {BOT_Y.map(y => <path key={'control-' + y} d={'M 113 180 C 166 180 176 ' + y + ' 224 ' + y} className="storm-controller-line"/>)}
              <g className="storm-hacker-node"><rect x="28" y="123" width="99" height="112" rx="15"/><path d="M 49 176 C 49 143 63 139 77 138 C 91 139 106 143 106 176 L 106 198 C 95 211 59 211 49 198 Z"/><path d="M 60 180 L 70 184 M 84 184 L 94 180"/><rect x="47" y="202" width="60" height="19" rx="4"/><text x="77" y="251">{safeName.slice(0, 12)}</text></g>
              {BOT_Y.map((y, index) => <g key={y} className="storm-bot-node"><rect x="224" y={y - 22} width="110" height="44" rx="9"/><circle cx="245" cy={y} r="7"/><path d={'M 264 ' + (y - 6) + ' h 44 M 264 ' + (y + 6) + ' h 29'}/><text x="281" y={y - 30}>BOT 0{index + 1}</text></g>)}
              {(proxyEnabled ? TO_EDGE_PATHS : DIRECT_PATHS).map((path, index) => <path key={index} d={path} className="storm-path"/>)}
              {proxyEnabled && <path d="M 645 185 L 825 185" className="storm-path storm-accepted-path"/>}
              {proxyEnabled && <g className="storm-proxy-edge"><rect x="590" y="133" width="55" height="104" rx="12"/><path d="M 617 149 L 636 158 V 179 Q 635 195 617 205 Q 598 195 598 179 V 158 Z"/><path d="M 607 176 L 614 183 L 628 167"/><text x="617" y="254">FILTERING</text></g>}
              {mode === 'running' && Array.from({ length: 30 }, (_, index) => <circle key={index} className={'storm-packet' + (proxyEnabled && index % 5 !== 0 ? ' is-filtered' : '')} r={index % 4 === 0 ? 4 : 2.7}><animateMotion path={proxyEnabled ? (index % 5 === 0 ? THROUGH_EDGE_PATHS[index % 4] : TO_EDGE_PATHS[index % 4]) : DIRECT_PATHS[index % 4]} dur={(1.1 + index % 6 * 0.16) + 's'} begin={(-index * 0.12) + 's'} repeatCount="indefinite"/></circle>)}
              <g className={'storm-server-graphic' + (mode === 'offline' ? ' is-offline' : stats.health <= 35 ? ' is-critical' : '')}>
                <rect x="825" y="126" width="99" height="118" rx="13"/>
                <rect x="841" y="146" width="67" height="24" rx="4"/><rect x="841" y="181" width="67" height="24" rx="4"/><rect x="841" y="216" width="67" height="14" rx="4"/>
                {[157,192,222].map(y => <circle key={y} cx="851" cy={y} r="3.2" className="storm-led"/>)}
                <text x="875" y="266">{status}</text>
              </g>
              {mode === 'offline' && <g className="storm-offline-symbol"><circle cx="875" cy="183" r="58"/><path d="M 857 165 L 893 201 M 893 165 L 857 201"/></g>}
            </svg>
            <div className="storm-network-foot"><span><i/> Packets represent traffic batches</span><span>{proxyEnabled ? 'Reverse proxy filters modeled requests' : 'Direct server traffic'}</span><span>{stats.seconds.toFixed(1)}s</span></div>
          </section>

          <section className="storm-panel storm-chart-panel" aria-label="Simulated bandwidth history">
            <div className="storm-chart-top"><span>Traffic history</span><strong>{trafficLabel}</strong></div>
            <svg viewBox="0 0 600 88" preserveAspectRatio="none" role="img" aria-label="Modeled incoming traffic over time"><path d="M 0 82 H 600 M 0 45 H 600" className="storm-chart-axis"/>{points && <polyline points={points} className="storm-chart-line"/>}</svg>
          </section>
        </div>

        <aside className="storm-side">
          <section className="storm-panel storm-server-details">
            <div className="storm-panel-heading"><div><h2>Server response</h2><p>{scenario?.ip}</p></div><Server size={18}/></div>
            <div className="storm-system-health">
              <div className={'storm-server-icon' + (mode === 'offline' ? ' is-offline' : '')}><Server size={32}/></div>
              <div><span>WEBSITE STATUS</span><strong className={mode === 'offline' ? 'storm-danger' : ''}>{status}</strong><small>{mode === 'offline' ? 'Connection lost' : 'Response: ' + responseMs + ' ms'}</small></div>
              <div className={'storm-fan' + (fanRpm === 0 ? ' stopped' : '')} style={{ '--storm-fan-duration': fanRpm ? Math.max(0.18, 2.8 - fanRpm / 1700).toFixed(2) + 's' : '1s' } as CSSProperties}><Fan size={31}/><strong>{compact(fanRpm)} RPM</strong><small>FAN SPEED</small></div>
            </div>
            <div className="storm-cpu-row"><span>CPU load</span><strong>{cpu}%</strong></div>
            <div className="storm-meter"><i style={{width:cpu+'%'}}/></div>
            <div className={'storm-site-preview' + (mode === 'offline' ? ' is-offline' : '')}>
              <div className="storm-site-head"><span className="storm-site-led"/><span>example.test</span><strong>{mode === 'offline' ? '503' : responseMs !== null && responseMs > 300 ? 'SLOW' : '200'}</strong></div>
              <p>{mode === 'offline' ? 'Website unavailable' : responseMs !== null && responseMs > 300 ? 'Website responding slowly' : 'Website responding'}</p>
            </div>
            <div className="storm-edge-caption">{proxyEnabled ? 'Reverse proxy filtering 82% of modeled traffic. Protection reduces load but is not guaranteed.' : 'No edge protection. The web server receives all modeled incoming traffic.'}</div>
          </section>
          <section className="storm-panel storm-console-panel">
            <div className="storm-panel-heading"><div><h2>Operator console</h2><p>Fictional CLI</p></div><Terminal size={18}/></div>
            <div className="storm-console" role="log" aria-live="off">
              <div><span className="storm-terminal-prompt">hacker@sim:~$</span> monitor {scenario?.ip}</div>
              <div><span className="storm-terminal-muted">botnet</span> {compact(scenario?.bots ?? 0)} nodes connected</div>
              <div><span className="storm-terminal-muted">proxy</span> {proxyEnabled ? 'protection enabled' : 'protection disabled'}</div>
              <div><span className="storm-terminal-muted">traffic</span> {trafficLabel} · {compact(stats.rps)} modeled req/s</div>
              <div><span className="storm-terminal-muted">filtered</span> {compact(stats.blocked)} · dropped {compact(stats.dropped)}</div>
              <div><span className={mode === 'offline' ? 'storm-danger' : 'storm-terminal-muted'}>server</span> {status}</div>
              <div className="storm-operator-message"><strong>{safeName}:</strong> {lastMessage}</div>
              <div className="storm-console-prompt"><span>hacker@sim:~$</span><i className="storm-console-caret" aria-hidden="true"/></div>
            </div>
          </section>
        </aside>
      </div>
      <footer className="storm-session-footer"><span>Educational simulation. No network requests are sent.</span><span>{proxyEnabled ? 'Defensive reverse proxy on' : 'No reverse proxy protection'} · {stats.seconds.toFixed(1)}s</span></footer>
    </div>}
    {showHelp && <div className="storm-dialog-backdrop" role="presentation" onClick={() => setShowHelp(false)}><section role="dialog" aria-modal="true" aria-labelledby="storm-help-heading" className="storm-dialog" onClick={event => event.stopPropagation()}><button type="button" aria-label="Close help" className="storm-dialog-close" onClick={() => setShowHelp(false)}><X size={17}/></button><h2 id="storm-help-heading">How Traffic Storm works</h2><p>A hacker controls fictional botnet nodes sending simulated traffic. The modeled website becomes slower or goes offline if incoming requests exceed server capacity.</p><p>Toggle reverse proxy protection to compare direct traffic with a simplified edge filter. A reverse proxy or CDN often helps defend a service against DDoS traffic, but it is not a guaranteed defence. The model assumes an illustrative 82% filtering rate.</p><p>Bandwidth assumes 32 kB per modeled request. Packet animations represent groups of requests. Console lines, audio and website responses are fictional, and the IP is never contacted.</p><button type="button" className="storm-primary" onClick={() => setShowHelp(false)}>Got it</button></section></div>}
  </main>;
}

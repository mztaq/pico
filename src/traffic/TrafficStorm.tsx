import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, CircleHelp, Minus, Pause, Play, Plus, RotateCcw, Server, Settings2, Shield, Users, X } from 'lucide-react';
import { SoundButton } from '../app/components/SoundToggle';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { onSoundChange, soundEnabled } from '../app/sound';
import { loadSettings, saveSettings } from '../storage/settings';
import './traffic-storm.css';

const SERVER_CAPACITY = 3200;
const BITS_PER_REQUEST = 4_194_304; // Fictional 512 KiB traffic unit; not measured bandwidth.
const BOT_REQUEST_RATE = 16; // Fictional average requests per bot per second.
const BOT_Y = [70, 145, 225, 300] as const;
const networkPositions = (count: number): number[] =>
  Array.from({length:count}, (_, i) => 370 * (i + 1) / (count + 1));

function packetPath(bot: number, serverY: number, proxyY: number | null, blocked = false): string {
  const y = BOT_Y[bot % BOT_Y.length];
  if (proxyY === null) return 'M 334 ' + y + ' C 545 ' + y + ' 670 ' + serverY + ' 825 ' + serverY;
  const incoming = 'M 334 ' + y + ' C 465 ' + y + ' 518 ' + proxyY + ' 591 ' + proxyY;
  return blocked ? incoming : incoming + ' L 645 ' + proxyY + ' C 733 ' + proxyY + ' 759 ' + serverY + ' 825 ' + serverY;
}
const initialStats = () => ({ seconds: 0, health: 100, rps: 0, total: 0, blocked: 0, dropped: 0, history: [] as number[] });

/** Slow 16-second startup, easing at both ends. */
export function trafficRamp(seconds: number): number {
  const progress = Math.max(0, Math.min(1, seconds / 16));
  return 0.003 + 0.997 * progress * progress * (3 - 2 * progress);
}

/** Simplified defensive filter with diminishing returns, not a guaranteed protection rate. */
export function proxyFilterRatio(count: number): number {
  const n = Math.max(0, Math.min(4, Math.floor(count) || 0));
  return 1 - Math.pow(0.6, n);
}

export function forwardedRequests(rps: number, proxies: number): number {
  return Math.round(Math.max(0, rps) * (1 - proxyFilterRatio(proxies)));
}

export function serverPressure(rps: number, proxies: number, servers: number): number {
  const count = Math.max(1, Math.min(4, Math.floor(servers) || 1));
  return forwardedRequests(rps, proxies) / (SERVER_CAPACITY * count);
}

export function modeledPing(ip: string, responseMs: number | null): string {
  return responseMs === null
    ? 'Request timed out (simulation)'
    : 'Reply from ' + ip + ': ' + responseMs + ' ms (simulation)';
}

export function formatTraffic(rps: number): string {
  const gbps = Math.max(0, rps) * BITS_PER_REQUEST / 1e9;
  return gbps >= 1000 ? (gbps / 1000).toFixed(2) + ' Tbps' : gbps.toFixed(2) + ' Gbps';
}

type Scenario = { hacker: string; bots: number; ip: string };
type Mode = 'setup' | 'running' | 'paused' | 'offline';
type EffectName = 'start' | 'warning' | 'shutdown' | 'packet';
type CoolingAudio = { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; hum: OscillatorNode; humGain: GainNode };

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
  const [proxyCount, setProxyCount] = useState(0);
  const [serverCount, setServerCount] = useState(1);
  const [pingCommand, setPingCommand] = useState('ping');
  const [pingOutput, setPingOutput] = useState<string | null>(null);
  const proxyEnabled = proxyCount > 0;
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [mode, setMode] = useState<Mode>('setup');
  const [stats, setStats] = useState(initialStats);
  const [showHelp, setShowHelp] = useState(false);
  const [themeId, setThemeId] = useState(() => loadSettings().theme);
  const [themeOpen, setThemeOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEnabled);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const theme = getTheme(themeId);
  const audioRef = useRef<AudioContext | null>(null);
  const coolingRef = useRef<CoolingAudio | null>(null);
  const warningPlayed = useRef(false);
  const lastFrame = useRef(0);
  const arriving = forwardedRequests(stats.rps, proxyCount);
  const pressure = arriving / (SERVER_CAPACITY * serverCount);
  const cpu = mode === 'offline' ? 0 : Math.round(Math.min(100, 14 + pressure * 72));

  useEffect(() => {
    for (const [key, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(key, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);

  useEffect(() => onSoundChange(setSoundOn), []);

  useEffect(() => {
    const handleVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => () => {
    const fan = coolingRef.current;
    if (fan) {
      try { fan.source.stop(); fan.hum.stop(); } catch { /* Already stopped. */ }
      coolingRef.current = null;
    }
    if (audioRef.current) void audioRef.current.close();
  }, []);

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
        tone(430, 350, 0.038, 0.016, 0, 'triangle');
      } else if (name === 'start') {
        tone(220, 480, 0.23, 0.035);
        tone(380, 660, 0.25, 0.028, 0.12);
      } else if (name === 'warning') {
        tone(600, 420, 0.2, 0.045);
        tone(600, 420, 0.2, 0.045, 0.32);
      } else {
        tone(260, 42, 1.55, 0.082, 0, 'sawtooth');
        tone(120, 32, 1.7, 0.042, 0.15, 'triangle');
      }
    } catch { /* Sound is optional and never blocks the model. */ }
  }

  // Continuous synthesized fan: filtered motor noise and low hum that follow CPU load.
  // Keep one fan pair alive per run, rather than making a new oscillator per frame.
  useEffect(() => {
    const active = mode === 'running' && soundOn && pageVisible;
    if (!active) {
      const fan = coolingRef.current;
      if (fan && audioRef.current) {
        coolingRef.current = null;
        const at = audioRef.current.currentTime;
        fan.gain.gain.setTargetAtTime(0.0001, at, 0.04);
        fan.humGain.gain.setTargetAtTime(0.0001, at, 0.04);
        try { fan.source.stop(at + 0.25); fan.hum.stop(at + 0.25); }
        catch { /* Already stopped. */ }
      }
      return;
    }
    if (typeof window.AudioContext === 'undefined') return;
    try {
      const ctx = audioRef.current ?? new window.AudioContext();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      if (!coolingRef.current) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        let lowNoise = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const white = Math.random() * 2 - 1;
          lowNoise = lowNoise * 0.96 + white * 0.04;
          samples[i] = lowNoise * 1.2 + white * 0.23;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        source.connect(filter).connect(gain).connect(ctx.destination);

        const hum = ctx.createOscillator();
        hum.type = 'triangle';
        hum.frequency.value = 75;
        const humGain = ctx.createGain();
        humGain.gain.value = 0.0001;
        hum.connect(humGain).connect(ctx.destination);
        source.start();
        hum.start();
        coolingRef.current = { source, filter, gain, hum, humGain };
      }
      const fan = coolingRef.current;
      const now = ctx.currentTime;
      const load = cpu / 100;
      fan.filter.frequency.setTargetAtTime(160 + load * 1100, now, 0.55);
      fan.source.playbackRate.setTargetAtTime(0.65 + load * 0.9, now, 0.55);
      fan.gain.gain.setTargetAtTime(0.002 + Math.pow(load, 1.6) * 0.18, now, 0.6);
      fan.hum.frequency.setTargetAtTime(48 + load * 135, now, 0.55);
      fan.humGain.gain.setTargetAtTime(0.001 + Math.pow(load, 1.5) * 0.022, now, 0.6);
    } catch { /* Unsupported audio never blocks the simulation. */ }
  }, [mode, soundOn, pageVisible, cpu]);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPingOutput(null);
    const bots = Number(botsDraft);
    if (!hacker.trim()) { setError('Give the operator a name.'); return; }
    if (!Number.isInteger(bots) || bots < 100 || bots > 20000) { setError('Choose between 100 and 20,000 fictional bots.'); return; }
    if (!validIPv4(ipDraft.trim())) { setError('Enter an IPv4 address with four numbers between 0 and 255.'); return; }
    setScenario({ hacker: hacker.trim().slice(0, 32), bots, ip: ipDraft.trim() });
    setStats(initialStats());
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
        const ramp = trafficRamp(previous.seconds);
        const variation = 0.96 + 0.045 * Math.sin(now / 330) + 0.035 * Math.sin(now / 860);
        const rps = Math.round(scenario.bots * BOT_REQUEST_RATE * variation * ramp);
        const forwarded = forwardedRequests(rps, proxyCount);
        const overload = forwarded / (SERVER_CAPACITY * serverCount);
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
  }, [mode, scenario, proxyCount, serverCount]);

  // Throttle packet sounds and increase their frequency across the gradual ramp.
  // These represent visible packet groups, never individual real requests.
  const packetAudioStep = Math.floor(trafficRamp(stats.seconds) * 6);
  useEffect(() => {
    if (mode !== 'running') return;
    const intervalMs = Math.max(140, 630 - packetAudioStep * 80);
    const id = window.setInterval(() => {
      if (document.hidden || !audioRef.current) return;
      playEffect('packet');
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [mode, packetAudioStep]);

  useEffect(() => {
    if (mode !== 'running') return;
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
    setPingOutput(null);
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
    setPingOutput(null);
  }

  function runPing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = pingCommand.trim();
    if (value !== 'ping' && value !== 'ping ' + scenario?.ip) {
      setPingOutput('Use ping or ping ' + scenario?.ip + ' (simulated target only)');
      return;
    }
    setPingOutput(modeledPing(scenario?.ip ?? '0.0.0.0', mode === 'offline' ? null : responseMs));
  }

  const status = mode === 'offline' ? 'OFFLINE' : pressure >= 1 ? 'OVERLOADED' : stats.health < 65 ? 'DEGRADED' : 'ONLINE';
  const responseMs = mode === 'offline' ? null : Math.round(38 + Math.pow(pressure, 2) * 165);
  const trafficLabel = formatTraffic(stats.rps);
  const serverTrafficLabel = formatTraffic(arriving);
  const points = stats.history.map((value, index) => {
    const x = stats.history.length <= 1 ? 0 : index / (stats.history.length - 1) * 600;
    const y = 82 - Math.min(1, value / Math.max(6000, (scenario?.bots ?? 3000) * 1.9)) * 74;
    return String(x) + ',' + String(y);
  }).join(' ');
  const safeName = scenario?.hacker ?? 'Operator';
  const visiblePacketCount = Math.max(1, Math.round(30 * trafficRamp(stats.seconds)));
  const serverYs = networkPositions(serverCount);
  const proxyYs = networkPositions(proxyCount);
  const filterRatio = proxyFilterRatio(proxyCount);
  const fanDuration = Math.max(0.26, 3.1 - cpu / 39).toFixed(2) + 's';

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
        <div className="storm-config-pair">
          <div className="storm-stepper"><span>Web servers</span><div><button type="button" aria-label="Remove web server" disabled={serverCount <= 1} onClick={() => setServerCount(value => Math.max(1, value - 1))}><Minus size={15}/></button><strong>{serverCount}</strong><button type="button" aria-label="Add web server" disabled={serverCount >= 4} onClick={() => setServerCount(value => Math.min(4, value + 1))}><Plus size={15}/></button></div></div>
          <div className="storm-stepper"><span>Defensive proxies</span><div><button type="button" aria-label="Remove defensive proxy" disabled={proxyCount <= 0} onClick={() => setProxyCount(value => Math.max(0, value - 1))}><Minus size={15}/></button><strong>{proxyCount}</strong><button type="button" aria-label="Add defensive proxy" disabled={proxyCount >= 4} onClick={() => setProxyCount(value => Math.min(4, value + 1))}><Plus size={15}/></button></div></div>
        </div>
        {error && <p className="storm-error" role="alert">{error}</p>}
        <button type="submit" className="storm-primary"><Play size={16} fill="currentColor"/> Start simulation</button>
        <p className="storm-disclaimer"><Shield size={14}/> Browser-only model. No requests are sent to the IP.</p>
      </form>
    </section> : <div className="storm-session">
      <div className="storm-intro">
        <div className="storm-titleline"><h1>Traffic Storm<span>.</span></h1><p>{safeName} · {compact(scenario?.bots ?? 0)} bots · <code>{scenario?.ip}</code></p></div>
        <div className="storm-controls">
          <div className="storm-live-steppers">
            <div><span>Servers</span><button type="button" aria-label="Remove web server" disabled={serverCount <= 1} onClick={() => setServerCount(value => Math.max(1, value - 1))}><Minus size={13}/></button><strong>{serverCount}</strong><button type="button" aria-label="Add web server" disabled={serverCount >= 4} onClick={() => setServerCount(value => Math.min(4, value + 1))}><Plus size={13}/></button></div>
            <div><span>Proxies</span><button type="button" aria-label="Remove defensive proxy" disabled={proxyCount <= 0} onClick={() => setProxyCount(value => Math.max(0, value - 1))}><Minus size={13}/></button><strong>{proxyCount}</strong><button type="button" aria-label="Add defensive proxy" disabled={proxyCount >= 4} onClick={() => setProxyCount(value => Math.min(4, value + 1))}><Plus size={13}/></button></div>
          </div>
          {mode === 'offline' ? <button type="button" className="storm-primary" onClick={restart}><RotateCcw size={15}/> Restart</button> : <button type="button" className="storm-primary" onClick={() => setMode(value => value === 'paused' ? 'running' : 'paused')}>{mode === 'paused' ? <Play size={15}/> : <Pause size={15}/>} {mode === 'paused' ? 'Resume' : 'Pause'}</button>}
          <button type="button" className="storm-secondary" onClick={newScenario}>New scenario</button>
        </div>
      </div>

      <section className="storm-metrics" aria-label="Simulation metrics">
        <div className="storm-metric"><span>INCOMING TRAFFIC</span><strong>{trafficLabel}</strong></div>
        <div className="storm-metric"><span>REACHING SERVERS</span><strong>{serverTrafficLabel}</strong><small>{proxyEnabled ? Math.round(filterRatio * 100) + '% filtered' : 'Unfiltered'}</small></div>
        <div className="storm-metric"><span>SERVER HEALTH</span><strong className={stats.health < 35 ? 'storm-danger' : ''}>{Math.ceil(stats.health)}%</strong><div className="storm-meter"><i className="storm-health" style={{ width: stats.health + '%' }}/></div></div>
        <div className="storm-metric"><span>RESPONSE TIME</span><strong>{responseMs === null ? 'OFFLINE' : responseMs + ' ms'}</strong></div>
      </section>

      <div className="storm-main-grid">
        <div className="storm-left-stack">
          <section className="storm-panel storm-network" aria-label="Animated network traffic">
            <div className="storm-panel-heading"><div><h2>Network traffic</h2></div><span className={'storm-status storm-status--' + status.toLowerCase()}><i/>{status}</span></div>
            <svg viewBox="0 0 1000 370" className="storm-network-svg" role="img" aria-label={'Fictional hacker and botnet feeding ' + proxyCount + ' defensive proxy nodes and ' + serverCount + ' web servers'}>
              <defs><linearGradient id="storm-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent)" stopOpacity=".16"/><stop offset="1" stopColor="var(--accent)" stopOpacity=".75"/></linearGradient><filter id="storm-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <text x="77" y="25" className="storm-diagram-label">HACKER</text>
              <text x="282" y="25" className="storm-diagram-label">BOTNET · {compact(scenario?.bots ?? 0)}</text>
              <text x="881" y="25" className="storm-diagram-label">WEB SERVERS · {serverCount}</text>
              {proxyEnabled && <text x="617" y="25" className="storm-diagram-label">PROXIES · {proxyCount}</text>}
              {BOT_Y.map(y => <path key={'controller-' + y} d={'M 113 180 C 166 180 176 ' + y + ' 224 ' + y} className="storm-controller-line"/>)}
              <g className="storm-hacker-node"><rect x="28" y="123" width="99" height="112" rx="15"/><path d="M 49 176 C 49 143 63 139 77 138 C 91 139 106 143 106 176 L 106 198 C 95 211 59 211 49 198 Z"/><path d="M 60 180 L 70 184 M 84 184 L 94 180"/><rect x="47" y="202" width="60" height="19" rx="4"/><text x="77" y="251">{safeName.slice(0, 12)}</text></g>
              {BOT_Y.map((y, index) => <g key={y} className="storm-bot-node"><rect x="224" y={y - 22} width="110" height="44" rx="9"/><circle cx="245" cy={y} r="7"/><path d={'M 264 ' + (y - 6) + ' h 44 M 264 ' + (y + 6) + ' h 29'}/><text x="281" y={y - 30}>BOT 0{index + 1}</text></g>)}
              {BOT_Y.map((_, index) => <path key={index} d={packetPath(index, serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null)} className="storm-path"/>)}
              {proxyYs.map((y, index) => <g key={'proxy-' + index} className="storm-proxy-edge"><rect x="591" y={y - 24} width="54" height="48" rx="10"/><path d={'M 618 ' + (y - 15) + ' l 15 6 v 13 q -2 12 -15 19 q -13 -7 -15 -19 v -13 Z'}/><path d={'M 608 ' + (y - 1) + ' l 7 7 l 14 -15'}/><text x="618" y={y + 37}>P{index + 1}</text></g>)}
              {mode === 'running' && Array.from({length:visiblePacketCount}, (_, index) => {
                const blocked = proxyEnabled && index % 100 < Math.round(filterRatio * 100);
                const path = packetPath(index % 4, serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null, blocked);
                return <circle key={index} className={'storm-packet' + (blocked ? ' is-filtered' : '')} r={index % 4 === 0 ? 3.9 : 2.6}><animateMotion path={path} dur={(1.1 + index % 6 * 0.16) + 's'} begin={(-index * 0.12) + 's'} repeatCount="indefinite"/></circle>;
              })}
              {serverYs.map((y, index) => <g key={'server-'+index} className={'storm-server-graphic' + (mode === 'offline' ? ' is-offline' : stats.health <= 35 ? ' is-critical' : '')}>
                <rect x="825" y={y - 27} width="112" height="54" rx="9"/>
                <rect x="838" y={y - 15} width="48" height="11" rx="3"/><rect x="838" y={y + 4} width="48" height="11" rx="3"/>
                {[y - 9, y + 10].map(ledY => <circle key={ledY} cx="845" cy={ledY} r="2.8" className="storm-led"/>)}
                <g transform={'translate(908 ' + y + ')'} className={'storm-rack-fan' + (mode !== 'running' ? ' is-stopped' : '')} style={{'--storm-fan-duration': fanDuration} as CSSProperties}>
                  <circle r="12" className="storm-fan-ring"/>
                  <g className="storm-fan-rotor"><path d="M 0 -8 Q 8 -12 5 -3 L 1 0 Q 12 -8 10 2 L 2 2 Q 10 9 0 9 L 0 2 Q -9 11 -10 0 L -2 0 Q -10 -8 0 -8 Z"/></g>
                  <circle r="2" className="storm-fan-hub"/>
                </g>
                <text x="881" y={y + 40}>SERVER {index + 1}</text>
              </g>)}
              {mode === 'offline' && <text x="881" y="362" className="storm-offline-caption">WEBSITE OFFLINE</text>}
            </svg>
            <div className="storm-network-foot"><span><i/> Simulated traffic</span><span>{serverCount} servers · {proxyCount} proxies</span><span>{stats.seconds.toFixed(1)}s</span></div>
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
              <div><span>WEBSITE STATUS</span><strong className={mode === 'offline' ? 'storm-danger' : ''}>{status}</strong><small>{mode === 'offline' ? 'Unreachable' : responseMs + ' ms · ' + serverCount + ' servers'}</small></div>
            </div>
            <div className="storm-cpu-row"><span>CPU load per server</span><strong>{cpu}%</strong></div>
            <div className="storm-meter"><i style={{width:cpu+'%'}}/></div>
            <div className="storm-node-count"><span><Server size={14}/> {serverCount} web servers</span><span><Shield size={14}/> {proxyCount} proxies</span></div>
            <div className={'storm-site-preview' + (mode === 'offline' ? ' is-offline' : '')}>
              <div className="storm-site-head"><span className="storm-site-led"/><span>example.test</span><strong>{mode === 'offline' ? '503' : responseMs !== null && responseMs > 300 ? 'SLOW' : '200'}</strong></div>
              <p>{mode === 'offline' ? 'Website unavailable' : responseMs !== null && responseMs > 300 ? 'Responding slowly' : 'Website responding'}</p>
            </div>
            <form className="storm-ping-form" onSubmit={runPing} aria-label="Simulated ping command">
              <div className="storm-ping-command"><span>$</span><input value={pingCommand} onChange={event => setPingCommand(event.target.value)} aria-label="Ping command" placeholder="ping" spellCheck={false}/></div>
              <button type="submit">Ping</button>
            </form>
            <p className="storm-ping-result" role="status">{pingOutput ?? 'Ping the simulated server to check its response.'}</p>
          </section>
        </aside>
      </div>
      <footer className="storm-session-footer"><span>Browser-only simulation. No packets sent.</span><span>{stats.seconds.toFixed(1)}s</span></footer>
    </div>}
    {showHelp && <div className="storm-dialog-backdrop" role="presentation" onClick={() => setShowHelp(false)}><section role="dialog" aria-modal="true" aria-labelledby="storm-help-heading" className="storm-dialog" onClick={event => event.stopPropagation()}><button type="button" aria-label="Close help" className="storm-dialog-close" onClick={() => setShowHelp(false)}><X size={17}/></button><h2 id="storm-help-heading">How Traffic Storm works</h2><p>A hacker controls fictional botnet nodes sending simulated traffic. The modeled website becomes slower or goes offline if incoming requests exceed server capacity.</p><p>Choose 1–4 web servers to share the simulated load, and 0–4 defensive proxies to filter it. This model illustrates diminishing returns across proxy layers. Real DDoS protection varies and is not guaranteed by adding proxies or servers.</p><p>Traffic uses fictional units of 512 KiB and 16 requests per bot per second. The ping command reports modeled latency without contacting the address. Audio and animations are generated in your browser.</p><button type="button" className="storm-primary" onClick={() => setShowHelp(false)}>Got it</button></section></div>}
  </main>;
}

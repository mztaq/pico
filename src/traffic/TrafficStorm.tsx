import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, CircleHelp, Minus, Pause, Play, Plus, RotateCcw, Server, ServerCog, Settings2, Shield, Users, X } from 'lucide-react';
import { SoundButton } from '../app/components/SoundToggle';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { onSoundChange, soundEnabled } from '../app/sound';
import { loadSettings, saveSettings } from '../storage/settings';
import './traffic-storm.css';

const SERVER_CAPACITY = 3200;
const BITS_PER_REQUEST = 4_194_304; // Fictional 512 KiB traffic unit; not measured bandwidth.
const BOT_REQUEST_RATE = 16; // Fictional average requests per bot per second.
const PROXY_CAPACITY = 100_000; // Synthetic requests per second handled by each edge node.
const BOT_Y = [65, 130, 195, 260] as const;
const REAL_USER_Y = 326;
const LEGITIMATE_RPS = 125;
const networkPositions = (count: number): number[] =>
  Array.from({length:count}, (_, i) => 370 * (i + 1) / (count + 1));

function packetPath(bot: number, serverY: number, proxyY: number | null, blocked = false): string {
  const y = BOT_Y[bot % BOT_Y.length];
  if (proxyY === null) return 'M 334 ' + y + ' C 545 ' + y + ' 670 ' + serverY + ' 825 ' + serverY;
  const incoming = 'M 334 ' + y + ' C 465 ' + y + ' 518 ' + proxyY + ' 591 ' + proxyY;
  return blocked ? incoming : incoming + ' L 645 ' + proxyY + ' C 733 ' + proxyY + ' 759 ' + serverY + ' 825 ' + serverY;
}

/** Deterministic per-node load with slightly uneven load-balancer allocation. */
export function nodeLoadRatio(rps: number, count: number, index: number, capacity: number): number {
  const n = Math.max(1, Math.min(4, Math.floor(count) || 1));
  if (!Number.isInteger(index) || index < 0 || index >= n || capacity <= 0) return 0;
  const weights = [0.94, 1.08, 0.89, 1.09];
  const totalWeight = weights.slice(0, n).reduce((total, weight) => total + weight, 0);
  return Math.max(0, rps) * weights[index] / totalWeight / capacity;
}

/** Fictional per-second HTTP responses; 404 is a separate missing-path check,
 * not an effect caused by a DDoS flood. */
export function httpOutcomes(rps: number, proxies: number, servers: number, offline: boolean) {
  const forwarded = forwardedRequests(rps, proxies);
  const deniedAtEdge = Math.max(0, rps - forwarded);
  const rateLimited = Math.round(deniedAtEdge * 0.72);
  const overflow = Math.max(0, forwarded - servers * SERVER_CAPACITY);
  const unavailable = offline ? forwarded : Math.round(overflow * 0.26);
  const timeout = offline ? 0 : Math.round(overflow * 0.15);
  const notFound = offline ? 0 : 1;
  const success = offline ? 0 : Math.max(0, forwarded - unavailable - timeout - notFound);
  return { ok: success, rateLimited, notFound, unavailable, timeout };
}

function userPacketPath(serverY: number, proxyY: number | null, fromEdge = false): string {
  if (proxyY === null) return 'M 340 ' + REAL_USER_Y + ' C 550 325 710 ' + serverY + ' 825 ' + serverY;
  if (fromEdge) return 'M 645 ' + proxyY + ' C 741 ' + proxyY + ' 760 ' + serverY + ' 825 ' + serverY;
  return 'M 340 ' + REAL_USER_Y + ' C 470 328 520 ' + proxyY + ' 591 ' + proxyY;
}

function acceptedAttackPath(serverY: number, proxyY: number): string {
  return 'M 645 ' + proxyY + ' C 728 ' + proxyY + ' 776 ' + serverY + ' 825 ' + serverY;
}

const initialStats = () => ({ seconds: 0, health: 100, rps: 0, total: 0, blocked: 0, dropped: 0, history: [] as number[] });

/** Slow 16-second startup, easing at both ends. */
export function trafficRamp(seconds: number): number {
  const progress = Math.max(0, Math.min(1, seconds / 16));
  return 0.003 + 0.997 * progress * progress * (3 - 2 * progress);
}

/** Illustrative clean-traffic filtering before capacity constraints. */
/** Smooth physical spin-up and spin-down, with a slower wind-down. */
export function nextFanSpeed(current: number, target: number, dt: number): number {
  const currentSpeed = Math.max(0, Math.min(1, current));
  const targetSpeed = Math.max(0, Math.min(1, target));
  const delta = Math.max(0, Math.min(0.065, dt));
  const tau = targetSpeed > currentSpeed ? 2.7 : 3.9;
  const speed = currentSpeed + (targetSpeed - currentSpeed) * (1 - Math.exp(-delta / tau));
  return targetSpeed === 0 && speed < 0.003 ? 0 : speed;
}

export function proxyFilterRatio(count: number): number {
  const n = Math.max(0, Math.min(4, Math.floor(count) || 0));
  return [0, 0.86, 0.92, 0.95, 0.97][n];
}

export function proxyLoadRatio(rps: number, count: number): number {
  const n = Math.max(0, Math.min(4, Math.floor(count) || 0));
  return n ? Math.max(0, rps) / (n * PROXY_CAPACITY) : 0;
}

/** An overwhelmed defensive edge filters less effectively in this model. */
export function effectiveProxyFilterRatio(rps: number, count: number): number {
  const nominal = proxyFilterRatio(count);
  const overload = Math.max(0, proxyLoadRatio(rps, count) - 1);
  return nominal / (1 + overload * 0.55);
}

export function forwardedRequests(rps: number, proxies: number): number {
  return Math.round(Math.max(0, rps) * (1 - effectiveProxyFilterRatio(rps, proxies)));
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
  const [pingLines, setPingLines] = useState<string[]>([]);
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
  const networkRef = useRef<SVGSVGElement | null>(null);
  const fanMotion = useRef({ angle: 0, speed: 0 });
  const fanTarget = useRef(0);
  const pingTarget = useRef({ ip: '', latency: null as number | null });
  const pingScrollRef = useRef<HTMLDivElement | null>(null);
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
        const windDown = mode === 'offline' && soundOn && pageVisible;
        fan.gain.gain.setTargetAtTime(0.0001, at, windDown ? 1.4 : 0.08);
        fan.humGain.gain.setTargetAtTime(0.0001, at, windDown ? 1.4 : 0.08);
        fan.filter.frequency.setTargetAtTime(120, at, windDown ? 1.6 : 0.08);
        fan.source.playbackRate.setTargetAtTime(0.35, at, windDown ? 1.5 : 0.08);
        fan.hum.frequency.setTargetAtTime(40, at, windDown ? 1.6 : 0.08);
        try { fan.source.stop(at + (windDown ? 8 : 0.8)); fan.hum.stop(at + (windDown ? 8 : 0.8)); }
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

  // Keep fan blades rotating continuously and ease their actual angular speed.
  // Setting a new CSS animation duration each frame made the rotation jump.
  useEffect(() => {
    fanTarget.current = mode === 'running' ? cpu / 100 : 0;
  }, [mode, cpu]);

  useEffect(() => {
    if (mode === 'setup' || !networkRef.current) {
      fanMotion.current.speed = 0;
      return;
    }
    const rotors = Array.from(networkRef.current.querySelectorAll<SVGGElement>('.storm-fan-rotor'));
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.065, Math.max(0, (now - previous) / 1000));
      previous = now;
      const target = fanTarget.current;
      const motion = fanMotion.current;
      motion.speed = nextFanSpeed(motion.speed, target, dt);
      motion.angle = (motion.angle + motion.speed * 790 * dt) % 360;
      const angle = motion.angle.toFixed(1);
      for (const rotor of rotors) rotor.setAttribute('transform', 'rotate(' + angle + ')');
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, serverCount]);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPingLines([]);
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
          dropped: previous.dropped + Math.max(0, forwarded - SERVER_CAPACITY * serverCount) * dt,
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
    setPingLines([]);
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
    setPingLines([]);
  }

  const status = mode === 'offline' ? 'OFFLINE' : pressure >= 1 ? 'OVERLOADED' : stats.health < 65 ? 'DEGRADED' : 'ONLINE';
  const responseMs = mode === 'offline' ? null : Math.round(38 + Math.pow(pressure, 2) * 165);
  // Auto-ping uses only this local synthetic latency, never ICMP or network fetch.
  useEffect(() => {
    pingTarget.current = { ip: scenario?.ip ?? '0.0.0.0', latency: mode === 'offline' ? null : responseMs };
  }, [scenario?.ip, responseMs, mode]);

  useEffect(() => {
    if (mode === 'setup' || !scenario) return;
    const tick = () => {
      if (mode === 'paused') return;
      const { ip, latency } = pingTarget.current;
      const line = latency === null
        ? 'Request timed out.'
        : 'Reply from ' + ip + ': bytes=32 time=' + latency + 'ms TTL=55';
      setPingLines(previous => {
        const header = 'Pinging ' + ip + ' with 32 bytes of data:';
        const oldLines = previous[0] === header ? previous.slice(1) : [];
        return [header, ...oldLines.slice(-11), line];
      });
    };
    tick();
    if (mode === 'paused') return;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [mode, scenario?.ip]);

  useEffect(() => {
    if (!pingScrollRef.current) return;
    pingScrollRef.current.scrollTop = pingScrollRef.current.scrollHeight;
  }, [pingLines]);
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
  const proxyLoad = proxyLoadRatio(stats.rps, proxyCount);
  const effectiveFilter = effectiveProxyFilterRatio(stats.rps, proxyCount);
  const responseCodes = httpOutcomes(stats.rps, proxyCount, serverCount, mode === 'offline');
  const serverLoads = serverYs.map((_, index) =>
    nodeLoadRatio(arriving, serverCount, index, SERVER_CAPACITY));
  const proxyLoads = proxyYs.map((_, index) =>
    nodeLoadRatio(stats.rps, proxyCount, index, PROXY_CAPACITY));
  const proxyState = proxyCount === 0 ? 'OFF' : proxyLoad > 1 ? 'OVERLOADED' : proxyLoad > 0.8 ? 'BUSY' : 'FILTERING';

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
          {mode === 'offline' ? <button type="button" className="storm-primary" onClick={restart}><RotateCcw size={15}/> Restart</button> : <button type="button" className="storm-primary" onClick={() => setMode(value => value === 'paused' ? 'running' : 'paused')}>{mode === 'paused' ? <Play size={15}/> : <Pause size={15}/>} {mode === 'paused' ? 'Resume' : 'Pause'}</button>}
          <button type="button" className="storm-secondary" onClick={newScenario}>New scenario</button>
        </div>
      </div>
      <div className="storm-infra-bar">
        <span className="storm-infra-label">NODES</span>
        <div className="storm-live-steppers">
          <div><span>Servers</span><button type="button" aria-label="Remove web server" disabled={serverCount <= 1} onClick={() => setServerCount(value => Math.max(1, value - 1))}><Minus size={13}/></button><strong>{serverCount}</strong><button type="button" aria-label="Add web server" disabled={serverCount >= 4} onClick={() => setServerCount(value => Math.min(4, value + 1))}><Plus size={13}/></button></div>
          <div><span>Proxies</span><button type="button" aria-label="Remove defensive proxy" disabled={proxyCount <= 0} onClick={() => setProxyCount(value => Math.max(0, value - 1))}><Minus size={13}/></button><strong>{proxyCount}</strong><button type="button" aria-label="Add defensive proxy" disabled={proxyCount >= 4} onClick={() => setProxyCount(value => Math.min(4, value + 1))}><Plus size={13}/></button></div>
        </div>
        {proxyEnabled && <span className={'storm-infra-state' + (proxyLoad > 1 ? ' is-overloaded' : '')}><span className="storm-infra-dot"/>{proxyState} · {Math.round(proxyLoad * 100)}% load</span>}
      </div>

      <section className="storm-metrics" aria-label="Simulation metrics">
        <div className="storm-metric"><span>INCOMING TRAFFIC</span><strong>{trafficLabel}</strong></div>
        <div className="storm-metric"><span>DELIVERED TRAFFIC</span><strong>{serverTrafficLabel}</strong><small>{proxyEnabled ? Math.round(effectiveFilter * 100) + '% filtered' : 'Unfiltered'}</small></div>
        <div className="storm-metric"><span>SERVER HEALTH</span><strong className={stats.health < 35 ? 'storm-danger' : ''}>{Math.ceil(stats.health)}%</strong><div className="storm-meter"><i className="storm-health" style={{ width: stats.health + '%' }}/></div></div>
        <div className="storm-metric"><span>RESPONSE TIME</span><strong>{responseMs === null ? 'OFFLINE' : responseMs + ' ms'}</strong></div>
      </section>

      <div className="storm-main-grid">
        <div className="storm-left-stack">
          <section className="storm-panel storm-network" aria-label="Animated network traffic">
            <div className="storm-panel-heading"><div><h2>Network traffic</h2></div><span className={'storm-status storm-status--' + status.toLowerCase()}><i/>{status}</span></div>
            <svg ref={networkRef} viewBox="0 0 1000 370" className="storm-network-svg" role="img" aria-label={'Fictional hacker and botnet feeding ' + proxyCount + ' defensive proxy nodes and ' + serverCount + ' web servers'}>
              <defs><linearGradient id="storm-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent)" stopOpacity=".16"/><stop offset="1" stopColor="var(--accent)" stopOpacity=".75"/></linearGradient><filter id="storm-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <text x="77" y="25" className="storm-diagram-label">HACKER</text>
              <text x="282" y="25" className="storm-diagram-label">BOTNET · {compact(scenario?.bots ?? 0)}</text>
              <text x="279" y="295" className="storm-diagram-label storm-real-users-label">REAL USERS · {LEGITIMATE_RPS}/s</text>
              <text x="881" y="25" className="storm-diagram-label">WEB SERVERS · {serverCount}</text>
              {proxyEnabled && <><text x="617" y="25" className="storm-diagram-label">PROXIES · {proxyCount}</text><text x="617" y="43" className={'storm-diagram-count' + (proxyLoad > 1 ? ' is-overloaded' : '')}>{proxyState}</text></>}
              {BOT_Y.map(y => <path key={'controller-' + y} d={'M 113 180 C 166 180 176 ' + y + ' 224 ' + y} className="storm-controller-line"/>)}
              <g className="storm-hacker-node"><rect x="28" y="123" width="99" height="112" rx="15"/><path d="M 49 176 C 49 143 63 139 77 138 C 91 139 106 143 106 176 L 106 198 C 95 211 59 211 49 198 Z"/><path d="M 60 180 L 70 184 M 84 184 L 94 180"/><rect x="47" y="202" width="60" height="19" rx="4"/><text x="77" y="251">{safeName.slice(0, 12)}</text></g>
              {BOT_Y.map((y, index) => <g key={y} className="storm-bot-node"><rect x="224" y={y - 22} width="110" height="44" rx="9"/><circle cx="245" cy={y} r="7"/><path d={'M 264 ' + (y - 6) + ' h 44 M 264 ' + (y + 6) + ' h 29'}/><text x="281" y={y - 30}>BOT 0{index + 1}</text></g>)}
              <g className="storm-real-node"><rect x="224" y="304" width="110" height="43" rx="9"/><circle cx="245" cy="326" r="8"/><path d="M 240 323 a 5 5 0 0 1 10 0 M 234 338 Q 245 326 256 338"/><path d="M 265 321 h 45 M 265 334 h 30"/></g>
              {BOT_Y.map((_, index) => <path key={index} d={packetPath(index, serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null)} className="storm-path"/> )}
              <path d={userPacketPath(serverYs[0], proxyEnabled ? proxyYs[0] : null)} className="storm-user-path"/>
              {proxyEnabled && <path d={userPacketPath(serverYs[0], proxyYs[0], true)} className="storm-user-path"/>}
              {proxyYs.map((y, index) => <g key={'proxy-' + index} className={'storm-proxy-edge' + (proxyLoads[index] > 1 ? ' is-overloaded' : proxyLoads[index] > 0.8 ? ' is-busy' : '')}>
                <rect x="591" y={y - 23} width="54" height="46" rx="9"/>
                <rect className="storm-proxy-rack" x="602" y={y - 14} width="32" height="11" rx="3"/>
                <rect className="storm-proxy-rack" x="602" y={y + 3} width="32" height="11" rx="3"/>
                <circle className="storm-proxy-led" cx="609" cy={y - 8.5} r="2"/>
                <circle className="storm-proxy-led" cx="609" cy={y + 8.5} r="2"/>
                <text x="618" y={y + 34}>P{index + 1}</text>
                {proxyLoads[index] > 1 && <text x="618" y={y + 46} className="storm-proxy-overload">OVERLOAD</text>}
              </g>)}
              {mode === 'running' && Array.from({length:visiblePacketCount}, (_, index) => {
                const path = packetPath(index % 4, serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null, proxyEnabled);
                return <circle key={'flood-' + index} className="storm-packet storm-packet-attack" r={index % 4 === 0 ? 3.7 : 2.6}><animateMotion path={path} dur={(0.42 + index % 5 * 0.065) + 's'} begin={(-index * 0.075) + 's'} repeatCount="indefinite"/></circle>;
              })}
              {mode === 'running' && proxyEnabled && Array.from({length:Math.max(1, Math.round(visiblePacketCount * (1 - effectiveFilter)))}, (_, index) =>
                <circle key={'survivor-' + index} className="storm-packet storm-packet-survivor" r="3.2">
                  <animateMotion path={acceptedAttackPath(serverYs[index % serverCount], proxyYs[index % proxyCount])} dur={(1.2 + index % 4 * 0.17) + 's'} begin={(-index * 0.37) + 's'} repeatCount="indefinite"/>
                </circle>
              )}
              {mode === 'running' && Array.from({length:3}, (_, index) =>
                <circle key={'user-in-' + index} className="storm-packet-user" r="3.5">
                  <animateMotion path={userPacketPath(serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null)} dur={proxyEnabled ? '0.9s' : '1.3s'} begin={(-index * 0.36) + 's'} repeatCount="indefinite"/>
                </circle>
              )}
              {mode === 'running' && proxyEnabled && Array.from({length:2}, (_, index) =>
                <circle key={'user-out-' + index} className="storm-packet-user" r="3.5">
                  <animateMotion path={userPacketPath(serverYs[index % serverCount], proxyYs[index % proxyCount], true)} dur="1.35s" begin={(-index * 0.52) + 's'} repeatCount="indefinite"/>
                </circle>
              )}
              {serverYs.map((y, index) => <g key={'server-'+index} className={'storm-server-graphic' + (mode === 'offline' ? ' is-offline' : stats.health <= 35 ? ' is-critical' : '')}>
                <rect x="825" y={y - 27} width="112" height="54" rx="9"/>
                <rect x="838" y={y - 15} width="48" height="11" rx="3"/><rect x="838" y={y + 4} width="48" height="11" rx="3"/>
                {[y - 9, y + 10].map(ledY => <circle key={ledY} cx="845" cy={ledY} r="2.8" className="storm-led"/>)}
                {[899, 922].map((x, rotorIndex) => <g key={'fan-' + rotorIndex} transform={'translate(' + x + ' ' + y + ')'} className="storm-rack-fan">
                  <circle r="10" className="storm-fan-ring"/>
                  <circle r="7.6" className="storm-fan-shroud"/>
                  <g className="storm-fan-rotor">
                    {[0, 90, 180, 270].map(angle => <path key={angle} transform={'rotate(' + angle + ')'} d="M -1 -1 Q -9 -11 1 -8 Q 6 -7 3 -1 Z" className="storm-fan-blade"/>)}
                  </g>
                  <circle r="2" className="storm-fan-hub"/>
                </g>)}
                <text x="881" y={y + 40}>SERVER {index + 1}</text>
              </g>)}
              {mode === 'offline' && <text x="881" y="362" className="storm-offline-caption">WEBSITE OFFLINE</text>}
            </svg>
            <div className="storm-network-foot"><span className="storm-legend-attack"><i/> Attack</span><span className="storm-legend-real"><i/> Real users</span><span>{serverCount} servers · {proxyCount} proxies</span><span>{stats.seconds.toFixed(1)}s</span></div>
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
            <div className="storm-node-usage">
              <div className="storm-node-group">
                <div className="storm-node-heading"><Server size={13}/> SERVER CPU</div>
                <div className="storm-node-load-grid">
                  {serverLoads.map((load, index) => {
                    const percent = mode === 'offline' ? 0 : Math.round(Math.min(100, 12 + load * 72));
                    return <div className="storm-node-load" key={'cpu-' + index}>
                      <div><span>Server {index + 1}</span><strong className={load > 1 ? 'storm-danger' : ''}>{percent}%</strong></div>
                      <div className={'storm-meter' + (load > 1 ? ' is-overloaded' : '')}><i style={{width:percent+'%'}}/></div>
                    </div>;
                  })}
                </div>
              </div>
              {proxyEnabled && <div className="storm-node-group">
                <div className="storm-node-heading"><ServerCog size={13}/> PROXY LOAD</div>
                <div className="storm-node-load-grid">
                  {proxyLoads.map((load, index) => <div className="storm-node-load" key={'proxy-' + index}>
                    <div><span>Proxy {index + 1}</span><strong className={load > 1 ? 'storm-danger' : ''}>{Math.round(load * 100)}%</strong></div>
                    <div className={'storm-meter storm-proxy-load-bar' + (load > 1 ? ' is-overloaded' : '')}><i style={{width:Math.min(load * 100, 100)+'%'}}/></div>
                  </div>)}
                </div>
              </div>}
            </div>
            <div className="storm-http">
              <div className="storm-node-heading">HTTP RESPONSES <span>req/s</span></div>
              <div className="storm-http-grid">
                {[
                  { code: '200', label: 'OK', value: responseCodes.ok },
                  { code: '429', label: 'Limited', value: responseCodes.rateLimited },
                  { code: '404', label: 'Not found', value: responseCodes.notFound },
                  { code: '503', label: 'Unavailable', value: responseCodes.unavailable },
                  { code: '504', label: 'Timeout', value: responseCodes.timeout },
                ].map(item => <div className={'storm-http-code storm-http-code--' + item.code} key={item.code}>
                  <span>{item.code}</span><strong>{compact(item.value)}</strong><small>{item.label}</small>
                </div>)}
              </div>
            </div>
            <div className="storm-live-ping">
              <div className="storm-ping-terminal-header"><span><i className={'storm-ping-dot' + (mode === 'offline' ? ' is-offline' : '')}/> AUTO PING</span><span>32 bytes · 1s</span></div>
              <div ref={pingScrollRef} className="storm-ping-terminal-lines" role="log" aria-live="off" aria-label="Simulated Windows-style ping history">
                {pingLines.map((line,index) => <div key={index}>{line}</div>)}
              </div>
            </div>
          </section>
        </aside>
      </div>
      <footer className="storm-session-footer"><span>Browser-only simulation. No packets sent.</span><span>{stats.seconds.toFixed(1)}s</span></footer>
    </div>}
    {showHelp && <div className="storm-dialog-backdrop" role="presentation" onClick={() => setShowHelp(false)}><section role="dialog" aria-modal="true" aria-labelledby="storm-help-heading" className="storm-dialog" onClick={event => event.stopPropagation()}><button type="button" aria-label="Close help" className="storm-dialog-close" onClick={() => setShowHelp(false)}><X size={17}/></button><h2 id="storm-help-heading">How Traffic Storm works</h2><p>A hacker controls fictional botnet nodes sending simulated traffic. The modeled website becomes slower or goes offline if incoming requests exceed server capacity.</p><p>Choose 1–4 web servers to share the simulated load, and 0–4 defensive proxies to filter it. This model illustrates diminishing returns across proxy layers. Real DDoS protection varies and is not guaranteed by adding proxies or servers.</p><p>Traffic uses fictional units of 512 KiB and 16 requests per bot per second. Proxy capacity is also fictional: excessive incoming requests overload the proxies and reduce filtering. The rolling Windows-style ping log reports fictional latency without contacting the address. HTTP 404 represents a separate missing-route check. Other HTTP codes represent simulated overload, rate limiting or unavailability.</p><button type="button" className="storm-primary" onClick={() => setShowHelp(false)}>Got it</button></section></div>}
  </main>;
}

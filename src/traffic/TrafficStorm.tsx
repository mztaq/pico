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
// All visible network links and animated packets share the same SVG path IDs.
// Keeping the connection coordinates here prevents packet/path drift.
const BOT_Y = [88, 162, 236, 310] as const;
const REAL_USER_Y = 407;
const LEGITIMATE_RPS = 125;
const BOT_EXIT_X = 450;
const PROXY_IN_X = 710;
const PROXY_OUT_X = 790;
const SERVER_IN_X = 990;
const networkPositions = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => 60 + 405 * (i + 1) / (count + 1));

export function botLanePath(bot: number, serverY: number, proxyY: number | null): string {
  const y = BOT_Y[bot % BOT_Y.length];
  const toX = proxyY === null ? SERVER_IN_X : PROXY_IN_X;
  const targetY = proxyY ?? serverY;
  const dx = toX - BOT_EXIT_X;
  return 'M ' + BOT_EXIT_X + ' ' + y + ' C ' + (BOT_EXIT_X + dx * 0.46) + ' ' + y
    + ' ' + (toX - dx * 0.42) + ' ' + targetY + ' ' + toX + ' ' + targetY;
}

export function relayLanePath(proxyY: number, serverY: number): string {
  return 'M ' + PROXY_OUT_X + ' ' + proxyY + ' C 876 ' + proxyY + ' 908 ' + serverY
    + ' ' + SERVER_IN_X + ' ' + serverY;
}

/** Packet dots represent traffic groups, not individual requests.
 * Keep every active outgoing lane visible without changing filtered bandwidth.
 */
export function visualSurvivorCount(incomingDots: number, filteredFraction: number, activeLanes = 4): number {
  const incoming = Math.max(0, Math.floor(incomingDots));
  const lanes = Math.max(0, Math.min(4, Math.floor(activeLanes)));
  if (incoming === 0 || lanes === 0) return 0;
  const passed = Math.round(incoming * (1 - Math.max(0, Math.min(1, filteredFraction))) * 2);
  return Math.min(8, Math.max(Math.min(lanes, incoming), passed));
}

export function realUserLanePath(serverY: number, proxyY: number | null): string {
  const toX = proxyY === null ? SERVER_IN_X : PROXY_IN_X;
  const targetY = proxyY ?? serverY;
  return 'M ' + BOT_EXIT_X + ' ' + REAL_USER_Y + ' C 565 ' + REAL_USER_Y
    + ' ' + (toX - 95) + ' ' + targetY + ' ' + toX + ' ' + targetY;
}

/** Deterministic per-node load with slightly uneven load-balancer allocation. */
export function nodeLoadRatio(rps: number, count: number, index: number, capacity: number): number {
  const n = Math.max(1, Math.min(4, Math.floor(count) || 1));
  if (!Number.isInteger(index) || index < 0 || index >= n || capacity <= 0) return 0;
  const weights = [0.94, 1.08, 0.89, 1.09];
  const totalWeight = weights.slice(0, n).reduce((total, weight) => total + weight, 0);
  return Math.max(0, rps) * weights[index] / totalWeight / capacity;
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
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const rotors = Array.from(networkRef.current.querySelectorAll<SVGGElement>('.storm-fan-rotor'));
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      // 30 FPS is sufficient for the small fans. Hidden tabs do no drawing.
      if (document.hidden) {
        previous = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      if (now - previous < 30) {
        frame = requestAnimationFrame(tick);
        return;
      }
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
      const dt = Math.min(0.55, Math.max(0, (now - lastFrame.current) / 1000));
      lastFrame.current = now;
      if (document.hidden) return;
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
    }, 330);
    return () => window.clearInterval(id);
  }, [mode, scenario, proxyCount, serverCount]);

  // Throttle packet sounds and increase their frequency across the gradual ramp.
  // These represent visible packet groups, never individual real requests.
  const packetAudioStep = Math.floor(trafficRamp(stats.seconds) * 6);
  useEffect(() => {
    if (mode !== 'running') return;
    const intervalMs = Math.max(260, 740 - packetAudioStep * 80);
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
      setPingLines(previous => [...previous.slice(-4), line]);
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
  // Keep SVG animation independent of the synthetic request count.
  // Each dot represents a group of requests; cap animations for smooth rendering.
  const visiblePacketCount = Math.max(1, Math.round(16 * trafficRamp(stats.seconds)));
  const visibleSurvivorCount = proxyEnabled ? visualSurvivorCount(visiblePacketCount, effectiveProxyFilterRatio(stats.rps, proxyCount)) : 0;
  const serverYs = networkPositions(serverCount);
  const proxyYs = networkPositions(proxyCount);
  const effectiveFilter = effectiveProxyFilterRatio(stats.rps, proxyCount);
  const serverLoads = serverYs.map((_, index) =>
    nodeLoadRatio(arriving, serverCount, index, SERVER_CAPACITY));
  const proxyLoads = proxyYs.map((_, index) =>
    nodeLoadRatio(stats.rps, proxyCount, index, PROXY_CAPACITY));

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
      </div>

      <section className="storm-metrics" aria-label="Simulation metrics">
        <div className="storm-metric"><span>INCOMING TRAFFIC</span><strong>{trafficLabel}</strong></div>
        <div className="storm-metric"><span>DELIVERED TRAFFIC</span><strong>{serverTrafficLabel}</strong></div>
        <div className="storm-metric"><span>SERVER HEALTH</span><strong className={stats.health < 35 ? 'storm-danger' : ''}>{Math.ceil(stats.health)}%</strong><div className="storm-meter"><i className="storm-health" style={{ width: stats.health + '%' }}/></div></div>
        <div className="storm-metric"><span>RESPONSE TIME</span><strong>{responseMs === null ? 'OFFLINE' : responseMs + ' ms'}</strong></div>
      </section>

      <div className="storm-main-grid">
        <div className="storm-left-stack">
          <section className="storm-panel storm-network" aria-label="Animated network traffic">
            <div className="storm-panel-heading"><h2>Network traffic</h2></div>
            <svg ref={networkRef} viewBox="0 0 1200 450" preserveAspectRatio="xMidYMid meet" className="storm-network-svg" role="img" aria-label={'Fictional network with a hacker, four groups of bots, legitimate users, ' + proxyCount + ' proxy servers, and ' + serverCount + ' web servers. Every packet follows a drawn connection.'}>
              <g className="storm-stage-titles">
                <text x="140" y="30">HACKER</text>
                <text x="370" y="30">BOTNET · {compact(scenario?.bots ?? 0)}</text>
                <text x="750" y="30">{proxyEnabled ? 'PROXIES · ' + proxyCount : 'NO PROXIES'}</text>
                <text x="1075" y="30">SERVERS · {serverCount}</text>
              </g>
              <g className="storm-diagram-routes">
                {BOT_Y.map(y => <path key={'control-' + y} d={'M 215 251 C 253 251 255 ' + y + ' 292 ' + y} className="storm-controller-line"/>)}
                {BOT_Y.map((_, index) => <path key={'attack-link-' + index} id={'storm-attack-link-' + index}
                  d={botLanePath(index, serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null)}
                  className="storm-network-link storm-network-link--attack"/>)}
                {proxyEnabled && BOT_Y.map((_, index) => <path key={'survivor-link-' + index} id={'storm-survivor-link-' + index}
                  d={relayLanePath(proxyYs[index % proxyCount], serverYs[index % serverCount])}
                  className="storm-network-link storm-network-link--approved"/>)}
                <path id="storm-legitimate-in" d={realUserLanePath(serverYs[0], proxyEnabled ? proxyYs[0] : null)}
                  className="storm-network-link storm-network-link--legitimate"/>
                {proxyEnabled && <path id="storm-legitimate-out" d={relayLanePath(proxyYs[0], serverYs[0])}
                  className="storm-network-link storm-network-link--legitimate"/>}
              </g>

              <g className="storm-hacker-node">
                <rect x="63" y="187" width="154" height="145" rx="20" className="storm-hacker-shell"/>
                <rect x="78" y="203" width="124" height="112" rx="14" className="storm-hacker-inner"/>
                <path d="M 94 280 C 93 243 107 217 139 215 C 172 217 186 243 184 280 L 177 293 Q 139 302 101 293 Z" className="storm-hacker-hood"/>
                <path d="M 115 260 l 17 5 M 147 265 l 17 -5" className="storm-hacker-eyes"/>
                <rect x="103" y="287" width="72" height="17" rx="5" className="storm-hacker-keyboard"/>
                <circle cx="190" cy="211" r="3" className="storm-hacker-status"/>
                <text x="140" y="357" className="storm-hacker-name">{safeName.slice(0, 14)}</text>
              </g>

              {BOT_Y.map((y, index) => <g key={y} className="storm-bot-node">
                <rect x="292" y={y - 29} width="158" height="58" rx="12" className="storm-device-shell"/>
                <rect x="307" y={y - 15} width="28" height="30" rx="7" className="storm-bot-avatar"/>
                <path d={'M 320 ' + (y - 8) + ' v 8 M 314 ' + (y + 6) + ' q 6 -8 12 0'} className="storm-bot-face"/>
                <path d={'M 346 ' + (y - 10) + ' h 84 M 346 ' + (y + 4) + ' h 57'} className="storm-bot-vents"/>
                <text x="367" y={y - 39} className="storm-device-name">BOT 0{index + 1}</text>
                <circle cx="429" cy={y + 13} r="3" className="storm-bot-led"/>
              </g>)}
              <g className="storm-real-node">
                <rect x="292" y={REAL_USER_Y - 27} width="158" height="54" rx="12"/>
                <circle cx="321" cy={REAL_USER_Y - 3} r="8"/>
                <path d={'M 307 ' + (REAL_USER_Y + 13) + ' q 14 -18 28 0'}/>
                <path d={'M 345 ' + (REAL_USER_Y - 8) + ' h 84 M 345 ' + (REAL_USER_Y + 6) + ' h 55'}/>
                <text x="370" y={REAL_USER_Y - 39} className="storm-real-users-label">REAL USERS · {LEGITIMATE_RPS}/s</text>
              </g>

              {proxyYs.map((y, index) => <g key={'proxy-' + index} className={'storm-proxy-edge' + (proxyLoads[index] > 1 ? ' is-overloaded' : proxyLoads[index] > 0.8 ? ' is-busy' : '')}>
                <rect x="710" y={y - 31} width="80" height="62" rx="11" className="storm-proxy-shell"/>
                <text x="750" y={y - 17} className="storm-proxy-number">PROXY {index + 1}</text>
                <rect x="723" y={y - 11} width="54" height="14" rx="3" className="storm-proxy-rack"/>
                <rect x="723" y={y + 8} width="54" height="13" rx="3" className="storm-proxy-rack"/>
                <circle cx="732" cy={y - 4} r="2.5" className="storm-proxy-led"/>
                <circle cx="732" cy={y + 14.5} r="2.5" className="storm-proxy-led"/>
                <path d={'M 743 ' + (y - 4) + ' h 25 M 743 ' + (y + 14.5) + ' h 25'} className="storm-proxy-slot"/>
                {proxyLoads[index] > 1 && <text x="779" y={y - 17} className="storm-proxy-overload">!</text>}
              </g>)}

              {serverYs.map((y, index) => <g key={'server-' + index} className={'storm-server-graphic' + (mode === 'offline' ? ' is-offline' : serverLoads[index] > 1 ? ' is-critical' : '')}>
                <rect x="990" y={y - 34} width="170" height="68" rx="11" className="storm-server-shell"/>
                <text x="1047" y={y - 18} className="storm-server-name">SERVER 0{index + 1}</text>
                <rect x="1004" y={y - 11} width="87" height="33" rx="6" className="storm-server-rack"/>
                <rect x="1011" y={y - 5} width="73" height="9" rx="2" className="storm-server-slot"/>
                <rect x="1011" y={y + 9} width="73" height="8" rx="2" className="storm-server-slot"/>
                {[y - 1, y + 13].map(ledY => <circle key={ledY} cx="1020" cy={ledY} r="2.7" className="storm-led"/>)}
                {[1115, 1140].map((x, rotorIndex) => <g key={'fan-' + rotorIndex} transform={'translate(' + x + ' ' + (y + 3) + ')'} className="storm-rack-fan">
                  <circle r="12" className="storm-fan-ring"/>
                  <circle r="9" className="storm-fan-shroud"/>
                  <g className="storm-fan-rotor">
                    {[0,90,180,270].map(angle => <path key={angle} transform={'rotate(' + angle + ')'} d="M -1 -1 Q -11 -12 1 -9 Q 8 -7 3 -1 Z" className="storm-fan-blade"/>)}
                  </g>
                  <circle r="2.4" className="storm-fan-hub"/>
                </g>)}
              </g>)}

              {mode === 'running' && Array.from({length:visiblePacketCount}, (_, index) =>
                <circle key={'attack-' + index} className="storm-packet-attack" r={index % 4 === 0 ? 3.5 : 2.6}>
                  <animateMotion dur={(0.42 + index % 5 * 0.055) + 's'} begin={(-index * 0.075) + 's'} repeatCount="indefinite">
                    <mpath href={'#storm-attack-link-' + (index % 4)}/>
                  </animateMotion>
                </circle>
              )}
              {mode === 'running' && proxyEnabled && Array.from({length:visibleSurvivorCount}, (_, index) =>
                <circle key={'approved-' + index} className="storm-packet-survivor" r="3">
                  <animateMotion dur={(1.35 + index % 4 * 0.13) + 's'} begin={(-index * 0.31) + 's'} repeatCount="indefinite">
                    <mpath href={'#storm-survivor-link-' + (index % 4)}/>
                  </animateMotion>
                </circle>
              )}
              {mode === 'running' && Array.from({length:3}, (_, index) =>
                <circle key={'real-in-' + index} className="storm-packet-user" r="3.7">
                  <animateMotion dur="1.15s" begin={(-index * 0.41) + 's'} repeatCount="indefinite">
                    <mpath href="#storm-legitimate-in"/>
                  </animateMotion>
                </circle>
              )}
              {mode === 'running' && proxyEnabled && Array.from({length:2}, (_, index) =>
                <circle key={'real-out-' + index} className="storm-packet-user" r="3.7">
                  <animateMotion dur="1.55s" begin={(-index * 0.7) + 's'} repeatCount="indefinite">
                    <mpath href="#storm-legitimate-out"/>
                  </animateMotion>
                </circle>
              )}
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
            <div className="storm-live-ping" aria-label="Simulated ping replies">
              <div ref={pingScrollRef} className="storm-ping-terminal-lines" role="log" aria-live="off">
                {pingLines.map((line,index) => <div key={index}>{line}</div>)}
              </div>
            </div>
          </section>
        </aside>
      </div>
      <footer className="storm-session-footer"><span>Browser-only simulation. No packets sent.</span><span>{stats.seconds.toFixed(1)}s</span></footer>
    </div>}
    {showHelp && <div className="storm-dialog-backdrop" role="presentation" onClick={() => setShowHelp(false)}><section role="dialog" aria-modal="true" aria-labelledby="storm-help-heading" className="storm-dialog" onClick={event => event.stopPropagation()}><button type="button" aria-label="Close help" className="storm-dialog-close" onClick={() => setShowHelp(false)}><X size={17}/></button><h2 id="storm-help-heading">How Traffic Storm works</h2><p>A hacker controls fictional botnet nodes sending simulated traffic. The modeled website becomes slower or goes offline if incoming requests exceed server capacity.</p><p>Choose 1–4 web servers to share the simulated load, and 0–4 defensive proxies to filter it. This model illustrates diminishing returns across proxy layers. Real DDoS protection varies and is not guaranteed by adding proxies or servers.</p><p>Traffic uses fictional units of 512 KiB and 16 requests per bot per second. Proxy capacity is also fictional: excessive incoming requests overload the proxies and reduce filtering. Ping replies report fictional latency without contacting the address.</p><button type="button" className="storm-primary" onClick={() => setShowHelp(false)}>Got it</button></section></div>}
  </main>;
}

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, Minus, Pause, Play, Plus, RotateCcw, Server, ServerCog, Settings2 } from 'lucide-react';
import { SoundButton } from '../app/components/SoundToggle';
import { StormGuidedTour } from './StormGuidedTour';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { onSoundChange, soundEnabled } from '../app/sound';
import { loadSettings, saveSettings } from '../storage/settings';
import './traffic-storm.css';

const SERVER_CAPACITY = 3200;
const BITS_PER_REQUEST = 12_582_912; // Fictional 1.5 MiB request unit for a ~5 Tbps peak; not measured bandwidth.
export const HIGH_TRAFFIC_THRESHOLD_GBPS = 100;
const BOT_REQUEST_RATE = 16; // Fictional average requests per bot per second.
const PROXY_CAPACITY = 60_000; // Illustrative requests/sec per defensive proxy, not real hardware throughput.
export const FAN_BLADE_ANGLES = [0, 72, 144, 216, 288] as const;
export const SERVER_FAN_Y_OFFSET = -20;
export const SERVER_RACK_Y_OFFSET = -2;

/** RFC 5737 reserved addresses, used only as simulated server labels. */
export function generateDemoIp(random: () => number = Math.random): string {
  const ranges = ['192.0.2', '198.51.100', '203.0.113'] as const;
  const bounded = (value: number) => Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0));
  const range = ranges[Math.floor(bounded(random()) * ranges.length)];
  const host = 1 + Math.floor(bounded(random()) * 254);
  return range + '.' + host;
}

// All visible network links and animated packets share the same SVG path IDs.
// Keeping the connection coordinates here prevents packet/path drift.
const BOT_Y = [92, 190, 288, 386] as const;
const BOT_EXIT_X = 450;
const PROXY_IN_X = 710;
const PROXY_OUT_X = 790;
const SERVER_IN_X = 990;
const networkPositions = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => 60 + 405 * (i + 1) / (count + 1));

/** Keep tall server chassis at least 26 units apart in the four-server layout. */
export function webserverPositions(count: number): number[] {
  const total = Math.max(1, Math.min(4, Math.floor(count)));
  return Array.from({ length: total }, (_, i) => 232.5 + (i - (total - 1) / 2) * 100);
}

/** The command pulses use the same exact path as the visible hacker-to-bot links. */
export function hackerCommandPath(bot: number): string {
  const y = BOT_Y[bot % BOT_Y.length];
  return 'M 215 251 C 275 251 300 ' + y + ' 350 ' + y;
}

/** Keep stage headings 18 SVG units above the first corresponding chassis. */
const headingAboveNode = (centerY: number, halfHeight: number): number => centerY - halfHeight - 18;

export function botnetHeadingY(): number {
  return headingAboveNode(BOT_Y[0], 29);
}

export function proxyHeadingY(count: number): number {
  const firstProxyY = networkPositions(Math.max(1, Math.min(4, Math.floor(count))))[0];
  return headingAboveNode(firstProxyY, 34);
}

export function webserverHeadingY(count: number): number {
  const firstServerY = webserverPositions(count)[0];
  return headingAboveNode(firstServerY, 37);
}

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

/** Short, uneven modeled bursts, rather than a nearly flat sine wave.
 * This varies only the browser simulation and never sends real requests.
 */
export function trafficSpikeFactor(seconds: number): number {
  const t = Math.max(0, seconds);
  const burst = Math.abs(Math.sin(t * 2.75) * Math.sin(t * 5.85));
  return 0.90 + 0.45 * burst;
}

/** A static warning appears at 100 Gbps incoming and clears below the threshold. */
export function isHighTraffic(rps: number): boolean {
  return Number.isFinite(rps) && rps >= 0
    && rps * BITS_PER_REQUEST >= HIGH_TRAFFIC_THRESHOLD_GBPS * 1e9;
}

/** An offline origin cannot deliver successful application traffic.
 * Incoming botnet traffic and proxy load remain modeled independently.
 */
export function deliveredTrafficRps(rps: number, proxyCount: number, offline: boolean): number {
  return offline ? 0 : forwardedRequests(rps, proxyCount);
}

export function deviceHeading(singular: string, plural: string, count: number): string {
  return count === 1 ? singular : plural;
}

/** Match the setup controls: 100–20,000 imaginary botnet devices in steps of 100. */
export function normalizeBotArmy(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(100, Math.min(20_000, Math.round(value / 100) * 100));
}

/** A visible idle spin starts as soon as the simulation runs, before heavy CPU load. */
export function coolingFanDemand(cpu: number, running: boolean): number {
  return running ? Math.max(0.34, Math.min(1, Math.max(0, cpu) / 100)) : 0;
}

/** Smooth physical spin-up and spin-down, with a slower wind-down. */
export function nextFanSpeed(current: number, target: number, dt: number): number {
  const currentSpeed = Math.max(0, Math.min(1, current));
  const targetSpeed = Math.max(0, Math.min(1, target));
  const delta = Math.max(0, Math.min(0.065, dt));
  const tau = targetSpeed > currentSpeed ? 1.15 : 3.9;
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

/** Health drains gradually under high load, even near the model's 5 Tbps peak.
 * -5 is a per-second recovery rate when the origin is within capacity.
 */
export function serverHealthDrainPerSecond(pressure: number): number {
  if (!Number.isFinite(pressure) || pressure <= 0) return -5;
  if (pressure <= 1) return -5;
  return Math.min(2.3, 0.45 + 0.42 * Math.log2(pressure));
}

export function formatTraffic(rps: number): string {
  const gbps = Math.max(0, rps) * BITS_PER_REQUEST / 1e9;
  return gbps >= 1000 ? (gbps / 1000).toFixed(2) + ' Tbps' : gbps.toFixed(2) + ' Gbps';
}

type Scenario = { hacker: string; bots: number; ip: string };
type Mode = 'setup' | 'ready' | 'running' | 'paused' | 'offline';
type EffectName = 'start' | 'warning' | 'shutdown' | 'packet';
/** More audible effects at typical listening volume, with an upper gain cap. */
export const EFFECT_GAIN_MULTIPLIER = 3;
export const EFFECT_GAIN_CAP = 0.18;
export const FAN_NOISE_GAIN_MULTIPLIER = 1.55;
export function effectGain(base: number): number {
  return Math.min(EFFECT_GAIN_CAP, Math.max(0, base) * EFFECT_GAIN_MULTIPLIER);
}

type CoolingAudio = { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; hum: OscillatorNode; humGain: GainNode };

/** Only letters and single spaces are accepted for the operator's display name. */
export function sanitizeHackerName(input: string): string {
  return input.normalize('NFC').replace(/[^\p{L}\p{M} ]/gu, '').replace(/ {2,}/g, ' ').replace(/^ /, '').slice(0, 24);
}

export function validateHackerName(input: string): string | null {
  const name = input.trim();
  if (name.length < 2) return 'Use at least 2 letters for your name.';
  if (name.length > 24) return 'Keep your name within 24 characters.';
  if (!/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(name)) return 'Use letters and spaces only. No numbers or symbols.';
  return null;
}

export const TRAFFIC_TUTORIAL_STEPS = [
  { target: 'controls', title: 'Start and pause', text: 'Start Simulation begins the traffic. Use Pause, Resume or Restart to control the run. New scenario lets you choose another hacker name.' },
  { target: 'bots', title: 'Bot army', text: 'Set your bot army from 100 to 20,000 devices. More bots create more traffic. Adjust it at any time.' },
  { target: 'servers', title: 'Webservers', text: 'Add up to four webservers to share the incoming requests. Each has its own load meter and spinning fans.' },
  { target: 'proxies', title: 'Proxies', text: 'Add up to four defensive proxies to filter requests. Heavy traffic can overwhelm them.' },
  { target: 'diagram', title: 'Network diagram', text: 'Red lines show commands from the hacker to the botnet. Moving dots follow request routes to the webservers.' },
  { target: 'incoming', title: 'Incoming traffic', text: 'Track incoming bandwidth here, reaching over 5 Tbps at peak. The exclamation mark flashes above 100 Gbps.' },
  { target: 'delivered', title: 'Delivered traffic', text: 'Traffic that reaches the webservers after proxy filtering appears here. It drops to zero if the site goes offline.' },
  { target: 'health', title: 'Server health', text: 'Health gradually decreases under overload, even at 5 Tbps. When it reaches zero, the website goes offline.' },
  { target: 'latency', title: 'Response time', text: 'Response time rises as server pressure increases. When the website goes offline, the indicator changes to OFFLINE.' },
  { target: 'server-panel', title: 'Server and proxy load', text: 'Each server CPU and proxy load appears here. Add or remove nodes to compare how the network behaves.' },
  { target: 'graph', title: 'Traffic graph', text: 'Follow traffic changes over time. Sharp spikes show sudden increases.' },
  { target: 'sound', title: 'Sound controls', text: 'Use the sound button to mute packet effects, alerts and fan noise.' },
] as const;

export function TrafficStorm({ onHome }: { onHome: () => void }) {
  // Nothing is sent to this address. The IP is a label in a browser-only model.
  const [hacker, setHacker] = useState('');
  const [botsDraft, setBotsDraft] = useState('3000');
  const [ipDraft, setIpDraft] = useState(() => generateDemoIp());
  const [proxyCount, setProxyCount] = useState(0);
  const [serverCount, setServerCount] = useState(1);
  const proxyEnabled = proxyCount > 0;
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [mode, setMode] = useState<Mode>('setup');
  const [stats, setStats] = useState(initialStats);
  const [showHelp, setShowHelp] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const autoTourChecked = useRef(false);
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
  const arriving = forwardedRequests(stats.rps, proxyCount);
  const deliveredRps = deliveredTrafficRps(stats.rps, proxyCount, mode === 'offline');
  const visiblePacketCount = Math.max(1, Math.round(16 * trafficRamp(stats.seconds)));
  const visibleSurvivorCount = proxyEnabled ? visualSurvivorCount(visiblePacketCount, effectiveProxyFilterRatio(stats.rps, proxyCount)) : 0;
  const pressure = arriving / (SERVER_CAPACITY * serverCount);
  const cpu = mode === 'offline' ? 0 : Math.round(Math.min(100, 14 + pressure * 72));

  useEffect(() => {
    for (const [key, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(key, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);

  useEffect(() => onSoundChange(setSoundOn), []);

  // First-time tour opens when the user reaches the dashboard, not on name entry.
  useEffect(() => {
    if (mode !== 'ready' || autoTourChecked.current) return;
    autoTourChecked.current = true;
    try {
      if (localStorage.getItem('pico.trafficStorm.tourSeen.v1')) return;
      localStorage.setItem('pico.trafficStorm.tourSeen.v1', '1');
    } catch { /* Private sessions still get one tour per mount. */ }
    setTutorialStep(0);
    setShowHelp(true);
  }, [mode]);

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
        filter.frequency.value = 860;
        gain.gain.setValueAtTime(0.0001, start + delay);
        gain.gain.exponentialRampToValueAtTime(effectGain(volume), start + delay + 0.035);
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
      const load = coolingFanDemand(cpu, true);
      fan.filter.frequency.setTargetAtTime(160 + load * 1100, now, 0.55);
      fan.source.playbackRate.setTargetAtTime(0.65 + load * 0.9, now, 0.55);
      fan.gain.gain.setTargetAtTime((0.002 + Math.pow(load, 1.6) * 0.18) * FAN_NOISE_GAIN_MULTIPLIER, now, 0.6);
      fan.hum.frequency.setTargetAtTime(48 + load * 135, now, 0.55);
      fan.humGain.gain.setTargetAtTime((0.001 + Math.pow(load, 1.5) * 0.022) * FAN_NOISE_GAIN_MULTIPLIER, now, 0.6);
    } catch { /* Unsupported audio never blocks the simulation. */ }
  }, [mode, soundOn, pageVisible, cpu]);

  // Keep fan blades rotating continuously and ease their actual angular speed.
  // Setting a new CSS animation duration each frame made the rotation jump.
  useEffect(() => {
    fanTarget.current = coolingFanDemand(cpu, mode === 'running');
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
    const nameError = validateHackerName(hacker);
    if (nameError) { setError(nameError); return; }
    setScenario({ hacker: hacker.trim(), bots: normalizeBotArmy(Number(botsDraft)), ip: ipDraft });
    setStats(initialStats());
    warningPlayed.current = false;
    lastFrame.current = performance.now();
    setError('');
    setMode('ready');
  }

  function beginSimulation() {
    lastFrame.current = performance.now();
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
        const variation = trafficSpikeFactor(previous.seconds);
        const rps = Math.round(scenario.bots * BOT_REQUEST_RATE * variation * ramp);
        const forwarded = forwardedRequests(rps, proxyCount);
        const overload = forwarded / (SERVER_CAPACITY * serverCount);
        const health = Math.max(0, Math.min(100, previous.health - serverHealthDrainPerSecond(overload) * dt));
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
    setTutorialStep(0);
    setIpDraft(generateDemoIp());
    setHacker('');
    setBotsDraft('3000');
    setServerCount(1);
    setProxyCount(0);
  }

  const responseMs = mode === 'offline' || mode === 'ready' ? null : Math.round(38 + Math.pow(pressure, 2) * 165);
  const trafficLabel = formatTraffic(stats.rps);
  const serverTrafficLabel = formatTraffic(deliveredRps);
  const trafficWarning = isHighTraffic(stats.rps) && mode !== 'setup';
  const points = stats.history.map((value, index) => {
    const x = stats.history.length <= 1 ? 0 : index / (stats.history.length - 1) * 600;
    const y = 106 - Math.min(1, value / Math.max(6000, (scenario?.bots ?? 3000) * BOT_REQUEST_RATE * 1.5)) * 99;
    return String(x) + ',' + String(y);
  }).join(' ');
  const safeName = scenario?.hacker ?? 'Operator';
  // Keep SVG animation independent of the synthetic request count.
  // Each dot represents a group of requests; cap animations for smooth rendering.
  const serverYs = webserverPositions(serverCount);
  const proxyYs = networkPositions(proxyCount);
  const serverLoads = serverYs.map((_, index) =>
    nodeLoadRatio(deliveredRps, serverCount, index, SERVER_CAPACITY));
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
        <button type="button" className="storm-icon-button" aria-label="Traffic Storm tutorial" title="Open tutorial" onClick={() => { setTutorialStep(0); setShowHelp(value => !value); }}><CircleHelp size={17}/></button>
        <span data-storm-tour="sound" className="storm-tour-sound-target"><SoundButton/></span>
        <div className="storm-theme-wrap">
          <button type="button" className="storm-icon-button" aria-label="Change Traffic Storm theme" onClick={() => setThemeOpen(value => !value)}><Settings2 size={17}/></button>
          {themeOpen && <div className="storm-theme-popover"><ThemePicker value={themeId} onChange={id => { setThemeId(id); try { saveSettings({ ...loadSettings(), theme: id }); } catch { /* Session theme still updates. */ } setThemeOpen(false); }}/></div>}
        </div>
      </div>
    </header>

    {mode === 'setup' ? <section className="storm-setup storm-identity-setup" aria-labelledby="storm-setup-title">
      <div className="storm-setup-title storm-identity-title">
        <h1 id="storm-setup-title">Enter hacker name<span>.</span></h1>
      </div>
      <form onSubmit={start} className="storm-setup-form storm-identity-form" noValidate>
        <label htmlFor="storm-hacker-name">Hacker name</label>
        <div className={'storm-identity-input' + (error ? ' is-invalid' : '')}>
          <input id="storm-hacker-name" autoFocus type="text" autoComplete="off" autoCapitalize="words"
            spellCheck={false} maxLength={24} value={hacker} placeholder="Enter hacker name"
            aria-invalid={Boolean(error)} aria-describedby={error ? 'storm-hacker-help storm-hacker-error' : 'storm-hacker-help'}
            onChange={event => {
              const raw = event.target.value;
              const filtered = sanitizeHackerName(raw);
              setHacker(filtered);
              setError(filtered !== raw ? 'Letters and spaces only. No numbers or symbols.' : '');
            }}/>
        </div>
        <div className="storm-identity-hint">
          <span id="storm-hacker-help">Letters and spaces, 2–24 characters</span>
          <span>{hacker.length}/24</span>
        </div>
        {error && <p className="storm-error" id="storm-hacker-error" role="alert">{error}</p>}
        <button type="submit" className="storm-primary storm-identity-submit">
          Continue <ArrowRight size={17} aria-hidden="true"/>
        </button>
      </form>
    </section> : <div className="storm-session">
      <div className="storm-intro">
        <div className="storm-titleline"><h1>Traffic Storm<span>.</span></h1></div>
        <div className="storm-controls" data-storm-tour="controls">
          {mode === 'ready'
            ? <button type="button" className="storm-primary storm-start-simulation" onClick={beginSimulation}><Play size={16} fill="currentColor"/> Start Simulation</button>
            : mode === 'offline'
              ? <button type="button" className="storm-primary" onClick={restart}><RotateCcw size={15}/> Restart</button>
              : <button type="button" className="storm-primary" onClick={() => setMode(value => value === 'paused' ? 'running' : 'paused')}>{mode === 'paused' ? <Play size={15}/> : <Pause size={15}/>} {mode === 'paused' ? 'Resume' : 'Pause'}</button>}
          {mode === 'ready' && <button type="button" className="storm-secondary" onClick={() => { setTutorialStep(0); setShowHelp(true); }}><CircleHelp size={15}/> Tutorial</button>}
          <button type="button" className="storm-secondary" onClick={newScenario}>New scenario</button>
        </div>
      </div>
      <div className="storm-infra-bar">
        <span className="storm-infra-label">NODES</span>
        <div className="storm-live-steppers">
          <div data-storm-tour="servers"><span>Servers</span><button type="button" aria-label="Remove web server" disabled={serverCount <= 1} onClick={() => setServerCount(value => Math.max(1, value - 1))}><Minus size={13}/></button><strong>{serverCount}</strong><button type="button" aria-label="Add web server" disabled={serverCount >= 4} onClick={() => setServerCount(value => Math.min(4, value + 1))}><Plus size={13}/></button></div>
          <div data-storm-tour="proxies"><span>Proxies</span><button type="button" aria-label="Remove defensive proxy" disabled={proxyCount <= 0} onClick={() => setProxyCount(value => Math.max(0, value - 1))}><Minus size={13}/></button><strong>{proxyCount}</strong><button type="button" aria-label="Add defensive proxy" disabled={proxyCount >= 4} onClick={() => setProxyCount(value => Math.min(4, value + 1))}><Plus size={13}/></button></div>
        </div>
        <div className="storm-live-bot-army" data-storm-tour="bots">
          <label htmlFor="storm-live-bot-army">Bot army</label>
          <input id="storm-live-bot-army" type="range" min={100} max={20000} step={100} value={scenario?.bots ?? 3000}
            onChange={event => {
              const bots = normalizeBotArmy(Number(event.target.value));
              setScenario(previous => previous ? { ...previous, bots } : previous);
              setBotsDraft(String(bots));
            }}/>
          <output htmlFor="storm-live-bot-army">{(scenario?.bots ?? 3000).toLocaleString('en-US')}</output>
        </div>
      </div>

      <section className="storm-metrics" aria-label="Simulation metrics">
        <div className="storm-metric storm-metric-incoming" data-storm-tour="incoming"><span>INCOMING TRAFFIC</span><strong>{trafficLabel}</strong>{trafficWarning && <span className="storm-traffic-warning" role="status" aria-label="Incoming traffic at or above 100 Gbps" title="High traffic: at least 100 Gbps"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9.3" y="2.2" width="5.4" height="14" rx="2.5" fill="currentColor"/><circle cx="12" cy="20.2" r="2.9" fill="currentColor"/></svg></span>}</div>
        <div className="storm-metric" data-storm-tour="delivered"><span>DELIVERED TRAFFIC</span><strong>{serverTrafficLabel}</strong></div>
        <div className="storm-metric" data-storm-tour="health"><span>SERVER HEALTH</span><strong className={stats.health < 35 ? 'storm-danger' : ''}>{Math.ceil(stats.health)}%</strong><div className="storm-meter"><i className="storm-health" style={{ width: stats.health + '%' }}/></div></div>
        <div className="storm-metric" data-storm-tour="latency"><span>RESPONSE TIME</span><strong>{mode === 'ready' ? 'READY' : responseMs === null ? 'OFFLINE' : responseMs + ' ms'}</strong></div>
      </section>

      <div className="storm-main-grid">
        <div className="storm-left-stack">
          <section className={'storm-panel storm-network' + (mode === 'running' ? ' is-active' : '')} aria-label="Animated network traffic" data-storm-tour="diagram">
            <div className="storm-panel-heading"><h2>Network traffic</h2></div>
            <svg ref={networkRef} viewBox="0 0 1200 465" preserveAspectRatio="xMidYMid meet" className="storm-network-svg" role="img" aria-label={'Fictional network with a hacker, four botnet groups, ' + proxyCount + ' proxy servers, and ' + serverCount + ' web servers. Every animated packet follows a drawn connection.'}>
              <g className="storm-stage-titles">
                
                <text x="400" y={botnetHeadingY()}>BOTNET</text>
                {proxyEnabled && <text x="750" y={proxyHeadingY(proxyCount)}>{deviceHeading('PROXY', 'PROXIES', proxyCount)}</text>}
                <text x="1075" y={webserverHeadingY(serverCount)}>{deviceHeading('WEBSERVER', 'WEBSERVERS', serverCount)}</text>
              </g>
              <g className="storm-diagram-routes">
                {BOT_Y.map((_, index) => <path key={'command-' + index} id={'storm-command-link-' + index} d={hackerCommandPath(index)} className="storm-command-link"/>)}
                {BOT_Y.map((_, index) => <path key={'attack-link-' + index} id={'storm-attack-link-' + index}
                  d={botLanePath(index, serverYs[index % serverCount], proxyEnabled ? proxyYs[index % proxyCount] : null)}
                  className="storm-network-link storm-network-link--attack"/>)}
                {proxyEnabled && BOT_Y.map((_, index) => <path key={'survivor-link-' + index} id={'storm-survivor-link-' + index}
                  d={relayLanePath(proxyYs[index % proxyCount], serverYs[index % serverCount])}
                  className="storm-network-link storm-network-link--approved"/>)}
              </g>

              <g className="storm-hacker-node">
                <rect x="63" y="187" width="154" height="145" rx="18" className="storm-hacker-shell"/>
                <circle cx="140" cy="260" r="55" className="storm-hacker-emblem-bg"/>
                <path d="M 140 210 C 110 210 91 239 91 267 C 91 286 101 302 116 310 L 125 297 C 115 290 110 278 111 264 C 112 245 125 231 140 231 C 155 231 168 245 169 264 C 170 278 165 290 155 297 L 164 310 C 180 302 189 285 189 267 C 189 239 170 210 140 210 Z" className="storm-hacker-hood"/>
                <path d="M 111 267 Q 124 259 140 260 Q 156 259 169 267 L 161 286 L 147 290 L 140 283 L 133 290 L 119 286 Z" className="storm-hacker-mask"/>
                <path d="M 119 270 l 13 4 M 148 274 l 13 -4" className="storm-hacker-eyes"/>
                <path d="M 133 283 l 7 7 l 7 -7 M 128 292 l 12 11 l 12 -11" className="storm-hacker-beard"/>
                <text x="140" y="357" className="storm-hacker-name">{safeName.slice(0, 14)}</text>
              </g>

              {BOT_Y.map(y => <g key={y} className="storm-bot-node">
                <rect x="350" y={y - 29} width="100" height="58" rx="11" className="storm-device-shell"/>
                <g transform={'translate(400 ' + y + ')'} className="storm-bot-emblem">
                  <circle r="21" className="storm-bot-emblem-bg"/>
                  <path d="M 0 -13 V -18" className="storm-bot-antenna"/>
                  <circle cy="-19" r="3.2" className="storm-bot-antenna-light"/>
                  <rect x="-13" y="-12" width="26" height="23" rx="6" className="storm-bot-faceplate"/>
                  <path d="M -9 -3 L -3 0 L -5 4 L -11 0 Z M 9 -3 L 3 0 L 5 4 L 11 0 Z" className="storm-bot-eyes"/>
                  <path d="M -6 8 H 6" className="storm-bot-mouth"/>
                </g>
              </g>)}
              {proxyYs.map((y, index) => <g key={'proxy-' + index} className={'storm-proxy-edge' + (proxyLoads[index] > 1 ? ' is-overloaded' : proxyLoads[index] > 0.8 ? ' is-busy' : '')}>
                <rect x="710" y={y - 34} width="80" height="68" rx="11" className="storm-proxy-shell"/>
                <circle cx="750" cy={y} r="24" className="storm-proxy-ring"/>
                <path d={'M 750 ' + (y - 20) + ' v 2 M 750 ' + (y + 18) + ' v 2'} className="storm-proxy-link"/>
                <rect x="733" y={y - 16} width="34" height="13" rx="3" className="storm-proxy-rack"/>
                <rect x="733" y={y + 4} width="34" height="13" rx="3" className="storm-proxy-rack"/>
                <circle cx="740" cy={y - 9.5} r="2.6" className="storm-proxy-led"/>
                <circle cx="740" cy={y + 10.5} r="2.6" className="storm-proxy-led"/>
                <path d={'M 750 ' + (y - 9.5) + ' h 11 M 750 ' + (y + 10.5) + ' h 11'} className="storm-proxy-slot"/>
                {proxyLoads[index] > 1 && <text x="779" y={y - 17} className="storm-proxy-overload">!</text>}
              </g>)}

              {serverYs.map((y, index) => <g key={'server-' + index} className={'storm-server-graphic' + (mode === 'offline' ? ' is-offline' : serverLoads[index] > 1 ? ' is-critical' : '')}>
                <rect x="990" y={y - 37} width="170" height="74" rx="9" className="storm-server-shell"/>
                <rect x="1004" y={y - 34} width="142" height="28" rx="5" className="storm-fan-deck"/>
                {[1050, 1100].map((x, rotorIndex) => <g key={'fan-' + rotorIndex} transform={'translate(' + x + ' ' + (y + SERVER_FAN_Y_OFFSET) + ')'} className="storm-rack-fan">
                  <circle r="11.5" className="storm-fan-ring"/>
                  <circle r="9.7" className="storm-fan-shroud"/>
                  <g className="storm-fan-rotor">
                    {FAN_BLADE_ANGLES.map(angle => <path key={angle} transform={'rotate(' + angle + ')'} d="M 0 -2 C 2 -6 5 -11 9 -10 C 13 -9 11 -4 8 -1 Q 4 2 1 2 Z" className="storm-fan-blade"/>)}
                  </g>
                  <circle r="2.8" className="storm-fan-hub"/>
                  <path d="M -8 -8 L 8 8 M -8 8 L 8 -8" className="storm-fan-grille"/>
                </g>)}
                <rect x="1004" y={y + SERVER_RACK_Y_OFFSET} width="142" height="35" rx="5" className="storm-server-rack"/>
                {[0, 12, 24].map((offset, bay) => <g key={'bay-' + bay} className="storm-rack-unit">
                  <rect x="1010" y={y + offset} width="130" height="9" rx="2.3" className="storm-server-slot"/>
                  <circle cx="1018" cy={y + offset + 4.5} r="2" className="storm-led"/>
                  <path d={'M 1026 ' + (y + offset + 3) + ' h 11 M 1026 ' + (y + offset + 6) + ' h 11 M 1044 ' + (y + offset + 3) + ' h 84 M 1044 ' + (y + offset + 6) + ' h 84'} className="storm-server-vents"/>
                </g>)}
                <path d={'M 1149 ' + (y - 30) + ' v 61 M 1153 ' + (y - 30) + ' v 61'} className="storm-server-handle"/>
                <circle cx="992" cy={y - 33} r="1.4" className="storm-rack-screw"/>
                <circle cx="1158" cy={y - 33} r="1.4" className="storm-rack-screw"/>
                <circle cx="992" cy={y + 33} r="1.4" className="storm-rack-screw"/>
                <circle cx="1158" cy={y + 33} r="1.4" className="storm-rack-screw"/>
              </g>)}

              {mode === 'running' && BOT_Y.map((_, index) =>
                <circle key={'command-pulse-' + index} className="storm-command-pulse" r="2.8">
                  <animateMotion dur={(1.25 + index * 0.12) + 's'} begin={(-index * 0.23) + 's'} repeatCount="indefinite">
                    <mpath href={'#storm-command-link-' + index}/>
                  </animateMotion>
                </circle>
              )}
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
            </svg>
          </section>

        </div>

        <aside className="storm-side">
          <section className="storm-panel storm-server-details" data-storm-tour="server-panel">
            <div className="storm-panel-heading"><div><h2>Server response</h2><p>{scenario?.ip}</p></div><Server size={18}/></div>
            <div className="storm-node-usage">
              <div className="storm-node-group">
                <div className="storm-node-heading"><Server size={13}/> SERVER CPU</div>
                <div className="storm-node-load-grid">
                  {serverLoads.map((load, index) => {
                    const percent = mode === 'offline' || mode === 'ready' ? 0 : Math.round(Math.min(100, 12 + load * 72));
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
            <div className="storm-traffic-chart" aria-label="Simulated network traffic over time" data-storm-tour="graph">
              <div className="storm-traffic-chart-heading"><span>Traffic</span><strong>{trafficLabel}</strong></div>
              <svg viewBox="0 0 600 110" preserveAspectRatio="none" role="img" aria-label="Spiky modeled incoming traffic">
                <path d="M 0 106 H 600 M 0 57 H 600" className="storm-chart-axis"/>
                {points && <polyline points={points} className="storm-chart-line"/>}
              </svg>
            </div>
          </section>
        </aside>
      </div>
    </div>}
    {showHelp && <StormGuidedTour steps={TRAFFIC_TUTORIAL_STEPS} step={tutorialStep}
      onStep={setTutorialStep} onClose={() => setShowHelp(false)}/>}
  </main>;
}

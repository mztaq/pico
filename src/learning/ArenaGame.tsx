import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Copy, Crown, Flag, Play, Radio,
  RefreshCw, Shield, Swords, Trophy, Users, Volume2, VolumeX, Zap,
} from 'lucide-react';
import {
  ARENA_TILES, arenaPool, arenaUnits, answerReward, nodeCost,
  questionAt, remainingSeconds, scoreFor, timeLabel, visibleQuestion,
  type ArenaAction, type ArenaNode, type ArenaPlayer, type ArenaQuestion,
} from './arenaRules';
import './arena.css';

type Mode = 'classic' | 'circuit' | 'hacker' | 'sprint';
type Screen = 'menu' | 'solo' | 'host' | 'join';
type Source = 'bank' | 'custom';
type NicknameMode = 'generated' | 'custom';
type Credentials = { code: string; token: string };
type CustomQuestion = {
  prompt: string; choices: [string, string, string, string]; answer: number; explanation: string;
};
type Room = {
  code: string; state: 'lobby' | 'playing' | 'finished'; role: 'host' | 'player';
  mode: Mode; unit: string; minPlayers: number; maxPlayers: number;
  nicknameMode: NicknameMode; questionSource: Source;
  startsAt: number | null; duration: number; expiresAt: number;
  playerId: string | null; question: ArenaQuestion | null;
  players: ArenaPlayer[]; nodes: ArenaNode[];
};
type Feedback = { correct: boolean; earned: number; explanation: string; correctChoice: number; points: number };
type Solo = {
  mode: Mode; unit: string; seed: number; cursor: number; startedAt: number;
  nextBotAt: number; duration: number; charge: number; streak: number;
  amplifier: number; correct: number; answered: number; baseScore: number;
  botScore: number; nodes: ArenaNode[];
};

const STORAGE_KEY = 'pico.arena.room.v1';
const hues = ['#cba6f7', '#89b4fa', '#a6e3a1', '#fab387', '#f38ba8', '#94e2d5', '#f9e2af', '#b4befe'];
const modes = [
  { id: 'classic', name: 'Classic Quiz', subtitle: 'Answer quickly. Highest score wins.', icon: Trophy },
  { id: 'circuit', name: 'Circuit Clash', subtitle: 'Earn charge to capture and reinforce a 2D network.', icon: Zap },
  { id: 'hacker', name: 'Hacker Heist', subtitle: 'Break into rival nodes and control the server grid.', icon: Shield },
  { id: 'sprint', name: 'Data Sprint', subtitle: 'Each correct answer accelerates your racer.', icon: Swords },
] as const;

function getCredentials(): Credentials | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    return value && /^[A-HJ-NP-Z2-9]{6}$/.test(value.code) && /^[a-f0-9]{64}$/.test(value.token) ? value : null;
  } catch { return null; }
}
function freshBoard(): ArenaNode[] {
  return Array.from({ length: ARENA_TILES }, (_, pos) => ({ pos, ownerId: null, level: 1 }));
}
function isTerritory(mode: Mode) { return mode === 'circuit' || mode === 'hacker'; }
function stageScore(player: { correct: number; amplifier: number; baseScore: number }, nodes: ArenaNode[], id: string): number {
  return player.baseScore + scoreFor(nodes.filter(node => node.ownerId === id).map(node => node.level), player.correct, player.amplifier);
}
function soloStandings(solo: Solo): ArenaPlayer[] {
  const youNodes = solo.nodes.filter(node => node.ownerId === 'you');
  const botNodes = solo.nodes.filter(node => node.ownerId === 'bot');
  return [
    { id: 'you', nickname: 'You', charge: solo.charge, streak: solo.streak,
      amplifier: solo.amplifier, correct: solo.correct, answered: solo.answered,
      score: stageScore(solo, solo.nodes, 'you'), owned: youNodes.length, color: 0 },
    { id: 'bot', nickname: 'CPU Rival', charge: 0, streak: 0, amplifier: 0,
      correct: 0, answered: 0, score: solo.botScore + scoreFor(botNodes.map(node => node.level), 0, 0),
      owned: botNodes.length, color: 1 },
  ].sort((a, b) => b.score - a.score);
}
function doBotTurn(solo: Solo): Solo {
  const next = { ...solo, nodes: solo.nodes.map(node => ({ ...node })),
    nextBotAt: Date.now() + 6200 + Math.floor(Math.random() * 3200) };
  if (!isTerritory(solo.mode)) {
    next.botScore += 85 + Math.floor(Math.random() * (solo.mode === 'sprint' ? 135 : 95));
    return next;
  }
  const available = next.nodes.filter(node => node.ownerId === null);
  const enemies = next.nodes.filter(node => node.ownerId === 'you');
  const owned = next.nodes.filter(node => node.ownerId === 'bot' && node.level < 3);
  const candidates = available.length ? available : enemies.length ? enemies : owned;
  if (candidates.length) {
    const node = candidates[Math.floor(Math.random() * candidates.length)]!;
    next.nodes[node.pos] = node.ownerId === 'bot'
      ? { ...node, level: node.level + 1 }
      : { pos: node.pos, level: 1, ownerId: 'bot' };
  }
  return next;
}
function emptyDraft(): CustomQuestion {
  return { prompt: '', choices: ['', '', '', ''], answer: 0, explanation: '' };
}

function NetworkBoard({ nodes, players, viewerId, mode, onSelect, disabled }: {
  nodes: ArenaNode[]; players: ArenaPlayer[]; viewerId: string | null;
  mode: Mode; onSelect: (node: ArenaNode) => void; disabled: boolean;
}) {
  const owners = new Map(players.map(player => [player.id, player]));
  return <div className={'arena-board arena-board--' + mode} role="group"
    aria-label={mode === 'hacker' ? 'Hacker Heist server grid' : 'Circuit Clash network'}>
    {nodes.map(node => {
      const owner = node.ownerId ? owners.get(node.ownerId) : null;
      const own = node.ownerId === viewerId && Boolean(viewerId);
      const color = owner ? hues[owner.color % hues.length] : undefined;
      return <button type="button" className={'arena-node' + (own ? ' is-own' : owner ? ' is-rival' : '')}
        key={node.pos} disabled={disabled} title={'Node ' + (node.pos + 1) + ': ' + (owner?.nickname || 'Unclaimed')}
        style={color ? { '--arena-owner': color } as React.CSSProperties : undefined}
        onClick={() => onSelect(node)}>
        <span className="arena-node-number">{String(node.pos + 1).padStart(2, '0')}</span>
        <span className="arena-node-core" aria-hidden="true">{mode === 'hacker' ? node.ownerId ? '▣' : '□' : node.ownerId ? '◆' : '◇'}</span>
        <span className="arena-node-owner">{owner?.nickname || (mode === 'hacker' ? 'Hack' : 'Claim')}</span>
        {node.ownerId && <span className="arena-node-bars">
          {Array.from({ length: node.level }, (_, index) => <i key={index}/>)}</span>}
      </button>;
    })}
  </div>;
}

function SpeedTrack({ players, mode }: { players: ArenaPlayer[]; mode: Mode }) {
  const high = Math.max(600, ...players.map(player => player.score));
  return <div className={'arena-track arena-track--' + mode}>
    <div className="arena-track-header"><span>START</span><span>{mode === 'sprint' ? 'DATA RACE' : 'SCORE TRACK'}</span><span>FINISH</span></div>
    {players.length ? [...players].sort((a, b) => b.score - a.score).slice(0, 12).map(player => {
      const distance = Math.min(94, player.score / high * 90);
      return <div className="arena-track-lane" key={player.id}>
        <span className="arena-track-name">{player.nickname}</span>
        <div className="arena-track-strip">
          <span className="arena-track-runner" style={{ left: distance + '%',
            background: hues[player.color % hues.length] }}>
            {mode === 'sprint' ? '▸' : '◆'}
          </span>
        </div>
        <strong>{player.score.toLocaleString()}</strong>
      </div>;
    }) : <p>Waiting for players…</p>}
  </div>;
}

function Leaderboard({ players, selfId }: { players: ArenaPlayer[]; selfId: string | null }) {
  const ordered = [...players].sort((a, b) => b.score - a.score || b.correct - a.correct);
  return <section className="arena-scores" aria-label="Live leaderboard">
    <div className="arena-panel-header"><h3>Leaderboard</h3><span>{players.length} players</span></div>
    <div className="arena-leader-list">{ordered.slice(0, 10).map((player, index) =>
      <div className={'arena-leader' + (player.id === selfId ? ' is-you' : '')} key={player.id}>
        <span className="arena-leader-rank">{index === 0 ? <Crown size={15}/> : index + 1}</span>
        <i className="arena-leader-dot" style={{ background: hues[player.color % hues.length] }}/>
        <span className="arena-leader-name">{player.nickname}</span><strong>{player.score.toLocaleString()}</strong>
      </div>)}</div>
    {!ordered.length && <p className="arena-note">No players yet.</p>}
  </section>;
}

function Winners({ players, revealed, onReveal, sound, onSound }: {
  players: ArenaPlayer[]; revealed: boolean; onReveal: () => void;
  sound: boolean; onSound: () => void;
}) {
  const top = [...players].sort((a, b) => b.score - a.score).slice(0, 5);
  return <section className={'arena-ceremony' + (revealed ? ' is-revealed' : '')} aria-label="Final standings">
    <div className="arena-stage-lights" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <div className="arena-ceremony-heading"><Trophy size={30}/><h2>Final results</h2>
      <button type="button" className="arena-outline" aria-label={sound ? 'Mute ceremony' : 'Enable ceremony sound'} onClick={onSound}>
        {sound ? <Volume2 size={16}/> : <VolumeX size={16}/>}
      </button>
    </div>
    {!revealed ? <div className="arena-ceremony-ready">
      <p>Who finished on top?</p>
      <button type="button" className="arena-primary" onClick={onReveal}>Reveal the winners</button>
    </div> : <><div className="arena-podium" aria-live="polite">
      {top.slice(0, 3).map((player, index) => <div key={player.id}
        className={'arena-podium-place arena-podium-place--' + (index + 1)}
        style={{ '--podium-owner': hues[player.color % hues.length] } as React.CSSProperties}>
        <Crown size={index === 0 ? 26 : 18}/>
        <strong>{player.nickname}</strong><span>{player.score.toLocaleString()} pts</span>
        <div className="arena-podium-block">{index + 1}</div>
      </div>)}
    </div><div className="arena-final-standings">
      {top.map((player, index) => <div key={player.id}>
        <span>{index + 1}</span><strong>{player.nickname}</strong><span>{player.score.toLocaleString()} points</span>
      </div>)}
    </div></>}
  </section>;
}

function QuestionPanel({ question, feedback, onAnswer, onNext, busy, onReview }: {
  question: ArenaQuestion | null; feedback: Feedback | null;
  onAnswer: (choice: number) => void; onNext: () => void; busy: boolean;
  onReview?: (topic: string) => void;
}) {
  if (!question && !feedback) return <section className="arena-question"><p className="arena-note">Waiting for a question…</p></section>;
  return <section className="arena-question" aria-label="Answer Computer Science question">
    <div className="arena-panel-header"><h3>Question</h3><span><Zap size={13}/> Earn charge and points</span></div>
    {feedback ? <div className={'arena-answer-result ' + (feedback.correct ? 'correct' : 'wrong')} role="status">
      <span className="arena-result-symbol">{feedback.correct ? <Check size={24}/> : '×'}</span>
      <strong>{feedback.correct ? 'Correct' : 'Incorrect'}</strong>
      <p>{feedback.explanation}</p>
      <span className="arena-earned">+{feedback.points} points · +{feedback.earned} charge</span>
      {onReview && question?.topic !== 'custom' && <button type="button" className="arena-review"
        onClick={() => onReview(question!.topic)}>Review topic</button>}
      <button type="button" className="arena-primary arena-next" onClick={onNext}>Next question <ArrowRight size={16}/></button>
    </div> : <>
      <h4>{question?.prompt}</h4>
      <div className="arena-answers">{question?.choices.map((text, index) =>
        <button key={index} type="button" disabled={busy} onClick={() => onAnswer(index)}>
          <kbd>{'ABCD'[index]}</kbd><span>{text}</span><ArrowRight size={15}/>
        </button>)}</div>
    </>}
  </section>;
}

function playDrumroll() {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const t = context.currentTime;
    for (let index = 0; index < 18; index++) {
      const frequency = 110 + index * 7;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, t + index * .07);
      volume.gain.linearRampToValueAtTime(.075, t + index * .07 + .008);
      volume.gain.exponentialRampToValueAtTime(.001, t + index * .07 + .065);
      oscillator.connect(volume); volume.connect(context.destination);
      oscillator.start(t + index * .07); oscillator.stop(t + index * .07 + .07);
    }
    window.setTimeout(() => { void context.close(); }, 1850);
  } catch { /* Sound is optional. */ }
}

export function ArenaGame({ onReviewTopic }: { onReviewTopic?: (id: string) => void }) {
  const [session, setSession] = useState<Credentials | null>(getCredentials);
  const [room, setRoom] = useState<Room | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('circuit');
  const [unit, setUnit] = useState('all');
  const [nicknameMode, setNicknameMode] = useState<NicknameMode>('generated');
  const [source, setSource] = useState<Source>('bank');
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(30);
  const [duration, setDuration] = useState(180);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [draft, setDraft] = useState<CustomQuestion>(emptyDraft);
  const [editing, setEditing] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [solo, setSolo] = useState<Solo | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [showWinners, setShowWinners] = useState(false);
  const [sound, setSound] = useState(true);
  const credentials = useRef(session);
  credentials.current = session;

  const soloEnded = solo && remainingSeconds(solo.startedAt / 1000, solo.duration, now / 1000) === 0;
  const gameMode = solo?.mode ?? room?.mode ?? mode;
  const ended = Boolean(soloEnded || room?.state === 'finished' ||
    (room?.startsAt && remainingSeconds(room.startsAt, room.duration, now / 1000) === 0));
  const timeLeft = solo
    ? remainingSeconds(solo.startedAt / 1000, solo.duration, now / 1000)
    : room ? remainingSeconds(room.startsAt, room.duration, now / 1000) : duration;
  const players = solo ? soloStandings(solo) : room?.players ?? [];
  const nodes = solo?.nodes ?? room?.nodes ?? freshBoard();
  const myId = solo ? 'you' : room?.playerId ?? null;
  const mine = players.find(player => player.id === myId);
  const isHost = Boolean(session && room?.role === 'host');
  const isActive = Boolean(solo || room?.state === 'playing' || room?.state === 'finished');
  const question = solo ? visibleQuestion(questionAt(solo.unit, solo.seed, solo.cursor)) : room?.question || null;

  useEffect(() => {
    if (!session) return;
    let alive = true;
    let pending = false;
    async function poll() {
      if (pending) return;
      pending = true;
      try {
        const response = await arenaApi('room', null, session);
        if (alive) { setRoom(response as Room); setNotice(''); }
      } catch (error) { if (alive) setNotice(error instanceof Error ? error.message : 'Room disconnected.'); }
      finally { pending = false; }
    }
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 2500);
    return () => { alive = false; window.clearInterval(interval); };
  }, [session?.code, session?.token]);

  useEffect(() => {
    if (!session && !solo) return;
    const interval = window.setInterval(() => {
      const moment = Date.now();
      setNow(moment);
      setSolo(old => old && remainingSeconds(old.startedAt / 1000, old.duration, moment / 1000) > 0 &&
        moment >= old.nextBotAt ? doBotTurn(old) : old);
    }, 300);
    return () => window.clearInterval(interval);
  }, [Boolean(session), Boolean(solo)]);

  async function arenaApi(action: string, body: Record<string, unknown> | null = null,
    auth: Credentials | null = credentials.current): Promise<unknown> {
    const response = await fetch('/api/arena/' + action +
      (action === 'room' ? '?code=' + encodeURIComponent(auth?.code || '') : ''), {
      method: action === 'room' ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { ...(action === 'room' ? {} : { 'Content-Type': 'application/json' }),
        ...(auth ? { Authorization: 'Bearer ' + auth.token } : {}) },
      ...(action !== 'room' ? { body: JSON.stringify(body || {}) } : {}),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw Error((value as { error?: string } | null)?.error || 'Match request failed.');
    return value;
  }
  async function reload() {
    if (credentials.current) setRoom(await arenaApi('room') as Room);
  }
  function leave() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage optional */ }
    setSession(null); setRoom(null); setSolo(null); setScreen('menu');
    setFeedback(null); setNotice(''); setShowWinners(false);
  }
  function initSolo() {
    const clock = Date.now();
    setSolo({ mode, unit, seed: Math.floor(Math.random() * 10000),
      cursor: 0, startedAt: clock, nextBotAt: clock + 7800, duration,
      charge: 0, streak: 0, amplifier: 0, correct: 0, answered: 0,
      baseScore: 0, botScore: 0, nodes: freshBoard() });
    setNow(clock); setNotice(''); setFeedback(null); setShowWinners(false);
  }
  async function call(action: string, data: Record<string, unknown>, callback?: (value: any) => void,
    auth: Credentials | null = credentials.current) {
    setBusy(true); setNotice('');
    try {
      const result = await arenaApi(action, data, auth);
      callback?.(result);
      return result;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Request failed.');
      return null;
    } finally { setBusy(false); }
  }
  function saveCredentials(value: Credentials) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage optional */ }
    setSession(value); setRoom(null); setFeedback(null); setNotice('');
  }
  async function create() {
    if (source === 'custom' && !customQuestions.length) {
      setNotice('Add at least one custom question.'); return;
    }
    const result = await call('create', {
      mode, nicknameMode, minPlayers, maxPlayers, duration, questionSource: source,
      unit, customQuestions: source === 'custom' ? customQuestions : undefined,
    }, undefined, null) as Credentials | null;
    if (result) saveCredentials(result);
  }
  async function join() {
    const result = await call('join', { code: codeInput.trim().toUpperCase(), nickname },
      undefined, null) as Credentials | null;
    if (result) saveCredentials(result);
  }
  async function start() {
    if (session && await call('start', { code: session.code })) await reload().catch(() => {});
  }
  async function finish() {
    if (session && await call('close', { code: session.code })) await reload().catch(() => {});
  }
  async function copyCode() {
    if (!session) return;
    try { await navigator.clipboard.writeText(session.code); setNotice('Room code copied.'); }
    catch { setNotice('Room code: ' + session.code); }
  }
  function updateChoice(index: number, value: string) {
    setDraft(old => ({ ...old,
      choices: old.choices.map((choice, pos) => pos === index ? value : choice) as CustomQuestion['choices'],
    }));
  }
  function saveDraft() {
    const valid = draft.prompt.trim().length >= 8 && draft.choices.every(choice => choice.trim().length > 0);
    if (!valid) { setNotice('Add a question of at least 8 characters and four answer choices.'); return; }
    if (draft.prompt.length > 240 || draft.choices.some(choice => choice.length > 120)) {
      setNotice('Keep the question under 240 characters and answers under 120.'); return;
    }
    if (editing === null && customQuestions.length >= 30) {
      setNotice('Maximum 30 custom questions per room.'); return;
    }
    setCustomQuestions(old => editing === null ? [...old, { ...draft }] :
      old.map((question, index) => editing === index ? { ...draft } : question));
    setDraft(emptyDraft()); setEditing(null); setNotice('');
  }
  function loadDraft(index: number) { setDraft({ ...customQuestions[index]! }); setEditing(index); }
  function removeDraft(index: number) {
    setCustomQuestions(old => old.filter((_, position) => index !== position));
    setDraft(emptyDraft()); setEditing(null);
  }
  function replyToQuestion(choice: number) {
    if (busy || feedback || ended || !question) return;
    if (solo) {
      const original = questionAt(solo.unit, solo.seed, solo.cursor);
      const correct = choice === original.answer;
      const result = answerReward(correct, solo.streak, solo.amplifier);
      const points = correct ? (solo.mode === 'sprint' ? 145 : solo.mode === 'classic' ? 100 : 20)
        + Math.min(solo.streak, 5) * 10 : 0;
      setSolo(current => current && current.cursor === solo.cursor ? { ...current,
        cursor: current.cursor + 1, charge: current.charge + result.charge,
        streak: result.streak, correct: current.correct + result.correct,
        answered: current.answered + 1, baseScore: current.baseScore + points } : current);
      setFeedback({ correct, points, earned: result.charge,
        explanation: original.explanation, correctChoice: original.answer });
    } else if (session) {
      void call('answer', { code: session.code, questionId: question.id, choice }, value => {
        const result = value as Feedback;
        setFeedback(result);
        void reload();
      });
    }
  }
  function selectNode(node: ArenaNode) {
    if (!mine || ended || busy || !isTerritory(gameMode)) return;
    const kind: ArenaAction = node.ownerId === myId ? 'fortify' : 'capture';
    void purchase(kind, node);
  }
  async function purchase(kind: ArenaAction, node?: ArenaNode) {
    if (!mine || ended || busy || !isTerritory(gameMode)) return;
    const cost = kind === 'amplify' ? 70 + mine.amplifier * 45 : nodeCost(kind, node);
    if (cost === null || cost === undefined) { setNotice('Maximum upgrade level.'); return; }
    if (mine.charge < cost) { setNotice('Need ' + cost + ' charge. Correct answers earn charge.'); return; }
    setNotice('');
    if (solo) {
      setSolo(current => current ? {
        ...current, charge: current.charge - cost,
        amplifier: kind === 'amplify' ? current.amplifier + 1 : current.amplifier,
        nodes: kind === 'amplify' || !node ? current.nodes :
          current.nodes.map(tile => tile.pos === node.pos
            ? { ...tile, ownerId: 'you', level: kind === 'capture' ? 1 : Math.min(3, tile.level + 1) } : tile),
      } : current);
    } else if (session) {
      if (await call('action', { code: session.code, kind, pos: node?.pos })) await reload();
    }
  }
  function reveal() {
    if (sound) playDrumroll();
    window.setTimeout(() => setShowWinners(true), sound ? 1250 : 100);
  }

  if (!session && !solo && screen === 'menu') return <section className="arena-game arena-intro">
    <div className="arena-intro-copy">
      <h2>Pico Arena</h2>
      <p>Choose your mode, answer Computer Science questions and compete against friends.</p>
      <div className="arena-mode-actions">
        <button className="arena-primary" type="button" onClick={() => setScreen('solo')}><Play size={16}/> Solo</button>
        <button className="arena-outline" type="button" onClick={() => setScreen('host')}><Users size={16}/> Host a game</button>
        <button className="arena-outline" type="button" onClick={() => setScreen('join')}><Radio size={16}/> Join a game</button>
      </div>
      <div className="arena-rules-pills"><span>4 game modes</span><span>2D gameplay</span><span>Up to 30 players</span></div>
    </div>
    <div className="arena-intro-art">
      <div className="arena-intro-board" aria-hidden="true">{Array.from({ length: 20 }, (_, i) =>
        <span key={i} className={i % 7 < 3 ? 'owned' : i % 5 === 0 ? 'enemy' : ''}>{i % 7 < 3 ? '◆' : '◇'}</span>)}</div>
      <div className="arena-intro-hud"><span><Zap size={16}/> 145</span><span><Flag size={16}/> 8 nodes</span><span><Trophy size={16}/> 1,120</span></div>
    </div>
  </section>;

  if (!session && !solo) return <section className="arena-game arena-new-setup">
    <button type="button" className="arena-text-back" onClick={() => { setScreen('menu'); setNotice(''); }}><ArrowLeft size={16}/> Back</button>
    <div className="arena-setup-frame">
      <h2>{screen === 'solo' ? 'Solo practice' : screen === 'host' ? 'Host a game' : 'Join a game'}</h2>
      {screen === 'join' ? <>
        <label className="arena-label" htmlFor="arena-code">Room code</label>
        <input id="arena-code" value={codeInput} maxLength={6}
          onChange={event => setCodeInput(event.target.value.toUpperCase())} placeholder="ABC234"/>
        <label className="arena-label" htmlFor="arena-name">Nickname (leave blank if host chooses random names)</label>
        <input id="arena-name" value={nickname} maxLength={20}
          onChange={event => setNickname(event.target.value)} placeholder="BeardlyWolf"/>
        <button type="button" className="arena-primary arena-setup-submit" disabled={busy}
          onClick={() => void join()}>Join room <ArrowRight size={16}/></button>
      </> : <>
        <h3 className="arena-setup-subhead">Choose your game mode</h3>
        <div className="arena-mode-grid">{modes.map(item => {
          const Icon = item.icon;
          return <button type="button" key={item.id} className={'arena-mode-card' + (mode === item.id ? ' selected' : '')}
            aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
            <Icon size={20}/><strong>{item.name}</strong><span>{item.subtitle}</span></button>;
        })}</div>
        <div className="arena-config-grid">
          <label className="arena-label">Round length
            <select value={duration} onChange={event => setDuration(Number(event.target.value))}>
              <option value={90}>90 seconds</option><option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option><option value={480}>8 minutes</option>
            </select>
          </label>
          <label className="arena-label">Question topic
            <select value={unit} onChange={event => setUnit(event.target.value)}>
              {arenaUnits.map(value => <option key={value} value={value}>{value === 'all' ? 'All topics' : value}</option>)}
            </select>
          </label>
        </div>
        {screen === 'host' && <>
          <div className="arena-config-grid">
            <label className="arena-label">Minimum players
              <input type="number" min={1} max={maxPlayers} value={minPlayers}
                onChange={event => setMinPlayers(Math.max(1, Math.min(maxPlayers, Number(event.target.value) || 1)))}/>
            </label>
            <label className="arena-label">Maximum players
              <input type="number" min={minPlayers} max={30} value={maxPlayers}
                onChange={event => setMaxPlayers(Math.max(minPlayers, Math.min(30, Number(event.target.value) || minPlayers)))}/>
            </label>
          </div>
          <h3 className="arena-setup-subhead">Nicknames</h3>
          <div className="arena-choice-row">
            <button type="button" aria-pressed={nicknameMode === 'generated'} onClick={() => setNicknameMode('generated')}>Random names</button>
            <button type="button" aria-pressed={nicknameMode === 'custom'} onClick={() => setNicknameMode('custom')}>Players choose</button>
          </div>
          <p className="arena-note">{nicknameMode === 'generated'
            ? 'Players get names such as BeardlyWolf and HotMonkey.'
            : 'Each player enters a unique nickname of 2 to 20 characters.'}</p>
          <h3 className="arena-setup-subhead">Question source</h3>
          <div className="arena-choice-row">
            <button type="button" aria-pressed={source === 'bank'} onClick={() => setSource('bank')}>Topic bank</button>
            <button type="button" aria-pressed={source === 'custom'} onClick={() => setSource('custom')}>My own questions</button>
          </div>
          {source === 'bank' ? <p className="arena-note">
            {arenaPool(unit).length} verified questions currently available in this topic selection. Questions repeat in longer rounds.
          </p> : <section className="arena-custom-editor" aria-label="Custom questions">
            <h4>Questions ({customQuestions.length}/30)</h4>
            <div className="arena-custom-list">{customQuestions.map((item, index) =>
              <div key={index}><strong>{index + 1}. {item.prompt}</strong>
                <button type="button" onClick={() => loadDraft(index)}>Edit</button>
                <button type="button" onClick={() => removeDraft(index)}>Remove</button></div>)}</div>
            <label className="arena-label">Question
              <input value={draft.prompt} maxLength={240} onChange={event => setDraft(old => ({ ...old, prompt: event.target.value }))} placeholder="What does RAM stand for?"/>
            </label>
            {draft.choices.map((text, index) => <label className="arena-label" key={index}>Answer {'ABCD'[index]}
              <input maxLength={120} value={text} onChange={event => updateChoice(index, event.target.value)} placeholder={'Answer ' + 'ABCD'[index]}/>
            </label>)}
            <label className="arena-label">Correct answer
              <select value={draft.answer} onChange={event => setDraft(old => ({ ...old, answer: Number(event.target.value) }))}>
                {[0,1,2,3].map(value => <option key={value} value={value}>{'ABCD'[value]}</option>)}
              </select>
            </label>
            <label className="arena-label">Explanation (optional)
              <input maxLength={350} value={draft.explanation} onChange={event => setDraft(old => ({ ...old, explanation: event.target.value }))}/>
            </label>
            <button className="arena-outline" type="button" onClick={saveDraft}>
              {editing === null ? 'Add question' : 'Save question'}
            </button>
          </section>}
        </>}
        <button type="button" className="arena-primary arena-setup-submit" disabled={busy}
          onClick={() => { if (screen === 'solo') initSolo(); else void create(); }}>
          {screen === 'solo' ? 'Play solo' : 'Create room'} <ArrowRight size={16}/>
        </button>
      </>}
      {notice && <p className="arena-message" role="alert">{notice}</p>}
    </div>
  </section>;

  if (session && !room) return <section className="arena-game arena-loading"><div className="arena-setup-frame">
    <h2>Connecting to room</h2><p>{notice || 'Checking your session…'}</p>
    <button type="button" className="arena-outline" onClick={leave}>Leave</button>
  </div></section>;

  if (room && room.state === 'lobby') return <section className="arena-game arena-lobby">
    <div className="arena-room-top"><h2>Game lobby</h2><button className="arena-outline" type="button" onClick={leave}>Leave</button></div>
    <div className="arena-lobby-layout">
      <section className="arena-lobby-code">
        <p>Room code</p><strong>{room.code}</strong>
        <button className="arena-outline" type="button" onClick={() => void copyCode()}><Copy size={15}/> Copy</button>
        <p className="arena-note">{modes.find(item => item.id === room.mode)?.name} · {timeLabel(room.duration)} ·
          {room.players.length}/{room.maxPlayers} players</p>
        {isHost ? <button type="button" className="arena-primary" disabled={busy || room.players.length < room.minPlayers}
          onClick={() => void start()}><Play size={16}/> Start ({room.minPlayers} minimum)</button>
          : <p className="arena-waiting"><Radio size={16}/> Waiting for the host to start…</p>}
      </section>
      <section className="arena-lobby-roster"><h3>Joined players <span>{room.players.length}/{room.maxPlayers}</span></h3>
        {room.players.map(player => <div key={player.id} className="arena-lobby-player">
          <i className="arena-leader-dot" style={{ background: hues[player.color % hues.length] }}/>{player.nickname}</div>)}
        {!room.players.length && <p className="arena-note">Share the code to invite players.</p>}
      </section>
    </div>
    {notice && <p className="arena-message" role="status">{notice}</p>}
  </section>;

  if (!isActive) return null;

  if (ended) return <section className="arena-game">
    <Winners players={players} revealed={showWinners} onReveal={reveal}
      sound={sound} onSound={() => setSound(old => !old)}/>
    <div className="arena-end-actions">
      {solo && <button type="button" className="arena-primary" onClick={() => { initSolo(); setShowWinners(false); }}><RefreshCw size={16}/> Rematch</button>}
      <button type="button" className="arena-outline" onClick={leave}><ArrowLeft size={16}/> Back to game modes</button>
    </div>
  </section>;

  return <section className={'arena-game arena-match arena-match--' + gameMode}>
    <header className="arena-game-top">
      <div><h2>{modes.find(item => item.id === gameMode)?.name}</h2>
        <span>{solo ? 'Solo vs CPU' : 'Room ' + room?.code}</span></div>
      <div className="arena-game-top-actions"><span className="arena-clock"><span className="arena-clock-dot"/>{timeLabel(timeLeft)}</span>
        <button type="button" className="arena-outline" onClick={leave}><ArrowLeft size={15}/> Leave</button></div>
    </header>
    <div className="arena-match-layout">
      <div className="arena-field">
        <div className="arena-field-heading"><h3>{isTerritory(gameMode) ? gameMode === 'hacker' ? 'Server grid' : 'Circuit grid' : 'Race track'}</h3>
          <span>{isTerritory(gameMode) ? nodes.filter(node => node.ownerId).length + '/20 captured' : players.length + ' racers'}</span></div>
        {isTerritory(gameMode)
          ? <NetworkBoard nodes={nodes} players={players} viewerId={myId} mode={gameMode} onSelect={selectNode}
            disabled={busy || !mine}/>
          : <SpeedTrack players={players} mode={gameMode}/>}
        {isTerritory(gameMode) && <div className="arena-field-guide">
          <span>Unclaimed 35 <Zap size={12}/></span>
          <span>Steal 75+ <Zap size={12}/></span>
          <span>Reinforce 65+ <Zap size={12}/></span>
        </div>}
      </div>
      <div className="arena-play-aside">
        {mine && <div className="arena-stats">
          <div className="arena-stat"><span><Zap size={16}/> Charge</span><strong>{mine.charge}</strong></div>
          <div className="arena-stat"><span><Flag size={16}/> Nodes</span><strong>{mine.owned}</strong></div>
          <div className="arena-stat"><span><Trophy size={16}/> Points</span><strong>{mine.score}</strong></div>
        </div>}
        {mine && isTerritory(gameMode) && <div className="arena-amp"><div><strong><Zap size={16}/> Amplifier</strong>
          <span>Level {mine.amplifier}/3 · +8 charge per level</span></div>
          <button type="button" className="arena-outline" disabled={busy || mine.amplifier >= 3}
            onClick={() => void purchase('amplify')}>Upgrade {70 + mine.amplifier * 45}</button></div>}
        {isHost && <div className="arena-host-controls">
          <p>Players are competing. Questions and scores update automatically.</p>
          <button className="arena-outline" type="button" onClick={() => void finish()}>End match</button></div>}
        {mine && <QuestionPanel question={question} feedback={feedback} busy={busy}
          onAnswer={replyToQuestion} onNext={() => setFeedback(null)}
          onReview={onReviewTopic}/>}
        <Leaderboard players={players} selfId={myId}/>
        {notice && <p className="arena-message" role="status">{notice}</p>}
      </div>
    </div>
  </section>;
}

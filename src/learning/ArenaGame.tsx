import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Crown, Flag, Play, Radio, RefreshCw, Shield, Swords, Trophy, Users, Zap } from 'lucide-react';
import {
  ARENA_COLUMNS, ARENA_TILES, ARENA_ROUND_SECONDS, arenaUnits, answerReward, nodeCost,
  questionAt, remainingSeconds, scoreFor, timeLabel, visibleQuestion,
  type ArenaAction, type ArenaNode, type ArenaPlayer, type ArenaQuestion,
} from './arenaRules';
import './arena.css';

type Role = 'host' | 'player';
type Credentials = { code: string; token: string };
type Room = {
  code: string; state: 'lobby' | 'playing' | 'finished'; unit: string;
  startsAt: number | null; duration: number; expiresAt: number;
  role: Role; playerId: string | null; question: ArenaQuestion | null;
  players: ArenaPlayer[]; nodes: ArenaNode[];
};
type Feedback = { correct: boolean; earned: number; explanation: string; correctChoice: number };
type SoloRun = {
  unit: string; seed: number; cursor: number; startedAt: number; nextBotAt: number;
  charge: number; streak: number; amplifier: number; correct: number; answered: number;
  nodes: ArenaNode[];
};
type Screen = 'menu' | 'solo' | 'host' | 'join';
const key = 'pico.arena.room.v1';
const colors = ['#cba6f7', '#89b4fa', '#a6e3a1', '#fab387', '#f38ba8', '#94e2d5', '#f9e2af', '#b4befe'];

function readSession(): Credentials | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return data && /^[A-HJ-NP-Z2-9]{6}$/.test(data.code) && /^[a-f0-9]{64}$/.test(data.token) ? data : null;
  } catch { return null; }
}
function initialNodes(): ArenaNode[] {
  return Array.from({ length: ARENA_TILES }, (_, pos) => ({ pos, ownerId: null, level: 1 }));
}
function soloPlayers(run: SoloRun): ArenaPlayer[] {
  const mine = run.nodes.filter(node => node.ownerId === 'you');
  const bot = run.nodes.filter(node => node.ownerId === 'bot');
  return [
    { id: 'you', nickname: 'You', charge: run.charge, streak: run.streak, amplifier: run.amplifier,
      correct: run.correct, answered: run.answered, owned: mine.length,
      score: scoreFor(mine.map(node => node.level), run.correct, run.amplifier), color: 0 },
    { id: 'bot', nickname: 'CPU Rival', charge: 0, streak: 0, amplifier: 0, correct: 0, answered: 0,
      owned: bot.length, score: scoreFor(bot.map(node => node.level), 0, 0), color: 1 },
  ];
}
function botTurn(run: SoloRun): SoloRun {
  const nodes = run.nodes.map(node => ({ ...node }));
  const targets = nodes.filter(node => node.ownerId === null);
  const rivals = nodes.filter(node => node.ownerId === 'you');
  const pool = targets.length ? targets : rivals;
  if (pool.length) {
    const target = pool[Math.floor(Math.random() * pool.length)]!;
    nodes[target.pos] = { pos: target.pos, ownerId: 'bot', level: 1 };
  } else {
    const owned = nodes.filter(node => node.ownerId === 'bot' && node.level < 3);
    if (owned.length) {
      const target = owned[Math.floor(Math.random() * owned.length)]!;
      nodes[target.pos] = { ...target, level: target.level + 1 };
    }
  }
  return { ...run, nodes, nextBotAt: Date.now() + 9500 + Math.floor(Math.random() * 3500) };
}
const validEnd = (run: SoloRun, now: number) => remainingSeconds(run.startedAt / 1000, ARENA_ROUND_SECONDS, now / 1000) === 0;

function CircuitBoard({ nodes, players, viewerId, onTile, locked }: {
  nodes: ArenaNode[]; players: ArenaPlayer[]; viewerId: string | null;
  onTile: (node: ArenaNode) => void; locked: boolean;
}) {
  const names = new Map(players.map(player => [player.id, player]));
  return <div className="arena-board" role="group" aria-label="20-node Circuit Clash board">
    {nodes.map(node => {
      const owner = node.ownerId ? names.get(node.ownerId) : null;
      const own = node.ownerId && node.ownerId === viewerId;
      const color = owner ? colors[owner.color % colors.length] : undefined;
      const label = owner?.nickname || 'Unclaimed';
      return <button type="button" key={node.pos}
        className={'arena-node' + (own ? ' is-own' : owner ? ' is-rival' : '')}
        style={color ? { '--arena-owner': color } as React.CSSProperties : undefined}
        onClick={() => onTile(node)} disabled={locked}
        title={'Node ' + (node.pos + 1) + ': ' + label}
        aria-label={'Node ' + (node.pos + 1) + ', ' + label +
          (node.ownerId ? ', level ' + node.level : '')}>
        <span className="arena-node-number">{String(node.pos + 1).padStart(2, '0')}</span>
        <span className="arena-node-core" aria-hidden="true">{node.ownerId ? '◆' : '◇'}</span>
        <span className="arena-node-owner">{owner?.nickname || 'Claim'}</span>
        {node.ownerId && <span className="arena-node-bars" aria-label={'Level ' + node.level}>
          {Array.from({ length: node.level }, (_, i) => <i key={i}/>)}
        </span>}
      </button>;
    })}
  </div>;
}
function ArenaScores({ players, viewerId }: { players: ArenaPlayer[]; viewerId: string | null }) {
  const ranked = [...players].sort((a, b) => b.score - a.score || b.owned - a.owned);
  return <section className="arena-scores" aria-label="Live leaderboard">
    <div className="arena-panel-header"><h3>Leaderboard</h3><span>{players.length} players</span></div>
    <div className="arena-leader-list">
      {ranked.length ? ranked.map((player, i) => <div key={player.id}
        className={'arena-leader' + (player.id === viewerId ? ' is-you' : '')}>
        <span className="arena-leader-rank">{i === 0 ? <Crown size={15}/> : String(i + 1).padStart(2, '0')}</span>
        <span className="arena-leader-dot" style={{ background: colors[player.color % colors.length] }}/>
        <span className="arena-leader-name">{player.nickname}</span>
        <strong>{player.score.toLocaleString()}</strong>
      </div>) : <p className="arena-note">Players appear here when they join.</p>}
    </div>
  </section>;
}
function ArenaQuestionPanel({ question, feedback, busy, onAnswer, onNext, onReview }: {
  question: ArenaQuestion | null; feedback: Feedback | null; busy: boolean;
  onAnswer: (choice: number) => void; onNext: () => void;
  onReview?: (topic: string) => void;
}) {
  if (!question) return <div className="arena-question-empty">Waiting for the next question…</div>;
  return <section className="arena-question" aria-label="Current question">
    <div className="arena-panel-header"><h3>Earn charge</h3><span>+25 to +64 <Zap size={13}/></span></div>
    {feedback ? <div className={'arena-answer-result' + (feedback.correct ? ' correct' : ' wrong')} role="status">
      <span className="arena-result-symbol">{feedback.correct ? <Check size={24}/> : '×'}</span>
      <strong>{feedback.correct ? 'Correct answer' : 'Not quite'}</strong>
      <p>{feedback.explanation}</p>
      {feedback.earned > 0 && <span className="arena-earned"><Zap size={15}/> +{feedback.earned} charge</span>}
      {onReview && <button className="arena-review" type="button" onClick={() => onReview(question.topic)}>Review topic</button>}
      <button className="arena-primary arena-next" type="button" onClick={onNext}>Next question <ArrowRight size={16}/></button>
    </div> : <>
      <h4>{question.prompt}</h4>
      <div className="arena-answers">
        {question.choices.map((choice, index) => <button type="button" key={index}
          onClick={() => onAnswer(index)} disabled={busy}>
          <kbd>{'ABCD'[index]}</kbd><span>{choice}</span><ArrowRight size={15}/>
        </button>)}
      </div>
    </>}
  </section>;
}

export function ArenaGame({ onReviewTopic }: { onReviewTopic?: (id: string) => void }) {
  const [session, setSession] = useState<Credentials | null>(readSession);
  const [screen, setScreen] = useState<Screen>('menu');
  const [unit, setUnit] = useState('all');
  const [codeInput, setCodeInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [solo, setSolo] = useState<SoloRun | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<number | null>(null);
  const credentialsRef = useRef(session);
  credentialsRef.current = session;
  const roomRef = useRef(room);
  roomRef.current = room;

  const participants = solo ? soloPlayers(solo) : (room?.players || []);
  const board = solo?.nodes || room?.nodes || initialNodes();
  const selfId = solo ? 'you' : room?.playerId || null;
  const self = participants.find(player => player.id === selfId) || null;
  const state = solo ? validEnd(solo, now) ? 'finished' : 'playing' : room?.state || 'lobby';
  const timeLeft = solo ? remainingSeconds(solo.startedAt / 1000, ARENA_ROUND_SECONDS, now / 1000)
    : room ? remainingSeconds(room.startsAt, room.duration, now / 1000) : ARENA_ROUND_SECONDS;
  const question = solo && state === 'playing'
    ? visibleQuestion(questionAt(solo.unit, solo.seed, solo.cursor)) : room?.question || null;
  const isHost = Boolean(session && room?.role === 'host');

  async function api(action: string, data?: Record<string, unknown>, credentials: Credentials | null = credentialsRef.current) {
    const response = await fetch('/api/arena/' + action + (action === 'room' ? '?code=' + encodeURIComponent(credentials?.code || '') : ''), {
      method: action === 'room' ? 'GET' : 'POST',
      cache: 'no-store', credentials: 'same-origin',
      headers: {
        ...(action !== 'room' ? { 'Content-Type': 'application/json' } : {}),
        ...(credentials ? { Authorization: 'Bearer ' + credentials.token } : {}),
      },
      ...(action !== 'room' ? { body: JSON.stringify(data || {}) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Error(result?.error || 'Unable to reach the match.');
    return result;
  }

  async function refresh(credentials = credentialsRef.current) {
    if (!credentials) return;
    const data = await api('room', undefined, credentials) as Room;
    if (credentialsRef.current?.token === credentials.token) setRoom(data);
  }
  useEffect(() => {
    if (!session) return;
    let active = true, pending = false;
    async function poll() {
      if (pending) return;
      pending = true;
      try {
        if (session) {
          const data = await api('room', undefined, session) as Room;
          if (active) { setRoom(data); setMessage(''); }
        }
      } catch (reason) {
        if (active) setMessage(reason instanceof Error ? reason.message : 'Connection failed.');
      } finally { pending = false; }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 3500);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.code, session?.token]);

  useEffect(() => {
    if (!solo && !session) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      setSolo(old => old && !validEnd(old, current) && current >= old.nextBotAt ? botTurn(old) : old);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [Boolean(solo), Boolean(session)]);

  function startSolo() {
    setFeedback(null); setSelected(null); setMessage('');
    setSolo({ unit, seed: Math.floor(Math.random() * 5000), cursor: 0, startedAt: Date.now(),
      nextBotAt: Date.now() + 9000, charge: 0, streak: 0, amplifier: 0, correct: 0, answered: 0,
      nodes: initialNodes() });
    setScreen('solo'); setNow(Date.now());
  }

  function saveSession(data: Credentials) {
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* private browsing */ }
    setSession(data); setRoom(null); setFeedback(null); setMessage('');
  }
  function leave() {
    try { sessionStorage.removeItem(key); } catch { /* private browsing */ }
    setSession(null); setRoom(null); setSolo(null); setScreen('menu'); setMessage('');
    setFeedback(null); setSelected(null);
  }
  async function create() {
    setBusy(true); setMessage('');
    try { saveSession(await api('create', { unit }, null)); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to create match.'); }
    finally { setBusy(false); }
  }
  async function join() {
    setBusy(true); setMessage('');
    try { saveSession(await api('join', { code: codeInput.trim().toUpperCase(), nickname: nickname.trim() }, null)); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to join match.'); }
    finally { setBusy(false); }
  }
  async function startHosted() {
    if (!session) return;
    setBusy(true);
    try { await api('start', { code: session.code }); await refresh(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to start.'); }
    finally { setBusy(false); }
  }
  async function finishHosted() {
    if (!session) return;
    setBusy(true);
    try { await api('close', { code: session.code }); await refresh(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to end the match.'); }
    finally { setBusy(false); }
  }
  async function copyCode() {
    if (!session) return;
    try { await navigator.clipboard.writeText(session.code); setMessage('Code copied.'); }
    catch { setMessage('Share the code ' + session.code); }
  }

  async function submitAnswer(choice: number) {
    if (busy || feedback || state !== 'playing' || !question) return;
    setBusy(true); setMessage('');
    try {
      if (solo) {
        const correct = choice === questionAt(solo.unit, solo.seed, solo.cursor).answer;
        const result = answerReward(correct, solo.streak, solo.amplifier);
        setSolo(run => run ? { ...run, cursor: run.cursor + 1,
          charge: run.charge + result.charge, streak: result.streak,
          correct: run.correct + result.correct, answered: run.answered + 1 } : run);
        setFeedback({ correct, earned: result.charge,
          explanation: questionAt(solo.unit, solo.seed, solo.cursor).explanation,
          correctChoice: questionAt(solo.unit, solo.seed, solo.cursor).answer });
      } else if (session) {
        const result = await api('answer', { code: session.code, questionId: question.id, choice });
        setFeedback({ correct: result.correct, earned: result.earned,
          explanation: result.explanation, correctChoice: result.correctChoice });
        await refresh();
      }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to submit answer.'); }
    finally { setBusy(false); }
  }

  async function purchase(kind: ArenaAction, node?: ArenaNode) {
    if (busy || state !== 'playing' || !self) return;
    if (kind === 'capture' && node?.ownerId === selfId) return;
    if (kind === 'fortify' && node?.ownerId !== selfId) return;
    const cost = kind === 'amplify' ? 70 + self.amplifier * 45 : nodeCost(kind, node);
    if (cost === null || cost === undefined) { setMessage('This upgrade is already at maximum.'); return; }
    if (self.charge < cost) { setMessage('Need ' + cost + ' charge. Answer questions to earn more.'); return; }
    setBusy(true); setMessage('');
    try {
      if (solo) {
        if (kind === 'amplify') {
          setSolo(run => run ? { ...run, amplifier: run.amplifier + 1, charge: run.charge - cost } : run);
        } else if (node) {
          setSolo(run => run ? { ...run, charge: run.charge - cost,
            nodes: run.nodes.map(tile => tile.pos === node.pos
              ? kind === 'capture' ? { ...tile, ownerId: 'you', level: 1 }
                : { ...tile, level: Math.min(3, tile.level + 1) }
              : tile) } : run);
        }
      } else if (session) {
        await api('action', { code: session.code, kind, pos: node?.pos });
        await refresh();
      }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Action failed.'); }
    finally { setBusy(false); }
  }

  function tileClick(node: ArenaNode) {
    if (!self || state !== 'playing') return;
    setSelected(node.pos);
    void purchase(node.ownerId === selfId ? 'fortify' : 'capture', node);
  }

  if (!solo && !session && screen === 'menu') return <section className="arena-game arena-intro" aria-label="Circuit Clash game">
    <div className="arena-intro-copy">
      <h2>Circuit Clash</h2>
      <p>Answer Computer Science questions. Earn charge. Capture the circuit before your rivals.</p>
      <div className="arena-mode-actions">
        <button className="arena-primary" type="button" onClick={() => setScreen('solo')}><Play size={17}/> Play solo</button>
        <button className="arena-outline" type="button" onClick={() => setScreen('host')}><Users size={17}/> Host match</button>
        <button className="arena-outline" type="button" onClick={() => setScreen('join')}><Radio size={17}/> Join match</button>
      </div>
      <div className="arena-rules-pills"><span>3-minute rounds</span><span>20-node arena</span><span>30 players max</span></div>
    </div>
    <div className="arena-intro-art">
      <div className="arena-intro-board" aria-hidden="true">
        {Array.from({ length: ARENA_TILES }, (_, pos) =>
          <span key={pos} className={pos % 7 < 3 ? 'owned' : pos % 5 === 0 ? 'enemy' : ''}>
            {pos % 7 < 3 ? '◆' : '◇'}
          </span>)}
      </div>
      <div className="arena-intro-hud" aria-hidden="true">
        <span><Zap size={16}/> 145</span><span><Flag size={16}/> 8 nodes</span><span><Trophy size={16}/> 1,120</span>
      </div>
    </div>
  </section>;

  if (!solo && !session && ['solo','host','join'].includes(screen)) return <section className="arena-game arena-setup" aria-label="Game setup">
    <button className="arena-text-back" type="button" onClick={() => { setScreen('menu'); setMessage(''); }}><ArrowLeft size={16}/> Back</button>
    <div className="arena-setup-frame">
      <div className="arena-setup-heading">
        <span className="arena-setup-icon">{screen === 'solo' ? <Swords size={24}/> : screen === 'host' ? <Users size={24}/> : <Radio size={24}/>}</span>
        <h2>{screen === 'solo' ? 'Solo match' : screen === 'host' ? 'Host a match' : 'Join a match'}</h2>
        <p>{screen === 'solo' ? 'Beat the CPU rival before the timer runs out.'
          : screen === 'host' ? 'Create a room, share the code, and start when everyone joins.'
          : 'Enter your room code and nickname to play.'}</p>
      </div>
      {screen !== 'join' ? <>
        <label className="arena-label" htmlFor="arena-unit">Questions</label>
        <select id="arena-unit" value={unit} onChange={event => setUnit(event.target.value)}>
          {arenaUnits.map(value => <option value={value} key={value}>{value === 'all' ? 'All Computer Science topics' : value}</option>)}
        </select>
        <div className="arena-setup-info"><Zap size={16}/> Every correct answer earns charge for capturing nodes.</div>
        <button className="arena-primary arena-setup-submit" type="button" disabled={busy}
          onClick={() => { if (screen === 'solo') startSolo(); else void create(); }}>
          {busy ? 'Creating…' : screen === 'solo' ? 'Start solo match' : 'Create room'} <ArrowRight size={16}/>
        </button>
      </> : <>
        <label className="arena-label" htmlFor="arena-code">Room code</label>
        <input id="arena-code" maxLength={6} autoComplete="off" value={codeInput}
          onChange={event => setCodeInput(event.target.value.toUpperCase())} placeholder="ABC234"/>
        <label className="arena-label" htmlFor="arena-name">Nickname</label>
        <input id="arena-name" maxLength={20} autoComplete="off" value={nickname}
          onChange={event => setNickname(event.target.value)} placeholder="Student 1"/>
        <button className="arena-primary arena-setup-submit" type="button" disabled={busy} onClick={() => void join()}>
          {busy ? 'Joining…' : 'Join room'} <ArrowRight size={16}/>
        </button>
      </>}
      {message && <p className="arena-message" role="alert">{message}</p>}
    </div>
  </section>;

  if (session && !room) return <section className="arena-game arena-loading">
    <div className="arena-setup-frame"><h2>Connecting to match</h2><p>{message || 'Loading room and players…'}</p>
      <button className="arena-outline" type="button" onClick={leave}>Leave match</button></div>
  </section>;

  if (session && room?.state === 'lobby') return <section className="arena-game arena-lobby">
    <div className="arena-room-top"><h2>Match lobby</h2><button type="button" className="arena-outline" onClick={leave}>Leave</button></div>
    <div className="arena-lobby-layout">
      <div className="arena-lobby-code">
        <p>Share this code</p><strong>{session.code}</strong>
        <button type="button" className="arena-outline" onClick={() => void copyCode()}><Copy size={15}/> Copy code</button>
        <p className="arena-note">{room.unit === 'all' ? 'All topics' : room.unit} · 3-minute round · Up to 30 students</p>
        {isHost ? <button className="arena-primary" type="button" disabled={busy || room.players.length < 1} onClick={() => void startHosted()}>
          <Play size={16}/> Start match ({room.players.length} joined)
        </button> : <p className="arena-waiting"><Radio size={16}/> Waiting for the host…</p>}
      </div>
      <div className="arena-lobby-roster"><h3>Players <span>{room.players.length}/30</span></h3>
        {room.players.length ? <div className="arena-lobby-names">{room.players.map(player =>
          <span key={player.id}><span className="arena-leader-dot" style={{ background: colors[player.color % colors.length] }}/>{player.nickname}</span>)}</div>
          : <p>No players yet. Share the code to begin.</p>}
      </div>
    </div>
    {message && <p className="arena-message" role="status">{message}</p>}
  </section>;

  const finished = state === 'finished' || timeLeft === 0;
  const ranked = [...participants].sort((a, b) => b.score - a.score || b.owned - a.owned);
  const winner = ranked[0] || null;

  return <section className="arena-game arena-match" aria-label="Circuit Clash match">
    <header className="arena-game-top">
      <div><h2>Circuit Clash</h2><span>{solo ? 'Solo vs CPU' : 'Room ' + session?.code}</span></div>
      <div className="arena-game-top-actions">
        <span className={'arena-clock' + (timeLeft <= 30 ? ' is-low' : '')}><span className="arena-clock-dot"/> {timeLabel(timeLeft)}</span>
        <button className="arena-outline" type="button" onClick={leave}><ArrowLeft size={15}/> Leave</button>
      </div>
    </header>
    {finished && <div className="arena-end-banner" role="status">
      <Trophy size={22}/><div><strong>{winner ? (winner.id === selfId ? 'You won!' : winner.nickname + ' wins!') : 'Round complete'}</strong>
        <span>{winner ? winner.score.toLocaleString() + ' points · ' + winner.owned + ' nodes' : 'No players completed the match'}</span></div>
      {solo && <button className="arena-primary" type="button" onClick={startSolo}><RefreshCw size={15}/> Rematch</button>}
    </div>}
    <div className="arena-match-layout">
      <div className="arena-field">
        <div className="arena-field-heading">
          <h3>Network</h3>
          <span>{ARENA_COLUMNS} × {ARENA_TILES / ARENA_COLUMNS} · {board.filter(node => node.ownerId).length}/{ARENA_TILES} captured</span>
        </div>
        <CircuitBoard nodes={board} players={participants} viewerId={selfId} onTile={tileClick}
          locked={busy || finished || !self}/>
        <div className="arena-field-guide">
          <span><i className="arena-guide-empty"/> Open: 35 <Zap size={12}/></span>
          <span><i className="arena-guide-self"/> Reinforce: 65+ <Zap size={12}/></span>
          <span><i className="arena-guide-rival"/> Steal: 75+ <Zap size={12}/></span>
        </div>
        {selected !== null && <p className="arena-selection">Node {selected + 1} selected.</p>}
      </div>
      <div className="arena-play-aside">
        {self && <div className="arena-stats">
          <div className="arena-stat"><span><Zap size={16}/> Charge</span><strong>{self.charge}</strong></div>
          <div className="arena-stat"><span><Flag size={16}/> Nodes</span><strong>{self.owned}</strong></div>
          <div className="arena-stat"><span><Trophy size={16}/> Points</span><strong>{self.score.toLocaleString()}</strong></div>
        </div>}
        {self && !finished && <div className="arena-amp">
          <div><strong><Zap size={17}/> Amplifier</strong><span>Level {self.amplifier}/3 · +8 charge per level</span></div>
          <button type="button" className="arena-outline" disabled={busy || self.amplifier >= 3 || self.charge < 70 + self.amplifier * 45}
            onClick={() => void purchase('amplify')}>{self.amplifier >= 3 ? 'Maxed' : 'Upgrade ' + (70 + self.amplifier * 45)} <Zap size={13}/></button>
        </div>}
        {isHost && !finished && <div className="arena-host-controls">
          <p>Students answer questions to earn charge, then capture and reinforce nodes. Scores update automatically.</p>
          <button className="arena-outline" type="button" disabled={busy} onClick={() => void finishHosted()}>End match</button>
        </div>}
        {self && !finished && <ArenaQuestionPanel question={question} feedback={feedback} busy={busy}
          onAnswer={choice => void submitAnswer(choice)} onNext={() => setFeedback(null)}
          onReview={onReviewTopic}/>}
        <ArenaScores players={participants} viewerId={selfId}/>
        {message && <p className="arena-message" role="alert">{message}</p>}
      </div>
    </div>
  </section>;
}

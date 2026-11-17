import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, Play, Users, X } from 'lucide-react';
import { challenges } from './challenges';

type LocalSession = { code: string; token: string; role: 'host' | 'student' };
type Player = { id: string; nickname: string; passed: number | null; total: number | null; attempts: number | null };
type Room = {
  code: string;
  state: 'open' | 'closed';
  expiresAt: number;
  role: 'host' | 'student';
  nickname?: string;
  challenge: { id: string; title: string; task: string; starter: string; level: string };
  players: Player[];
};
const storageKey = 'pico.classroom.session.v1';
function readSession(): LocalSession | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (saved && /^[A-HJ-NP-Z2-9]{6}$/.test(saved.code) &&
        /^[a-f0-9]{64}$/.test(saved.token) && ['host', 'student'].includes(saved.role)) return saved;
  } catch { /* no session */ }
  return null;
}

export function Classroom() {
  const [session, setSession] = useState<LocalSession | null>(readSession);
  const [room, setRoom] = useState<Room | null>(null);
  const [mode, setMode] = useState<'host' | 'join'>('host');
  const [challengeId, setChallengeId] = useState(challenges[0]!.id);
  const [joinCode, setJoinCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [score, setScore] = useState<{ passed: number; total: number } | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  async function api(action: string, details?: Record<string, unknown>, credentials = sessionRef.current) {
    const response = await fetch('/api/classroom/' + action + (action === 'room' ? '?code=' + encodeURIComponent(credentials?.code || '') : ''), {
      method: action === 'room' ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(action !== 'room' ? { 'Content-Type': 'application/json' } : {}),
        ...(credentials ? { Authorization: 'Bearer ' + credentials.token } : {}),
      },
      ...(action !== 'room' ? { body: JSON.stringify(details || {}) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw Error(data?.error || 'Classroom request failed.');
    return data;
  }

  function remember(next: LocalSession) {
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* optional */ }
    setSession(next);
    setRoom(null);
    setMessage('');
  }

  function leave() {
    try { sessionStorage.removeItem(storageKey); } catch { /* optional */ }
    setSession(null);
    setRoom(null);
    setMessage('');
    setScore(null);
    setSource('');
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function refresh() {
      if (!sessionRef.current) return;
      try {
        const current: Room = await api('room', undefined, sessionRef.current);
        if (!cancelled) {
          setRoom(current);
          setMessage('');
          setSource(previous => previous || current.challenge.starter);
        }
      } catch (reason) {
        if (!cancelled) setMessage(reason instanceof Error ? reason.message : 'Could not refresh the room.');
      } finally { if (!cancelled) setPolling(false); }
    }
    setPolling(true);
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 7000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session?.code, session?.token]);

  async function create() {
    setBusy(true); setMessage('');
    try {
      const data = await api('create', { challengeId }, null);
      remember({ code: data.code, token: data.token, role: 'host' });
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to start classroom.'); }
    finally { setBusy(false); }
  }

  async function join() {
    setBusy(true); setMessage('');
    try {
      const code = joinCode.trim().toUpperCase();
      const data = await api('join', { code, nickname: nickname.trim() }, null);
      remember({ code: data.code, token: data.token, role: 'student' });
      setSource('');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to join classroom.'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!session) return;
    setBusy(true); setMessage('');
    try {
      const result = await api('submit', { code: session.code, source });
      setScore({ passed: result.passed, total: result.total });
      const fresh = await api('room');
      setRoom(fresh);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to check submission.'); }
    finally { setBusy(false); }
  }

  async function close() {
    if (!session) return;
    setBusy(true); setMessage('');
    try { await api('close', { code: session.code }); setRoom(current => current ? { ...current, state: 'closed' } : current); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to close room.'); }
    finally { setBusy(false); }
  }

  async function copy() {
    if (!session) return;
    try { await navigator.clipboard.writeText(session.code); setMessage('Room code copied.'); }
    catch { setMessage('Share this code: ' + session.code); }
  }

  if (!session) return <section className="suite-surface suite-classroom-setup">
    <h2>Classroom</h2>
    <div className="suite-switch suite-classroom-mode" role="group" aria-label="Classroom mode">
      <button type="button" aria-pressed={mode === 'host'} onClick={() => { setMode('host'); setMessage(''); }}>Host</button>
      <button type="button" aria-pressed={mode === 'join'} onClick={() => { setMode('join'); setMessage(''); }}>Join</button>
    </div>
    {mode === 'host' ? <>
      <p>Start a coding challenge for your class. Share the six-character room code.</p>
      <label className="suite-label" htmlFor="classroom-challenge">Challenge</label>
      <select id="classroom-challenge" value={challengeId} onChange={event => setChallengeId(event.target.value)}>
        {challenges.map(challenge => <option key={challenge.id} value={challenge.id}>{challenge.title}</option>)}
      </select>
      <button type="button" className="suite-primary" disabled={busy} onClick={create}><Users size={16} /> {busy ? 'Creating…' : 'Create classroom'}</button>
    </> : <>
      <p>Enter the code given by your teacher. Use a nickname, not your full name.</p>
      <label className="suite-label" htmlFor="classroom-code">Room code</label>
      <input id="classroom-code" autoCapitalize="characters" autoComplete="off" maxLength={6} value={joinCode}
        onChange={event => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC234" />
      <label className="suite-label" htmlFor="classroom-nickname">Nickname</label>
      <input id="classroom-nickname" autoComplete="off" maxLength={24} value={nickname}
        onChange={event => setNickname(event.target.value)} placeholder="Student 1" />
      <button type="button" className="suite-primary" disabled={busy} onClick={join}>{busy ? 'Joining…' : 'Join classroom'}</button>
    </>}
    {message && <p className="suite-error" role="status">{message}</p>}
  </section>;

  return <section className="suite-classroom-room">
    <div className="suite-surface suite-room-header">
      <div className="suite-section-header">
        <div><h2>{session.role === 'host' ? 'Classroom host' : 'Classroom challenge'}</h2>
          <p className="suite-hint">Room {session.code} · {room?.state === 'closed' ? 'Closed' : 'Active'}</p>
        </div>
        <button type="button" className="suite-secondary" onClick={leave}><X size={15} /> Leave</button>
      </div>
      {session.role === 'host' && <div className="suite-actions">
        <strong className="suite-room-code">{session.code}</strong>
        <button type="button" className="suite-secondary" onClick={copy}><ClipboardCopy size={15} /> Copy code</button>
        <button type="button" className="suite-secondary" onClick={close} disabled={busy || room?.state === 'closed'}>Close room</button>
      </div>}
      {message && <p className="suite-hint" role="status">{message}</p>}
    </div>

    {!room ? <section className="suite-surface"><p className="suite-hint">{polling ? 'Loading classroom…' : 'Connecting to classroom…'}</p></section>
      : <div className="suite-room-layout">
        <section className="suite-surface suite-room-task">
          <h2>{room.challenge.title}</h2>
          <p className="suite-task-copy">{room.challenge.task}</p>
          {session.role === 'student' && <>
            <label className="suite-label" htmlFor="classroom-editor">Your pseudocode</label>
            <textarea id="classroom-editor" className="suite-code" spellCheck={false} value={source}
              onChange={event => setSource(event.target.value)} />
            <button type="button" className="suite-primary" disabled={busy || room.state !== 'open'}
              onClick={submit}><Play size={15} /> {busy ? 'Checking…' : 'Submit solution'}</button>
            {score && <p className="suite-room-result"><Check size={16} /> {score.passed}/{score.total} tests passed</p>}
          </>}
        </section>
        <aside className="suite-surface suite-room-scores">
          <div className="suite-section-header"><h2>Results</h2><span className="suite-count">{room.players.length}/30</span></div>
          {!room.players.length ? <p className="suite-hint">No students joined yet.</p> : <table className="suite-trace-table">
            <thead><tr><th>Student</th><th>Best score</th></tr></thead>
            <tbody>{room.players.map(player => <tr key={player.id}><td>{player.nickname}</td>
              <td>{player.passed === null ? 'Not submitted' : player.passed + '/' + player.total}</td></tr>)}</tbody>
          </table>}
        </aside>
      </div>}
  </section>;
}

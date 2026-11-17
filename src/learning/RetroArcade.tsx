import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';

type Game = 'catcher' | 'logic';
const bestKey = (game: Game) => 'pico.arcade.' + game + '.best.v1';
function best(game: Game) {
  try { return Math.max(0, Number(localStorage.getItem(bestKey(game)) || 0) || 0); }
  catch { return 0; }
}
function saveBest(game: Game, score: number) {
  try { localStorage.setItem(bestKey(game), String(Math.max(score, best(game)))); }
  catch { /* storage optional */ }
}

const VALUES = [1, 2, 4, 8];
const TARGETS = [3, 5, 6, 9, 10, 12, 13];
type Token = { x: number; y: number; value: number };
type CatcherState = { x: number; sum: number; target: number; score: number; lives: number;
  tokens: Token[]; previous: number; nextSpawn: number; started: number; finished: boolean };
const chooseTarget = () => TARGETS[Math.floor(Math.random() * TARGETS.length)]!;

function BitCatcher({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef({ left: false, right: false });
  const frame = useRef(0);
  const [hud, setHud] = useState({ score: 0, total: 0, target: 5, lives: 3, seconds: 45, over: false });
  const [round, setRound] = useState(0);
  const [record, setRecord] = useState(() => best('catcher'));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!ctx || !canvas) return;
    const style = getComputedStyle(canvas);
    const bg = style.getPropertyValue('--bg').trim() || '#1e1e2e';
    const accent = style.getPropertyValue('--accent').trim() || '#cba6f7';
    const fg = style.getPropertyValue('--ds-text').trim() || '#cdd6f4';
    const surface = style.getPropertyValue('--ds-panel-raised').trim() || '#2a2a40';
    const state: CatcherState = { x: 160, sum: 0, target: 5, score: 0, lives: 3,
      tokens: [], previous: 0, nextSpawn: 0, started: 0, finished: false };
    let cancelled = false;
    function draw() {
      if (!ctx) return;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 320, 190);
      ctx.fillStyle = surface;
      for(let i=0;i<32;i++) ctx.fillRect(i * 10, 0, 1, 190);
      ctx.fillStyle = fg; ctx.font = '8px monospace';
      ctx.fillText('CATCH BINARY VALUES TO HIT THE TARGET', 7, 13);
      ctx.fillText('TARGET: ' + state.target, 7, 27);
      ctx.fillText('TOTAL: ' + state.sum, 110, 27);
      ctx.fillStyle = accent;
      ctx.fillRect(state.x - 19, 170, 38, 7);
      ctx.fillRect(state.x - 4, 165, 8, 5);
      for(const token of state.tokens) {
        ctx.fillStyle = accent; ctx.fillRect(token.x - 10, token.y - 9, 20, 18);
        ctx.fillStyle = bg; ctx.font = 'bold 12px monospace';
        ctx.fillText(String(token.value), token.x - (token.value > 9 ? 7 : 4), token.y + 4);
      }
      ctx.fillStyle = fg; ctx.fillRect(0, 182, 320, 2);
      if(state.finished) {
        ctx.fillStyle = surface; ctx.fillRect(53, 63, 214, 61);
        ctx.fillStyle = accent; ctx.font = 'bold 16px monospace'; ctx.fillText('GAME OVER', 112, 84);
        ctx.fillStyle = fg; ctx.font = '10px monospace';
        ctx.fillText('SCORE: ' + state.score, 125, 102);
      }
    }
    function frameStep(time: number) {
      if(cancelled) return;
      if(!state.started) { state.started = time; state.previous = time; }
      const dt = Math.min((time - state.previous) / 1000, 0.06);
      state.previous = time;
      const left = held.current.left, right = held.current.right;
      if(!state.finished) {
        if(left) state.x = Math.max(21, state.x - 155 * dt);
        if(right) state.x = Math.min(299, state.x + 155 * dt);
        const seconds = Math.max(0, 45 - Math.floor((time - state.started) / 1000));
        if(time >= state.nextSpawn) {
          state.tokens.push({ x: 18 + Math.random() * 284, y: -12, value: VALUES[Math.floor(Math.random() * VALUES.length)]! });
          state.nextSpawn = time + Math.max(370, 780 - state.score * 25);
        }
        for(const token of state.tokens) token.y += (50 + state.score * 3) * dt;
        const remaining: Token[] = [];
        for(const token of state.tokens) {
          if(token.y >= 154 && token.y <= 180 && Math.abs(token.x - state.x) < 24) {
            state.sum += token.value;
            if(state.sum === state.target) {
              state.score++;
              state.sum = 0;
              state.target = chooseTarget();
            } else if(state.sum > state.target) {
              state.lives--;
              state.sum = 0;
              state.target = chooseTarget();
            }
          } else if(token.y <= 190) remaining.push(token);
        }
        state.tokens = remaining;
        if(seconds === 0 || state.lives <= 0) {
          state.finished = true;
          saveBest('catcher', state.score);
          setRecord(best('catcher'));
        }
        setHud(old => old.seconds !== seconds || old.score !== state.score || old.total !== state.sum ||
          old.target !== state.target || old.lives !== state.lives || old.over !== state.finished
          ? { score: state.score, total: state.sum, target: state.target, lives: state.lives, seconds, over: state.finished }
          : old);
      }
      draw();
      frame.current = requestAnimationFrame(frameStep);
    }
    frame.current = requestAnimationFrame(frameStep);
    function keyDown(event: KeyboardEvent) {
      if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(event.key)) {
        if(event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') held.current.left = true;
        else held.current.right = true;
        event.preventDefault();
      }
    }
    function keyUp(event: KeyboardEvent) {
      if(event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') held.current.left = false;
      if(event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') held.current.right = false;
    }
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      held.current.left = false;
      held.current.right = false;
    };
  }, [round]);

  function move(direction: 'left' | 'right', pressed: boolean) { held.current[direction] = pressed; }
  return <section className="suite-surface suite-arcade-game" aria-label="Bit Catcher game">
    <div className="suite-section-header"><h2>Bit Catcher</h2><button className="suite-text-button" onClick={onExit} type="button"><ArrowLeft size={15}/> Arcade</button></div>
    <div className="suite-arcade-hud"><span>Score {hud.score}</span><span>Target {hud.target} · Total {hud.total}</span><span>Lives {hud.lives} · {hud.seconds}s</span><span>Best {record}</span></div>
    <canvas ref={canvasRef} width={320} height={190} className="suite-pixel-canvas" role="img" aria-label="Falling values. Move left and right to collect numbers matching the binary target." />
    <div className="suite-arcade-controls">
      <button type="button" onPointerDown={() => move('left', true)} onPointerUp={() => move('left', false)}
        onPointerLeave={() => move('left', false)} onPointerCancel={() => move('left', false)}>◀ Left</button>
      <button type="button" onPointerDown={() => move('right', true)} onPointerUp={() => move('right', false)}
        onPointerLeave={() => move('right', false)} onPointerCancel={() => move('right', false)}>Right ▶</button>
    </div>
    <div className="suite-actions"><span className="suite-hint">Use A / D or ← / → to move. Reach the target exactly; going over costs a life.</span>
      {hud.over && <button className="suite-primary" type="button" onClick={() => { setHud({ score: 0, total: 0, target: 5, lives: 3, seconds: 45, over: false }); setRound(n => n + 1); }}><RotateCcw size={15} /> Play again</button>}
    </div>
  </section>;
}

type Gate = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR';
type Question = { gate: Gate; a: number; b: number; answer: number };
const GATES: Gate[] = ['AND','OR','XOR','NAND','NOR'];
export function gateOutput(gate: Gate, a: number, b: number): number {
  const and = a & b, or = a | b, xor = a ^ b;
  switch(gate) {
    case 'AND': return and;
    case 'OR': return or;
    case 'XOR': return xor;
    case 'NAND': return 1 - and;
    case 'NOR': return 1 - or;
  }
}
function nextQuestion(): Question {
  const gate = GATES[Math.floor(Math.random() * GATES.length)]!;
  const a = Math.floor(Math.random() * 2), b = Math.floor(Math.random() * 2);
  return { gate, a, b, answer: gateOutput(gate, a, b) };
}

function LogicRush({ onExit }: { onExit: () => void }) {
  const [question, setQuestion] = useState(nextQuestion);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [deadline, setDeadline] = useState(() => Date.now() + 35000);
  const [now, setNow] = useState(Date.now());
  const [record, setRecord] = useState(() => best('logic'));
  const done = lives <= 0 || now >= deadline;
  const last = useRef(false);
  useEffect(() => {
    if(done) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [done]);
  useEffect(() => {
    if(done && !last.current) {
      last.current = true;
      saveBest('logic', score);
      setRecord(best('logic'));
    }
  }, [done, score]);

  function answer(value: number) {
    if (done) return;
    if(value === question.answer) setScore(old => old + 1);
    else setLives(old => Math.max(0, old - 1));
    setQuestion(nextQuestion());
  }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if(event.key === '0' || event.key === '1') {
        if(!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
          event.preventDefault(); answer(Number(event.key));
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
  function restart() {
    setQuestion(nextQuestion()); setScore(0); setLives(3); setNow(Date.now());
    setDeadline(Date.now() + 35000); last.current = false;
  }
  return <section className="suite-surface suite-arcade-game suite-logic-rush" aria-label="Logic Rush game">
    <div className="suite-section-header"><h2>Logic Rush</h2><button className="suite-text-button" onClick={onExit} type="button"><ArrowLeft size={15}/> Arcade</button></div>
    <div className="suite-arcade-hud"><span>Score {score}</span><span>Lives {lives}</span><span>{Math.max(0, Math.ceil((deadline - now) / 1000))}s</span><span>Best {record}</span></div>
    <div className="suite-logic-board" aria-live="off">
      {done ? <><strong>GAME OVER</strong><span>{score} correct gates</span></>
        : <><div className="suite-logic-inputs"><span>A = {question.a}</span><span>B = {question.b}</span></div>
          <strong>{question.gate}</strong><div className="suite-logic-output">OUTPUT = ?</div></>}
    </div>
    {done ? <button className="suite-primary" type="button" onClick={restart}><RotateCcw size={15} /> Play again</button>
      : <div className="suite-logic-buttons">
        <button type="button" onClick={() => answer(0)}>0</button>
        <button type="button" onClick={() => answer(1)}>1</button>
      </div>}
    <p className="suite-hint">Choose the output of the logic gate. Keyboard: 0 or 1. A wrong answer costs one life.</p>
  </section>;
}

export function RetroArcade() {
  const [game, setGame] = useState<Game | null>(null);
  if(game === 'catcher') return <BitCatcher onExit={() => setGame(null)} />;
  if(game === 'logic') return <LogicRush onExit={() => setGame(null)} />;
  return <section className="suite-arcade-picker" aria-label="Retro arcade">
    <button type="button" className="suite-surface suite-arcade-card" onClick={() => setGame('catcher')}>
      <span className="suite-arcade-art" aria-hidden="true">01<span>+</span>10</span>
      <h2>Bit Catcher</h2><p>Collect binary place values and reach the target number.</p>
      <small>2D · Movement · 45 seconds</small>
    </button>
    <button type="button" className="suite-surface suite-arcade-card" onClick={() => setGame('logic')}>
      <span className="suite-arcade-art" aria-hidden="true">1<span>⊕</span>0</span>
      <h2>Logic Rush</h2><p>Solve logic gates against the clock.</p>
      <small>2D · Logic · 35 seconds</small>
    </button>
  </section>;
}

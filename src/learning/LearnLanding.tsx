import { useState } from 'react';
import { ArrowRight, BookOpen, Check, Code2, Flag, Gamepad2, Shield, Swords, Trophy, Zap } from 'lucide-react';

export type LearningGameMode = 'classic' | 'circuit' | 'hacker' | 'sprint';

const gameModes = [
  { id: 'classic', label: 'Classic Quiz', icon: Trophy },
  { id: 'circuit', label: 'Circuit Clash', icon: Zap },
  { id: 'hacker', label: 'Hacker Heist', icon: Shield },
  { id: 'sprint', label: 'Data Sprint', icon: Swords },
] as const;

const previewNodes: ('mine' | 'rival' | 'open')[] = [
  'mine', 'mine', 'open', 'rival', 'open',
  'mine', 'open', 'rival', 'rival', 'open',
  'mine', 'mine', 'mine', 'open', 'open',
  'open', 'mine', 'rival', 'rival', 'open',
];
const racers = [
  { name: 'BeardlyWolf', progress: 79, score: 1280, own: true },
  { name: 'HotMonkey', progress: 65, score: 1030, own: false },
  { name: 'PixelFalcon', progress: 52, score: 850, own: false },
];

function GameDemo({ mode }: { mode: LearningGameMode }) {
  const [answer, setAnswer] = useState<number | null>(null);

  return <div className={'learn-demo learn-demo--' + mode} aria-label={'Preview of ' + gameModes.find(item => item.id === mode)?.label}>
    <div className="learn-demo-bar">
      <span className="learn-demo-dots" aria-hidden="true"><i/><i/><i/></span>
      <strong>{gameModes.find(item => item.id === mode)?.label}</strong>
      <span className="learn-demo-timer">02:41</span>
    </div>
    {mode === 'classic' ? <div className="learn-demo-quiz">
      <p>Which type of memory loses its contents when the computer loses power?</p>
      <div className="learn-demo-answers">
        {['ROM', 'RAM', 'SSD', 'Flash memory'].map((choice, index) => <button key={choice}
          type="button" aria-pressed={answer === index} onClick={() => setAnswer(index)}>
          <span>{'ABCD'[index]}</span>{choice}
          {answer === index && <Check size={14} aria-hidden="true"/>}
        </button>)}
      </div>
      <span className="learn-demo-feedback" role="status">
        {answer === null ? 'Choose an answer to try it.' : answer === 1 ? 'Correct. RAM is volatile memory.' : 'RAM is volatile. Try again.'}
      </span>
    </div> : mode === 'sprint' ? <div className="learn-demo-race">
      {racers.map((racer, index) => <div className="learn-demo-racer" key={racer.name}>
        <span>{index + 1}</span><div className="learn-demo-race-row">
          <b>{racer.name}</b><div className="learn-demo-track"><i style={{ width: racer.progress + '%' }}/>
            <span style={{ left: racer.progress + '%' }}><Flag size={13}/></span>
          </div>
        </div><strong>{racer.score.toLocaleString()}</strong>
      </div>)}
      <div className="learn-demo-race-finish">Every correct answer moves your racer forward.</div>
    </div> : <div className="learn-demo-grid-wrap">
      <div className="learn-demo-grid" aria-hidden="true">
        {previewNodes.map((node, index) => <div key={index} className={'learn-demo-cell ' + node}>
          <span>{mode === 'hacker' ? node === 'open' ? '□' : '▣' : node === 'open' ? '◇' : '◆'}</span>
        </div>)}
      </div>
      <div className="learn-demo-statline">
        <span><Zap size={14}/> 145 charge</span><span><Flag size={14}/> 8 nodes</span><span><Trophy size={14}/> 1,120</span>
      </div>
      <p>{mode === 'hacker' ? 'Breach rival servers. Take control of the grid.' : 'Earn charge. Capture and reinforce the network.'}</p>
    </div>}
    <div className="learn-demo-foot">
      <span className="learn-demo-live"><i/> Game preview</span>
      <span>2D · Lightweight</span>
    </div>
  </div>;
}

export function LearnLanding({ onNotes, onArena }: {
  onNotes: () => void;
  onArena: (mode: LearningGameMode) => void;
}) {
  const [mode, setMode] = useState<LearningGameMode>('circuit');

  return <div className="learn-landing">
    <section className="learn-landing-game" aria-labelledby="learn-landing-game-title">
      <div className="learn-landing-game-copy">
        <span className="learn-landing-mark" aria-hidden="true"><Gamepad2 size={25}/></span>
        <h1 id="learn-landing-game-title">Pico Arena</h1>
        <p>Answer Computer Science questions, compete with your class and take the top spot.</p>
        <button type="button" className="learn-landing-play" onClick={() => onArena(mode)}>
          <Gamepad2 size={17}/> Play Pico Arena <ArrowRight size={17}/>
        </button>
        <div className="learn-landing-modes" role="group" aria-label="Preview a game mode">
          {gameModes.map(item => {
            const Icon = item.icon;
            return <button type="button" key={item.id} className={mode === item.id ? 'is-active' : ''}
              aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
              <Icon size={15} aria-hidden="true"/>{item.label}
            </button>;
          })}
        </div>
      </div>
      <GameDemo key={mode} mode={mode} />
    </section>

    <button className="learn-landing-notes" type="button" onClick={onNotes}>
      <div className="learn-landing-notes-copy">
        <span className="learn-landing-notes-icon"><BookOpen size={22} aria-hidden="true"/></span>
        <div><h2>Computer Science notes</h2>
          <p>30 topics with worked examples, explanations and interactive models.</p>
          <span className="learn-landing-notes-link">Open notes <ArrowRight size={15}/></span>
        </div>
      </div>
      <div className="learn-landing-notes-preview" aria-hidden="true">
        <div className="learn-landing-note-code"><Code2 size={15}/><span>0010 1101</span><b>=</b><strong>45</strong></div>
        <div className="learn-landing-note-bits">{['0','0','1','0','1','1','0','1'].map((bit, index) =>
          <span key={index} className={bit === '1' ? 'is-set' : ''}>{bit}</span>)}</div>
      </div>
    </button>
  </div>;
}

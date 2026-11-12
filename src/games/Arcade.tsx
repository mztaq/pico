import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Gamepad2, Pause, Play, RotateCcw, Settings2, Shield, X, Zap } from 'lucide-react';
import { playCue } from '../app/sound';
import { SoundButton } from '../app/components/SoundToggle';
import { Arena3D } from './Arena3D';
import {
  attackDuration, attackLimit, attackMove, attackReward, attackShop, attackTick, availablePerks,
  defenseReward, defenseShop, defenseTick, freshAttack, freshDefense, lanes, maxEnergy,
  missions, moves, policies, price, rebirth, serviceRate, shieldedLane, startAttack,
  startDefense, switchBackup, waveDuration, waves,
  type Attack, type AttackUpgrade, type Defense, type DefenseUpgrade, type Move,
} from './game-engine';
import './arcade.css';

export type ArcadePage = 'games' | 'games/siege' | 'games/defense';

function restore<T>(fallback: T, saved: unknown): T {
  if (typeof fallback === 'number') {
    return (typeof saved === 'number' && Number.isSafeInteger(saved) && saved >= 0 && saved <= 1e9
      ? saved : fallback) as T;
  }
  if (!saved || typeof saved !== 'object') return fallback;
  return Object.fromEntries(Object.entries(fallback as object).map(([key, value]) => [
    key, restore(value, (saved as Record<string, unknown>)[key]),
  ])) as T;
}

const siegeSave = 'pico.games.siege.v1';
const defenseSave = 'pico.games.defense.v1';

function readProfile<T>(key: string, initial: T): T {
  try {
    return restore(initial, JSON.parse(localStorage.getItem(key) ?? 'null'));
  } catch {
    return initial;
  }
}

function useProfile<T>(key: string, create: () => T) {
  const [profile, setProfile] = useState(() => readProfile(key, create()));
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(profile)); } catch { /* Play still works in memory. */ }
  }, [key, profile]);
  return [profile, setProfile] as const;
}

function Meter({ label, value, max = 100, unit = '%' }: { label: string; value: number; max?: number; unit?: string }) {
  return <div className="arcade-meter">
    <div><span>{label}</span><strong>{Math.ceil(value)}{unit}</strong></div>
    <progress max={max} value={value} aria-label={label} />
  </div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="arcade-panel"><h2>{title}</h2><div className="arcade-panel-body">{children}</div></section>;
}

function GameDialog({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal?.(); }, []);
  return <dialog ref={dialog} className="arcade-dialog" aria-label={title} onCancel={event => {
    event.preventDefault();
    onClose();
  }}>
    <h2>{title}<button className="arcade-close" type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button></h2>
    <div className="arcade-dialog-body">{children}</div>
  </dialog>;
}

function PauseButton({ paused, onClick, onRestart, onSettings, onGames }: {
  paused: boolean; onClick: () => void; onRestart: () => void; onSettings: () => void; onGames: () => void;
}) {
  return <>
    <button type="button" onClick={onClick}><Pause size={16} />Pause</button>
    {paused && <GameDialog title="Paused" onClose={onClick}>
      <div className="arcade-pause-grid">
        <button className="arcade-primary" type="button" onClick={onClick}><Play size={21} />Resume</button>
        <button data-tone="pink" type="button" onClick={onRestart}><RotateCcw size={21} />Restart</button>
        <button data-tone="mint" type="button" onClick={onSettings}><Settings2 size={21} />Settings</button>
        <button type="button" onClick={onGames}><Gamepad2 size={21} />Games</button>
      </div>
    </GameDialog>}
  </>;
}

type GameOptions = { lite: boolean; settingsOpen: boolean; onSettings: () => void; onGames: () => void };

function Siege({ lite, settingsOpen, onSettings, onGames }: GameOptions) {
  const [profile, setProfile] = useProfile(siegeSave, freshAttack);
  const [selected, select] = useState(Math.min(profile.cleared, missions.length - 1));
  const [lane, setLane] = useState(0);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState<Attack | null>(null);
  const live = round?.status === 'live';
  const seconds = round?.seconds;
  useEffect(() => {
    if (!live || paused || settingsOpen) return;
    const timer = window.setTimeout(() => {
      setRound(current => current ? attackTick(current, profile) : current);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [live, paused, settingsOpen, profile, seconds]);
  useEffect(() => {
    if (round?.status === 'won') {
      setProfile(current => attackReward(round, current));
      playCue('success');
    } else if (round?.status === 'lost') playCue('error');
  }, [round, setProfile]);

  function fire(move: Move) {
    if (!paused && !settingsOpen) setRound(current => current ? attackMove(current, profile, move, lane) : current);
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!live || paused || settingsOpen || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      const index = ['1', '2', '3'].indexOf(key);
      if (index >= 0) setLane(index);
      const move = ({ q: 'pulse', w: 'burst', e: 'split' } as const)[key as 'q' | 'w' | 'e'];
      if (move) {
        event.preventDefault();
        setRound(current => current ? attackMove(current, profile, move, lane) : current);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [live, paused, settingsOpen, profile, lane]);

  function buy(key: AttackUpgrade) {
    setProfile(current => {
      const level = current.upgrades[key];
      const cost = price(attackShop[key].cost, level);
      return level < attackLimit && current.coins >= cost
        ? { ...current, coins: current.coins - cost, upgrades: { ...current.upgrades, [key]: level + 1 } }
        : current;
    });
  }
  const mission = missions[round?.mission ?? selected];
  const perkPoints = availablePerks(profile);
  return <>
    <div className="arcade-title"><div><h1>Server Siege</h1><p>Take down five increasingly defended targets.</p></div><strong className="arcade-currency">{profile.coins} coins · Rebirth {profile.rebirths}</strong></div>
    <div className="arcade-layout">
      <Panel title={mission.name}>
        <p>{mission.detail} Clear in 12 seconds for bonus coins.</p>
        <Arena3D traffic={round?.traffic ?? [0, 0, 0]} focus={lane} lite={lite} stage={round?.mission ?? selected} animate={Boolean(live && !paused && !settingsOpen)}
          shielded={round ? shieldedLane(round) : -1} offline={round?.integrity === 0} />
        <div className="arcade-meters">
          <Meter label="Target integrity" value={round?.integrity ?? 100} />
          <Meter label="Energy" value={round?.energy ?? maxEnergy(profile)} max={maxEnergy(profile)} unit="" />
          <Meter label="Time left" value={attackDuration - (round?.seconds ?? 0)} max={attackDuration} unit="s" />
        </div>
        <div className="arcade-actions">
          {lanes.map((name, i) => <button key={name} type="button" disabled={paused || !live} aria-pressed={lane === i} onClick={() => setLane(i)}>{i + 1} · {name}</button>)}
        </div>
        <div className="arcade-actions">
          {(Object.keys(moves) as Move[]).map((move, i) => <button key={move} type="button" data-tone={move === 'burst' ? 'pink' : move === 'split' ? 'mint' : undefined} className={move === 'pulse' ? 'arcade-primary' : undefined}
            disabled={!live || paused || !round || round.energy < moves[move].energy || round.cooldowns[move] > 0}
            onClick={() => fire(move)}>{['Q', 'W', 'E'][i]} · {moves[move].name} {round?.cooldowns[move] ? `(${round.cooldowns[move]}s)` : `(${moves[move].energy} energy)`}</button>)}
        </div>
        <div className="arcade-actions">
          {live ? <PauseButton paused={paused && !settingsOpen} onClick={() => setPaused(!paused)} onSettings={onSettings} onGames={onGames}
            onRestart={() => { setRound(startAttack(selected, profile)); setPaused(false); }} /> :
            <button className="arcade-primary" type="button" onClick={() => { setRound(startAttack(selected, profile)); setPaused(false); }}>{round ? 'Play again' : 'Launch mission'}</button>}
          {round?.status === 'won' && round.mission < missions.length - 1 &&
            <button type="button" onClick={() => { select(round.mission + 1); setRound(null); }}>Next target</button>}
        </div>
        <p className="arcade-status" role="status">{round?.status === 'won' ? 'Target down. Coins earned.' :
          round?.status === 'lost' ? 'Time ran out. Retry and aim for unshielded lanes.' :
          round?.integrity === 0 ? `Target offline · hold ${3 - round.offline}s` :
          'Shielded lanes absorb most damage. Split hits all three lanes.'}</p>
      </Panel>
      <div className="arcade-stack">
        <Panel title="Targets">
          <div className="arcade-list">{missions.map((item, i) =>
            <button key={item.name} type="button" aria-pressed={selected === i} disabled={live || i > profile.cleared}
              onClick={() => { select(i); setRound(null); }}>{i + 1}. {item.name}<span>{i < profile.cleared ? 'Cleared' : i > profile.cleared ? 'Locked' : 'Ready'}</span></button>)}</div>
        </Panel>
        <Panel title="Coin shop">
          <div className="arcade-list">{(Object.keys(attackShop) as AttackUpgrade[]).map(key => {
            const item = attackShop[key];
            const level = profile.upgrades[key];
            const cost = price(item.cost, level);
            return <button key={key} type="button" disabled={live || level >= attackLimit || profile.coins < cost} onClick={() => buy(key)}>
              <span><strong>{item.name} · Lv {level}</strong><small>{item.info}</small></span><span>{level >= attackLimit ? 'Max' : `${cost} coins`}</span>
            </button>;
          })}</div>
        </Panel>
        <Panel title="Rebirth">
          <p>Clear Storm Core to reset the campaign, coins and shop upgrades for a permanent perk point.</p>
          <button type="button" disabled={live || profile.cleared !== missions.length} onClick={() => {
            setProfile(rebirth); setRound(null); select(0);
          }}>Rebirth</button>
          {profile.rebirths > 0 && <><p>{perkPoints} perk points available</p><div className="arcade-actions">
            {(['power', 'energy'] as const).map(perk => <button type="button" key={perk} disabled={live || perkPoints <= 0}
              onClick={() => setProfile(current => availablePerks(current) > 0
                ? { ...current, perks: { ...current.perks, [perk]: current.perks[perk] + 1 } } : current)}>
              {perk === 'power' ? 'Power' : 'Energy'} · Lv {profile.perks[perk]}
            </button>)}
          </div></>}
        </Panel>
      </div>
    </div>
  </>;
}

function DefenseGame({ lite, settingsOpen, onSettings, onGames }: GameOptions) {
  const [profile, setProfile] = useProfile(defenseSave, freshDefense);
  const [round, setRound] = useState<Defense | null>(null);
  const [paused, setPaused] = useState(false);
  const [endless, setEndless] = useState(false);
  const [nextEndless, setNextEndless] = useState(0);
  const live = round?.status === 'live';
  const seconds = round?.seconds;
  useEffect(() => {
    if (!live || paused || settingsOpen) return;
    const timer = window.setTimeout(() => {
      setRound(current => current ? defenseTick(current, profile) : current);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [live, paused, settingsOpen, profile, seconds]);
  useEffect(() => {
    if (round?.status === 'won') {
      setProfile(current => defenseReward(round, current));
      if (round.endless) setNextEndless(round.wave + 1);
      playCue('success');
    } else if (round?.status === 'lost') playCue('error');
  }, [round, setProfile]);

  const nextWave = endless ? nextEndless : Math.min(profile.cleared, waves.length - 1);
  function start() {
    setPaused(false);
    setRound(startDefense(nextWave, endless, profile));
  }
  function buy(key: DefenseUpgrade) {
    setProfile(current => {
      const level = current.upgrades[key];
      const cost = price(defenseShop[key].cost, level);
      return level < defenseShop[key].max && current.budget >= cost
        ? { ...current, budget: current.budget - cost, upgrades: { ...current.upgrades, [key]: level + 1 } }
        : current;
    });
  }
  function refund(key: DefenseUpgrade) {
    setProfile(current => {
      const level = current.upgrades[key];
      return level > 0 ? {
        ...current, budget: current.budget + price(defenseShop[key].cost, level - 1),
        upgrades: { ...current.upgrades, [key]: level - 1 },
      } : current;
    });
  }

  const title = (round?.endless ?? endless)
    ? `Endless wave ${(round?.wave ?? nextWave) + 1}`
    : waves[round?.wave ?? nextWave];
  return <>
    <div className="arcade-title"><div><h1>Server Defense</h1><p>Keep the server online and serve at least 78% of legitimate requests.</p></div><strong className="arcade-currency">{profile.budget} budget · {profile.cleared}/{waves.length} waves</strong></div>
    <div className="arcade-layout">
      <Panel title={title}>
        <Arena3D traffic={round?.traffic ?? [0, 0, 0]} focus={round?.route ?? 1} lite={lite} defense stage={profile.upgrades.capacity * 2} animate={Boolean(live && !paused && !settingsOpen)}
          defended={profile.upgrades.proxy > 0} offline={round?.integrity === 0} />
        <div className="arcade-meters">
          <Meter label="Server integrity" value={round?.integrity ?? 100} />
          <Meter label="Visitors served" value={round ? serviceRate(round) : 100} />
          <Meter label="Wave time left" value={waveDuration - (round?.seconds ?? 0)} max={waveDuration} unit="s" />
        </div>
        <p className="arcade-telemetry">Proxy load {round?.proxyLoad ?? 0}% · Latency {round?.latency ?? 0} ms</p>
        <div className="arcade-actions" aria-label="Proxy routing">
          {lanes.map((name, route) => <button key={name} type="button" disabled={!live || paused || !profile.upgrades.proxy}
            aria-pressed={round?.route === route} onClick={() => setRound(current => current ? { ...current, route } : current)}>Route {name}</button>)}
        </div>
        <div className="arcade-actions" aria-label="Filtering policy">
          {policies.map(policy => <button key={policy} type="button" disabled={!live || paused}
            aria-pressed={round?.policy === policy} onClick={() => setRound(current => current ? { ...current, policy } : current)}>{policy}</button>)}
          <button type="button" disabled={!live || paused || !round?.backups || round.integrity >= 100}
            onClick={() => setRound(current => current ? switchBackup(current) : current)}>Failover ({round?.backups ?? profile.upgrades.backup})</button>
        </div>
        <div className="arcade-actions">
          {live ? <PauseButton paused={paused && !settingsOpen} onClick={() => setPaused(!paused)} onSettings={onSettings} onGames={onGames}
            onRestart={start} /> :
            <button className="arcade-primary" type="button" onClick={start}>
              {round?.status === 'lost' ? 'Retry wave' : !endless && profile.cleared === waves.length ? 'Replay final wave' : round?.status === 'won' ? 'Next wave' : 'Start wave'}
            </button>}
          {!live && endless && nextEndless > 0 && <button type="button" onClick={() => { setNextEndless(0); setRound(null); }}>Restart Endless</button>}
        </div>
        <p className="arcade-status" role="status">{round?.status === 'won' ? (!round.endless && round.wave === waves.length - 1 ? 'Campaign cleared. Endless unlocked.' : 'Wave cleared. Budget earned.') :
          round?.status === 'lost' ? `Wave lost · ${serviceRate(round)}% of visitors served. Adjust your defenses and retry.` :
          'Route proxies toward the busiest lane. Strict filtering also blocks some legitimate visitors.'}</p>
      </Panel>
      <div className="arcade-stack">
        <Panel title="Defense shop">
          <div className="arcade-list">{(Object.keys(defenseShop) as DefenseUpgrade[]).map(key => {
            const item = defenseShop[key];
            const level = profile.upgrades[key];
            const cost = price(item.cost, level);
            return <div className="arcade-shop-row" key={key}>
              <div><strong>{item.name} · Lv {level}</strong><small>{item.info}</small></div>
              <div className="arcade-actions">
                <button type="button" aria-label={`Buy ${item.name}`} disabled={live || level >= item.max || profile.budget < cost}
                  onClick={() => buy(key)}>{level >= item.max ? 'Max' : `Buy ${cost}`}</button>
                {level > 0 && <button type="button" aria-label={`Refund ${item.name}`} disabled={live} onClick={() => refund(key)}>Refund</button>}
              </div>
            </div>;
          })}</div>
        </Panel>
        <Panel title="Game mode">
          <div className="arcade-actions">
            <button type="button" aria-pressed={!endless} disabled={live} onClick={() => { setEndless(false); setRound(null); }}>Campaign</button>
            <button type="button" aria-pressed={endless} disabled={live || profile.cleared < waves.length}
              onClick={() => { setEndless(true); setRound(null); }}>Endless</button>
          </div>
          <p>{profile.cleared < waves.length ? 'Clear the campaign to unlock Endless.' : `Endless record · wave ${profile.best}`}</p>
        </Panel>
      </div>
    </div>
  </>;
}

export function Arcade({ page, onChoose, onHome }: {
  page: ArcadePage; onChoose: (page: ArcadePage) => void; onHome: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lite, setLite] = useState(() => {
    try { return localStorage.getItem('pico.games.graphics') !== 'standard'; }
    catch { return true; }
  });
  function changeGraphics(next: boolean) {
    setLite(next);
    try { localStorage.setItem('pico.games.graphics', next ? 'lite' : 'standard'); } catch { /* Session preference still applies. */ }
  }
  const gameOptions = { lite, settingsOpen, onSettings: () => setSettingsOpen(true), onGames: () => onChoose('games') };
  const siegeProgress = page === 'games' ? readProfile(siegeSave, freshAttack()).cleared : 0;
  const defenseProgress = page === 'games' ? readProfile(defenseSave, freshDefense()).cleared : 0;
  return <main className="arcade" data-game={page}>
    <header className="arcade-bar"><div>
      <button type="button" onClick={page === 'games' ? onHome : () => onChoose('games')}><ArrowLeft size={16} />{page === 'games' ? 'Pico home' : 'Games'}</button>
      <span><Gamepad2 size={19} /> Pico Games</span>
    </div><button data-tone="mint" type="button" onClick={gameOptions.onSettings}><Settings2 size={16} />Settings</button></header>
    {settingsOpen && <GameDialog title="Settings" onClose={() => setSettingsOpen(false)}>
      <div className="arcade-setting"><strong>Sound effects</strong><SoundButton /></div>
      <div className="arcade-setting"><strong>Graphics</strong><div className="arcade-actions" aria-label="Graphics quality">
        <button type="button" aria-pressed={lite} onClick={() => changeGraphics(true)}>Low</button>
        <button type="button" aria-pressed={!lite} onClick={() => changeGraphics(false)}>Standard</button>
      </div></div>
      <p>Low draws fewer packets at a lower resolution. Standard makes traffic denser and smoother.</p>
      <button className="arcade-primary" type="button" onClick={() => setSettingsOpen(false)}>Done</button>
    </GameDialog>}
    <div className="arcade-content">
      {page === 'games' ? <>
        <div className="arcade-title"><div><h1>Games</h1><p>Take down a server or keep one running through a traffic storm.</p></div></div>
        <div className="arcade-cards">
          <Panel title="Server Siege">
            <Arena3D traffic={[10, 0, 12]} focus={0} shielded={1} stage={3} lite={lite} />
            <p>Break through stronger defenses, buy upgrades, and rebirth for permanent perks.</p>
            {siegeProgress > 0 && <p>{siegeProgress}/{missions.length} targets cleared</p>}
            <button className="arcade-primary" type="button" onClick={() => onChoose('games/siege')}><Zap size={17} /> {siegeProgress ? 'Continue' : 'Play'} Server Siege</button>
          </Panel>
          <Panel title="Server Defense">
            <Arena3D traffic={[0, 13, 6]} focus={1} defended defense stage={3} lite={lite} />
            <p>Build defenses, reroute traffic, and keep legitimate visitors connected.</p>
            {defenseProgress > 0 && <p>{defenseProgress}/{waves.length} waves cleared</p>}
            <button className="arcade-primary" data-tone="mint" type="button" onClick={() => onChoose('games/defense')}><Shield size={17} /> {defenseProgress ? 'Continue' : 'Play'} Server Defense</button>
          </Panel>
        </div>
      </> : page === 'games/siege' ? <Siege {...gameOptions} /> : <DefenseGame {...gameOptions} />}
    </div>
  </main>;
}

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowLeft, Gamepad2, Pause, Play, Shield, Zap } from 'lucide-react';
import { playCue } from '../app/sound';
import { SoundButton } from '../app/components/SoundToggle';
import { contrastRatio, cssVariables, getTheme } from '../app/themes';
import { loadSettings } from '../storage/settings';
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

function Arena({ traffic, focus, shielded = -1, defended = false, offline = false }: {
  traffic: number[]; focus: number; shielded?: number; defended?: boolean; offline?: boolean;
}) {
  const grid = useId();
  return <svg className="arcade-arena" viewBox="0 0 720 270" role="img" aria-label="Three animated traffic lanes between bot squads and a server rack">
    <defs>
      <pattern id={grid} width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="currentColor" opacity=".11" />
      </pattern>
    </defs>
    <rect width="720" height="270" fill={`url(#${grid})`} />
    {lanes.map((lane, i) => {
      const y = 66 + i * 68;
      const path = `M160 ${y}H450Q510 ${y} 558 134H604`;
      const protectedLane = i === shielded || (defended && i === focus);
      return <g key={lane}>
        <path d={path} className={i === focus ? 'arcade-lane active' : 'arcade-lane'} />
        <text x="173" y={y - 12} className="arcade-map-label">{lane.toUpperCase()}</text>
        <g transform={`translate(106 ${y - 18})`} className="arcade-bot">
          <path d="M4 6H16V0H22V6H34V34H4Z" />
          <path className="arcade-eyes" d="M10 14H16V21H10ZM22 14H28V21H22Z" />
        </g>
        {protectedLane && <g transform={`translate(418 ${y - 17})`} className="arcade-proxy">
          <rect width="35" height="34" rx="4" /><path d="M10 9H25V18L17.5 25 10 18Z" />
        </g>}
        {Array.from({ length: Math.min(7, Math.ceil(traffic[i] / 5)) }, (_, n) =>
          <rect key={n} width="10" height="6" y="-3" rx="1" className="arcade-packet">
            <animateMotion path={path} dur="1.15s" begin={`-${n * 0.16}s`} repeatCount="indefinite" />
          </rect>)}
      </g>;
    })}
    <g transform="translate(589 84)" className={offline ? 'arcade-rack offline' : 'arcade-rack'}>
      <rect width="85" height="102" rx="7" />
      {[15, 42, 69].map(y => <g key={y}>
        <rect className="arcade-rack-slot" x="11" y={y} width="63" height="18" rx="3" />
        <circle cx="20" cy={y + 9} r="3" /><path d={`M47 ${y + 9}H65`} />
      </g>)}
    </g>
  </svg>;
}

function Meter({ label, value, max = 100, unit = '%' }: { label: string; value: number; max?: number; unit?: string }) {
  return <div className="arcade-meter">
    <div><span>{label}</span><strong>{Math.ceil(value)}{unit}</strong></div>
    <progress max={max} value={value} aria-label={label} />
  </div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="arcade-panel"><h2>{title}</h2>{children}</section>;
}

function PauseButton({ paused, onClick }: { paused: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? 'Resume' : 'Pause'}</button>;
}

function Siege() {
  const [profile, setProfile] = useProfile(siegeSave, freshAttack);
  const [selected, select] = useState(Math.min(profile.cleared, missions.length - 1));
  const [lane, setLane] = useState(0);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState<Attack | null>(null);
  const live = round?.status === 'live';
  const seconds = round?.seconds;
  useEffect(() => {
    if (!live || paused) return;
    const timer = window.setTimeout(() => {
      setRound(current => current ? attackTick(current, profile) : current);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [live, paused, profile, seconds]);
  useEffect(() => {
    if (round?.status === 'won') {
      setProfile(current => attackReward(round, current));
      playCue('success');
    } else if (round?.status === 'lost') playCue('error');
  }, [round, setProfile]);

  function fire(move: Move) {
    if (!paused) setRound(current => current ? attackMove(current, profile, move, lane) : current);
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!live || paused || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
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
  }, [live, paused, profile, lane]);

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
        <Arena traffic={(paused ? null : round?.traffic) ?? [0, 0, 0]} focus={lane}
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
          {(Object.keys(moves) as Move[]).map((move, i) => <button key={move} type="button"
            disabled={!live || paused || !round || round.energy < moves[move].energy || round.cooldowns[move] > 0}
            onClick={() => fire(move)}>{['Q', 'W', 'E'][i]} · {moves[move].name} {round?.cooldowns[move] ? `(${round.cooldowns[move]}s)` : `(${moves[move].energy} energy)`}</button>)}
        </div>
        <div className="arcade-actions">
          {live ? <PauseButton paused={paused} onClick={() => setPaused(!paused)} /> :
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

function DefenseGame() {
  const [profile, setProfile] = useProfile(defenseSave, freshDefense);
  const [round, setRound] = useState<Defense | null>(null);
  const [paused, setPaused] = useState(false);
  const [endless, setEndless] = useState(false);
  const [nextEndless, setNextEndless] = useState(0);
  const live = round?.status === 'live';
  const seconds = round?.seconds;
  useEffect(() => {
    if (!live || paused) return;
    const timer = window.setTimeout(() => {
      setRound(current => current ? defenseTick(current, profile) : current);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [live, paused, profile, seconds]);
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
        <Arena traffic={(paused ? null : round?.traffic) ?? [0, 0, 0]} focus={round?.route ?? 1}
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
          {live ? <PauseButton paused={paused} onClick={() => setPaused(!paused)} /> :
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
  const theme = getTheme(loadSettings().theme);
  const siegeProgress = page === 'games' ? readProfile(siegeSave, freshAttack()).cleared : 0;
  const defenseProgress = page === 'games' ? readProfile(defenseSave, freshDefense()).cleared : 0;
  const accentText = contrastRatio(theme.accent, '#101723') >= 4.5 ? '#101723' : '#fff';
  const style: Record<string, string> = { ...cssVariables(theme), colorScheme: theme.appearance };
  style['--arcade-accent-text'] = accentText;
  return <main className="arcade" data-game={page} style={style}>
    <header className="arcade-bar"><div>
      <button type="button" onClick={page === 'games' ? onHome : () => onChoose('games')}><ArrowLeft size={16} />{page === 'games' ? 'Pico home' : 'Games'}</button>
      <span><Gamepad2 size={19} /> Pico Games</span>
    </div><SoundButton /></header>
    <div className="arcade-content">
      {page === 'games' ? <>
        <div className="arcade-title"><div><h1>Games</h1><p>Take down a server or keep one running through a traffic storm.</p></div></div>
        <div className="arcade-cards">
          <Panel title="Server Siege">
            <Arena traffic={[10, 0, 12]} focus={0} shielded={1} />
            <p>Break through stronger defenses, buy upgrades, and rebirth for permanent perks.</p>
            {siegeProgress > 0 && <p>{siegeProgress}/{missions.length} targets cleared</p>}
            <button className="arcade-primary" type="button" onClick={() => onChoose('games/siege')}><Zap size={17} /> {siegeProgress ? 'Continue' : 'Play'} Server Siege</button>
          </Panel>
          <Panel title="Server Defense">
            <Arena traffic={[0, 13, 6]} focus={1} defended />
            <p>Build defenses, reroute traffic, and keep legitimate visitors connected.</p>
            {defenseProgress > 0 && <p>{defenseProgress}/{waves.length} waves cleared</p>}
            <button className="arcade-primary" type="button" onClick={() => onChoose('games/defense')}><Shield size={17} /> {defenseProgress ? 'Continue' : 'Play'} Server Defense</button>
          </Panel>
        </div>
      </> : page === 'games/siege' ? <Siege /> : <DefenseGame />}
    </div>
  </main>;
}

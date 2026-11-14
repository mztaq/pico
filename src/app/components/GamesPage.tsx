import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Clock3, Gamepad2, ShieldCheck, Swords } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import { HomeAmbientCurves } from './HomeScreen';
import '../../styles/games.css';

const games = [
  {
    id: 'blackout-protocol',
    title: 'Blackout Protocol',
    description: 'Explore a 3D data centre, defend the network or play as the hacker. Investigate incidents, manage proxies and avoid security patrols.',
    href: '/blackout-protocol/',
  },
] as const;

function GameArtwork() {
  return <svg className="games-blackout-art" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="games-hall" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#26354c" />
        <stop offset="100%" stopColor="#0b1224" />
      </linearGradient>
      <linearGradient id="games-floor" x1="0" x2="1">
        <stop offset="0%" stopColor="#101b2b" />
        <stop offset="50%" stopColor="#1b2b3e" />
        <stop offset="100%" stopColor="#0b1324" />
      </linearGradient>
    </defs>
    <rect width="800" height="360" fill="url(#games-hall)" />
    <path d="M 0 300 L 400 138 L 800 300 V 360 H 0 Z" fill="url(#games-floor)" />
    <path d="M 0 22 L 400 138 L 800 22 M 155 0 L 400 138 L 645 0 M 315 0 L 400 138 L 485 0" fill="none" stroke="#455977" strokeOpacity=".5" strokeWidth="3" />
    <path d="M 400 138 V 360 M 400 138 L 110 360 M 400 138 L 690 360 M 0 333 L 400 138 L 800 333" stroke="#6885a8" strokeOpacity=".28" strokeWidth="2" />
    <path d="M 0 290 L 400 138 L 400 160 L 0 342 Z" fill="#0e1828" />
    <path d="M 800 290 L 400 138 L 400 160 L 800 342 Z" fill="#101d30" />
    {[0, 1, 2, 3].map(i => {
      const left = 42 + i * 78;
      const top = 47 + i * 31;
      const height = 252 - i * 48;
      const width = 108 - i * 17;
      return <g key={i}>
        <path d={'M ' + left + ' ' + top + ' l ' + width + ' 20 v ' + height + ' l -' + width + ' 23 Z'} fill="#0c1322" stroke="#425779" strokeWidth="3" />
        {Array.from({ length: 8 }, (_, row) => <g key={row}>
          <path d={'M ' + (left + 10) + ' ' + (top + 35 + row * height / 9) + ' l ' + (width - 20) + ' 14'} stroke="#283a51" strokeWidth="5"/>
          <circle cx={left + 19} cy={top + 38 + row * height / 9} r="2.8" fill={row % 3 === 0 ? '#f6a37f' : '#87e0d4'}/>
        </g>)}
      </g>;
    })}
    {[0, 1, 2, 3].map(i => {
      const right = 800 - 42 - i * 78;
      const top = 47 + i * 31;
      const height = 252 - i * 48;
      const width = 108 - i * 17;
      return <g key={'right-' + i}>
        <path d={'M ' + right + ' ' + top + ' l -' + width + ' 20 v ' + height + ' l ' + width + ' 23 Z'} fill="#10192a" stroke="#425779" strokeWidth="3"/>
        {Array.from({ length: 8 }, (_, row) => <g key={row}>
          <path d={'M ' + (right - 10) + ' ' + (top + 35 + row * height / 9) + ' l -' + (width - 20) + ' 14'} stroke="#2b3f54" strokeWidth="5"/>
          <circle cx={right - 19} cy={top + 38 + row * height / 9} r="2.8" fill={row % 4 === 0 ? '#f6a37f' : '#82c7fb'}/>
        </g>)}
      </g>;
    })}
    <path d="M 380 143 h 40 v 62 h -40 Z" fill="#162536" stroke="#7395ab" strokeWidth="2"/>
    <rect x="390" y="155" width="20" height="4" rx="2" fill="#7be9d5"/>
    <path d="M 394 219 L 406 219 L 415 271 L 385 271 Z" fill="#cba6f7" opacity=".65"/>
    <circle cx="400" cy="212" r="12" fill="#cba6f7"/>
  </svg>;
}

export function GamesPage({ onHome }: { onHome: () => void }) {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);

  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onHome();
  };

  return <main className="pico-home pico-games" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <HomeAmbientCurves />
    <nav className="pico-games-nav" aria-label="Games navigation">
      <a href="/app" className="pico-games-back" onClick={back}><ArrowLeft size={17} aria-hidden="true"/> Workspaces</a>
      <a href="/app" className="pico-games-brand" onClick={back}><img src="/pico-logo.svg" alt="" width="30" height="30"/> Pico<span>.</span></a>
    </nav>
    <div className="home-inner pico-games-inner">
      <header className="pico-games-hero">
        <p className="pico-games-eyebrow"><Gamepad2 size={17} aria-hidden="true"/> PICO GAMES</p>
        <h1>Games</h1>
        <p className="pico-games-intro">Play interactive computer science missions built for Pico.</p>
      </header>
      <section className="pico-games-library" aria-labelledby="pico-games-section-title">
        <div className="pico-games-section-heading">
          <h2 id="pico-games-section-title">Available games</h2>
          <span>{games.length} available</span>
        </div>
        <div className="pico-games-grid">
          {games.map(game => <a key={game.id} className="pico-games-card" href={game.href} aria-label={'Play ' + game.title}>
            <div className="pico-games-art">
              <GameArtwork />
              <span className="pico-games-art-label">3D NETWORK SECURITY</span>
            </div>
            <div className="pico-games-card-body">
              <div className="pico-games-card-title"><h3>{game.title}</h3><span className="pico-games-type">3D</span></div>
              <p>{game.description}</p>
              <div className="pico-games-details">
                <span><Swords size={15} aria-hidden="true"/> Attack / Defence</span>
                <span><ShieldCheck size={15} aria-hidden="true"/> Single-player</span>
                <span><Clock3 size={15} aria-hidden="true"/> 18 min</span>
              </div>
              <span className="pico-games-play">Play game <ArrowUpRight size={17} aria-hidden="true"/></span>
            </div>
          </a>)}
        </div>
      </section>
      <p className="pico-games-footnote">New games will appear here as they are released.</p>
    </div>
  </main>;
}

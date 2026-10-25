/**
 * CPU Lab — game shell. Owns the lifecycle state machine
 * (menu → intro → playing ⇄ panel/paused/journal/map/settings/saves → ending)
 * and mounts the 3D World behind the React overlays.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GameStore } from './state/store';
import { GameAudio } from './audio';
import { PanelHost } from './ui/Panels';
import { ControlsScreen, Ending, Hud, Intro, Journal, MainMenu, MapScreen, PauseMenu, SavesScreen, SettingsScreen } from './ui/Screens';
import './cpu-lab.css';

type WorldModule = typeof import('./world/World');

export function CpuLab({ onHome }: { onHome: () => void }) {
  const [store] = useState(() => new GameStore());
  const [audio] = useState(() => new GameAudio());
  const s = useSyncExternalStore(store.subscribe, store.get);
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<InstanceType<WorldModule['World']> | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [locked, setLocked] = useState(false);

  // Mount the 3D world (it renders the title-screen backdrop too). A quality change rebuilds it.
  const quality = s.settings.quality;
  useEffect(() => () => { store.dispose(); audio.dispose(); }, [store, audio]);
  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const supported = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    if (!supported) { setWebgl(false); return; }
    void import('./world/World').then(({ World }) => {
      if (cancelled || !stage.current) return;
      try {
        world.current = new World(stage.current, store, audio);
        if (new URLSearchParams(location.search).has('cpulab-debug')) (window as unknown as Record<string, unknown>).__cpuLab = { store, world: world.current };
      }
      catch (error) { console.error('CPU Lab could not start the 3D view', error); setWebgl(false); }
    });
    return () => { cancelled = true; world.current?.dispose(); world.current = null; };
  }, [store, audio, quality]);

  useEffect(() => { document.title = 'Pico | CPU Lab'; }, []);
  useEffect(() => {
    const onLock = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onLock);
    return () => document.removeEventListener('pointerlockchange', onLock);
  }, []);

  // Return focus/pointer to the world when gameplay resumes.
  const prev = useRef(s.phase);
  useEffect(() => {
    if (s.phase === 'playing' && prev.current !== 'playing' && prev.current !== 'menu' && prev.current !== 'intro') world.current?.focus();
    if (s.phase === 'playing' && prev.current === 'intro') world.current?.focus();
    prev.current = s.phase;
  }, [s.phase]);

  // Global Escape: close whatever is open, or pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const p = store.get().phase;
      if (p === 'panel') store.closePanel();
      else if (p === 'journal' || p === 'map' || p === 'settings' || p === 'saves' || p === 'controls') store.back();
      else if (p === 'paused') store.setPhase('playing');
      else if (p === 'playing') store.pause();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  // Close the Core panel so the player can watch the restart.
  useEffect(() => {
    if (s.phase === 'panel' && s.panel === 'core' && s.progress.solved.core && !s.progress.dialogueSeen.includes('coreCinematic')) {
      const t = setTimeout(() => { store.closePanel(); store.sayOnce('coreCinematic'); }, 2200);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.panel, s.progress.solved.core, s.progress.dialogueSeen, store]);

  const exit = () => { store.saveNow(); onHome(); };
  const inGame = s.phase !== 'menu' && s.phase !== 'intro';
  return <main className={'cpulab phase-' + s.phase}>
    <div className="cpulab-stage" ref={stage} onMouseDown={() => audio.start()} />
    {s.phase === 'menu' && <MainMenu store={store} s={s} onHome={onHome} webgl={webgl} />}
    {s.phase === 'intro' && <Intro store={store} />}
    {inGame && s.phase !== 'ending' && <Hud store={store} s={s} locked={locked} stats={() => world.current?.stats() ?? null} />}
    {s.phase === 'panel' && s.panel && <PanelHost store={store} s={s} />}
    {s.phase === 'paused' && <PauseMenu store={store} s={s} onHome={exit} />}
    {s.phase === 'journal' && <Journal store={store} s={s} />}
    {s.phase === 'map' && <MapScreen store={store} s={s} />}
    {s.phase === 'settings' && <SettingsScreen store={store} s={s} />}
    {s.phase === 'controls' && <ControlsScreen store={store} />}
    {s.phase === 'saves' && <SavesScreen store={store} s={s} />}
    {s.phase === 'ending' && <Ending store={store} s={s} onHome={exit} />}
  </main>;
}

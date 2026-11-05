import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Bug, Check, CheckCircle2, Circle, Lightbulb, Play, RotateCcw, Square, Terminal, Trophy } from 'lucide-react';
import { CodeEditor } from '../app/components/CodeEditor';
import { SoundButton } from '../app/components/SoundToggle';
import { ThemePicker } from '../app/components/ThemePicker';
import { cssVariables, getTheme } from '../app/themes';
import { loadSettings, saveSettings } from '../storage/settings';
import { playCue } from '../app/sound';
import { compile } from '../language';
import { startExecution, type ExecutionJob } from '../runtime/runner';
import type { ExecutionReply } from '../runtime/worker';
import { challenges } from './challenges';
import { loadProgress, saveProgress, type Attempt } from './progress';
import './bugfix.css';

export function BugFixLab({ onHome }: { onHome: () => void }) {
  const [settings, setSettings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  const [progress, setProgress] = useState(loadProgress);
  const [selected, setSelected] = useState(challenges[0].id);
  const [replies, setReplies] = useState<ExecutionReply[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const job = useRef<ExecutionJob | null>(null);
  const themeMenu = useRef<HTMLDivElement>(null);
  const themeTrigger = useRef<HTMLButtonElement>(null);
  const focusChallenge = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const challenge = challenges.find(item => item.id === selected)!;
  const attempt = progress[selected] ?? { code: challenge.starter, hints: 0, solved: false };
  const completed = challenges.filter(item => progress[item.id]?.solved).length;
  const passed = challenge.tests.filter((test, index) => replies?.[index] && !replies[index].error && JSON.stringify(replies[index].result?.output) === JSON.stringify(test.expected)).length;
  const allPassed = replies !== null && replies.length === challenge.tests.length && passed === challenge.tests.length;

  useEffect(() => { setSaveError(!saveProgress(progress)); }, [progress]);
  useEffect(() => () => { job.current?.cancel(); job.current = null; }, []);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);

  useLayoutEffect(() => {
    if (!focusChallenge.current) return;
    focusChallenge.current = false;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  useEffect(() => {
    if (!themeOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !themeMenu.current?.contains(event.target)) setThemeOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setThemeOpen(false); themeTrigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [themeOpen]);

  function updateAttempt(patch: Partial<Attempt>) {
    setProgress(current => ({ ...current, [selected]: { ...(current[selected] ?? { code: challenge.starter, hints: 0, solved: false }), ...patch } }));
  }
  function clearRun() {
    const current = job.current;
    job.current = null;
    current?.cancel();
    setRunning(false);
    setReplies(null);
    setError(null);
  }
  function select(id: string) {
    clearRun();
    focusChallenge.current = id !== selected;
    setSelected(id);
  }
  async function checkFix() {
    clearRun();
    playCue('run');
    let current: ExecutionJob | null = null;
    try {
      const { ast } = compile(attempt.code);
      current = startExecution({ ast, runs: challenge.tests.map(test => ({ inputs: test.inputs, options: { limit: 2_000, trace: false } })) });
      job.current = current;
      setRunning(true);
      const results = await current.promise;
      if (job.current !== current) return;
      setReplies(results);
      const solved = results.length === challenge.tests.length && results.every((reply, index) => !reply.error && JSON.stringify(reply.result?.output) === JSON.stringify(challenge.tests[index].expected));
      if (solved) updateAttempt({ solved: true });
      playCue(solved ? 'success' : 'error');
    } catch (failure) {
      if (current && job.current !== current) return;
      setError(failure instanceof Error ? failure.message : 'The checks could not run. Try again.');
      playCue('error');
    } finally {
      if (!current || job.current === current) { job.current = null; setRunning(false); }
    }
  }
  function reset() {
    if (!window.confirm('Reset this challenge to its original broken code? Your completed badge will be kept.')) return;
    clearRun();
    updateAttempt({ code: challenge.starter, hints: 0 });
    playCue('undo');
  }
  const selectedIndex = challenges.findIndex(item => item.id === selected);
  const following = [...challenges.slice(selectedIndex + 1), ...challenges.slice(0, selectedIndex)];
  const next = following.find(item => !progress[item.id]?.solved) ?? following[0] ?? challenge;
  return <main className="bugfix-lab" tabIndex={-1} aria-label="Bug Fix Lab" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as CSSProperties}>
    <header className="bf-topbar">
      <button className="bf-home" onClick={onHome}><ArrowLeft size={17} /><span>Workspaces</span></button>
      <a className="bf-brand" href="/app" onClick={event => { event.preventDefault(); onHome(); }}><img src="/pico-logo.svg" alt="" width="24" height="24" />Pico<span>.</span></a>
      <div className="bf-tools" ref={themeMenu}><SoundButton /><button ref={themeTrigger} aria-expanded={themeOpen} aria-controls="bf-theme-picker" onClick={() => setThemeOpen(open => !open)}>Theme</button>{themeOpen && <div className="bf-theme-picker" id="bf-theme-picker"><button className="bf-theme-close" onClick={() => { setThemeOpen(false); themeTrigger.current?.focus(); }}>Close themes</button><ThemePicker value={settings.theme} showSound={false} onChange={id => { const nextSettings = { ...settings, theme: id }; setSettings(nextSettings); try { saveSettings(nextSettings); } catch { /* Theme still applies. */ } }} /></div>}</div>
    </header>
    <div className="bf-content">
      <section className="bf-intro" aria-labelledby="bf-title">
        <div><span className="bf-eyebrow"><Bug size={14} /> THE DEBUGGING LAB</span><h1 id="bf-title">Small bugs. Big <span>aha moments.</span></h1><p>Something’s broken. Find it, fix it, and make the tests turn green.</p></div>
        <div className="bf-progress"><Trophy size={21} /><strong>{completed}<span> / {challenges.length}</span></strong><span>challenges solved</span><progress aria-label="Challenges solved" value={completed} max={challenges.length} /></div>
      </section>
      {saveError && <p className="bf-storage-warning" role="status">Browser storage is unavailable. Keep this tab open to retain your work.</p>}
      <div className="bf-layout">
        <aside className="bf-sidebar" aria-label="Bug-fixing challenges"><div className="bf-sidebar-title"><h2>Your next aha</h2><span>{challenges.length} challenges</span></div><nav aria-label="Choose a challenge">{challenges.map((item, index) => <button key={item.id} className={`bf-challenge ${selected === item.id ? 'is-active' : ''}`} aria-current={selected === item.id ? 'true' : undefined} onClick={() => select(item.id)}><span className="bf-challenge-number">{progress[item.id]?.solved ? <Check size={17} aria-label="Solved" /> : String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><small>{item.topic} <span aria-hidden="true">·</span> {item.difficulty}</small></span>{selected === item.id && <ArrowRight size={15} />}</button>)}</nav><div className="bf-sidebar-note"><Lightbulb size={18} /><p>Getting stuck is part of it.<br />Hints help you find your own fix.</p></div></aside>
        <section className="bf-workbench" aria-labelledby="bf-challenge-title">
          <div className="bf-brief"><div className="bf-tags"><span>{challenge.difficulty}</span><span>{challenge.topic}</span><span>Cambridge pseudocode</span></div><h2 id="bf-challenge-title" tabIndex={-1} ref={heading}>{challenge.title}</h2><p>{challenge.brief}</p></div>
          <div className="bf-editor-heading"><span><Bug size={15} /> fix-me.pico</span><span>{saveError ? 'Changes are only kept in this tab' : 'Your edit is saved in this browser'}</span></div>
          <div className="bf-editor"><CodeEditor key={selected} value={attempt.code} onChange={code => { clearRun(); updateAttempt({ code }); }} preferences={{ ...settings, autocomplete: false }} theme={theme} /></div>
          <div className="bf-actions"><div><button className="bf-hint-button" disabled={attempt.hints >= challenge.hints.length} onClick={() => { updateAttempt({ hints: attempt.hints + 1 }); playCue('notify'); }}><Lightbulb size={16} />{challenge.hints.length === 0 ? 'No hints for this challenge' : attempt.hints >= challenge.hints.length ? 'All hints shown' : attempt.hints ? `Next hint (${attempt.hints}/${challenge.hints.length})` : 'Need a hint?'}</button><button className="bf-reset" onClick={reset}><RotateCcw size={15} />Reset</button></div>{running ? <button className="bf-primary" onClick={() => { clearRun(); playCue('stop'); }}><Square size={14} />Stop checks</button> : <button className="bf-primary" onClick={() => void checkFix()}><Play size={15} />Check my fix</button>}</div>
          {attempt.hints > 0 && <aside className="bf-hints" aria-label="Hints">{challenge.hints.slice(0, attempt.hints).map((hint, index) => <p key={hint}><Lightbulb size={15} /><span><strong>Hint {index + 1}.</strong> {hint}</span></p>)}</aside>}
          <section className="bf-results" aria-labelledby="bf-results-title" aria-busy={running}>
            <div className="bf-results-heading"><h3 id="bf-results-title"><Terminal size={16} />Test bench</h3><span role="status" aria-live="polite">{running ? 'Checking your code…' : error ? 'Fix the error and try again' : replies ? `${passed} of ${challenge.tests.length} checks passed` : `${challenge.tests.length} checks ready`}</span></div>
            {error && <p className="bf-error" role="alert">{error}</p>}
            {!replies && !error && <p className="bf-results-help">Run the broken code first, or jump straight into a fix. Check every case to solve the challenge.</p>}
            {challenge.tests.map((test, index) => {
              const reply = replies?.[index];
              const ok = Boolean(reply && !reply.error && JSON.stringify(reply.result?.output) === JSON.stringify(test.expected));
              return <details className={`bf-test ${reply ? ok ? 'is-pass' : 'is-fail' : ''}`} key={`${selected}-${index}`} open={reply && !ok ? true : undefined}><summary>{reply ? ok ? <CheckCircle2 size={17} /> : <Bug size={17} /> : <Circle size={17} />}<span>{test.name}</span><small>{reply ? ok ? 'Passed' : 'Needs a fix' : 'Ready'}</small></summary><div className="bf-test-details"><div><strong>Input</strong><pre>{test.inputs.length ? test.inputs.join('\n') : '(no input)'}</pre></div><div><strong>Expected output</strong><pre>{test.expected.join('\n')}</pre></div><div><strong>Actual output</strong><pre>{reply ? [(reply.result?.output.slice(0, 20).join('\n') || '(no output)'), ...(reply.result && reply.result.output.length > 20 ? ['… Output shortened to the first 20 lines.'] : []), ...(reply.error ? [reply.error.message] : [])].join('\n') : 'Run checks to see the result.'}</pre></div></div></details>;
            })}
            {allPassed && <div className="bf-success" role="status"><CheckCircle2 size={25} /><div><h3>Bug squashed. Nicely done.</h3><p>{challenge.explanation}</p></div><button onClick={() => select(next.id)}>{completed === challenges.length ? 'Keep practising' : 'Next challenge'}<ArrowRight size={16} /></button></div>}
          </section>
        </section>
      </div>
    </div>
  </main>;
}

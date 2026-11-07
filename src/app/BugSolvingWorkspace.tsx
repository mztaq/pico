import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CircleHelp, Code2, RotateCcw, Sparkles, X } from 'lucide-react';
import { CodeEditor } from './components/CodeEditor';
import type { EditorPreferences } from './components/CodeEditor';
import { getTheme, cssVariables } from './themes';
import { loadSettings } from '../storage/settings';
import { startPythonExecution } from '../runtime/python/runner';
import { bugQuestions, buildCheckProgram } from './bug-solving/questions';
import './styles/bug-solving.css';

const STORAGE_KEY = 'pico.bug-solving.v1';
type Saved = { code: Record<string, string>; solved: string[] };
function loadSaved(): Saved {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>; return { code: value.code ?? {}, solved: value.solved ?? [] }; }
  catch { return { code: {}, solved: [] }; }
}

export function BugSolvingWorkspace({ onHome }: { onHome: () => void }) {
  const [settings] = useState(loadSettings);
  const theme = useMemo(() => getTheme(settings.theme), [settings.theme]);
  const [saved, setSaved] = useState(loadSaved);
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState(() => loadSaved().code[bugQuestions[0].id] ?? bugQuestions[0].starter);
  const [hint, setHint] = useState(0);
  const [result, setResult] = useState<{ passed: boolean[]; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const question = bugQuestions[index];
  const solved = saved.solved.includes(question.id);
  const editorPreferences: EditorPreferences = { autocomplete: settings.autocomplete, hoverDocs: settings.hoverDocs, fontSize: settings.fontSize };

  useEffect(() => {
    const next = { ...saved, code: { ...saved.code, [question.id]: code } };
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Editing remains available when storage is full. */ }
  }, [code, question.id]);
  useEffect(() => { document.title = 'Pico | Bug Solving'; return () => { document.title = 'Pico | Home'; }; }, []);

  function chooseQuestion(next: number) {
    const target = bugQuestions[next];
    setSaved(current => {
      const value = { ...current, code: { ...current.code, [question.id]: code } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Keep in-memory progress. */ }
      return value;
    });
    setIndex(next); setCode(saved.code[target.id] ?? target.starter); setHint(0); setResult(null); setShowSolution(false);
  }

  async function checkSolution() {
    setRunning(true); setResult(null); setShowSolution(false);
    let output = '';
    const job = startPythonExecution({ code: buildCheckProgram(code, question), filename: `${question.id}.py`, debug: false, files: {}, sources: {} }, { onOutput: lines => { output += lines.join('\n'); } });
    const replies = await job.promise;
    const error = replies.find(reply => reply.error)?.error?.message;
    const marker = output.split('\n').find(line => line.startsWith('PICO_CHECK:'));
    if (error) setResult({ passed: [], error });
    else if (marker) {
      try {
        const passed = JSON.parse(marker.slice('PICO_CHECK:'.length)) as boolean[];
        setResult({ passed });
        if (passed.length && passed.every(Boolean)) setSaved(current => {
          const value = { ...current, solved: [...new Set([...current.solved, question.id])] };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Keep in-memory progress. */ }
          return value;
        });
      } catch { setResult({ passed: [], error: 'Pico could not read the test results. Check your function and try again.' }); }
    } else setResult({ passed: [], error: 'Python finished without returning test results. Check that your function is defined correctly.' });
    setRunning(false);
  }

  return <main className="bug-app" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="bug-topbar"><button className="bug-back" onClick={onHome}><ArrowLeft size={17} /> Home</button><div className="bug-brand"><img src="/pico-logo.svg" alt="" /> <strong>Pico<span>.</span></strong><span className="bug-divider">/</span><span>Bug Solving</span></div><span className="bug-progress">{saved.solved.length} / {bugQuestions.length} solved</span></header>
    <div className="bug-layout">
      <aside className="bug-sidebar"><div className="bug-sidebar-title">QUESTIONS <span>{bugQuestions.length}</span></div>{bugQuestions.map((item, i) => <button key={item.id} className={`bug-question-link${i === index ? ' active' : ''}`} onClick={() => chooseQuestion(i)}><span className="bug-question-number">{saved.solved.includes(item.id) ? <Check size={15} /> : String(i + 1).padStart(2, '0')}</span><span className="bug-question-label"><strong>{item.title}</strong><small>{item.difficulty} · {item.topic}</small></span>{i === index && <ChevronRight size={15} />}</button>)}<div className="bug-sidebar-note"><Sparkles size={15} /><p>Find the bug, make the fix, then run the tests to check your work.</p></div></aside>
      <section className="bug-content"><div className="bug-problem"><div className="bug-eyebrow"><span>QUESTION {String(index + 1).padStart(2, '0')}</span><span className="bug-pill">{question.difficulty}</span><span className="bug-pill">{question.topic}</span></div><h1>{question.title}</h1><p>{question.description}</p><div className="bug-task"><CircleHelp size={17} /><span>Fix the bug while keeping the function name and parameters unchanged.</span></div>
        <div className="bug-hints"><div className="bug-hints-head"><strong><Sparkles size={15} /> Hints</strong><span>{hint} / {question.hints.length} revealed</span></div>{hint > 0 && <ol>{question.hints.slice(0, hint).map((item, i) => <li key={i}>{item}</li>)}</ol>}<button className="bug-hint-button" onClick={() => setHint(value => Math.min(value + 1, question.hints.length))} disabled={hint >= question.hints.length}>{hint >= question.hints.length ? 'All hints revealed' : 'Reveal a hint'}</button></div>
      </div><div className="bug-editor-panel"><div className="bug-editor-head"><span><Code2 size={16} /> YOUR CODE</span><span>Python</span></div><div className="bug-editor"><CodeEditor language="python" value={code} onChange={value => { setCode(value); setResult(null); }} preferences={editorPreferences} theme={theme} /></div><div className="bug-actions"><button className="bug-reset" onClick={() => { setCode(question.starter); setResult(null); setShowSolution(false); }}><RotateCcw size={15} /> Reset code</button><button className="bug-check" onClick={checkSolution} disabled={running}>{running ? 'Running tests…' : 'Run tests'} <ChevronRight size={16} /></button></div>
        {result && <div className={`bug-results${result.error ? ' has-error' : result.passed.every(Boolean) ? ' all-pass' : ''}`} aria-live="polite"><div className="bug-result-heading">{result.error ? <><X size={17} /> Could not run tests</> : result.passed.every(Boolean) ? <><Check size={17} /> All tests passed</> : <><X size={17} /> {result.passed.filter(Boolean).length} of {result.passed.length} tests passed</>}</div>{result.error ? <p>{result.error}</p> : <div className="bug-case-list">{result.passed.map((pass, i) => <div key={i} className={pass ? 'passed' : 'failed'}><span>{pass ? <Check size={14} /> : <X size={14} />} Test {i + 1}</span><span>{pass ? 'Passed' : 'Not yet'}</span></div>)}</div>}{result.passed.length > 0 && result.passed.every(Boolean) && <button className="bug-explain-button" onClick={() => setShowSolution(value => !value)}>{showSolution ? 'Hide explanation' : 'See explanation'}</button>}{showSolution && <div className="bug-explanation"><p>{question.explanation}</p><pre><code>{question.solution}</code></pre></div>}</div>}
      </div>{solved && !result && <div className="bug-solved-banner"><Check size={16} /> You’ve solved this question. You can keep experimenting with your code.</div>}<div className="bug-bottom-nav"><span>Question {index + 1} of {bugQuestions.length}</span><button onClick={() => chooseQuestion((index + 1) % bugQuestions.length)}>Next question <ChevronRight size={15} /></button></div></section>
    </div>
  </main>;
}

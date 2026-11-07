import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, CircleHelp, Code2, RotateCcw, Sparkles, X } from 'lucide-react';
import { CodeEditor } from './components/CodeEditor';
import type { EditorPreferences } from './components/CodeEditor';
import { HighlightedCode } from './components/HighlightedCode';
import { getTheme, cssVariables } from './themes';
import { loadSettings } from '../storage/settings';
import { startPythonExecution } from '../runtime/python/runner';
import { compile } from '../language';
import { startExecution } from '../runtime/runner';
import { bugQuestions, buildCheckProgram, type BugDifficulty, type BugLanguage, type BugQuestion } from './bug-solving/questions';
import './styles/bug-solving.css';

const STORAGE_KEY = 'pico.bug-solving.v1';
type Saved = { code: Record<string, string>; solved: string[] };
type CheckResult = { label: string; passed: boolean; expected: string; actual: string };
type Result = { checks: CheckResult[]; error?: string; programOutput: string[] };
type QuestionEntry = { question: BugQuestion; index: number };
function loadSaved(): Saved {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>; return { code: value.code ?? {}, solved: value.solved ?? [] }; }
  catch { return { code: {}, solved: [] }; }
}
function displayValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : value === undefined ? 'No returned value' : JSON.stringify(value) ?? String(value);
}

export function BugSolvingWorkspace({ onHome }: { onHome: () => void }) {
  const [settings] = useState(loadSettings);
  const theme = useMemo(() => getTheme(settings.theme), [settings.theme]);
  const [saved, setSaved] = useState(loadSaved);
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState(() => loadSaved().code[bugQuestions[0].id] ?? bugQuestions[0].starter);
  const [hint, setHint] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<BugLanguage | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<BugDifficulty | 'all'>('all');
  const question = bugQuestions[index];
  const filteredQuestions = useMemo<QuestionEntry[]>(() => bugQuestions
    .map((item, questionIndex) => ({ question: item, index: questionIndex }))
    .filter(({ question: item }) => (languageFilter === 'all' || item.language === languageFilter) && (difficultyFilter === 'all' || item.difficulty === difficultyFilter)),
  [languageFilter, difficultyFilter]);
  const solved = saved.solved.includes(question.id);
  const selectedOrdinal = Math.max(1, filteredQuestions.findIndex(item => item.index === index) + 1);
  const editorPreferences: EditorPreferences = { autocomplete: settings.autocomplete, hoverDocs: settings.hoverDocs, fontSize: settings.fontSize };
  const editorLanguage = question.language === 'python' ? 'python' : 'pseudocode';

  useEffect(() => {
    const next = { ...saved, code: { ...saved.code, [question.id]: code } };
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Editing remains available when storage is full. */ }
  }, [code, question.id]);
  useEffect(() => { document.title = 'Pico | Bug Solving'; return () => { document.title = 'Pico | Home'; }; }, []);
  useEffect(() => {
    if (!filteredQuestions.some(item => item.index === index) && filteredQuestions[0]) {
      setIndex(filteredQuestions[0].index);
      setCode(saved.code[filteredQuestions[0].question.id] ?? filteredQuestions[0].question.starter);
      setHint(0); setResult(null); setShowWalkthrough(false);
    }
  }, [filteredQuestions, index]);

  function chooseQuestion(nextIndex: number) {
    const target = bugQuestions[nextIndex];
    setSaved(current => {
      const value = { ...current, code: { ...current.code, [question.id]: code } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Keep in-memory progress. */ }
      return value;
    });
    setIndex(nextIndex); setCode(saved.code[target.id] ?? target.starter); setHint(0); setResult(null); setShowWalkthrough(false);
  }

  async function checkSolution() {
    setRunning(true); setResult(null); setShowWalkthrough(false);
    try {
      let nextResult: Result;
      if (question.language === 'python') {
        let output = '';
        const job = startPythonExecution({ code: buildCheckProgram(code, question), filename: `${question.id}.py`, debug: false, files: {}, sources: {} }, { onOutput: lines => { output += lines.join('\n'); } });
        const replies = await job.promise;
        const error = replies.find(reply => reply.error)?.error?.message;
        const outputLines = output.split('\n');
        const marker = outputLines.find(line => line.startsWith('PICO_CHECK:'));
        const programOutput = outputLines.filter(line => !line.startsWith('PICO_CHECK:') && line.length > 0);
        if (error) nextResult = { checks: [], error, programOutput };
        else if (marker) {
          const checks = JSON.parse(marker.slice('PICO_CHECK:'.length)) as Array<{ label: string; actual: unknown; expected: unknown; passed: boolean }>;
          nextResult = { checks: checks.map(item => ({ label: item.label, passed: item.passed, actual: displayValue(item.actual), expected: displayValue(item.expected) })), programOutput };
        } else nextResult = { checks: [], error: 'Python finished without returning test results. Check your function and try again.', programOutput };
      } else {
        const ast = compile(code).ast;
        const job = startExecution({ ast, runs: question.cases.map(item => ({ inputs: item.inputs ?? [], options: {} })) });
        const replies = await job.promise;
        const checks = replies.map((reply, caseIndex) => {
          const item = question.cases[caseIndex];
          const actual = reply.result?.output.join('\n') ?? (reply.error ? `Error: ${reply.error.message}` : 'No output');
          return { label: item.label, passed: !reply.error && actual === (item.expectedOutput ?? ''), actual, expected: item.expectedOutput ?? '' };
        });
        nextResult = { checks, programOutput: [] };
      }
      setResult(nextResult);
      if (nextResult.checks.length && nextResult.checks.every(item => item.passed)) setSaved(current => {
        const value = { ...current, solved: [...new Set([...current.solved, question.id])] };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Keep in-memory progress. */ }
        return value;
      });
    } catch (error) {
      setResult({ checks: [], error: error instanceof Error ? error.message : 'Pico could not run these tests.', programOutput: [] });
    } finally { setRunning(false); }
  }

  return <main className="bug-app" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="bug-topbar"><button className="bug-back" onClick={onHome}><ArrowLeft size={17} /> Home</button><div className="bug-brand"><img src="/pico-logo.svg" alt="" /> <strong>Pico<span>.</span></strong><span className="bug-divider">/</span><span>Bug Solving</span></div><span className="bug-progress">{saved.solved.length} / {bugQuestions.length} solved</span></header>
    <div className="bug-layout">
      <aside className="bug-sidebar"><div className="bug-sidebar-title">QUESTION BANK <span>{filteredQuestions.length}</span></div>
        <div className="bug-filters"><label><span>Language</span><select aria-label="Filter questions by language" value={languageFilter} onChange={event => { setLanguageFilter(event.target.value as BugLanguage | 'all'); setDifficultyFilter('all'); }}><option value="all">All languages</option><option value="python">Python</option><option value="pseudocode">Pseudocode</option></select></label><label><span>Difficulty</span><select aria-label="Filter questions by difficulty" value={difficultyFilter} onChange={event => setDifficultyFilter(event.target.value as BugDifficulty | 'all')}><option value="all">All levels</option><option value="Beginner">Beginner</option><option value="Easy" disabled={!bugQuestions.some(item => (languageFilter === 'all' || item.language === languageFilter) && item.difficulty === 'Easy')}>Easy</option><option value="Intermediate" disabled={!bugQuestions.some(item => (languageFilter === 'all' || item.language === languageFilter) && item.difficulty === 'Intermediate')}>Intermediate</option></select></label></div>
        {filteredQuestions.map(({ question: item, index: questionIndex }, visibleIndex) => <button key={item.id} className={`bug-question-link${questionIndex === index ? ' active' : ''}`} onClick={() => chooseQuestion(questionIndex)}><span className="bug-question-number">{saved.solved.includes(item.id) ? <Check size={15} /> : String(visibleIndex + 1).padStart(2, '0')}</span><span className="bug-question-label"><strong>{item.title}</strong><small>{item.language === 'python' ? 'Python' : 'Pseudocode'} · {item.difficulty} · {item.topic}</small></span>{questionIndex === index && <ChevronRight size={15} />}</button>)}
        {filteredQuestions.length === 0 && <p className="bug-no-questions">No questions match these filters.</p>}<div className="bug-sidebar-note"><Sparkles size={15} /><p>Inspect the code, make a fix, then run the tests to compare your output.</p></div></aside>
      <section className="bug-content"><div className="bug-problem"><div className="bug-eyebrow"><span>QUESTION {String(selectedOrdinal).padStart(2, '0')}</span><span className="bug-pill">{question.language === 'python' ? 'Python' : 'Pseudocode'}</span><span className="bug-pill">{question.difficulty}</span><span className="bug-pill">{question.topic}</span></div><h1>{question.title}</h1><p>{question.description}</p><div className="bug-task"><CircleHelp size={17} /><span>Fix the bug, then run the tests. Keep the provided function signature or pseudocode inputs unchanged.</span></div>
        <div className="bug-examples"><strong>Example{question.examples.length > 1 ? 's' : ''}</strong>{question.examples.map((example, i) => <div className="bug-example" key={i}><code>{example.input}</code><span aria-hidden="true">→</span><code>{example.output}</code></div>)}</div>
        <div className="bug-hints"><div className="bug-hints-head"><strong><Sparkles size={15} /> Hints</strong><span>{hint} / {question.hints.length} revealed</span></div>{hint > 0 && <ol>{question.hints.slice(0, hint).map((item, i) => <li key={i}>{item}</li>)}</ol>}<button className="bug-hint-button" onClick={() => setHint(value => Math.min(value + 1, question.hints.length))} disabled={hint >= question.hints.length}>{hint >= question.hints.length ? 'All hints revealed' : 'Reveal a hint'}</button><button className="bug-walkthrough-button" onClick={() => setShowWalkthrough(value => !value)} aria-expanded={showWalkthrough}><BookOpen size={15} /> {showWalkthrough ? 'Hide full walkthrough' : 'Full walkthrough'}</button></div>
        {showWalkthrough && <section className="bug-walkthrough" aria-label="Full walkthrough"><div className="bug-walkthrough-head"><div><span>STEP-BY-STEP GUIDE</span><h2>How to solve it</h2></div><button onClick={() => setShowWalkthrough(false)} aria-label="Close walkthrough"><X size={17} /></button></div><ol>{question.walkthrough.map((step, i) => <li key={i}><span>{i + 1}</span><p>{step}</p></li>)}</ol><h3>One correct solution</h3><pre><HighlightedCode language={editorLanguage} code={question.solution} /></pre><p className="bug-walkthrough-explanation">{question.explanation}</p></section>}
      </div>
      <div className="bug-editor-panel"><div className="bug-editor-head"><span><Code2 size={16} /> YOUR CODE</span><span>{question.language === 'python' ? 'Python' : 'Pseudocode'}</span></div><div className="bug-editor"><CodeEditor language={editorLanguage} value={code} onChange={value => { setCode(value); setResult(null); }} preferences={editorPreferences} theme={theme} /></div><div className="bug-actions"><button className="bug-reset" onClick={() => { setCode(question.starter); setResult(null); setShowWalkthrough(false); }}><RotateCcw size={15} /> Reset code</button><button className="bug-check" onClick={checkSolution} disabled={running}>{running ? 'Running tests…' : 'Run tests'} <ChevronRight size={16} /></button></div>
        {result && <div className={`bug-results${result.error ? ' has-error' : result.checks.length > 0 && result.checks.every(item => item.passed) ? ' all-pass' : ''}`} aria-live="polite"><div className="bug-result-heading">{result.error ? <><X size={17} /> Could not run tests</> : result.checks.length > 0 && result.checks.every(item => item.passed) ? <><Check size={17} /> All tests passed</> : <><X size={17} /> {result.checks.filter(item => item.passed).length} of {result.checks.length} tests passed</>}</div>{result.error && <p>{result.error}</p>}{result.checks.length > 0 && <div className="bug-case-list">{result.checks.map((item, i) => <div key={`${item.label}-${i}`} className={item.passed ? 'passed' : 'failed'}><div className="bug-case-status"><span>{item.passed ? <Check size={14} /> : <X size={14} />} {item.label}</span><strong>{item.passed ? 'Passed' : 'Check output'}</strong></div><div className="bug-case-values"><span><small>Expected</small><code>{item.expected}</code></span><span><small>Your output</small><code>{item.actual}</code></span></div></div>)}</div>}{result.programOutput.length > 0 && <div className="bug-program-output"><strong>Your program output</strong><pre>{result.programOutput.join('\n')}</pre></div>}{result.checks.length > 0 && result.checks.every(item => item.passed) && <p className="bug-success-note">Nice work. All sample and edge-case outputs match.</p>}</div>}
      </div>{solved && !result && <div className="bug-solved-banner"><Check size={16} /> You’ve solved this question. Keep experimenting or move on.</div>}<div className="bug-bottom-nav"><span>Question {selectedOrdinal} of {filteredQuestions.length}</span><button onClick={() => chooseQuestion(filteredQuestions[(filteredQuestions.findIndex(item => item.index === index) + 1) % Math.max(filteredQuestions.length, 1)]?.index ?? index)}>Next question <ChevronRight size={15} /></button></div></section>
    </div>
  </main>;
}

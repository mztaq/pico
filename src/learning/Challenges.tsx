import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Lightbulb, Play, RotateCcw } from 'lucide-react';
import type { ExecutionJob } from '../runtime/runner';
import { challenges, type Challenge } from './challenges';
import { checkChallenge, gradeChallenge, readSolved, recordSolved, type ChallengeResult } from './execute';

function readDraft(id: string, starter: string): string {
  try { return localStorage.getItem('pico.challenge.draft.' + id)?.slice(0, 12000) || starter; }
  catch { return starter; }
}

export function Challenges({ onDebug }: { onDebug: (code: string) => void }) {
  const [selected, setSelected] = useState<Challenge>(challenges[0]!);
  const [code, setCode] = useState(() => readDraft(challenges[0]!.id, challenges[0]!.starter));
  const [solved, setSolved] = useState(readSolved);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [error, setError] = useState('');
  const job = useRef<ExecutionJob | null>(null);

  useEffect(() => {
    try { localStorage.setItem('pico.challenge.draft.' + selected.id, code.slice(0, 12000)); }
    catch { /* storage optional */ }
  }, [selected.id, code]);
  useEffect(() => () => { job.current?.cancel(); }, []);

  function choose(challenge: Challenge) {
    job.current?.cancel();
    job.current = null;
    setRunning(false);
    setSelected(challenge);
    setCode(readDraft(challenge.id, challenge.starter));
    setResult(null);
    setError('');
    setHintVisible(false);
  }

  function reset() {
    job.current?.cancel(); job.current = null;
    setRunning(false);
    setCode(selected.starter);
    setResult(null);
    setError('');
  }

  async function check() {
    job.current?.cancel();
    job.current = null;
    setResult(null); setError(''); setRunning(true);
    let execution: ExecutionJob | null = null;
    try {
      if(code.length > 12000) throw Error('Limit code to 12,000 characters.');
      execution = checkChallenge(code, selected);
      job.current = execution;
      const replies = await execution.promise;
      if (job.current !== execution) return;
      const graded = gradeChallenge(selected, replies);
      setResult(graded);
      if (graded.passed === graded.total) setSolved(recordSolved(selected.id));
    } catch (reason) {
      if (execution === null || job.current === execution)
        setError(reason instanceof Error ? reason.message : 'Unable to check the program.');
    } finally {
      if (job.current === execution) { job.current = null; setRunning(false); }
      if (execution === null) setRunning(false);
    }
  }

  const remaining = challenges.length - solved.length;

  return <section className="suite-challenge-grid" aria-label="Programming challenges">
    <aside className="suite-surface suite-challenge-list">
      <div className="suite-section-header"><h2>Challenges</h2><span className="suite-count">{solved.length}/{challenges.length}</span></div>
      <div className="suite-challenge-scroll">
        {challenges.map(challenge => <button type="button" key={challenge.id}
          className={'suite-challenge-option' + (selected.id === challenge.id ? ' is-active' : '')}
          onClick={() => choose(challenge)}>
          <span className="suite-challenge-name">{solved.includes(challenge.id) && <Check size={15} />} {challenge.title}</span>
          <small>{challenge.level} · {challenge.topic}</small>
          <ChevronRight size={15} aria-hidden="true" />
        </button>)}
      </div>
      <div className="suite-challenge-footer">{remaining === 0 ? 'All challenges completed' : remaining + ' to complete'}</div>
    </aside>

    <section className="suite-surface suite-challenge-task">
      <div className="suite-section-header"><h2>{selected.title}</h2><span className="suite-count">{selected.level}</span></div>
      <p className="suite-task-copy">{selected.task}</p>
      <div className="suite-actions suite-hint-actions">
        <button type="button" className="suite-text-button" onClick={() => setHintVisible(value => !value)}>
          <Lightbulb size={16} /> {hintVisible ? 'Hide hint' : 'Hint'}
        </button>
        {hintVisible && <p className="suite-hint">{selected.hint}</p>}
      </div>

      <label className="suite-label" htmlFor="challenge-editor">Your pseudocode</label>
      <textarea id="challenge-editor" className="suite-code" spellCheck={false} value={code}
        onChange={event => { setCode(event.target.value); setResult(null); setError(''); }} />
      <div className="suite-actions">
        <button className="suite-primary" type="button" disabled={running} onClick={check}><Play size={15} /> {running ? 'Checking…' : 'Check solution'}</button>
        <button className="suite-secondary" type="button" onClick={reset}><RotateCcw size={15} /> Reset code</button>
        <button className="suite-text-button" type="button" onClick={() => onDebug(code)}>Debug in Live Studio</button>
      </div>
      {error && <p className="suite-error" role="alert">{error}</p>}
      {result && <section className="suite-check-results" aria-label="Test results" aria-live="polite">
        <h3>{result.passed === result.total ? 'All tests passed' : result.passed + ' of ' + result.total + ' tests passed'}</h3>
        {result.cases.map((test, index) => <div key={index} className={'suite-test-row' + (test.passed ? ' passed' : ' failed')}>
          <strong>{test.passed ? '✓' : '×'} Test {index + 1}</strong>
          {!test.passed && <div className="suite-test-details">
            <span>Input: {test.inputs.join(', ') || '(none)'}</span>
            <span>Expected: {test.expected.join(' | ')}</span>
            <span>Received: {test.error || test.received.join(' | ') || '(no output)'}</span>
          </div>}
        </div>)}
      </section>}
    </section>
  </section>;
}

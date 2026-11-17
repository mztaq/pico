import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { questions, topics, type Question } from './content';

type ExamSession = {
  id: string;
  questions: Question[];
  answers: Record<string, number>;
  deadline: number;
  duration: number;
  completed: boolean;
};
type ExamHistory = { id: string; date: string; score: number; total: number; duration: number };
const historyKey = 'pico.exam.results.v1';
const activeKey = 'pico.exam.active.v1';

function restoreSession(): ExamSession | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(activeKey) ?? 'null') as {
      id?: string; ids?: string[]; answers?: Record<string, number>; deadline?: number;
      duration?: number; completed?: boolean;
    } | null;
    if (!saved || typeof saved.id !== 'string' || !Array.isArray(saved.ids) ||
      saved.ids.length < 1 || saved.ids.length > 30 || !Number.isFinite(saved.deadline) ||
      !Number.isFinite(saved.duration)) return null;
    const questionMap = new Map(questions.map(question => [question.id, question]));
    const restored = saved.ids.map(id => questionMap.get(id));
    if (restored.some(question => !question)) return null;
    const answers: Record<string, number> = {};
    for (const id of saved.ids) {
      const answer = saved.answers?.[id];
      if (Number.isInteger(answer) && answer! >= 0 && answer! <= 3) answers[id] = answer!;
    }
    return {
      id: saved.id, questions: restored as Question[], answers,
      deadline: saved.deadline!, duration: saved.duration!, completed: Boolean(saved.completed),
    };
  } catch { return null; }
}
function chooseQuestions(size: number, unit: string): Question[] {
  const topicIds = new Set(topics.filter(topic => unit === 'all' || topic.unit === unit).map(topic => topic.id));
  const pool = questions.filter(question => topicIds.has(question.topic));
  // Fisher-Yates, once at exam start. Do not reshuffle on a rerender.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(size, pool.length));
}
function resultOf(session: ExamSession) {
  const missed = session.questions.filter(q => session.answers[q.id] !== q.answer);
  return { correct: session.questions.length - missed.length, missed };
}
function rememberResult(result: ExamHistory) {
  try {
    const stored = JSON.parse(localStorage.getItem(historyKey) ?? '[]') as ExamHistory[];
    if (stored.some(previous => previous.id === result.id)) return;
    localStorage.setItem(historyKey, JSON.stringify([result, ...stored].slice(0, 20)));
  } catch { /* optional local storage */ }
}
function timeText(seconds: number) {
  const n = Math.max(0, seconds);
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}
export function ExamSimulator({ onReviewTopic }: { onReviewTopic: (topicId: string) => void }) {
  const [unit, setUnit] = useState('all');
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(15);
  const [session, setSession] = useState<ExamSession | null>(restoreSession);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const units = [...new Set(topics.map(t => t.unit))];
  const available = questions.filter(q => unit === 'all' || topics.find(t => t.id === q.topic)?.unit === unit).length;
  const timeLeft = session ? Math.max(0, Math.ceil((session.deadline - now) / 1000)) : 0;

  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(activeKey, JSON.stringify({
        id: session.id, ids: session.questions.map(q => q.id), answers: session.answers,
        deadline: session.deadline, duration: session.duration, completed: session.completed,
      }));
      else sessionStorage.removeItem(activeKey);
    } catch { /* Storage not required for practice. */ }
  }, [session]);

  useEffect(() => {
    if (!session?.completed) return;
    const correct = session.questions.filter(q => session.answers[q.id] === q.answer).length;
    rememberResult({ id: session.id, date: new Date().toISOString(),
      score: correct, total: session.questions.length, duration: session.duration });
  }, [session?.id, session?.completed]);

  useEffect(() => {
    if (!session || session.completed) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session?.deadline, session?.completed]);

  useEffect(() => {
    if (session && !session.completed && timeLeft === 0) finish();
  }, [timeLeft, session?.completed]);

  function start() {
    const selected = chooseQuestions(count, unit);
    if (!selected.length) return;
    const started = Date.now();
    setNow(started);
    setSession({ id: String(started) + '-' + Math.random().toString(36).slice(2),
      questions: selected, answers: {}, deadline: started + minutes * 60000,
      duration: minutes, completed: false });
    setIndex(0);
  }
  function finish() {
    setSession(current => current && !current.completed
      ? { ...current, completed: true } : current);
  }
  function answer(choice: number) {
    setSession(current => current && !current.completed && Date.now() < current.deadline
      ? { ...current, answers: { ...current.answers, [current.questions[index]!.id]: choice } } : current);
  }

  const result = useMemo(() => session?.completed ? resultOf(session) : null, [session]);
  const weakTopics = useMemo(() => {
    if (!result) return [];
    const countByTopic = new Map<string, number>();
    for (const question of result.missed) countByTopic.set(question.topic, (countByTopic.get(question.topic) || 0) + 1);
    return [...countByTopic].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, wrong]) => ({ id, title: topics.find(t => t.id === id)?.title || id, wrong }));
  }, [result]);

  if (!session) return <section className="suite-surface suite-exam-setup">
    <h2>Exam practice</h2>
    <p>Timed questions from Pico's original Computer Science question bank. This is practice, not an official exam paper.</p>
    <div className="suite-exam-settings">
      <label className="suite-label">Topics
        <select value={unit} onChange={event => setUnit(event.target.value)}>
          <option value="all">All topics</option>
          {units.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="suite-label">Questions
        <select value={count} onChange={event => setCount(Number(event.target.value))}>
          <option value={10}>10</option><option value={20}>20</option><option value={30}>30</option>
        </select>
      </label>
      <label className="suite-label">Time limit
        <select value={minutes} onChange={event => setMinutes(Number(event.target.value))}>
          <option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option>
        </select>
      </label>
    </div>
    <p className="suite-hint">{Math.min(count, available)} questions available with this selection.</p>
    <button className="suite-primary" type="button" disabled={available === 0} onClick={start}>Start exam practice <ArrowRight size={16} /></button>
  </section>;

  if (result) return <section className="suite-surface suite-exam-results" aria-live="polite">
    <div className="suite-section-header"><h2>Results</h2><span className="suite-count">{session.questions.length} questions</span></div>
    <strong className="suite-exam-score">{result.correct} / {session.questions.length}</strong>
    <p>{Math.round(result.correct / session.questions.length * 100)}% correct</p>
    {weakTopics.length > 0 && <div className="suite-exam-review">
      <h3>Topics to review</h3>
      <ul>{weakTopics.map(topic => <li key={topic.id}><button className="suite-review-topic" type="button"
        onClick={() => onReviewTopic(topic.id)}>{topic.title}</button> · {topic.wrong} missed</li>)}</ul>
    </div>}
    <div className="suite-exam-review">
      <h3>Answer review</h3>
      {session.questions.map((q, i) => <details key={q.id} className="suite-exam-answer">
        <summary>{session.answers[q.id] === q.answer ? '✓' : '×'} Question {i + 1}: {q.prompt}</summary>
        <p>Your answer: {session.answers[q.id] === undefined ? 'Not answered' : q.choices[session.answers[q.id]!]}</p>
        <p>Correct answer: {q.choices[q.answer]}</p><p>{q.explanation}</p>
      </details>)}
    </div>
    <button className="suite-primary" type="button" onClick={() => setSession(null)}>New exam practice</button>
  </section>;

  const q = session.questions[index]!;
  const answered = Object.keys(session.answers).length;
  return <section className="suite-surface suite-exam-session">
    <div className="suite-section-header">
      <h2>Question {index + 1} of {session.questions.length}</h2>
      <span className="suite-timer" aria-label={'Time remaining ' + timeText(timeLeft)}><Clock3 size={16} /> {timeText(timeLeft)}</span>
    </div>
    <div className="suite-exam-progress" role="progressbar" aria-valuenow={answered} aria-valuemin={0}
      aria-valuemax={session.questions.length} aria-label="Questions answered">
      <span style={{ width: answered / session.questions.length * 100 + '%' }} />
    </div>
    <h3 className="suite-exam-prompt">{q.prompt}</h3>
    <fieldset className="suite-exam-options"><legend className="sr-only">Choose one answer</legend>
      {q.choices.map((option, i) => <label key={i} className={'suite-exam-choice' + (session.answers[q.id] === i ? ' selected' : '')}>
        <input type="radio" name={'exam-' + q.id} checked={session.answers[q.id] === i} onChange={() => answer(i)} />
        <span>{'ABCD'[i]}</span>{option}
      </label>)}
    </fieldset>
    <div className="suite-actions suite-exam-navigation">
      <button className="suite-secondary" type="button" disabled={index === 0} onClick={() => setIndex(n => n - 1)}><ArrowLeft size={16} /> Previous</button>
      <button className="suite-secondary" type="button" disabled={index === session.questions.length - 1} onClick={() => setIndex(n => n + 1)}>Next <ArrowRight size={16} /></button>
      <button className="suite-primary" type="button" onClick={finish}>Submit ({answered}/{session.questions.length})</button>
    </div>
  </section>;
}

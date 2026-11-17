import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Code2, Gamepad2, GraduationCap, RotateCcw, Search, Trophy, Users } from 'lucide-react';
import type { PicoWorkspace } from '../app/workspace-deeplink';
import { questions, topics, type Question, type Topic } from './content';
import { readProgress, recordAnswer, saveProgress } from './progress';
import { loadSettings } from '../storage/settings';
import { getTheme } from '../app/themes';
import { learningThemeVariables } from './theme';
import { LearningVisual, visualizedTopics } from './LearningVisuals';
import { topicNotes } from './notes';
import './learning.css';
import './suite.css';

const LiveStudio = lazy(() => import('./LiveStudio').then(module => ({ default: module.LiveStudio })));
const Challenges = lazy(() => import('./Challenges').then(module => ({ default: module.Challenges })));
const ExamSimulator = lazy(() => import('./ExamSimulator').then(module => ({ default: module.ExamSimulator })));
const Classroom = lazy(() => import('./Classroom').then(module => ({ default: module.Classroom })));
const RetroArcade = lazy(() => import('./RetroArcade').then(module => ({ default: module.RetroArcade })));

type LearningSection = 'notes' | 'studio' | 'challenges' | 'exam' | 'classroom' | 'arcade';
const sections = [
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'studio', label: 'Live Studio', icon: Code2 },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'exam', label: 'Exam practice', icon: GraduationCap },
  { id: 'classroom', label: 'Classroom', icon: Users },
  { id: 'arcade', label: 'Arcade', icon: Gamepad2 },
] as const;


type Props = {
  onBack: () => void;
  onOpenTool: (tool: PicoWorkspace) => void;
  onStartCode: (starter: NonNullable<Topic['starter']>) => void;
};

const toolNames: Partial<Record<PicoWorkspace, string>> = {
  binary: 'Binary Lab', cpu: 'CPU Studio', flowchart: 'Flowchart Builder', logic: 'Logic Sim',
  pseudocode: 'Pseudocode Compiler', python: 'Python Compiler',
};

export function LearningHub({ onBack, onOpenTool, onStartCode }: Props) {
  const [theme, setTheme] = useState(() => getTheme(loadSettings().theme));
  useEffect(() => {
    const syncTheme = () => setTheme(getTheme(loadSettings().theme));
    window.addEventListener('pico:settings-saved', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('pico:settings-saved', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);
  const [section, setSection] = useState<LearningSection>('notes');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Topic>(topics[0]);
  const [progress, setProgress] = useState(readProgress);
  const [session, setSession] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [mode, setMode] = useState('');
  const lessonRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => topics.filter(topic =>
    `${topic.title} ${topic.unit} ${topic.idea}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const units = [...new Set(filtered.map(topic => topic.unit))];
  const available = questions.filter(question => question.topic === selected.id);
  const notes = topicNotes[selected.id];

  function start(items: Question[], label: string) {
    if (!items.length) return;
    setSession(items);
    setMode(label);
    setIndex(0);
    setChoice(null);
    setRevealed(false);
    setScore(0);
  }
  function answer() {
    if (choice === null || revealed || !session) return;
    const question = session[index];
    const isCorrect = choice === question.answer;
    const next = recordAnswer(progress, question.id, isCorrect);
    setProgress(next);
    saveProgress(next);
    setScore(value => value + Number(isCorrect));
    setRevealed(true);
  }
  function next() {
    if (!session) return;
    setIndex(value => value + 1);
    setChoice(null);
    setRevealed(false);
  }
  function chooseTopic(topic: Topic) {
    setSelected(topic);
    setSection('notes');
    setSession(null);
    lessonRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
  function openStudioWithCode(code: string) {
    try { localStorage.setItem('pico.studio.code.v1', code.slice(0, 12000)); }
    catch { /* use default example if local storage is disabled */ }
    setSection('studio');
  }
  return <section className="learning-hub" aria-label="Learn and practice" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={learningThemeVariables(theme)}>
    <header className="learning-topbar">
      <span className="learning-brand"><BookOpen size={18} aria-hidden="true" /> Learn</span>
      <button type="button" className="learning-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Workspaces</button>
    </header>
    <nav className="learning-sections" aria-label="Learning sections">
      {sections.map(item => {
        const Icon = item.icon;
        return <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''}
          aria-pressed={section === item.id} onClick={() => setSection(item.id)}>
          <Icon size={16} aria-hidden="true" />{item.label}
        </button>;
      })}
    </nav>
    {section === 'notes' ? <div className="learning-layout">
      <aside className="learning-catalogue" aria-label="Topics">
        <label className="learning-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search topics</span><input type="search" placeholder="Search topics" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="learning-topic-list">
          {units.map(unit => <div className="learning-unit" key={unit}>
            <h2>{unit}</h2>
            {filtered.filter(topic => topic.unit === unit).map(topic => <button key={topic.id} type="button" className={`learning-topic${selected.id === topic.id ? ' is-active' : ''}`} aria-current={selected.id === topic.id ? 'true' : undefined} onClick={() => chooseTopic(topic)}>
              <span>{topic.title}</span>
            </button>)}
          </div>)}
          {!filtered.length && <p className="learning-empty">No matching topic. Try a shorter search.</p>}
        </div>
      </aside>
      <div className="learning-main">
        {session ? index < session.length ? <section className="learning-panel learning-quiz" aria-label="Practice question">
          <div className="learning-panel-top"><span className="learning-eyebrow">{mode}</span><button type="button" className="learning-text-button" onClick={() => setSession(null)}>Exit practice</button></div>
          <div className="learning-quiz-meta"><span>Question {index + 1} of {session.length}</span><span>{score} correct so far</span></div>
          <h2>{session[index].prompt}</h2>
          <fieldset disabled={revealed} className="learning-answers"><legend className="sr-only">Choose an answer</legend>
            {session[index].choices.map((option, optionIndex) => <label key={optionIndex} className={`learning-answer${choice === optionIndex ? ' is-selected' : ''}${revealed && optionIndex === session[index].answer ? ' is-correct' : ''}${revealed && choice === optionIndex && choice !== session[index].answer ? ' is-incorrect' : ''}`}>
              <input type="radio" name="practice-answer" checked={choice === optionIndex} onChange={() => setChoice(optionIndex)} />
              <span className="learning-answer-letter" aria-hidden="true">{'ABCD'[optionIndex]}</span><span>{option}</span>
            </label>)}
          </fieldset>
          {revealed && <div className="learning-feedback" role="status"><strong>{choice === session[index].answer ? 'Correct' : `The answer is ${session[index].choices[session[index].answer]}`}</strong><p>{session[index].explanation}</p></div>}
          <div className="learning-actions">{revealed ? <button className="learning-primary" type="button" onClick={next}>{index === session.length - 1 ? 'See result' : 'Next question'} <ArrowRight size={16} aria-hidden="true" /></button> : <button className="learning-primary" type="button" disabled={choice === null} onClick={answer}>Check answer</button>}</div>
        </section> : <section className="learning-panel learning-result" aria-live="polite"><CheckCircle2 size={32} aria-hidden="true" /><span className="learning-eyebrow">Practice complete</span><h2>{score} of {session.length} correct</h2><p>{progress.missed.length ? `${progress.missed.length} question${progress.missed.length === 1 ? '' : 's'} in your review list.` : 'No questions in your review list.'}</p><div className="learning-actions"><button type="button" className="learning-primary" onClick={() => setSession(null)}>Back to topic</button>{progress.missed.length > 0 && <button type="button" className="learning-secondary" onClick={() => start(questions.filter(question => progress.missed.includes(question.id)), 'Review missed')}>Review missed</button>}</div></section>
        : <>
          <section className="learning-panel learning-lesson" aria-labelledby="learning-topic-title" ref={lessonRef}>
            <span className="learning-eyebrow">{selected.unit}</span>
            <h2 id="learning-topic-title">{selected.title}</h2>

            <section className="learning-note-section" aria-labelledby="learning-key-points">
              <h3 id="learning-key-points">Key points</h3>
              <p className="learning-definition">{selected.idea}</p>
              {notes && <ul className="learning-note-list">{notes.points.map((point, pointIndex) =>
                <li key={pointIndex}>{point}</li>
              )}</ul>}
            </section>

            {(selected.worked || notes?.exampleSteps?.length) && <section className="learning-note-section" aria-labelledby="learning-worked-example">
              <h3 id="learning-worked-example">Worked example</h3>
              {selected.worked && !notes?.exampleSteps?.length && <p>{selected.worked}</p>}
              {notes?.exampleSteps && <ol className="learning-example-steps">{notes.exampleSteps.map((stepText, stepIndex) =>
                <li key={stepIndex}>{stepText}</li>
              )}</ol>}
            </section>}

            {notes?.remember && <div className="learning-remember"><strong>Remember</strong><p>{notes.remember}</p></div>}

            {visualizedTopics.has(selected.id) && <section className="learning-note-section learning-interactive-example" aria-labelledby="learning-interactive-heading">
              <h3 id="learning-interactive-heading">Interactive example</h3>
              <LearningVisual topicId={selected.id} />
            </section>}

            {selected.tryThis && <section className="learning-note-section" aria-labelledby="learning-try-heading">
              <h3 id="learning-try-heading">Try it yourself</h3>
              <p>{selected.tryThis}</p>
            </section>}

            <div className="learning-actions learning-lesson-actions">
              {available.length > 0 && <button type="button" className="learning-primary" onClick={() => start(available, selected.title)}><CircleHelp size={16} aria-hidden="true" /> Practice questions ({available.length})</button>}
              {selected.tool && <button type="button" className="learning-secondary"
                onClick={() => selected.starter?.language === 'pseudocode' ? openStudioWithCode(selected.starter.code)
                  : selected.starter ? onStartCode(selected.starter) : onOpenTool(selected.tool!)}>
                {selected.starter?.language === 'pseudocode' ? 'Try in Live Studio'
                  : selected.starter ? 'Open example in compiler' : `Open ${toolNames[selected.tool] ?? 'Pico tool'}`}
                <ArrowRight size={16} aria-hidden="true" />
              </button>}
            </div>
          </section>
          <section className="learning-panel learning-practice-card" aria-labelledby="practice-title">
            <div><h2 id="practice-title">Practice</h2><p>Mixed questions or questions you answered incorrectly.</p></div>
            <div className="learning-actions">
              <button type="button" className="learning-secondary" onClick={() => start([...questions].sort(() => Math.random() - .5).slice(0, 8), 'Mixed practice')}>Mixed questions</button>
              <button type="button" className="learning-secondary" disabled={!progress.missed.length} onClick={() => start(questions.filter(question => progress.missed.includes(question.id)), 'Review missed')}><RotateCcw size={16} aria-hidden="true" /> Review missed ({progress.missed.length})</button>
            </div>
          </section>
        </>}
      </div>
    </div> : <div className="learning-feature">
      <Suspense fallback={<div className="learning-panel" role="status">Loading…</div>}>
        {section === 'studio' && <LiveStudio />}
        {section === 'challenges' && <Challenges onDebug={openStudioWithCode} />}
        {section === 'exam' && <ExamSimulator onReviewTopic={id => {
          const topic = topics.find(item => item.id === id);
          if (topic) chooseTopic(topic);
        }} />}
        {section === 'classroom' && <Classroom />}
        {section === 'arcade' && <RetroArcade />}
      </Suspense>
    </div>}
  </section>;
}

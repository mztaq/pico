import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Bug, CheckCircle2, CircleHelp, Gamepad2, RotateCcw, Search, WifiOff } from 'lucide-react';
import type { PicoWorkspace } from '../app/workspace-deeplink';
import { questions, topics, type Question, type Topic } from './content';
import { readProgress, recordAnswer, saveProgress } from './progress';
import { loadSettings } from '../storage/settings';
import { getTheme } from '../app/themes';
import { learningThemeVariables } from './theme';
import { LearningVisual, visualizedTopics } from './LearningVisuals';
import { topicNotes } from './notes';
import './learning.css';
import './arena.css';
import { SiteInfoLinks } from '../app/components/SiteInfo';
import { BugReportDialog } from '../app/components/BugReportDialog';
import { BugReportNotice } from '../app/components/BugReportNotice';
import { picoIsOnline } from '../app/components/pico-connection';

const ArenaGame = lazy(() => import('./ArenaGame').then(module => ({ default: module.ArenaGame })));

type LearningSection = 'notes' | 'arena';

export function sectionFromSearch(search: string): LearningSection | null {
  const target = new URLSearchParams(search).get('section');
  return target === 'notes' || target === 'arena' ? target : null;
}

const sections = [
  { id: 'notes', label: 'Notes', description: 'Understand every topic with diagrams and worked examples.', icon: BookOpen },
  { id: 'arena', label: 'Circuit Clash', description: 'Answer questions, conquer the network and compete live.', icon: Gamepad2 },
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
  const [section, setSection] = useState<LearningSection | null>(() => sectionFromSearch(window.location.search));
  useEffect(() => {
    const syncSection = () => setSection(sectionFromSearch(window.location.search));
    window.addEventListener('popstate', syncSection);
    return () => window.removeEventListener('popstate', syncSection);
  }, []);
  function chooseSection(next: LearningSection | null) {
    if (next === section) return;
    setSection(next);
    const url = new URL(window.location.href);
    if (next === null) url.searchParams.delete('section');
    else url.searchParams.set('section', next);
    window.history.pushState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  const [reportOpen, setReportOpen] = useState(false);
  const [reportWarning, setReportWarning] = useState(false);
  const [reportNotice, setReportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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
    if (section !== 'notes') chooseSection('notes');
    setSession(null);
    lessonRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
  async function openReport() {
    if (await picoIsOnline()) setReportOpen(true);
    else setReportWarning(true);
  }
  return <section className="learning-hub" aria-label="Learn and practice" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={learningThemeVariables(theme)}>
    <header className="learning-topbar">
      <span className="learning-brand"><BookOpen size={18} aria-hidden="true" /> Learn and practise</span>
      <button type="button" className="learning-back" onClick={() => section === null ? onBack() : chooseSection(null)}>
        <ArrowLeft size={17} aria-hidden="true" /> {section === null ? 'Home' : 'All tools'}
      </button>
    </header>
    {section === null ? <div className="learning-tool-grid" aria-label="Choose a learning tool">
      <button type="button" className="learning-tool-card learning-tool-card--notes" onClick={() => chooseSection('notes')}>
        <span className="learning-tool-heading"><span className="learning-tool-icon"><BookOpen size={24}/></span><ArrowRight size={19}/></span>
        <span className="learning-tool-preview learning-tool-preview--notes" aria-hidden="true">
          <span>0010 1101</span><span className="learning-preview-arrow">→</span><span>45</span>
          <small>32 + 8 + 4 + 1 = 45</small>
        </span>
        <span className="learning-tool-copy"><strong>Notes</strong><span>Computer Science topics, examples and interactive diagrams.</span></span>
      </button>
      <button type="button" className="learning-tool-card learning-tool-card--arena" onClick={() => chooseSection('arena')}>
        <span className="learning-tool-heading"><span className="learning-tool-icon"><Gamepad2 size={24}/></span><ArrowRight size={19}/></span>
        <span className="learning-tool-preview learning-tool-preview--arena" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => <i key={index} className={index % 6 < 3 ? 'owned' : index % 4 === 0 ? 'rival' : ''}/>)}
        </span>
        <span className="learning-tool-copy"><strong>Circuit Clash</strong><span>One competitive game. Solo matches, live classrooms and a 2D network to conquer.</span></span>
      </button>
    </div> : section === 'notes' ? <div className="learning-layout">
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
                onClick={() => selected.starter ? onStartCode(selected.starter) : onOpenTool(selected.tool!)}>
                {selected.starter ? 'Open example in compiler' : `Open ${toolNames[selected.tool] ?? 'Pico tool'}`}
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
      <Suspense fallback={<div className="learning-panel" role="status">Loading game…</div>}>
        <ArenaGame onReviewTopic={id => {
          const topic = topics.find(item => item.id === id);
          if (topic) chooseTopic(topic);
        }} />
      </Suspense>
    </div>}
    <footer className="learning-footer">
      <SiteInfoLinks />
      <button type="button" className="learning-report" onClick={() => { void openReport(); }}>
        <Bug size={16} aria-hidden="true"/> Report a Bug
      </button>
    </footer>
    {reportWarning && <div className="pico-offline-backdrop" role="presentation">
      <section className="pico-offline-dialog" role="dialog" aria-modal="true" aria-labelledby="learn-report-offline">
        <h2 id="learn-report-offline">You're offline</h2>
        <p>Connect to the internet to report a bug.</p>
        <button type="button" className="pico-offline-continue" onClick={() => setReportWarning(false)}>
          <WifiOff size={16}/> Close
        </button>
      </section>
    </div>}
    {reportOpen && <BugReportDialog onClose={() => setReportOpen(false)}
      onResult={(type, message) => { setReportOpen(false); setReportNotice({ type, message }); }}/>}
    {reportNotice && <BugReportNotice type={reportNotice.type} message={reportNotice.message}
      onClose={() => setReportNotice(null)}/>}
  </section>;
}

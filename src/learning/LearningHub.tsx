import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp, RotateCcw, Search } from 'lucide-react';
import type { PicoWorkspace } from '../app/workspace-deeplink';
import { questions, topics, type Question, type Topic } from './content';
import { readProgress, recordAnswer, saveProgress } from './progress';
import { loadSettings } from '../storage/settings';
import { cssVariables, getTheme } from '../app/themes';
import { LearningVisual, visualizedTopics } from './LearningVisuals';
import './learning.css';

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
  const [theme] = useState(() => getTheme(loadSettings().theme));
  useEffect(() => { document.documentElement.style.colorScheme = theme.appearance; }, [theme]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Topic>(topics[0]);
  const [progress, setProgress] = useState(readProgress);
  const [session, setSession] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [mode, setMode] = useState('');
  const [lessonStep, setLessonStep] = useState(0);
  const lessonRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => topics.filter(topic =>
    `${topic.title} ${topic.unit} ${topic.idea}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const units = [...new Set(filtered.map(topic => topic.unit))];
  const available = questions.filter(question => question.topic === selected.id);
  const lessonStages = ['Understand', ...(selected.worked ? ['Worked example'] : []), ...(visualizedTopics.has(selected.id) ? ['Explore'] : []), ...(selected.tryThis ? ['Now try'] : []), 'Ready to practise'];
  const stage = lessonStages[lessonStep];
  const attempts = Object.values(progress.attempts).reduce((total, item) => total + item.total, 0);
  const correct = Object.values(progress.attempts).reduce((total, item) => total + item.correct, 0);

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
    setSession(null);
    setLessonStep(0);
    lessonRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
  function moveLesson(step: number) {
    setLessonStep(step);
    lessonRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  return <section className="learning-hub" aria-label="Learn and practice" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <header className="learning-topbar">
      <button type="button" className="learning-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Workspaces</button>
      <span className="learning-brand"><BookOpen size={18} aria-hidden="true" /> Pico learning</span>
      <span className="learning-progress" aria-live="polite">{attempts ? `${correct}/${attempts} correct` : 'Ready to start'}</span>
    </header>
    <div className="learning-intro">
      <p className="learning-kicker">Study notes, made practical</p>
      <h1>Learn a concept. Try it in Pico.</h1>
      <p>Explore the topics in your notes, check an example, then practise or open the matching workspace. Progress stays in this browser.</p>
      <nav className="learning-path" aria-label="Suggested beginner path"><span>Start here</span>{['number-systems', 'algorithms', 'programming', 'logic'].map((id, step) => {
        const topic = topics.find(item => item.id === id)!;
        return <button type="button" key={id} onClick={() => chooseTopic(topic)}><b>{step + 1}</b>{topic.title}</button>;
      })}</nav>
    </div>
    <div className="learning-layout">
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
            <div className="learning-panel-top"><span className="learning-eyebrow">{selected.unit}</span><span className="learning-lesson-count">Lesson {lessonStep + 1} of {lessonStages.length}</span></div>
            <h2 id="learning-topic-title">{selected.title}</h2>
            <progress className="learning-lesson-progress" value={lessonStep + 1} max={lessonStages.length} aria-label="Lesson progress" />
            <div className="learning-step" aria-live="polite"><span className="learning-step-number">{String(lessonStep + 1).padStart(2, '0')}</span><div><h3>{stage}</h3>
              {stage === 'Understand' && <p>{selected.idea}</p>}
              {stage === 'Worked example' && <p>{selected.worked}</p>}
              {stage === 'Explore' && <LearningVisual topicId={selected.id} />}
              {stage === 'Now try' && <p>{selected.tryThis}</p>}
              {stage === 'Ready to practise' && <p>You have finished the lesson. Check your understanding with a short quiz, or continue in a Pico workspace.</p>}
            </div></div>
            <div className="learning-actions">
              {lessonStep > 0 && <button type="button" className="learning-secondary" onClick={() => moveLesson(lessonStep - 1)}>Previous step</button>}
              {lessonStep < lessonStages.length - 1 && <button type="button" className="learning-primary" onClick={() => moveLesson(lessonStep + 1)}>{lessonStep === lessonStages.length - 2 ? 'Finish lesson' : `Next: ${lessonStages[lessonStep + 1]}`} <ArrowRight size={16} aria-hidden="true" /></button>}
              {stage === 'Ready to practise' && <>
                {available.length > 0 && <button type="button" className="learning-primary" onClick={() => start(available, selected.title)}><CircleHelp size={16} aria-hidden="true" /> Practise this topic ({available.length})</button>}
                {selected.tool && <button type="button" className="learning-secondary" onClick={() => selected.starter ? onStartCode(selected.starter) : onOpenTool(selected.tool!)}>{selected.starter ? 'Open starter in compiler' : `Open ${toolNames[selected.tool] ?? 'Pico tool'}`} <ArrowRight size={16} aria-hidden="true" /></button>}
                {!available.length && !selected.tool && <button type="button" className="learning-secondary" onClick={() => chooseTopic(topics[(topics.indexOf(selected) + 1) % topics.length])}>Next topic <ArrowRight size={16} aria-hidden="true" /></button>}
              </>}
            </div>
          </section>
          {stage === 'Ready to practise' && <section className="learning-panel learning-practice-card" aria-labelledby="practice-title">
            <div><span className="learning-eyebrow">Revision</span><h2 id="practice-title">Keep practising</h2><p>Mix questions from the topics above, or retry only those you missed. Answers include a short reason.</p></div>
            <div className="learning-actions"><button type="button" className="learning-secondary" onClick={() => start([...questions].sort(() => Math.random() - .5).slice(0, 8), 'Mixed practice')}>Start mixed practice</button><button type="button" className="learning-secondary" disabled={!progress.missed.length} onClick={() => start(questions.filter(question => progress.missed.includes(question.id)), 'Review missed')}><RotateCcw size={16} aria-hidden="true" /> Review missed ({progress.missed.length})</button></div>
          </section>}
        </>}
      </div>
    </div>
  </section>;
}

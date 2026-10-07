import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ArrowLeft, ChevronDown, CircleHelp, Code2, Download, FileCode2, Keyboard, PanelRightClose, Play, Plus, Redo2, Search, Settings2, Sparkles, Undo2, Upload, X } from 'lucide-react';
import { compile, synchronizeAutoDeclarations } from '../language';
import type { DataType, Program } from '../language/ast';
import { CodeEditor, type EditorHandle } from './components/CodeEditor';
import { ConsolePanel, DebuggerPanel, FlowchartDock, panelIcon, type PanelKey, type ConsoleEntry } from './components/Panels';
import { findSuggestions, friendlyError, documentationFor, type Suggestion } from '../runtime/diagnostics';
import type { RunResult } from '../runtime/interpreter';
import { startExecution, type ExecutionJob } from '../runtime/runner';
import type { PendingInput } from '../runtime/worker';
import { normalizeSource } from '../language/normalize';
import { exportProject, importProject, loadActiveId, loadProjects, newProject, normalizeProjectName, projectNameExists, uniqueProjectName, saveProjects, type PicoFile, type PicoProject, type CompilerLanguage } from '../storage/projects';
import { loadSettings, saveSettings, type PicoSettings } from '../storage/settings';
import { contrastRatio, cssVariables, getTheme } from '../app/themes';
import { FloatingPanel } from './components/FloatingPanel';
import { ResizeHandle } from './components/ResizeHandle';
import { ThemePicker } from './components/ThemePicker';
import { GuidedTutorial, tutorialSteps } from './components/GuidedTutorial';
import { TutorialOffer } from './components/TutorialOffer';
import { inputEasterEgg } from './inputEasterEgg';
import { HighlightedCode } from './components/HighlightedCode';
import { UpdateCenter } from './components/UpdateCenter';
import { HomeScreen, Credits } from './components/HomeScreen';
import { PythonReference } from './components/PythonReference';
import { startPythonExecution } from '../runtime/python/runner';
import { MAX_CONSOLE_LINES } from '../runtime/python/config';
import { referenceExamples, referenceTerms, type ReferenceExample, type ReferenceKeyword } from './reference';
import '../app/styles/app.css';
import './styles/editor-folding.css';
import './styles/workspace-upgrades.css';
import './styles/tutorial.css';
import './styles/file-tabs.css';
import './styles/resizable-workspace.css';
import './styles/branding-adjustments.css';
import './styles/readability.css';
import './styles/high-contrast.css';
import './styles/motion.css';
import './styles/top-toolbar.css';
import './styles/compiler-workspace.css';

const panelTabs: { key: PanelKey; title: string }[] = [
  { key: 'console', title: 'Console' }, { key: 'debugger', title: 'Debugger' },
  { key: 'flowchart', title: 'Flowchart' },
];

interface ParseState { ast: Program | null; error: unknown | null; }

interface WorkspaceSnapshot { projects: PicoProject[]; activeId: string; }
export default function App() {
  const [language, setLanguage] = useState<CompilerLanguage | null>(null);
  const snapshots = useRef<Partial<Record<CompilerLanguage, WorkspaceSnapshot>>>({});
  const navigate = (next: CompilerLanguage | null, snapshot: WorkspaceSnapshot) => {
    if (language) snapshots.current[language] = snapshot;
    setLanguage(next);
  };
  if (!language) return <HomeScreen onChoose={setLanguage} />;
  return <Workspace key={language} language={language} snapshot={snapshots.current[language]} onChoose={(next, snapshot) => navigate(next, snapshot)} onHome={snapshot => navigate(null, snapshot)} />;
}
export function Workspace({ language, snapshot, onChoose, onHome }: { language: CompilerLanguage; snapshot?: WorkspaceSnapshot; onChoose: (language: CompilerLanguage, snapshot: WorkspaceSnapshot) => void; onHome: (snapshot: WorkspaceSnapshot) => void }) {
  const isPython = language === 'python';
  const [initial] = useState(() => { if (snapshot) return snapshot; const projects = loadProjects(language); return { projects, activeId: loadActiveId(projects, language) }; });
  const [projects, setProjects] = useState<PicoProject[]>(initial.projects);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [settings, setSettings] = useState<PicoSettings>(() => loadSettings());
  const [activePanel, setActivePanel] = useState<PanelKey>('console');
  const [saveError, setSaveError] = useState(false);
  const [runStatus, setRunStatus] = useState('');
  const [pythonVersion, setPythonVersion] = useState('');
  const [outputTruncated, setOutputTruncated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(() => initial.projects.find(project => project.id === initial.activeId)!.name);
  const [projectNameError, setProjectNameError] = useState('');
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [inputValue, setInputValue] = useState('');
  const jobRef = useRef<ExecutionJob | null>(null);
  const consoleCount = useRef(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [executionError, setExecutionError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const [debugIndex, setDebugIndex] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<ReferenceKeyword>('OUTPUT');
  const [docSearch, setDocSearch] = useState('');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [picoGreeting, setPicoGreeting] = useState(false);
  const [tutorialOfferOpen, setTutorialOfferOpen] = useState(() => {
    try { return Number(localStorage.getItem(isPython ? 'pico.python.visitCount.v1' : 'pico.visitCount.v1') ?? '0') === 0; }
    catch { return false; }
  });
  const visitRecorded = useRef(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [referenceExpanded, setReferenceExpanded] = useState(false);
  const tutorialPanelRef = useRef<PanelKey>('console');
  const [draggedPanel, setDraggedPanel] = useState<PanelKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const workspaceMainRef = useRef<HTMLElement>(null);
  const settingsAnchorRef = useRef<HTMLDivElement>(null);
  const fileAnchorRef = useRef<HTMLDivElement>(null);
  const autoDeclaredTypesRef = useRef<Record<string, Record<string, DataType>>>({});

  const activeProject = projects.find(project => project.id === activeId) ?? projects[0]!;
  const activeFile = activeProject.files.find(file => file.id === activeProject.activeFileId) ?? activeProject.files[0]!;
  const theme = getTheme(settings.theme);
  const parsed = useMemo<ParseState>(() => {
    if (isPython) return { ast: null, error: null };
    try { const compilation = compile(activeFile.code); return { ast: compilation.ast, error: null }; }
    catch (error) { return { ast: null, error }; }
  }, [activeFile.code, isPython]);
  const parseError = parsed.error ? friendlyError(parsed.error, activeFile.code) : null;
  const visibleError = executionError ?? parseError;
  const suggestions = useMemo(() => !isPython && settings.autocorrect && !dismissedSuggestions ? findSuggestions(activeFile.code).slice(0, 3) : [], [activeFile.code, settings.autocorrect, dismissedSuggestions]);
  const currentStep = activePanel === 'debugger' ? result?.trace[debugIndex] : undefined;

  useEffect(() => () => { const job = jobRef.current; jobRef.current = null; job?.cancel(); }, []);
  useEffect(() => { jobRef.current?.cancel(); jobRef.current = null; setRunning(false); setPendingInput(null); setInputValue(''); }, [activeId, activeFile.id, activeFile.code, activeProject.virtualFiles]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { saveProjects(projects, activeId, language); setSaveError(false); }
      catch { setSaveError(true); }
    }, 360);
    return () => window.clearTimeout(timer);
  }, [projects, activeId]);
  useEffect(() => { try { saveSettings(settings); } catch { /* The current tab remains usable if storage is blocked. */ } }, [settings]);
  useEffect(() => {
    if (isPython || !settings.autoDeclare) return;
    updateCode(activeFile.code);
  }, [settings.autoDeclare, activeFile.id]);
  useEffect(() => { setProjectNameDraft(activeProject.name); setProjectNameError(''); }, [activeId]);
  useEffect(() => {
    if (!referenceExpanded || !settings.referenceVisible || tutorialOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLInputElement>('.reference-search input')?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [referenceExpanded, settings.referenceVisible, tutorialOpen]);
  useEffect(() => {
    if (visitRecorded.current) return;
    visitRecorded.current = true;
    try {
      const visits = Number(localStorage.getItem(isPython ? 'pico.python.visitCount.v1' : 'pico.visitCount.v1') ?? '0') + 1;
      localStorage.setItem(isPython ? 'pico.python.visitCount.v1' : 'pico.visitCount.v1', String(visits));
      if (visits === 1) setTutorialOfferOpen(true);
    } catch { /* On blocked storage, the app remains usable without onboarding. */ }
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    for (const [property, value] of Object.entries(cssVariables(theme))) root.style.setProperty(property, value);
    root.style.colorScheme = theme.appearance;
  }, [theme]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (tutorialOpen || tutorialOfferOpen || document.querySelector('[aria-modal="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runProgram(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); try { saveProjects(projects, activeId, language); setSaveError(false); } catch { setSaveError(true); } }
      if (event.key === 'Escape') { setSettingsOpen(false); setFileMenuOpen(false); setReferenceExpanded(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (settingsAnchorRef.current && !settingsAnchorRef.current.contains(target)) setSettingsOpen(false);
      if (fileAnchorRef.current && !fileAnchorRef.current.contains(target)) setFileMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function updateProject(change: (project: PicoProject) => PicoProject) {
    setProjects(current => current.map(project => project.id === activeId ? change({ ...project }) : project));
  }
  function updateCode(code: string) {
    if (!isPython) code = normalizeSource(code);
    let autoDeclaredTypes = activeFile.autoDeclaredTypes ?? {};
    if (!isPython && settings.autoDeclare) {
      const previous = autoDeclaredTypesRef.current[activeFile.id] ?? autoDeclaredTypes;
      const synchronized = synchronizeAutoDeclarations(code, previous);
      code = synchronized.code;
      autoDeclaredTypes = synchronized.generatedTypes;
      autoDeclaredTypesRef.current[activeFile.id] = autoDeclaredTypes;
    }
    setDismissedSuggestions(false);
    setExecutionError(null); setResult(null); setConsoleEntries([]); setOutputTruncated(false);
    updateProject(project => ({ ...project, code, files: project.files.map(file => file.id === project.activeFileId ? { ...file, code, autoDeclaredTypes } : file), updatedAt: Date.now() }));
  }
  function startTutorial() {
    tutorialPanelRef.current = activePanel;
    setTutorialStep(0); setTutorialOpen(true); setTutorialOfferOpen(false);
    setSettingsOpen(false); setFileMenuOpen(false); setCreditsOpen(false);
  }
  function closeTutorial() { setTutorialOpen(false); setActivePanel(tutorialPanelRef.current); }
  function goToTutorialStep(step: number) {
    setTutorialStep(step);
    if (tutorialSteps[step]?.label === 'OUTPUT') setActivePanel('console');
    if (tutorialSteps[step]?.label === 'EXPLORE') setActivePanel('debugger');
  }
  function openReference() {
    changeSettings({ referenceVisible: true, layoutPreset: 'custom' });
    setReferenceExpanded(true); setDocSearch('');
  }
  function toggleReference() {
    if (window.matchMedia('(max-width: 1070px)').matches) {
      if (referenceExpanded) setReferenceExpanded(false); else openReference();
    } else changeSettings({ referenceVisible: !settings.referenceVisible, layoutPreset: 'custom' });
  }
  function closeReference() {
    setReferenceExpanded(false);
    if (!window.matchMedia('(max-width: 1070px)').matches) changeSettings({ referenceVisible: false, layoutPreset: 'custom' });
  }
  function changeSettings(patch: Partial<PicoSettings>) { setSettings(current => ({ ...current, ...patch })); }
  function selectProject(id: string) {
    setActiveId(id); setExecutionError(null); setResult(null); setConsoleEntries([]); setOutputTruncated(false); setPendingInput(null); setInputValue(''); setActivePanel('console');
    try { localStorage.setItem(isPython ? 'pico.python.activeProject.v1' : 'pico.activeProject.v1', id); } catch { /* Autosave status will explain local-storage availability. */ }
  }
  function createBlankProject() {
    const requested = window.prompt('Name this project', uniqueProjectName('Untitled program', projects));
    if (requested === null) return;
    const name = normalizeProjectName(requested) || 'Untitled program';
    if (projectNameExists(name, projects)) { window.alert('A project with that name already exists. Choose a different name.'); return; }
    const project = newProject(name, language); setProjects(current => [...current, project]); selectProject(project.id); setActivePanel('console');
  }
  function renameProject(draft: string) {
    setProjectNameDraft(draft.slice(0, 42));
    const name = normalizeProjectName(draft);
    if (!name) { setProjectNameError('Enter a workspace name.'); return; }
    if (projectNameExists(name, projects, activeId)) { setProjectNameError('A project with that name already exists. Choose a different name.'); return; }
    setProjectNameError('');
    updateProject(project => ({ ...project, name, updatedAt: Date.now() }));
  }
  function finishProjectRename() { setProjectNameDraft(activeProject.name); setProjectNameError(''); }
  function selectFile(fileId: string) { setProjects(current => current.map(project => project.id === activeId ? { ...project, activeFileId: fileId, code: project.files.find(file => file.id === fileId)?.code ?? project.code, updatedAt: Date.now() } : project)); setExecutionError(null); setResult(null); setConsoleEntries([]); setOutputTruncated(false); }
  function createFile() {
    let next = activeProject.files.length + 1;
    while (activeProject.files.some(file => file.name === `untitled-${next}.${isPython ? 'py' : 'pico'}`)) next++;
    const file: PicoFile = { id: crypto.randomUUID(), name: `untitled-${next}.${isPython ? 'py' : 'pico'}`, code: '' };
    updateProject(project => ({ ...project, files: [...project.files, file], activeFileId: file.id, code: file.code, updatedAt: Date.now() }));
    setExecutionError(null); setResult(null); setConsoleEntries([]); setOutputTruncated(false);
  }
  function renameFile(file: PicoFile) { const name = window.prompt('Rename file', file.name); if (name === null) return; const clean = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48) || file.name; updateProject(project => ({ ...project, files: project.files.map(item => item.id === file.id ? { ...item, name: clean } : item), updatedAt: Date.now() })); }
  function closeFile(file: PicoFile) {
    if (activeProject.files.length === 1) { window.alert('A project must keep at least one file.'); return; }
    if (!window.confirm(`Close “${file.name}” from this project?`)) return;
    const files = activeProject.files.filter(item => item.id !== file.id);
    const next = files.find(item => item.id === activeProject.activeFileId) ?? files[0]!;
    updateProject(project => ({ ...project, files, activeFileId: next.id, code: next.code, updatedAt: Date.now() }));
    if (file.id === activeProject.activeFileId) { setExecutionError(null); setResult(null); setConsoleEntries([]); setOutputTruncated(false); }
  }
  function removeProject(id: string) {
    if (projects.length < 2) { if (!window.confirm('This is your last local project. Replace it with a fresh blank program?')) return; const replacement = newProject(undefined, language); setProjects([replacement]); selectProject(replacement.id); return; }
    const project = projects.find(item => item.id === id);
    if (!window.confirm(`Delete “${project?.name ?? 'this project'}” from this browser? This cannot be undone.`)) return;
    const remaining = projects.filter(item => item.id !== id); setProjects(remaining);
    if (id === activeId) selectProject(remaining[0]!.id);
  }
  function runProgram(debug = false) {
    if (running) return;
    setExecutionError(null);
    if (!isPython && !parsed.ast) { setExecutionError(parseError ?? { message: 'Fix the syntax before running.' }); setActivePanel('console'); return; }
    executeProgram(debug);
  }
  async function executeProgram(debug = false) {
    if (!isPython && !parsed.ast) return;
    jobRef.current?.cancel();
    setConsoleEntries([]); setOutputTruncated(false); setPendingInput(null); setInputValue(''); setResult(null); setPicoGreeting(false); setActivePanel('console');
    setOutputTruncated(false); setRunStatus(''); consoleCount.current = 0;
    function appendOutput(lines: string[], kind: 'output' | 'error') {
      if (jobRef.current !== job) return;
      consoleCount.current += lines.length;
      if (consoleCount.current > MAX_CONSOLE_LINES) setOutputTruncated(true);
      setConsoleEntries(entries => [...entries, ...lines.map(text => ({ kind, text }))].slice(-MAX_CONSOLE_LINES));
    }
    const callbacks = {
      onOutput: (lines: string[]) => appendOutput(lines, 'output'),
      onStderr: (lines: string[]) => appendOutput(lines, 'error'),
      onStatus: (message: string) => { if (jobRef.current === job) { setRunStatus(message.startsWith('Python ') ? '' : message); if (message.startsWith('Python ')) setPythonVersion(message); } },
      onInput: (request: PendingInput) => { if (jobRef.current === job) { setRunStatus(''); setPendingInput(request); setInputValue(''); setActivePanel('console'); } },
    };
    const job = isPython
      ? startPythonExecution({ code: activeFile.code, filename: activeFile.name, debug, files: activeProject.virtualFiles, sources: Object.fromEntries(activeProject.files.filter(file => file.name.endsWith('.py')).map(file => [file.name, file.code])) }, callbacks)
      : startExecution({ ast: parsed.ast!, interactive: true, runs: [{ inputs: [], options: { files: activeProject.virtualFiles } }] }, callbacks);
    jobRef.current=job; setRunning(true);
    const [reply]=await job.promise;
    if(jobRef.current!==job)return;
    jobRef.current=null;setRunning(false);setPendingInput(null);
    const next=reply?.result;
    setResult(next??null); setDebugIndex(0);
    setRunStatus('');
    if (reply?.error?.code === 'cancelled') {
      setConsoleEntries(entries => [...entries, { kind: 'note', text: 'Execution stopped.' }].slice(-MAX_CONSOLE_LINES) as ConsoleEntry[]);
      setExecutionError(null);
    } else setExecutionError(reply?.error ? { ...friendlyError(Object.assign(new Error(reply.error.message), { name: 'RuntimeError', line: reply.error.line }), activeFile.code), ...(reply.error.diagnostic ? { diagnostic: reply.error.diagnostic } : {}) } : null);
    if (next?.outputTruncated) setOutputTruncated(true);
    setPicoGreeting(Boolean(next?.output.some(line=>line.trim().toUpperCase()==='PICO')));
    setActivePanel(debug && next && !reply?.error ? 'debugger' : 'console');
    if(next)updateProject(project=>({...project,virtualFiles:next.files,updatedAt:Date.now()}));
  }
  function stopExecution() { jobRef.current?.cancel(); }
  function submitConsoleInput() {
    if (!pendingInput || !jobRef.current?.provideInput(pendingInput.id, inputValue)) return;
    const message = pendingInput.dataType === 'STRING' ? inputEasterEgg(inputValue) : undefined;
    consoleCount.current += message ? 2 : 1;
    if (consoleCount.current > MAX_CONSOLE_LINES) setOutputTruncated(true);
    setConsoleEntries(entries => [...entries, { kind: 'input' as const, text: inputValue }, ...(message ? [{ kind: 'note' as const, text: message }] : [])].slice(-MAX_CONSOLE_LINES));
    setPendingInput(null); setInputValue('');
  }
  function reorderPanels(target: PanelKey) { if (!draggedPanel || draggedPanel === target) return; const order = [...settings.panelOrder]; const from = order.indexOf(draggedPanel); const to = order.indexOf(target); if (from < 0 || to < 0) return; order.splice(from, 1); order.splice(to, 0, draggedPanel); changeSettings({ panelOrder: order }); setDraggedPanel(null); }
  function applyLayoutPreset(preset: PicoSettings['layoutPreset']) {
    const presets: Record<Exclude<PicoSettings['layoutPreset'], 'custom'>, Partial<PicoSettings>> = {
      coding: { sidebarVisible: true, referenceVisible: true, sidebarSide: 'left', dockSide: 'bottom', sidebarWidth: 226, referenceWidth: 360, dockSize: 33, panelOrder: [...defaultPanelOrder] },
      debugging: { sidebarVisible: true, referenceVisible: false, sidebarSide: 'left', dockSide: 'right', sidebarWidth: 226, referenceWidth: 360, dockSize: 42, panelOrder: ['debugger','console','flowchart'] },
      focus: { sidebarVisible: false, referenceVisible: false, sidebarSide: 'left', dockSide: 'bottom', sidebarWidth: 226, referenceWidth: 360, dockSize: 28, panelOrder: [...defaultPanelOrder] },
    };
    changeSettings({ ...(presets[preset as Exclude<PicoSettings['layoutPreset'], 'custom'>] ?? {}), layoutPreset: preset });
  }
  function resetLayout() { applyLayoutPreset('coding'); }
  function resizeReference(delta: number) {
    setSettings(current => ({ ...current, referenceWidth: Math.min(600, Math.max(280, current.referenceWidth - delta)), layoutPreset: 'custom' }));
  }
  function resizeDock(delta: number) {
    const available = settings.dockSide === 'right' ? workspaceMainRef.current?.clientWidth : workspaceMainRef.current?.clientHeight;
    if (!available) return;
    changeSettings({ dockSize: Math.min(60, Math.max(22, settings.dockSize - delta / available * 100)), layoutPreset: 'custom' });
  }
  function applySuggestion(suggestion: Suggestion) { editorRef.current?.applySuggestion(suggestion); setDismissedSuggestions(false); }
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const project = await importProject(file, language);
      setProjects(current => [...current, { ...project, name: uniqueProjectName(project.name, current) }]);
      selectProject(project.id);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not import that .pico file.'); }
    input.value = '';
  }


  const tutorialReference = tutorialOpen && tutorialSteps[tutorialStep]?.target === 'reference';
  const layout = tutorialOpen ? { ...settings, dockSide: 'bottom' as const, referenceVisible: tutorialReference } : settings;
  const orderedTabs = settings.panelOrder.filter(key => !isPython || key !== 'flowchart').map(key => panelTabs.find(tab => tab.key === key)).filter(Boolean) as typeof panelTabs;
  const shownTerms = referenceTerms.filter(term => term.includes(docSearch.trim().toUpperCase()));
  const currentExample: ReferenceExample = referenceExamples[selectedDoc];
  const currentDoc = documentationFor(selectedDoc) ?? 'Select a Cambridge pseudocode keyword to read its quick explanation.';

  function leaveWorkspace(next?: CompilerLanguage) {
    jobRef.current?.cancel();
    try { saveProjects(projects, activeId, language); saveSettings(settings); } catch { /* The in-memory snapshot keeps unsaved work when switching compilers. */ }
    const current = { projects, activeId };
    if (next) onChoose(next, current); else onHome(current);
  }
  function exportPythonSource() {
    const url = URL.createObjectURL(new Blob([activeFile.code], { type: 'text/x-python' }));
    const link = document.createElement('a'); link.href = url; link.download = activeFile.name; link.click(); URL.revokeObjectURL(url);
    setFileMenuOpen(false);
  }

  return <div className="pico-app" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={{ ...cssVariables(theme), '--on-accent': contrastRatio('#ffffff', theme.accent) >= contrastRatio('#000000', theme.accent) ? '#ffffff' : '#000000', '--error-color': theme.appearance === 'light' ? '#a40000' : '#ff7474', '--reference-width': `${settings.referenceWidth}px`, '--reference-font-size': `${settings.referenceFontSize}px`, '--dock-size': `${settings.dockSize}%` } as React.CSSProperties}>
    <header className="topbar" inert={tutorialOpen || tutorialOfferOpen}>
      <button className="toolbar-button home-button" aria-label="Go to home screen" onClick={() => leaveWorkspace()}><ArrowLeft size={16} /></button>
      <button className="brand-lockup" title="About Pico" aria-label="Open Pico developer credits" onClick={() => setCreditsOpen(true)}><BrandMark /><span>Pico</span><span className="brand-period">.</span><span className="brand-subtitle">{isPython ? pythonVersion || "PYTHON" : "PSEUDOCODE"}</span></button>
      <input data-tour="workspace" aria-label="Workspace name" title="Rename workspace" className="project-title-input topbar-project-name" value={projectNameDraft} aria-invalid={Boolean(projectNameError)} aria-describedby={projectNameError ? "project-name-error" : undefined} onChange={event => renameProject(event.target.value)} onBlur={finishProjectRename} onKeyDown={event => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} />
      <div className="topbar-spacer" />
      <button className="toolbar-button compiler-switch" onClick={() => leaveWorkspace(isPython ? "pseudocode" : "python")}>{isPython ? "Go to Pseudocode Compiler" : "Go to Python Compiler"}</button>
      <div className="topbar-actions">
        {running ? <button className="toolbar-button stop-button" aria-label="Stop execution" onClick={stopExecution}><X size={16} /><span>Stop</span></button> : <button className="toolbar-button debug-button" aria-label="Debug program" onClick={() => runProgram(true)}><Code2 size={16} /><span>Debug</span></button>}
        <button data-tour="run" className="run-button" disabled={running} onClick={() => runProgram()}><Play size={14} fill="currentColor" /><span>Run</span><kbd>⌘ ↵</kbd></button>
        <button className="toolbar-button editor-history-button" aria-label="Undo last edit" onClick={() => editorRef.current?.undo()} title="Undo"><Undo2 size={16} /><span>Undo</span></button>
        <button className="toolbar-button editor-history-button" aria-label="Redo last edit" onClick={() => editorRef.current?.redo()} title="Redo"><Redo2 size={16} /><span>Redo</span></button>
        <button className="toolbar-button reference-toggle" aria-label="Toggle quick reference" onClick={toggleReference} title="Quick reference"><BookOpen size={16} /><span>Reference</span></button>
        <UpdateCenter />
      </div>
      <div className="settings-anchor" ref={settingsAnchorRef}>
        <button className={`topbar-icon ${settingsOpen ? 'active' : ''}`} title="Settings" data-tour="settings" aria-label="Open settings" onClick={() => setSettingsOpen(open => !open)}><Settings2 size={16} /></button>
        <FloatingPanel anchor={settingsAnchorRef} open={settingsOpen} className="settings-popover">
          <div className="settings-title"><div><Settings2 size={15} /><strong>Editor settings</strong></div><button className="icon-button quiet" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={14} /></button></div>
          <SettingRow title="Autocomplete" detail="Suggest keywords and declared names as you type" checked={settings.autocomplete} onChange={value => changeSettings({ autocomplete: value })} />
          {!isPython && <SettingRow title="Autocorrect" detail="Spot likely keyword misspellings" checked={settings.autocorrect} onChange={value => { changeSettings({ autocorrect: value }); setDismissedSuggestions(false); }} />}
          {!isPython && <SettingRow title="Hover documentation" detail="Explain keywords when you pause over them" checked={settings.hoverDocs} onChange={value => changeSettings({ hoverDocs: value })} />}
          {!isPython && <SettingRow title="Auto-declare variables" detail="Infer and update types from assignments" checked={settings.autoDeclare} onChange={value => changeSettings({ autoDeclare: value })} />}
          <ThemePicker value={settings.theme} onChange={id => changeSettings({ theme: id })} />
          <label className="font-setting"><span>Tool dock position</span><select value={settings.dockSide} onChange={event => changeSettings({ dockSide: event.target.value as PicoSettings['dockSide'] })}><option value="bottom">Bottom</option><option value="right">Right</option></select></label>
          <label className="font-setting"><span>Editor text size <b>{settings.fontSize}px</b></span><input type="range" min="12" max="24" value={settings.fontSize} onChange={event => changeSettings({ fontSize: Number(event.target.value) })} /></label>
          <label className="font-setting"><span>Layout preset</span><select value={settings.layoutPreset} onChange={event => applyLayoutPreset(event.target.value as PicoSettings['layoutPreset'])}><option value="coding">Coding</option><option value="debugging">Debugging</option><option value="focus">Focus</option><option value="custom">Custom</option></select></label>
          <SettingRow title="Quick reference" detail={isPython ? 'Show Python examples and explanations' : 'Show keyword examples and explanations'} checked={settings.referenceVisible} onChange={value => changeSettings({ referenceVisible: value, layoutPreset: 'custom' })} />
          <button className="reset-layout-button" onClick={resetLayout}>Reset workspace layout</button>
          <div className="settings-foot">Drag tool tabs to reorder</div>
        </FloatingPanel>
      </div>
      <div className="file-menu-anchor" ref={fileAnchorRef}><button data-tour="files" className={`help-button ${fileMenuOpen ? 'active' : ''}`} onClick={() => setFileMenuOpen(open => !open)}><FileCode2 size={15} /><span>File</span><ChevronDown size={12} /></button>{<FloatingPanel anchor={fileAnchorRef} open={fileMenuOpen} className="file-menu"><label className="file-menu-project">Workspace name<input aria-label="Workspace name in File menu" value={projectNameDraft} aria-invalid={Boolean(projectNameError)} aria-describedby={projectNameError ? "project-name-error" : undefined} onChange={event => renameProject(event.target.value)} onBlur={finishProjectRename} onKeyDown={event => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} /></label><button onClick={() => { setFileMenuOpen(false); fileInputRef.current?.click(); }}><Upload size={14} /> {isPython ? "Import .py / .pico" : "Import .pico"}</button>{isPython && <button onClick={exportPythonSource}><Download size={14} /> Export .py</button>}<button onClick={() => { exportProject(activeProject); setFileMenuOpen(false); }}><Download size={14} /> Export .pico</button></FloatingPanel>}<input ref={fileInputRef} type="file" accept={isPython ? ".py,.pico,application/json" : ".pico,application/json"} hidden onChange={handleImport} /></div><button className="help-button" aria-label="Help: start the Pico tutorial" title="Start the guided tutorial" onClick={startTutorial}><CircleHelp size={15} /><span>Help</span></button>
      {projectNameError && <p id="project-name-error" className="project-name-error" role="alert">{projectNameError}</p>}
    </header>

    <nav className="workspace-tabs" aria-label="Workspaces" inert={tutorialOpen || tutorialOfferOpen}>
      <div className="project-list" role="tablist" aria-label="Workspace tabs">{projects.map(project => <div className={`project-row ${project.id === activeId ? 'active' : ''}`} key={project.id}><button className="project-select" role="tab" aria-selected={project.id === activeId} onClick={() => selectProject(project.id)} title={project.name}><FileCode2 size={15} /><span>{project.name}</span></button>{project.id === activeId && <button className="project-delete" title="Delete project" aria-label="Delete project" onClick={() => removeProject(project.id)}><X size={14} /></button>}</div>)}</div>
      <button className="small-icon-button new-workspace" onClick={createBlankProject} title="New project" aria-label="New project"><Plus size={17} /></button>
    </nav>
    <div inert={tutorialOpen || tutorialOfferOpen} className={`ide-shell workspace-shell dock-${layout.dockSide} ${(referenceExpanded || tutorialReference) ? 'reference-open' : ''}`}>
      <main className="workspace-main" ref={workspaceMainRef}>
        <div className={`editor-split ${layout.referenceVisible ? '' : 'reference-hidden'}`}>
          <section className="editor-card" data-tour="editor">
            <div className="editor-card-head"><div className="editor-card-title"><span className="editor-live-dot" /><span>Editor</span><span className="line-count">{activeFile.code.split('\n').length} lines</span></div><div className="editor-card-meta"><span className="mono-tag">IGCSE</span><span>·</span><span>UTF-8</span><span>·</span><span>LF</span></div></div>
            <div className="file-tabs" role="tablist" aria-label="Project files">{activeProject.files.map(file => <div className={`file-tab ${file.id === activeFile.id ? 'active' : ''}`} key={file.id} role="tab" aria-selected={file.id === activeFile.id} onDoubleClick={() => renameFile(file)}><button className="file-tab-select" onClick={() => selectFile(file.id)} title={`${file.name} · double-click to rename`}><FileCode2 size={12} /><span>{file.name}</span></button><button className="file-tab-close" onClick={() => closeFile(file)} aria-label={`Close ${file.name}`} title="Close file"><X size={11} /></button></div>)}<button className="file-tab-new" onClick={createFile} title="New file" aria-label="New file"><Plus size={13} /></button></div>
            {suggestions.length > 0 && <div className="suggestion-ribbon"><Sparkles size={13} /><span>Did you mean?</span>{suggestions.map((suggestion, index) => <button className="suggestion-chip" key={`${suggestion.line}-${suggestion.column}-${index}`} onClick={() => applySuggestion(suggestion)}><code>{suggestion.original}</code><span>→</span><b>{suggestion.replacement}</b><small>line {suggestion.line}</small></button>)}<button className="dismiss-suggestions" title="Dismiss suggestions" onClick={() => setDismissedSuggestions(true)}><X size={13} /></button></div>}
            <div className="editor-body"><CodeEditor ref={editorRef} language={language} value={activeFile.code} onChange={updateCode} preferences={settings} theme={theme} currentLine={currentStep?.line} errorLine={visibleError?.line} /></div>
            <div className="editor-card-foot"><span><Keyboard size={12} /> <kbd>⌘</kbd> <kbd>↵</kbd> to run <span className="shortcut-separator">·</span> <kbd>Ctrl G</kbd> go to line</span></div>
          </section>

          {layout.referenceVisible && <ResizeHandle axis="x" label="Resize quick reference panel" className="reference-resize-handle" onResize={resizeReference} />}
          {layout.referenceVisible && <button className="reference-backdrop" aria-label="Dismiss quick reference" onClick={closeReference} tabIndex={-1} />}
          {layout.referenceVisible && <aside className="reference-card" id="quick-reference" data-tour="reference" aria-label="Quick reference">
            <div className="reference-head"><div><BookOpen size={15} /><strong>Quick reference</strong></div><button className="reference-close" aria-label="Close quick reference" onClick={closeReference}><X size={18} /></button></div>
            <div className="reference-controls"><span><span>Drag the divider to resize</span></span><div><button aria-label="Decrease reference text size" disabled={settings.referenceFontSize <= 12} onClick={() => changeSettings({ referenceFontSize: settings.referenceFontSize - 1 })}>A−</button><output aria-label="Reference text size">{settings.referenceFontSize}px</output><button aria-label="Increase reference text size" disabled={settings.referenceFontSize >= 18} onClick={() => changeSettings({ referenceFontSize: settings.referenceFontSize + 1 })}>A+</button></div></div>
            {isPython ? <PythonReference /> : <>
            <div className="reference-search"><Search size={13} /><input value={docSearch} onChange={event => setDocSearch(event.target.value)} placeholder="Find a keyword" aria-label="Search pseudocode keywords" /></div>
            <div className="reference-keywords">{shownTerms.map(term => <button key={term} className={`keyword-pill ${selectedDoc === term ? 'active' : ''}`} aria-pressed={selectedDoc === term} onClick={() => setSelectedDoc(term)}>{term}</button>)}{!shownTerms.length && <p className="reference-no-results">No keywords found. Try OUTPUT or FOR.</p>}</div>
            <div className="reference-explanation" key={selectedDoc}>
              <span className="mini-label">KEYWORD</span><strong>{selectedDoc}</strong><p>{currentDoc}</p>
              <div className="reference-example"><span className="mini-label">EXAMPLE</span><pre aria-label={`${selectedDoc} code example`}><HighlightedCode code={currentExample.code} /></pre>{currentExample.inputs && <p className="reference-input-hint">Example input: <code>{currentExample.inputs.join(', ')}</code></p>}</div>
            </div>
            </>}
          </aside>}
        </div>

        <ResizeHandle axis={layout.dockSide === 'right' ? 'x' : 'y'} label="Resize tool panel" className="dock-resize-handle" onResize={resizeDock} />
        <section className="tool-dock" data-tour="tools">
          <div className="dock-tab-row" role="tablist" aria-label="Pico tool panels">{orderedTabs.map(tab => <button draggable key={tab.key} role="tab" aria-selected={activePanel === tab.key} className={`dock-tab ${activePanel === tab.key ? 'active' : ''}`} onDragStart={() => setDraggedPanel(tab.key)} onDragOver={event => event.preventDefault()} onDrop={() => reorderPanels(tab.key)} onClick={() => setActivePanel(tab.key)}>{panelIcon(tab.key)}<span>{tab.title}</span></button>)}<div className="dock-flex" /><span className="dock-panel-state"><span className="panel-state-dot" /> {activePanel === 'console' ? 'OUTPUT' : activePanel.toUpperCase()}</span><button className="small-icon-button dock-close" title="Collapse panel" onClick={() => setActivePanel('console')}><PanelRightClose size={14} /></button></div>
          <div className="dock-content" role="tabpanel" key={activePanel}>
            {activePanel === 'console' && <><ConsolePanel entries={consoleEntries} error={executionError ?? parseError} onErrorClick={() => { const line = (executionError ?? parseError)?.line; if (line) editorRef.current?.goToLine(line); }} pendingInput={pendingInput} inputValue={inputValue} onInput={setInputValue} onSubmit={submitConsoleInput} running={running} ran={Boolean(result)} status={runStatus} outputTruncated={outputTruncated} /><PracticeFiles files={activeProject.virtualFiles} onChange={virtualFiles=>updateProject(project=>({...project,virtualFiles,updatedAt:Date.now()}))} />{picoGreeting && <div className="pico-easter-egg" role="status">Hi, I’m Pico. Thanks for saying hello.</div>}</>}
            {activePanel === 'debugger' && <DebuggerPanel language={language} trace={result?.trace ?? []} index={debugIndex} onIndex={setDebugIndex} truncated={result?.traceTruncated} error={executionError?.message} />}
            {activePanel === 'flowchart' && <FlowchartDock ast={parsed.ast} error={parseError?.message} />}
          </div>
        </section>
      </main>
    </div>

    {tutorialOfferOpen && <TutorialOffer onStart={startTutorial} onDismiss={() => setTutorialOfferOpen(false)} />}
    {tutorialOpen && <GuidedTutorial language={language} step={tutorialStep} onStep={goToTutorialStep} onClose={closeTutorial} onReference={() => { closeTutorial(); openReference(); }} />}
    {saveError && <p className="autosave-error" role="alert">Autosave failed. Export your project to keep a copy.</p>}
    <footer className="statusbar" inert={tutorialOpen || tutorialOfferOpen}><Credits /></footer>
    {creditsOpen && <div className="input-modal-backdrop" role="presentation" onClick={() => setCreditsOpen(false)}><div className="credits-modal" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={event => event.stopPropagation()}><div className="credits-mark"><BrandMark /></div><div className="input-modal-head"><div><strong id="credits-title">About Pico</strong><small>Pseudocode and Python compilers.</small></div><button className="icon-button quiet" onClick={() => setCreditsOpen(false)} aria-label="Close developer credits"><X size={15} /></button></div><p className="credits-message">Thanks to <strong>Amar</strong> and <strong>Mustaqim</strong> — this was made by them.</p><p className="credits-contact">If you have any problems, contact <a href="mailto:b04557@nbabarwa.com">b04557@nbabarwa.com</a> or <a href="mailto:b03661@nbabarwa.com">b03661@nbabarwa.com</a>.</p><div className="input-modal-actions"><button className="primary-small" onClick={() => setCreditsOpen(false)}>Close</button></div></div></div>}
  </div>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <button className={`switch ${checked ? 'checked' : ''}`} role="switch" aria-label={label} aria-checked={checked} onClick={onChange}><span /></button>; }
function SettingRow({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="setting-row"><div><strong>{title}</strong><small>{detail}</small></div><Toggle label={title} checked={checked} onChange={() => onChange(!checked)} /></div>; }
function BrandMark() { return <svg className="brand-mark" viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="8" fill="#8179ef"/><path d="M9 7.5h7.6a4.4 4.4 0 0 1 0 8.8H12v4.2H9V7.5Zm3 2.8v3.2h4.3a1.6 1.6 0 0 0 0-3.2H12Z" fill="#11121a"/><circle cx="19.5" cy="20.5" r="1.5" fill="#c9c4ff"/></svg>; }

const defaultPanelOrder: PanelKey[] = ['console','debugger','flowchart'];
function PracticeFiles({files,onChange}:{files:Record<string,string[]>;onChange:(files:Record<string,string[]>)=>void}) {
  const [name,setName]=useState('');
  return <details className="practice-files"><summary>Project practice files ({Object.keys(files).length})</summary><p>Text files used by OPENFILE. Saved with this project.</p>{Object.entries(files).map(([filename,lines])=><label key={filename}><span>{filename}</span><textarea aria-label={`Contents of ${filename}`} value={lines.join('\n')} onChange={event=>onChange({...files,[filename]:event.target.value===''?[]:event.target.value.split(/\r?\n/)})} /></label>)}<div><input aria-label="New practice filename" placeholder="data.txt" value={name} onChange={event=>setName(event.target.value)} /><button className="subtle-button" disabled={!name.trim()||Object.hasOwn(files,name.trim())} onClick={()=>{onChange({...files,[name.trim()]:[]});setName('');}}>Add file</button></div></details>;
}

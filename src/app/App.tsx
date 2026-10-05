import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, CircleHelp, Code2, CodeXml, Download, FileCode2, FolderOpen, GitBranch, History, Keyboard, PanelRightClose, Play, Plus, Search, Settings2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { autoDeclareVariables, compile } from '../language';
import type { Program } from '../language/ast';
import { examples } from '../examples';
import { CodeEditor, type EditorHandle } from './components/CodeEditor';
import { AstPanel, ConsolePanel, CoveragePanel, DebuggerPanel, FlowchartDock, panelIcon, TestsPanel, TokensPanel, type PanelKey, type TestOutcome } from './components/Panels';
import { findSuggestions, friendlyError, documentationFor, type Suggestion } from '../runtime/diagnostics';
import { execute, type RunResult } from '../runtime/interpreter';
import { exportProject, importProject, loadActiveId, loadProjects, newProject, projectFromExample, saveProjects, type PicoFile, type PicoProject, type TestCase } from '../storage/projects';
import { loadSettings, saveSettings, type PicoSettings } from '../storage/settings';
import { addVersion, loadHistory, type ProjectVersion } from '../storage/history';
import { formatPseudocode } from '../language/formatter';
import { cssVariables, getTheme } from '../app/themes';
import { FloatingPanel } from './components/FloatingPanel';
import { ResizeHandle } from './components/ResizeHandle';
import { ThemePicker } from './components/ThemePicker';
import '../app/styles/app.css';
import './styles/editor-folding.css';
import './styles/workspace-upgrades.css';
import './styles/tutorial.css';
import './styles/file-tabs.css';
import './styles/resizable-workspace.css';
import './styles/branding-adjustments.css';

const panelTabs: { key: PanelKey; title: string }[] = [
  { key: 'console', title: 'Console' }, { key: 'debugger', title: 'Debugger' }, { key: 'tests', title: 'Test cases' },
  { key: 'flowchart', title: 'Flowchart' }, { key: 'coverage', title: 'Coverage' }, { key: 'ast', title: 'AST' }, { key: 'tokens', title: 'Tokens' },
];
const referenceTerms = ['DECLARE', 'CONSTANT', 'INPUT', 'OUTPUT', 'IF', 'THEN', 'ELSE', 'ENDIF', 'WHILE', 'DO', 'ENDWHILE', 'FOR', 'TO', 'STEP', 'NEXT', 'REPEAT', 'UNTIL', 'CASE', 'OF', 'OTHERWISE', 'ENDCASE', 'PROCEDURE', 'FUNCTION', 'CALL', 'RETURN', 'ARRAY', 'INTEGER', 'REAL', 'CHAR', 'STRING', 'BOOLEAN', 'AND', 'OR', 'NOT', 'DIV', 'MOD', 'ROUND', 'LENGTH', 'SUBSTRING', 'UCASE', 'LCASE', 'UPPER', 'LOWER', 'RANDOM', 'OPENFILE', 'READFILE', 'WRITEFILE', 'CLOSEFILE'];

type SaveState = 'saved' | 'saving' | 'local-only';
interface ParseState { ast: Program | null; tokens: ReturnType<typeof compile>['tokens']; error: unknown | null; }

export default function App() {
  const [initial] = useState(() => { const projects = loadProjects(); return { projects, activeId: loadActiveId(projects) }; });
  const [projects, setProjects] = useState<PicoProject[]>(initial.projects);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [settings, setSettings] = useState<PicoSettings>(() => loadSettings());
  const [activePanel, setActivePanel] = useState<PanelKey>('console');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ProjectVersion[]>([]);
  const [inputValues, setInputValues] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [executionError, setExecutionError] = useState<ReturnType<typeof friendlyError> | null>(null);
  const [debugIndex, setDebugIndex] = useState(0);
  const [testOutcomes, setTestOutcomes] = useState<Record<string, TestOutcome>>({});
  const [selectedDoc, setSelectedDoc] = useState('OUTPUT');
  const [docSearch, setDocSearch] = useState('');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [inputPromptOpen, setInputPromptOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [picoGreeting, setPicoGreeting] = useState(false);
  const [tutorialOfferOpen, setTutorialOfferOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [pendingDebug, setPendingDebug] = useState(false);
  const [draggedPanel, setDraggedPanel] = useState<PanelKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const workspaceMainRef = useRef<HTMLElement>(null);
  const settingsAnchorRef = useRef<HTMLDivElement>(null);
  const fileAnchorRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find(project => project.id === activeId) ?? projects[0]!;
  const activeFile = activeProject.files.find(file => file.id === activeProject.activeFileId) ?? activeProject.files[0]!;
  const theme = getTheme(settings.theme);
  const parsed = useMemo<ParseState>(() => {
    try { const compilation = compile(activeFile.code); return { ast: compilation.ast, tokens: compilation.tokens, error: null }; }
    catch (error) { return { ast: null, tokens: [], error }; }
  }, [activeFile.code]);
  const parseError = parsed.error ? friendlyError(parsed.error) : null;
  const visibleError = executionError ?? parseError;
  const suggestions = useMemo(() => settings.autocorrect && !dismissedSuggestions ? findSuggestions(activeFile.code).slice(0, 3) : [], [activeFile.code, settings.autocorrect, dismissedSuggestions]);
  const currentStep = activePanel === 'debugger' ? result?.trace[debugIndex] : undefined;

  useEffect(() => {
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      try { saveProjects(projects, activeId); setSaveState('saved'); }
      catch { setSaveState('local-only'); }
    }, 360);
    return () => window.clearTimeout(timer);
  }, [projects, activeId]);
  useEffect(() => { try { saveSettings(settings); } catch { /* The current tab remains usable if storage is blocked. */ } }, [settings]);
  useEffect(() => {
    if (!settings.autoDeclare) return;
    const analyzed = autoDeclareVariables(activeFile.code);
    if (analyzed !== activeFile.code) updateCode(analyzed);
  }, [settings.autoDeclare, activeFile.id]);
  useEffect(() => { setHistory(loadHistory(activeProject.id)); }, [activeProject.id]);
  useEffect(() => {
    try {
      const visits = Number(localStorage.getItem('pico.visitCount.v1') ?? '0') + 1;
      localStorage.setItem('pico.visitCount.v1', String(visits));
      if (visits <= 2) setTutorialOfferOpen(true);
    } catch { /* On blocked storage, the app remains usable without onboarding. */ }
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    for (const [property, value] of Object.entries(cssVariables(theme))) root.style.setProperty(property, value);
    root.style.colorScheme = theme.appearance;
  }, [theme]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runProgram(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProjects(projects, activeId); setSaveState('saved'); }
      if (event.key === 'Escape') { setSettingsOpen(false); setFileMenuOpen(false); }
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
  function updateCode(code: string, analyzeNow = false) {
    code = code.replace(/<--/g, '←').replace(/[“”]/g, '"');
    if (settings.autoDeclare && analyzeNow) code = autoDeclareVariables(code);
    setDismissedSuggestions(false);
    setExecutionError(null); setResult(null); setTestOutcomes({});
    updateProject(project => ({ ...project, code, files: project.files.map(file => file.id === project.activeFileId ? { ...file, code } : file), updatedAt: Date.now() }));
  }
  function formatCode() { updateCode(formatPseudocode(activeFile.code), true); }
  function saveSnapshot() { const label = window.prompt('Name this snapshot', `Snapshot ${history.length + 1}`); if (label === null) return; setHistory(addVersion(activeProject.id, label, activeProject.files, activeProject.activeFileId)); setHistoryOpen(true); }
  function restoreSnapshot(version: ProjectVersion) { if (!window.confirm(`Restore “${version.label}”? Current edits will remain available only if you save a snapshot first.`)) return; updateProject(project => ({ ...project, files: version.files.map(file => ({ ...file })), activeFileId: version.activeFileId, code: version.files.find(file => file.id === version.activeFileId)?.code ?? version.files[0]?.code ?? '', updatedAt: Date.now() })); setHistoryOpen(false); setResult(null); setExecutionError(null); }
  function changeSettings(patch: Partial<PicoSettings>) { setSettings(current => ({ ...current, ...patch })); }
  function selectProject(id: string) {
    setActiveId(id); setExecutionError(null); setResult(null); setTestOutcomes({}); setInputValues(''); setActivePanel('console');
    try { localStorage.setItem('pico.activeProject.v1', id); } catch { /* Autosave status will explain local-storage availability. */ }
  }
  function createBlankProject() {
    const requested = window.prompt('Name this project', 'Untitled program');
    if (requested === null) return;
    const project = newProject(requested.trim().slice(0, 42) || 'Untitled program'); setProjects(current => [...current, project]); selectProject(project.id); setActivePanel('console');
  }
  function loadExample(exampleId: string) {
    const project = projectFromExample(exampleId);
    if (!project) return;
    setProjects(current => [...current, project]); selectProject(project.id); setActivePanel('console');
  }
  function renameProject(name: string) { updateProject(project => ({ ...project, name: name.slice(0, 42), updatedAt: Date.now() })); }
  function selectFile(fileId: string) { setProjects(current => current.map(project => project.id === activeId ? { ...project, activeFileId: fileId, code: project.files.find(file => file.id === fileId)?.code ?? project.code, updatedAt: Date.now() } : project)); setExecutionError(null); setResult(null); setTestOutcomes({}); }
  function createFile() { const next = activeProject.files.length + 1; const file: PicoFile = { id: crypto.randomUUID(), name: `untitled-${next}.pseudocode`, code: '', }; updateProject(project => ({ ...project, files: [...project.files, file], activeFileId: file.id, code: file.code, updatedAt: Date.now() })); setExecutionError(null); setResult(null); }
  function renameFile(file: PicoFile) { const name = window.prompt('Rename file', file.name); if (name === null) return; const clean = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48) || file.name; updateProject(project => ({ ...project, files: project.files.map(item => item.id === file.id ? { ...item, name: clean } : item), updatedAt: Date.now() })); }
  function closeFile(file: PicoFile) { if (activeProject.files.length === 1) { window.alert('A project must keep at least one file.'); return; } if (!window.confirm(`Close “${file.name}” from this project?`)) return; const files = activeProject.files.filter(item => item.id !== file.id); const next = files[0]!; updateProject(project => ({ ...project, files, activeFileId: next.id, code: next.code, updatedAt: Date.now() })); setExecutionError(null); setResult(null); }
  function removeProject(id: string) {
    if (projects.length < 2) { if (!window.confirm('This is your last local project. Replace it with a fresh blank program?')) return; const replacement = newProject(); setProjects([replacement]); selectProject(replacement.id); return; }
    const project = projects.find(item => item.id === id);
    if (!window.confirm(`Delete “${project?.name ?? 'this project'}” from this browser? This cannot be undone.`)) return;
    const remaining = projects.filter(item => item.id !== id); setProjects(remaining);
    if (id === activeId) selectProject(remaining[0]!.id);
  }
  function runProgram(debug = false) {
    setExecutionError(null);
    if (!parsed.ast) { setExecutionError(parseError ?? { message: 'Fix the syntax before running.' }); setActivePanel('console'); return; }
    if (settings.promptForInput && hasInputStatements(parsed.ast) && !inputPromptOpen) { setPendingDebug(debug); setInputPromptOpen(true); return; }
    executeProgram(debug);
  }
  function executeProgram(debug = false) {
    if (!parsed.ast) return;
    try {
      const values = inputValues === '' ? [] : inputValues.split(/\r?\n/);
      const next = execute(parsed.ast, values);
      setResult(next); setDebugIndex(0); setTestOutcomes({}); setPicoGreeting(next.output.some(line => line.trim().toUpperCase() === 'PICO')); setActivePanel(debug ? 'debugger' : 'console');
    } catch (error) { setResult(null); setExecutionError(friendlyError(error)); setActivePanel('console'); }
  }
  function submitInputPrompt() { setInputPromptOpen(false); executeProgram(pendingDebug); }
  const creatorInput = inputValues.split(/\r?\n/).some(value => /^(amar|mustaqim)$/i.test(value.trim()));
  const teacherInput = inputValues.split(/\r?\n/).some(value => /^mr\.boyle$/i.test(value.trim()));
  function reorderPanels(target: PanelKey) { if (!draggedPanel || draggedPanel === target) return; const order = [...settings.panelOrder]; const from = order.indexOf(draggedPanel); const to = order.indexOf(target); if (from < 0 || to < 0) return; order.splice(from, 1); order.splice(to, 0, draggedPanel); changeSettings({ panelOrder: order }); setDraggedPanel(null); }
  function applyLayoutPreset(preset: PicoSettings['layoutPreset']) {
    const presets: Record<Exclude<PicoSettings['layoutPreset'], 'custom'>, Partial<PicoSettings>> = {
      coding: { sidebarVisible: true, referenceVisible: true, sidebarSide: 'left', dockSide: 'bottom', sidebarWidth: 226, referenceWidth: 278, dockSize: 33, panelOrder: [...defaultPanelOrder] },
      debugging: { sidebarVisible: true, referenceVisible: false, sidebarSide: 'left', dockSide: 'right', sidebarWidth: 226, referenceWidth: 278, dockSize: 42, panelOrder: ['debugger','console','tests','coverage','flowchart','ast','tokens'] },
      focus: { sidebarVisible: false, referenceVisible: false, sidebarSide: 'left', dockSide: 'bottom', sidebarWidth: 226, referenceWidth: 278, dockSize: 28, panelOrder: [...defaultPanelOrder] },
    };
    changeSettings({ ...(presets[preset as Exclude<PicoSettings['layoutPreset'], 'custom'>] ?? {}), layoutPreset: preset });
  }
  function resetLayout() { applyLayoutPreset('coding'); }
  function resizeSidebar(delta: number) {
    const direction = settings.sidebarSide === 'left' ? 1 : -1;
    changeSettings({ sidebarWidth: Math.min(360, Math.max(170, settings.sidebarWidth + delta * direction)), layoutPreset: 'custom' });
  }
  function resizeReference(delta: number) {
    changeSettings({ referenceWidth: Math.min(460, Math.max(220, settings.referenceWidth - delta)), layoutPreset: 'custom' });
  }
  function resizeDock(delta: number) {
    const available = settings.dockSide === 'right' ? workspaceMainRef.current?.clientWidth : workspaceMainRef.current?.clientHeight;
    if (!available) return;
    changeSettings({ dockSize: Math.min(60, Math.max(22, settings.dockSize - delta / available * 100)), layoutPreset: 'custom' });
  }
  function runTests() {
    if (!parsed.ast) {
      const message = parseError?.message ?? 'Fix the syntax before running test cases.';
      setTestOutcomes(Object.fromEntries(activeProject.tests.map(test => [test.id, { passed: false, actual: [], error: message }])));
      return;
    }
    const outcomes: Record<string, TestOutcome> = {};
    for (const test of activeProject.tests) {
      try {
        const actual = execute(parsed.ast, test.inputs).output;
        outcomes[test.id] = { passed: actual.length === test.expected.length && actual.every((line, index) => line === test.expected[index]), actual };
      } catch (error) { outcomes[test.id] = { passed: false, actual: [], error: friendlyError(error).message }; }
    }
    setTestOutcomes(outcomes); setActivePanel('tests');
  }
  function updateTest(id: string, patch: Partial<TestCase>) {
    setTestOutcomes(current => { const next = { ...current }; delete next[id]; return next; });
    updateProject(project => ({ ...project, tests: project.tests.map(test => test.id === id ? { ...test, ...patch } : test), updatedAt: Date.now() }));
  }
  function addTest() {
    const test: TestCase = { id: crypto.randomUUID(), name: `Test ${activeProject.tests.length + 1}`, inputs: [], expected: [] };
    updateProject(project => ({ ...project, tests: [...project.tests, test], updatedAt: Date.now() })); setActivePanel('tests');
  }
  function removeTest(id: string) {
    updateProject(project => ({ ...project, tests: project.tests.filter(test => test.id !== id), updatedAt: Date.now() }));
    setTestOutcomes(current => { const next = { ...current }; delete next[id]; return next; });
  }
  function applySuggestion(suggestion: Suggestion) { editorRef.current?.applySuggestion(suggestion); setDismissedSuggestions(false); }
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; try { const project = await importProject(file); setProjects(current => [...current, project]); setActiveId(project.id); } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not import that .pico file.'); } event.target.value = ''; }

  const orderedTabs = settings.panelOrder.map(key => panelTabs.find(tab => tab.key === key)).filter(Boolean) as typeof panelTabs;
  const shownTerms = referenceTerms.filter(term => term.includes(docSearch.trim().toUpperCase()));
  const saveText = saveState === 'saving' ? 'Saving…' : saveState === 'local-only' ? 'Storage unavailable' : 'Saved on this device';
  const currentDoc = documentationFor(selectedDoc) ?? 'Select a Cambridge pseudocode keyword to read its quick explanation.';

  return <div className="pico-app" data-pico-theme={theme.id} style={{ ...cssVariables(theme), '--sidebar-width': `${settings.sidebarWidth}px`, '--reference-width': `${settings.referenceWidth}px`, '--dock-size': `${settings.dockSize}%` } as React.CSSProperties}>
    <header className="topbar">
      <button className="brand-lockup" title="About Pico" aria-label="Open Pico developer credits" onClick={() => setCreditsOpen(true)}><BrandMark /><span>Pico</span><span className="brand-period">.</span><span className="brand-subtitle">PSEUDOCODE STUDIO</span></button>
      <div className="topbar-divider" />
      <div className="topbar-crumb"><FolderOpen size={14} /><span>Workspace</span><span className="crumb-slash">/</span><span className="crumb-active">Cambridge Core</span><ChevronDown size={12} /></div>
      <div className="topbar-spacer" />
      <div className={`save-indicator ${saveState}`}><span className="save-dot">{saveState === 'saved' ? <Check size={9} /> : null}</span>{saveText}</div>
      <div className="settings-anchor" ref={settingsAnchorRef}>
        <button className={`topbar-icon ${settingsOpen ? 'active' : ''}`} title="Settings" aria-label="Open settings" onClick={() => setSettingsOpen(open => !open)}><Settings2 size={16} /></button>
        <FloatingPanel anchor={settingsAnchorRef} open={settingsOpen} className="settings-popover">
          <div className="settings-title"><div><Settings2 size={15} /><strong>Editor settings</strong></div><button className="icon-button quiet" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={14} /></button></div>
          <SettingRow title="Autocomplete" detail="Suggest Cambridge keywords as you type" checked={settings.autocomplete} onChange={value => changeSettings({ autocomplete: value })} />
          <SettingRow title="Autocorrect" detail="Spot likely keyword misspellings" checked={settings.autocorrect} onChange={value => changeSettings({ autocorrect: value })} />
          <SettingRow title="Hover documentation" detail="Explain keywords when you pause over them" checked={settings.hoverDocs} onChange={value => changeSettings({ hoverDocs: value })} />
          <SettingRow title="Auto-declare variables" detail="Infer missing scalar types from assignments and FOR loops" checked={settings.autoDeclare} onChange={value => changeSettings({ autoDeclare: value })} />
          <ThemePicker value={settings.theme} onChange={id => changeSettings({ theme: id })} />
          <SettingRow title="Ask for INPUT on Run" detail="Show an input dialog before programs execute" checked={settings.promptForInput} onChange={value => changeSettings({ promptForInput: value })} />
          <label className="font-setting"><span>Sidebar position</span><select value={settings.sidebarSide} onChange={event => changeSettings({ sidebarSide: event.target.value as PicoSettings['sidebarSide'] })}><option value="left">Left</option><option value="right">Right</option></select></label>
          <label className="font-setting"><span>Tool dock position</span><select value={settings.dockSide} onChange={event => changeSettings({ dockSide: event.target.value as PicoSettings['dockSide'] })}><option value="bottom">Bottom</option><option value="right">Right</option></select></label>
          <label className="font-setting"><span>Editor text size <b>{settings.fontSize}px</b></span><input type="range" min="12" max="20" value={settings.fontSize} onChange={event => changeSettings({ fontSize: Number(event.target.value) })} /></label>
          <label className="font-setting"><span>Layout preset</span><select value={settings.layoutPreset} onChange={event => applyLayoutPreset(event.target.value as PicoSettings['layoutPreset'])}><option value="coding">Coding</option><option value="debugging">Debugging</option><option value="focus">Focus</option><option value="custom">Custom</option></select></label>
          <SettingRow title="Project sidebar" detail="Show the project and example navigator" checked={settings.sidebarVisible} onChange={value => changeSettings({ sidebarVisible: value, layoutPreset: 'custom' })} />
          <SettingRow title="Quick reference" detail="Show the Cambridge keyword reference" checked={settings.referenceVisible} onChange={value => changeSettings({ referenceVisible: value, layoutPreset: 'custom' })} />
          <button className="reset-layout-button" onClick={resetLayout}>Reset workspace layout</button>
          <div className="settings-foot">Saved locally in this browser · drag dock tabs to reorder</div>
        </FloatingPanel>
      </div>
      <div className="file-menu-anchor" ref={fileAnchorRef}><button className={`help-button ${fileMenuOpen ? 'active' : ''}`} onClick={() => setFileMenuOpen(open => !open)}><FileCode2 size={15} /><span>File</span><ChevronDown size={12} /></button>{<FloatingPanel anchor={fileAnchorRef} open={fileMenuOpen} className="file-menu"><button onClick={() => { setFileMenuOpen(false); fileInputRef.current?.click(); }}><Upload size={14} /> Import .pico</button><button onClick={() => { exportProject(activeProject); setFileMenuOpen(false); }}><Download size={14} /> Export .pico</button></FloatingPanel>}<input ref={fileInputRef} type="file" accept=".pico,application/json" hidden onChange={handleImport} /></div><button className="help-button" title="Cambridge subset guide" onClick={() => { setSelectedDoc('DECLARE'); document.getElementById('quick-reference')?.scrollIntoView({ behavior: 'smooth' }); }}><CircleHelp size={15} /><span>Help</span></button>
    </header>

    <div className={`ide-shell sidebar-${settings.sidebarSide} dock-${settings.dockSide}`}>
      {settings.sidebarVisible && <aside className="project-sidebar">
        <div className="sidebar-head"><span>WORKSPACE</span><button className="small-icon-button" onClick={createBlankProject} title="New project" aria-label="New project"><Plus size={15} /></button></div>
        <div className="side-section-label"><span>PROJECTS</span><span className="count-pill">{projects.length}</span></div>
        <div className="project-list">{projects.map(project => <div className={`project-row ${project.id === activeId ? 'active' : ''}`} key={project.id}><button className="project-select" onClick={() => selectProject(project.id)} title={project.name}><FileCode2 size={15} /><span>{project.name}</span></button>{project.id === activeId && <button className="project-delete" title="Delete project" aria-label="Delete project" onClick={() => removeProject(project.id)}><Trash2 size={12} /></button>}</div>)}</div>
        <div className="side-section-label examples-label"><span>CAMBRIDGE EXAMPLES</span><Sparkles size={12} /></div>
        <div className="example-list">{examples.map(example => <button className="example-row" key={example.id} title={example.description} onClick={() => loadExample(example.id)}><span className="example-mark"><Code2 size={13} /></span><span><b>{example.name}</b><small>{example.description}</small></span></button>)}</div>
        <div className="sidebar-bottom"><div className="subset-mark"><span><BookOpen size={14} /></span><div><strong>Cambridge core</strong><small>Focused syllabus subset</small></div></div><span className="local-badge"><span /> LOCAL ONLY</span></div>
      </aside>}
      {settings.sidebarVisible && <ResizeHandle axis="x" label="Resize project sidebar" className="sidebar-resize-handle" onResize={resizeSidebar} />}

      <main className="workspace-main" ref={workspaceMainRef}>
        <div className="command-bar">
          <div className="file-crumb"><span className="file-icon"><CodeXml size={15} /></span><input aria-label="Project name" className="project-title-input" value={activeProject.name} onChange={event => renameProject(event.target.value)} /><span className="file-extension">.pseudocode</span><span className="command-dot">·</span><span className="language-pill"><span /> Cambridge pseudocode</span></div>
          <div className="command-spacer" />
          <div className="editor-preferences">
            <ToggleChip label="Autocomplete" checked={settings.autocomplete} onClick={() => changeSettings({ autocomplete: !settings.autocomplete })} />
            <ToggleChip label="Autocorrect" checked={settings.autocorrect} onClick={() => { changeSettings({ autocorrect: !settings.autocorrect }); setDismissedSuggestions(false); }} />
            <ToggleChip label="Hover docs" checked={settings.hoverDocs} onClick={() => changeSettings({ hoverDocs: !settings.hoverDocs })} />
          </div>
          <div className="command-divider" />
          <button className="toolbar-button" onClick={formatCode} title="Format code · Shift+Alt+F"><CodeXml size={14} /><span>Format</span></button><button className="toolbar-button" onClick={saveSnapshot} title="Save a project snapshot"><History size={14} /><span>History</span></button><button className="toolbar-button" onClick={() => setActivePanel('flowchart')}><GitBranch size={14} /><span>Flowchart</span></button>
          <button className="toolbar-button debug-button" onClick={() => runProgram(true)}><Code2 size={14} /><span>Debug</span></button>
          <button className="run-button" onClick={() => runProgram()}><Play size={13} fill="currentColor" /><span>Run</span><kbd>⌘ ↵</kbd></button>
        </div>

        <div className={`editor-split ${settings.referenceVisible ? '' : 'reference-hidden'}`}>
          <section className="editor-card">
            <div className="editor-card-head"><div className="editor-card-title"><span className="editor-live-dot" /><span>Editor</span><span className="line-count">{activeFile.code.split('\n').length} lines</span></div><div className="editor-card-meta"><span className="mono-tag">IGCSE</span><span>·</span><span>UTF-8</span><span>·</span><span>LF</span></div></div>
            <div className="file-tabs" role="tablist" aria-label="Project files">{activeProject.files.map(file => <div className={`file-tab ${file.id === activeFile.id ? 'active' : ''}`} key={file.id} role="tab" aria-selected={file.id === activeFile.id} onDoubleClick={() => renameFile(file)}><button className="file-tab-select" onClick={() => selectFile(file.id)} title={`${file.name} · double-click to rename`}><FileCode2 size={12} /><span>{file.name}</span></button><button className="file-tab-close" onClick={() => closeFile(file)} aria-label={`Close ${file.name}`} title="Close file"><X size={11} /></button></div>)}<button className="file-tab-new" onClick={createFile} title="New file" aria-label="New file"><Plus size={13} /></button></div>
            {suggestions.length > 0 && <div className="suggestion-ribbon"><Sparkles size={13} /><span>Did you mean?</span>{suggestions.map((suggestion, index) => <button className="suggestion-chip" key={`${suggestion.line}-${suggestion.column}-${index}`} onClick={() => applySuggestion(suggestion)}><code>{suggestion.original}</code><span>→</span><b>{suggestion.replacement}</b><small>line {suggestion.line}</small></button>)}<button className="dismiss-suggestions" title="Dismiss suggestions" onClick={() => setDismissedSuggestions(true)}><X size={13} /></button></div>}
            <div className="editor-body"><CodeEditor ref={editorRef} value={activeFile.code} onChange={updateCode} onFormat={formatCode} preferences={settings} theme={theme} coveredLines={result?.coverage ?? []} currentLine={currentStep?.line} errorLine={visibleError?.line} /></div>
            <div className="editor-card-foot"><span><Keyboard size={12} /> <kbd>⌘</kbd> <kbd>↵</kbd> to run <span className="shortcut-separator">·</span> <kbd>Ctrl G</kbd> go to line</span><span className="scope-note">Cambridge subset · core statements and expressions</span></div>
          </section>

          {settings.referenceVisible && <ResizeHandle axis="x" label="Resize quick reference panel" className="reference-resize-handle" onResize={resizeReference} />}
          {settings.referenceVisible && <aside className="reference-card" id="quick-reference">
            <div className="reference-head"><div><BookOpen size={15} /><strong>Quick reference</strong></div><span className="reference-level">CAMBRIDGE</span></div>
            <div className="reference-search"><Search size={13} /><input value={docSearch} onChange={event => setDocSearch(event.target.value)} placeholder="Find a keyword" aria-label="Search Cambridge keywords" /></div>
            <div className="reference-keywords"><button className="syntax-cheat-button" onClick={() => setDocSearch('')}>Syntax cheat sheet</button>{shownTerms.map(term => <button key={term} className={`keyword-pill ${selectedDoc === term ? 'active' : ''}`} onClick={() => setSelectedDoc(term)}>{term}</button>)}</div>
            <div className="reference-explanation"><span className="mini-label">KEYWORD</span><strong>{selectedDoc}</strong><p>{currentDoc}</p></div><details className="syntax-cheat-sheet" open><summary>Syntax cheat sheet · examples</summary><pre>{`DECLARE Name : STRING
Name ← "Pico"

IF Score >= 50 THEN
    OUTPUT "Pass"
ELSE
    OUTPUT "Try again"
ENDIF

WHILE Number <> -1 DO
    INPUT Number
ENDWHILE

CASE OF Choice
1 : OUTPUT "One"
OTHERWISE
    OUTPUT "Other"
ENDCASE`}</pre></details>
            <div className="reference-scope"><div className="scope-icon"><Sparkles size={14} /></div><div><strong>A focused subset</strong><p>Cambridge declarations, selection, CASE, all loop styles, routines, arrays, files and booklet library routines.</p></div></div>
            <button className={`hover-doc-setting ${settings.hoverDocs ? 'enabled' : ''}`} onClick={() => changeSettings({ hoverDocs: !settings.hoverDocs })}><span className="hover-setting-icon">⌕</span><span><b>Hover documentation</b><small>Pause on a keyword in the editor</small></span><Toggle checked={settings.hoverDocs} onChange={() => changeSettings({ hoverDocs: !settings.hoverDocs })} /></button>
          </aside>}
        </div>

        <ResizeHandle axis={settings.dockSide === 'right' ? 'x' : 'y'} label="Resize tool panel" className="dock-resize-handle" onResize={resizeDock} />
        <section className="tool-dock">
          <div className="dock-tab-row" role="tablist" aria-label="Pico tool panels">{orderedTabs.map(tab => <button draggable key={tab.key} role="tab" aria-selected={activePanel === tab.key} className={`dock-tab ${activePanel === tab.key ? 'active' : ''}`} onDragStart={() => setDraggedPanel(tab.key)} onDragOver={event => event.preventDefault()} onDrop={() => reorderPanels(tab.key)} onClick={() => setActivePanel(tab.key)}>{panelIcon(tab.key)}<span>{tab.title}</span>{tab.key === 'tests' && activeProject.tests.length > 0 && <small>{activeProject.tests.length}</small>}{tab.key === 'coverage' && result && <small>{result.coverage.length}</small>}</button>)}<div className="dock-flex" /><span className="dock-panel-state"><span className="panel-state-dot" /> {activePanel === 'console' ? 'OUTPUT' : activePanel.toUpperCase()}</span><button className="small-icon-button dock-close" title="Collapse panel" onClick={() => setActivePanel('console')}><PanelRightClose size={14} /></button></div>
          <div className="dock-content" role="tabpanel">
            {activePanel === 'console' && <><ConsolePanel output={result?.output ?? []} error={executionError ?? parseError} stdin={inputValues} onInput={setInputValues} ran={Boolean(result)} />{picoGreeting && <div className="pico-easter-egg" role="status">Hi, I’m Pico. Thanks for saying hello.</div>}</>}
            {activePanel === 'debugger' && <DebuggerPanel trace={result?.trace ?? []} index={debugIndex} onIndex={setDebugIndex} />}
            {activePanel === 'tests' && <TestsPanel tests={activeProject.tests} outcomes={testOutcomes} onRun={runTests} onUpdate={updateTest} onAdd={addTest} onRemove={removeTest} />}
            {activePanel === 'flowchart' && <FlowchartDock ast={parsed.ast} error={parseError?.message} />}
            {activePanel === 'coverage' && <CoveragePanel source={activeFile.code} lines={result?.coverage ?? []} />}
            {activePanel === 'ast' && <AstPanel ast={parsed.ast} error={parseError?.message} />}
            {activePanel === 'tokens' && <TokensPanel tokens={parsed.tokens} error={parseError?.message} />}
          </div>
        </section>
      </main>
    </div>

    {tutorialOfferOpen && <div className="tutorial-offer" role="dialog" aria-label="Pico tutorial offer"><div><strong>New to Pico?</strong><small>Take a quick tour of the workspace.</small></div><div className="tutorial-offer-actions"><button className="subtle-button" onClick={() => setTutorialOfferOpen(false)}>Not now</button><button className="primary-small" onClick={() => { setTutorialOfferOpen(false); setTutorialOpen(true); }}>Show tutorial</button></div></div>}
    {tutorialOpen && <div className="input-modal-backdrop" role="presentation" onClick={() => setTutorialOpen(false)}><div className="tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onClick={event => event.stopPropagation()}><div className="input-modal-head"><div><strong id="tutorial-title">Pico in a minute</strong><small>A short tour of the useful bits.</small></div><button className="icon-button quiet" onClick={() => setTutorialOpen(false)} aria-label="Close tutorial"><X size={15} /></button></div><div className="tutorial-steps"><div><b>1 · Write</b><span>Use the editor, tabs, folding arrows, and <kbd>Ctrl G</kbd> to jump to a line.</span></div><div><b>2 · Run and learn</b><span>Press Run, use the input popup, then inspect Console, Debugger, Tests, Flowchart, and Coverage.</span></div><div><b>3 · Make it yours</b><span>Format with <kbd>Shift Alt F</kbd>, save snapshots in History, and choose a layout preset in Settings.</span></div><div><b>4 · Say hello</b><span>Click the Pico logo for credits. Hint: try <code>OUTPUT "PICO"</code>, or enter <code>Amar</code>, <code>Mustaqim</code>, or <code>Mr.Boyle</code> in an input popup.</span></div></div><div className="tutorial-actions"><button className="subtle-button" onClick={() => setTutorialOpen(false)}>Start exploring</button><button className="primary-small" onClick={() => { setTutorialOpen(false); setCreditsOpen(true); }}>Try the logo credits</button></div></div></div>}
    <footer className="statusbar"><div className="attribution">Deployed by Mustaqim 11 Boys Red and Made by Amar 11 Boys Blue</div><div className="status-left"><span className="status-ready"><span /> READY</span><span className="status-divider" /><span>{saveState === 'saved' ? 'Saved locally' : saveState === 'saving' ? 'Saving changes…' : 'Local storage unavailable'}</span><span className="status-divider" /><span>Cambridge core</span></div><div className="status-right"><span>{activeFile.code.split('\n').length} lines</span><span className="status-divider" /><span>Browser-only <span className="status-lock">●</span></span><span className="status-divider" /><span className="version-mark">PICO / 01</span></div></footer>
    {historyOpen && <div className="input-modal-backdrop" role="presentation" onClick={() => setHistoryOpen(false)}><div className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={event => event.stopPropagation()}><div className="input-modal-head"><div><strong id="history-title">Project history</strong><small>{activeProject.name} · browser-local snapshots</small></div><button className="icon-button quiet" onClick={() => setHistoryOpen(false)} aria-label="Close history"><X size={15} /></button></div><div className="history-actions"><button className="primary-small" onClick={saveSnapshot}><History size={13} /> Save snapshot</button></div>{history.length === 0 ? <div className="history-empty">No snapshots yet. Save one before experimenting with a big change.</div> : <div className="history-list">{history.map(version => <div className="history-row" key={version.id}><div><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleString()} · {version.files.length} file{version.files.length === 1 ? '' : 's'}</small></div><button className="subtle-button" onClick={() => restoreSnapshot(version)}>Restore</button></div>)}</div>}</div></div>}
    {inputPromptOpen && <div className="input-modal-backdrop" role="presentation"><div className="input-modal" role="dialog" aria-modal="true"><div className="input-modal-head"><div><strong>Program input</strong><small>This program uses INPUT. Enter one value per line.</small></div><button className="icon-button quiet" onClick={() => setInputPromptOpen(false)} aria-label="Close input dialog"><X size={15} /></button></div><textarea autoFocus rows={6} value={inputValues} onChange={event => setInputValues(event.target.value)} placeholder="One input value per line" />{creatorInput && <div className="pico-easter-egg creator-note" role="status">These are my creators — thanks, Amar and Mustaqim.</div>}{teacherInput && <div className="pico-easter-egg creator-note" role="status">Hello, Mr. Boyle — my computer science teacher.</div>}<div className="input-modal-actions"><button className="subtle-button" onClick={() => setInputPromptOpen(false)}>Cancel</button><button className="primary-small" onClick={submitInputPrompt}><Play size={13} fill="currentColor" /> Run program</button></div></div></div>}
    {creditsOpen && <div className="input-modal-backdrop" role="presentation" onClick={() => setCreditsOpen(false)}><div className="credits-modal" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={event => event.stopPropagation()}><div className="credits-mark"><BrandMark /></div><div className="input-modal-head"><div><strong id="credits-title">About Pico</strong><small>A Cambridge pseudocode studio made with care.</small></div><button className="icon-button quiet" onClick={() => setCreditsOpen(false)} aria-label="Close developer credits"><X size={15} /></button></div><p className="credits-message">Thanks to <strong>Amar</strong> and <strong>Mustaqim</strong> — this was made by them.</p><p className="credits-contact">If you have any problems, contact <a href="mailto:b04557@nbabarwa.com">b04557@nbabarwa.com</a> or <a href="mailto:b03661@nbabarwa.com">b03661@nbabarwa.com</a>.</p><div className="input-modal-actions"><button className="primary-small" onClick={() => setCreditsOpen(false)}>Close</button></div></div></div>}
  </div>;
}

function ToggleChip({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) { return <button className={`toggle-chip ${checked ? 'on' : ''}`} aria-pressed={checked} onClick={onClick}><span className="toggle-light" />{label}</button>; }
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) { return <button className={`switch ${checked ? 'checked' : ''}`} role="switch" aria-checked={checked} onClick={onChange}><span /></button>; }
function SettingRow({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="setting-row"><div><strong>{title}</strong><small>{detail}</small></div><Toggle checked={checked} onChange={() => onChange(!checked)} /></div>; }
function BrandMark() { return <svg className="brand-mark" viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="8" fill="#8179ef"/><path d="M9 7.5h7.6a4.4 4.4 0 0 1 0 8.8H12v4.2H9V7.5Zm3 2.8v3.2h4.3a1.6 1.6 0 0 0 0-3.2H12Z" fill="#11121a"/><circle cx="19.5" cy="20.5" r="1.5" fill="#c9c4ff"/></svg>; }

const defaultPanelOrder: PanelKey[] = ['console','debugger','tests','flowchart','coverage','ast','tokens'];
function hasInputStatements(program: Program): boolean { const scan = (statements: any[]): boolean => statements.some(statement => statement.kind === 'Input' || (statement.thenBody && (scan(statement.thenBody) || scan(statement.elseBody ?? []))) || (statement.body && scan(statement.body)) || (statement.branches && statement.branches.some((branch: any) => scan(branch.body))) || (statement.otherwise && scan(statement.otherwise))); return scan(program.statements); }

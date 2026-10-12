import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Code2, Copy, Download, GitBranch, CircleHelp, Play, Plus, Redo2, Settings2, Trash2, Undo2, Upload, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { compileFlowchart, ChartError, type ChartCompilation } from './compiler';
import { BLOCKS, DATA_TYPES, NODE_HEIGHT, NODE_WIDTH, connectNodes, createNode, newChart, blockName, nodeLabel, ports, removeNode, type FlowchartProject, type NodeKind, type Port } from './model';
import { chartNameExists, importChart, loadCharts, saveCharts, serializeChart, uniqueChartName, type ChartStore } from './storage';
import { ChartCanvas, BlockSymbol } from './Canvas';
import { ConsolePanel, DebuggerPanel, type ConsoleEntry } from '../app/components/Panels';
import { HighlightedCode } from '../app/components/HighlightedCode';
import { ThemePicker } from '../app/components/ThemePicker';
import { UpdateCenter } from '../app/components/UpdateCenter';
import { ResizeHandle } from '../app/components/ResizeHandle';
import { contrastRatio, cssVariables, getTheme } from '../app/themes';
import { loadSettings, saveSettings } from '../storage/settings';
import { normalizeProjectName } from '../storage/projects';
import { startExecution, type ExecutionJob } from '../runtime/runner';
import type { ExecutionFailure, PendingInput } from '../runtime/worker';
import type { RunResult } from '../runtime/interpreter';
import { inputEasterEgg } from '../app/inputEasterEgg';
import { FlowchartTutorial, lessonReady } from './FlowchartTutorial';
import './flowchart-builder.css';
const OUTPUT_LIMIT=2000;
interface Props {snapshot?:ChartStore;onHome:(store:ChartStore)=>void;onPseudocode:(code:string,name:string,store:ChartStore)=>void;}
export function FlowchartWorkspace({snapshot,onHome,onPseudocode}:Props) {
  const [initial]=useState(()=>snapshot??loadCharts());
  const [store,setStore]=useState(initial);
  const [tourStep,setTourStep]=useState<number|null>(()=>initial.tutorialCompleted?null:0);
  const [lesson,setLesson]=useState(()=>{return newChart('Practice flowchart');});
  const practiceLesson=useRef(lesson);
  const tutorialActive=tourStep!==null;
  const project=tutorialActive?lesson:store.projects.find(p=>p.id===store.activeId)??store.projects[0];
  const projectRef=useRef(project);projectRef.current=project;
  const [settings,setSettings]=useState(loadSettings),theme=getTheme(settings.theme);
  const [selected,setSelected]=useState<string|null>(null),[connection,setConnection]=useState<{from:string;port:Port}|null>(null);
  const [zoom,setZoom]=useState(0.85),[dockHeight,setDockHeight]=useState(250),[panel,setPanel]=useState<'console'|'debugger'|'pseudocode'>('console');
  const [settingsOpen,setSettingsOpen]=useState(false),[nameDraft,setNameDraft]=useState(project.name);
  const [message,setMessage]=useState(''),[saveError,setSaveError]=useState(false),[running,setRunning]=useState(false);
  const [entries,setEntries]=useState<ConsoleEntry[]>([]),[pending,setPending]=useState<PendingInput|null>(null),[input,setInput]=useState('');
  const [error,setError]=useState<ExecutionFailure|null>(null),[errorNode,setErrorNode]=useState<string>(),[result,setResult]=useState<RunResult|null>(null),[debugIndex,setDebugIndex]=useState(0),[truncated,setTruncated]=useState(false);
  const jobRef=useRef<ExecutionJob|null>(null),runCompilation=useRef<ChartCompilation|null>(null),count=useRef(0);
  const importRef=useRef<HTMLInputElement>(null),layoutRef=useRef<HTMLDivElement>(null),settingsRef=useRef<HTMLDivElement>(null);
  const histories=useRef(new Map<string,{past:FlowchartProject[];future:FlowchartProject[]}>());
  const history=histories.current.get(project.id);
  const currentNode=project.nodes.find(n=>n.id===selected);
  const conversion=useMemo(()=>{try{return {value:compileFlowchart(project),error:null};}catch(e){return {value:null,error:e instanceof ChartError?e:new ChartError(e instanceof Error?e.message:'Invalid flowchart.')};}},[project]);
  const debugTrace=result?.trace.filter(step=>Boolean(runCompilation.current?.lineNodes[step.line]))??[];
  const activeNode=pending&&runCompilation.current?runCompilation.current.lineNodes[pending.line]:panel==='debugger'&&result&&runCompilation.current?runCompilation.current.lineNodes[debugTrace[debugIndex]?.line]:undefined;
  useEffect(()=>()=>{const job=jobRef.current;jobRef.current=null;job?.cancel();},[]);
  useEffect(()=>{const timer=setTimeout(()=>{try{saveCharts(store);setSaveError(false);}catch{setSaveError(true);}},300);return()=>clearTimeout(timer);},[store]);
  useEffect(()=>{try{saveSettings(settings);}catch{/* Keep the current theme when storage is unavailable. */}},[settings]);
  useEffect(()=>{for(const [key,value] of Object.entries(cssVariables(theme)))document.documentElement.style.setProperty(key,value);document.documentElement.style.colorScheme=theme.appearance;},[theme]);
  useEffect(()=>{setNameDraft(project.name);setSelected(null);setConnection(null);setMessage('');},[project.id]);
  useEffect(()=>{
    if(!settingsOpen)return;
    const close=(event:globalThis.PointerEvent)=>{const target=event.target as HTMLElement;if(!settingsRef.current?.contains(target)&&!target.closest('[aria-label="Flowchart settings"]'))setSettingsOpen(false);};
    document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
  },[settingsOpen]);
  async function copyCode() {
    try {if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(conversion.value!.code);setMessage('Pseudocode copied.');}
    catch {setMessage('Select the code and copy it with Ctrl+C.');}
  }
  function resetExecution() {
    const job=jobRef.current;jobRef.current=null;job?.cancel();setRunning(false);setPending(null);setInput('');setError(null);setErrorNode(undefined);setResult(null);setEntries([]);setTruncated(false);
  }
  function update(next:FlowchartProject,record=true) {
    resetExecution();setMessage('');
    if(tutorialActive){const added=next.nodes.filter(n=>!project.nodes.some(old=>old.id===n.id));const allowed=tourStep===1?'start':tourStep===2?'output':tourStep===4?'end':null;if(added.length&&(!allowed||added.some(n=>n.kind!==allowed)||project.nodes.some(n=>n.kind===allowed)||added.length>1))return;setLesson(next);practiceLesson.current=next;return;}
    if(record) {const h=histories.current.get(project.id)??{past:[],future:[]};h.past=[...h.past,project].slice(-80);h.future=[];histories.current.set(project.id,h);}
    setStore(s=>({...s,projects:s.projects.map(p=>p.id===project.id?next:p)}));
  }
  function undo(redo=false) {const h=histories.current.get(project.id);if(!h)return;const source=redo?h.future:h.past;const next=source.pop();if(!next)return;(redo?h.past:h.future).push(project);update(next,false);setConnection(null);}
  function select(id:string|null) {setSelected(id);}
  function link(from:string,port:Port,to:string){if(running)return;update(connectNodes(project,from,port,to));setConnection(null);setSelected(to);}
  function connect(from:string,port:Port) {if(running)return;setSelected(from);setConnection(c=>c?.from===from&&c.port===port?null:{from,port});}
  function target(id:string) {if(!connection)return;if(project.nodes.find(n=>n.id===id)?.kind==='start'){setMessage('Choose a block other than Start.');return;}update(connectNodes(project,connection.from,connection.port,id));setConnection(null);setSelected(id);}
  function add(kind:NodeKind) {
    if(running||(tutorialActive&&((tourStep===1?'start':tourStep===2?'output':tourStep===4?'end':null)!==kind||project.nodes.some(n=>n.kind===kind))))return;if(project.nodes.length>=250){setMessage('Use at most 250 blocks in one flowchart.');return;}
    const node=createNode(kind,tutorialActive?360:currentNode?currentNode.x+256:360,tutorialActive?(kind==='start'?44:kind==='end'?440:240):currentNode?currentNode.y+144:160+project.nodes.length*40);
    update({...project,nodes:[...project.nodes,node]});setSelected(node.id);
  }
  function patchNode(patch:Partial<NonNullable<typeof currentNode>>) {if(!currentNode)return;update({...project,nodes:project.nodes.map(n=>n.id===selected?{...n,...patch}:n)});}
  function deleteSelected() {if(running||!selected)return;update(removeNode(project,selected));setSelected(null);setConnection(null);}
  function rename() {if(tutorialActive)return;const name=normalizeProjectName(nameDraft);if(!name){setMessage('Enter a workspace name.');setNameDraft(project.name);return;}if(chartNameExists(name,store.projects,project.id)){setMessage('A flowchart with that name already exists.');setNameDraft(project.name);return;}if(name!==project.name)update({...project,name});}
  function createProject() {
    if(tutorialActive)return;
    if(store.projects.length>=50){setMessage('Use at most 50 flowchart workspaces. Export one before removing it.');return;}
    resetExecution();const p=newChart();p.name=uniqueChartName(p.name,store.projects);setStore(s=>({...s,projects:[...s.projects,p],activeId:p.id}));setZoom(0.85);
  }
  function removeProject() {
    if(tutorialActive)return;
    if(!window.confirm(`Delete "${project.name}"? Export it first if you want to keep a copy.`))return;
    resetExecution();histories.current.delete(project.id);const projects=store.projects.filter(p=>p.id!==project.id);if(!projects.length)projects.push(newChart());setStore(s=>({...s,projects,activeId:projects[0].id}));
  }
  function saveNow():ChartStore {try{saveCharts(store);}catch{setSaveError(true);}return store;}
  function download(text:string,name:string,mime='text/plain') {const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[<>:"/\\|?*]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
  async function importFile(file:File) {
    if(tutorialActive)return;
    const previousId=project.id;
    try {if(file.size>2_000_000)throw Error('Choose a flowchart file smaller than 2 MB.');const p=importChart(await file.text());if(projectRef.current.id!==previousId)return;if(store.projects.length>=50)throw Error('Use at most 50 flowchart workspaces.');resetExecution();setStore(s=>{p.name=uniqueChartName(p.name,s.projects);return {...s,projects:[...s.projects,p],activeId:p.id};});}
    catch(e){setMessage(e instanceof Error?e.message:'The file did not import.');}
  }
  async function run(debug=false) {
    if(running||(tutorialActive&&tourStep!==7))return;
    if(!conversion.value){setError({message:conversion.error!.message});setErrorNode(conversion.error!.nodeId);setSelected(conversion.error!.nodeId??null);setPanel('console');return;}
    resetExecution();const compiled=conversion.value;runCompilation.current=compiled;setPanel('console');count.current=0;
    const job=startExecution({ast:compiled.ast,interactive:true,runs:[{inputs:[],options:{trace:debug}}]}, {
      onOutput:lines=>{if(jobRef.current!==job)return;count.current+=lines.length;if(count.current>OUTPUT_LIMIT)setTruncated(true);setEntries(items=>[...items,...lines.map(text=>({kind:'output' as const,text}))].slice(-OUTPUT_LIMIT));},
      onInput:request=>{if(jobRef.current!==job)return;setPending(request);setInput('');setPanel('console');setSelected(compiled.lineNodes[request.line]??null);},
    });
    jobRef.current=job;setRunning(true);
    const [reply]=await job.promise;if(jobRef.current!==job)return;
    jobRef.current=null;setRunning(false);setPending(null);setInput('');
    if(reply?.error?.code==='cancelled'){setEntries(items=>[...items,{kind:'note',text:'Execution stopped.'}]);return;}
    setResult(reply?.result??null);setDebugIndex(0);setError(reply?.error??null);setErrorNode(reply?.error?.line?compiled.lineNodes[reply.error.line]:undefined);
    if(reply?.error?.line)setSelected(compiled.lineNodes[reply.error.line]??null);
    if(debug&&reply?.result&&!reply.error)setPanel('debugger');if(reply?.result?.outputTruncated)setTruncated(true);
  }
  function submit() {if(!pending||!jobRef.current?.provideInput(pending.id,input))return;const egg=pending.dataType==='STRING'?inputEasterEgg(input):undefined;setEntries(items=>[...items,{kind:'input' as const,text:input},...(egg?[{kind:'note' as const,text:egg}]:[])].slice(-OUTPUT_LIMIT));setPending(null);setInput('');}
  function fit() {
    const viewport=layoutRef.current?.querySelector<HTMLElement>('.flow-viewport');if(!viewport)return;
    const width=Math.max(...project.nodes.map(n=>n.x+NODE_WIDTH+80),600),height=Math.max(...project.nodes.map(n=>n.y+NODE_HEIGHT+80),450);
    setZoom(Math.min(1.25,Math.max(0.35,Math.min(viewport.clientWidth/width,viewport.clientHeight/height))));viewport.scrollTo?.({left:0,top:0});
  }
  function enterLesson(step:number) {
    resetExecution();setConnection(null);setSelected(null);setPanel('console');
    setLesson(practiceLesson.current);if(step===3)setSelected(practiceLesson.current.nodes.find(n=>n.kind==='output')?.id??null);
    const available=window.innerWidth-(window.innerWidth<520?100:window.innerWidth<850?150:476);
    setZoom(Math.min(.7,Math.max(.35,(available-40)/900)));setTourStep(step);
  }
  function startWalkthrough() {
    const p=newChart('Practice flowchart');
    practiceLesson.current=p;setLesson(p);setSettingsOpen(false);enterLesson(0);
  }
  function nextLesson() {
    if(tourStep===null||running||!lessonReady(tourStep,project,result,panel))return;
    if(tourStep===9){resetExecution();setTourStep(null);setSelected(null);setConnection(null);setPanel('console');setZoom(.85);const complete={...store,tutorialCompleted:true};setStore(complete);try{saveCharts(complete);}catch{setSaveError(true);}return;}
    // Keep output visible when moving from Run to conversion or into the finish screen.
    if(tourStep===7)setTourStep(tourStep+1);else enterLesson(tourStep+1);
  }
  useEffect(()=>{function key(event:KeyboardEvent) {
    const editing=(event.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]');
    if(event.key==='Escape'){setConnection(null);setSettingsOpen(false);}
    if(settingsOpen||tutorialActive)return;
    if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();void run();}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveNow();}
    if(editing||running)return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();deleteSelected();}
  }window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
  const style={...cssVariables(theme),'--on-accent':contrastRatio('#fff',theme.accent)>=contrastRatio('#000',theme.accent)?'#fff':'#000','--error-color':theme.appearance==='light'?'#a40000':'#ff7474'} as CSSProperties;
  return <div className="pico-app flow-builder" data-pico-theme={theme.id} data-high-contrast={theme.highContrast?'true':undefined} style={style}>
    <header className="topbar">
      <button className="toolbar-button home-button" aria-label="Go to home screen" disabled={tutorialActive} onClick={()=>onHome(saveNow())}><ArrowLeft size={16}/></button>
      <div className="brand-lockup"><img src="/pico-logo.svg" alt="" width="27" height="27"/><span>Pico<span className="brand-period">.</span></span><span className="brand-subtitle">FLOWCHART</span></div>
      <input className="project-title-input topbar-project-name" aria-label="Flowchart workspace name" value={nameDraft} maxLength={42} disabled={running||tutorialActive} onChange={e=>setNameDraft(e.target.value)} onBlur={rename} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
      <div className="topbar-spacer"/>
      <div className="topbar-actions"><button className="toolbar-button" disabled={running||tutorialActive||!history?.past.length} aria-label="Undo flowchart edit" onClick={()=>undo()}><Undo2 size={16}/></button><button className="toolbar-button" disabled={running||tutorialActive||!history?.future.length} aria-label="Redo flowchart edit" onClick={()=>undo(true)}><Redo2 size={16}/></button>
        {running?<button className="toolbar-button stop-button" onClick={()=>jobRef.current?.cancel()}><X size={16}/>Stop</button>:<button className="toolbar-button debug-button" disabled={tutorialActive} onClick={()=>void run(true)}><Code2 size={16}/>Debug</button>}
        <button className="run-button" disabled={running||(tutorialActive&&tourStep!==7)} onClick={()=>void run()}><Play size={14} fill="currentColor"/>Run</button>
        <button className="toolbar-button flow-convert-button" disabled={running||(tutorialActive&&tourStep!==8)} onClick={()=>{setPanel('pseudocode');if(!conversion.value)setSelected(conversion.error?.nodeId??null);}}><Code2 size={16}/>Convert to pseudocode</button>
      </div>
      {!tutorialActive&&<UpdateCenter/>}<button className="toolbar-button" aria-label="Flowchart settings" disabled={tutorialActive} onClick={()=>setSettingsOpen(v=>!v)}><Settings2 size={16}/></button>
      <button className="help-button" disabled={tutorialActive} onClick={startWalkthrough}><CircleHelp size={16}/>Help</button>
    </header>
    <nav inert={tutorialActive} className="workspace-tabs" aria-label="Flowchart workspaces"><div className="project-list">{store.projects.map(p=><div className={`project-row ${p.id===project.id?'active':''}`} key={p.id}><button className="project-select" aria-current={p.id===project.id?'page':undefined} onClick={()=>{resetExecution();setStore(s=>({...s,activeId:p.id}));}}><GitBranch size={14}/><span>{p.name}</span></button></div>)}</div><button className="icon-button new-workspace" aria-label="New flowchart workspace" onClick={()=>createProject()}><Plus size={16}/></button></nav>
    {saveError&&<p className="autosave-error" role="alert">Browser storage is unavailable. Export your flowchart to keep your work.</p>}
    {message&&<p className="flow-message" role="status">{message}<button aria-label="Dismiss message" onClick={()=>setMessage('')}><X size={14}/></button></p>}
    <div className="flow-workspace" ref={layoutRef}>
      <aside className="flow-palette" aria-label="Flowchart blocks"><h2>Blocks</h2><p>Drag a block onto the canvas, or click to add it.</p><div className="flow-block-list">{BLOCKS.map(b=><button key={b.kind} className={`flow-palette-block flow-kind-${b.kind}`} disabled={running||(tutorialActive&&((tourStep===1?'start':tourStep===2?'output':tourStep===4?'end':null)!==b.kind||project.nodes.some(n=>n.kind===b.kind)))} draggable={!running&&(!tutorialActive||((tourStep===1?'start':tourStep===2?'output':tourStep===4?'end':null)===b.kind&&!project.nodes.some(n=>n.kind===b.kind)))} onDragStart={e=>{e.dataTransfer.setData('application/pico-flow-block',b.kind);e.dataTransfer.effectAllowed='copy';}} onClick={()=>add(b.kind)} title={b.hint}><BlockSymbol kind={b.kind}/><span><strong>{b.label}</strong><small>{b.hint}</small></span></button>)}</div>

        <div className="flow-file-actions" inert={tutorialActive}><button onClick={()=>download(serializeChart(project),`${project.name}.picochart`,'application/json')}><Download size={14}/>Export flowchart</button><button onClick={()=>importRef.current?.click()}><Upload size={14}/>Import flowchart</button><button onClick={removeProject}><Trash2 size={14}/>Delete workspace</button></div>
        <input ref={importRef} type="file" accept=".picochart,application/json" hidden onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void importFile(file);}}/>
      </aside>
      <main className="flow-main"><div className="flow-canvas-toolbar"><span>{connection?`Choose a destination for ${connection.port==='next'?'Next':connection.port==='yes'?'Yes':'No'}`:'Drag a connection port onto another block. Drag the background to pan.'}</span><div>{connection&&<button aria-label="Cancel connection" onClick={()=>setConnection(null)}><X size={15}/></button>}<button aria-label="Zoom out" disabled={zoom<=0.35} onClick={()=>setZoom(v=>Math.max(0.35,v-0.1))}><ZoomOut size={16}/></button><output>{Math.round(zoom*100)}%</output><button aria-label="Zoom in" disabled={zoom>=1.5} onClick={()=>setZoom(v=>Math.min(1.5,v+0.1))}><ZoomIn size={16}/></button><button aria-label="Fit flowchart" onClick={fit}><Maximize2 size={16}/></button></div></div>
        <ChartCanvas project={project} selected={selected} activeNode={activeNode} errorNode={errorNode??(!tutorialActive?conversion.error?.nodeId:undefined)} connection={connection} zoom={zoom} disabled={running} onSelect={select} onChange={update} onConnect={connect} onTarget={target} onLink={link} onCancelConnection={()=>setConnection(null)}/>
        <ResizeHandle axis="y" label="Resize flowchart console" onResize={delta=>{const available=layoutRef.current?.clientHeight??700;setDockHeight(v=>Math.min(available*0.65,Math.max(160,v-delta)));}}/>
        <section className="flow-dock" style={{height:tutorialActive?160:dockHeight}} aria-label="Flowchart tools"><div className="dock-tabs" role="tablist" aria-label="Flowchart tool panels">{(['console','debugger','pseudocode'] as const).map(tab=><button className={`dock-tab ${panel===tab?'active':''}`} role="tab" aria-selected={panel===tab} key={tab} onClick={()=>setPanel(tab)}>{tab==='console'?'Console':tab==='debugger'?'Debugger':'Pseudocode'}</button>)}</div><div className="flow-dock-content" role="tabpanel">
          {panel==='console'&&<ConsolePanel entries={entries} error={error} pendingInput={pending} inputValue={input} onInput={setInput} onSubmit={submit} running={running} ran={Boolean(result)} outputTruncated={truncated} errorActionLabel="Select the block with this error" onErrorClick={errorNode?()=>setSelected(errorNode):undefined}/>}
          {panel==='debugger'&&<DebuggerPanel trace={debugTrace} index={debugIndex} onIndex={setDebugIndex} truncated={result?.traceTruncated} error={error?.message}/>}
          {panel==='pseudocode'&&<div className="flow-code-panel">{conversion.value?<><div className="flow-code-actions"><button onClick={()=>void copyCode()}><Copy size={14}/>Copy</button><button onClick={()=>download(conversion.value!.code,`${project.name}.pico`)}><Download size={14}/>Download .pico</button><button disabled={tutorialActive} onClick={()=>onPseudocode(conversion.value!.code,project.name,saveNow())}>Open in Pseudocode Compiler<ArrowRight size={14}/></button></div>{conversion.value.mode==='connections'&&<p>This chart uses a control variable to preserve its connections.</p>}<pre><HighlightedCode code={conversion.value.code}/></pre></>:<div className="flow-validation" role="alert"><strong>Error</strong><p>{conversion.error?.message}</p>{conversion.error?.nodeId&&<button onClick={()=>setSelected(conversion.error!.nodeId!)}>Select block</button>}</div>}</div>}
        </div></section>
      </main>
      <aside className="flow-inspector" aria-label="Block settings"><h2>{currentNode?`${blockName(currentNode.kind)} block`:'Block settings'}</h2>{currentNode?<><label>{currentNode.kind==='decision'?'Condition':currentNode.kind==='input'?'Variable':currentNode.kind==='output'?'Text or expressions':currentNode.kind==='declare'?'Variable or array declaration':currentNode.kind==='call'?'Procedure call':'Instruction'}<textarea aria-label="Block expression" maxLength={4000} rows={3} value={currentNode.text} disabled={running||currentNode.kind==='start'||currentNode.kind==='end'} spellCheck={false} onChange={e=>patchNode({text:e.target.value})}/></label>
        {(currentNode.kind==='input'||currentNode.kind==='declare')&&<label>Data type<select aria-label="Block data type" value={currentNode.dataType} disabled={running} onChange={e=>patchNode({dataType:e.target.value as typeof currentNode.dataType})}>{DATA_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>}
        <p className="flow-inspector-hint">{currentNode.kind==='decision'?'Use a comparison such as Score >= 50. Connect both Yes and No.':currentNode.kind==='input'?'This input declares a scalar variable with the chosen type.':currentNode.kind==='output'?'Put text in quotes. Separate text and variables with commas.':currentNode.kind==='declare'?'Variables are declared before execution. For an array, enter Scores : ARRAY[1:10] OF INTEGER instead.':currentNode.kind==='process'?'Use ← to assign a value, for example Total ← Price * Quantity.':currentNode.kind==='call'?'Define this procedure in Subroutines below.':'Connect the blocks in the order they should run.'}</p>
        {ports(currentNode).map(port=><label key={port}>{port==='next'?'Next block':port==='yes'?'Yes branch':'No branch'}<select aria-label={`${port} destination`} value={project.edges.find(e=>e.from===currentNode.id&&e.port===port)?.to??''} disabled={running} onChange={e=>{if(e.target.value)update(connectNodes(project,currentNode.id,port,e.target.value));else update({...project,edges:project.edges.filter(edge=>edge.from!==currentNode.id||edge.port!==port)});}}><option value="">Not connected</option>{project.nodes.filter(n=>n.kind!=='start').map(n=><option value={n.id} key={n.id}>{nodeLabel(n).slice(0,65)}</option>)}</select></label>)}
        <button className="flow-delete-block" disabled={running||tutorialActive} onClick={deleteSelected}><Trash2 size={14}/>Delete block</button>
      </>:<p>Select a block to edit its expression, type, or connections. Arrow keys move the selected block.</p>}
      {conversion.error&&project.nodes.length>0&&!tutorialActive&&<div className="flow-validation"><strong>Check this chart</strong><p>{conversion.error.message}</p>{conversion.error.nodeId&&<button onClick={()=>setSelected(conversion.error!.nodeId!)}>Select block</button>}</div>}
      <details className="flow-routines" inert={tutorialActive}><summary>Subroutines</summary><p>Define procedures and functions for Subroutine blocks.</p><textarea aria-label="Flowchart subroutine definitions" maxLength={100000} rows={10} value={project.routines} disabled={running} spellCheck={false} placeholder={'PROCEDURE ShowResult()\n  OUTPUT "Done"\nENDPROCEDURE'} onChange={e=>update({...project,routines:e.target.value})}/></details>
      </aside>
    </div>
    {tutorialActive&&<FlowchartTutorial step={tourStep} project={project} result={result} pending={Boolean(pending)} running={running} panel={panel} onNext={nextLesson} onBack={()=>enterLesson(Math.max(0,tourStep-1))}/>}
    {settingsOpen&&<div className="flow-settings" ref={settingsRef} role="dialog" aria-label="Flowchart appearance"><header><strong>Appearance</strong><button aria-label="Close flowchart settings" onClick={()=>setSettingsOpen(false)}><X size={16}/></button></header><ThemePicker value={settings.theme} onChange={id=>setSettings(s=>({...s,theme:id}))}/></div>}

  </div>;
}

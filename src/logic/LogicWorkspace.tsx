import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Credits} from '../app/components/HomeScreen';
import {ArrowLeft,Check,ChevronDown,Copy,Download,Hand,Maximize,Menu,MousePointer2,Pause,Play,Plus,Redo2,RotateCw,Save,StepForward,Trash2,Undo2,Upload,X,ZoomIn,ZoomOut} from 'lucide-react';
import {GROUPS,NODE_WIDTH,SPECS,makeDocument,makeNode,nodeHeight,parseDocument,portPosition,isWireValid,type CircuitDocument,type CircuitNode,type ComponentKind,type Signal} from './model';
import {advanceSimulation,evaluateCircuit,generateTruthTable,initialSimulation,key,stepSimulation,truthTableCSV,type SimulationState} from './engine';
import {loadSample,SAMPLES,type SampleName} from './samples';
import './logic.css';
const STORAGE='pico.logic.document.v1';
const validNumber=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const getInitial=()=>{try{const value=localStorage.getItem(STORAGE);return value?parseDocument(JSON.parse(value)):makeDocument();}catch{return makeDocument();}};
const filename=(name:string,ext:string)=>(name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)||'circuit')+ext;
function download(text:string,name:string,type:string){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
type Selection={type:'node'|'wire';id:string}|null;
type Interaction={type:'move'|'pan';x:number;y:number;origX:number;origY:number;nodeId?:string;before?:CircuitDocument}|null;
const stateName:Record<Signal,string>={0:'LOW',1:'HIGH',X:'UNKNOWN',Z:'HIGH Z'};
const signalClass=(signal:Signal)=>signal===0?'s0':signal===1?'s1':signal==='Z'?'sz':'sx';
const contentEqual=(a:CircuitDocument,b:CircuitDocument)=>JSON.stringify(a)===JSON.stringify(b);
const snap=(n:number,enabled:boolean)=>enabled?Math.round(n/12)*12:n;
export function LogicWorkspace({onHome}:{onHome:()=>void}){
 const [doc,setDoc]=useState<CircuitDocument>(getInitial);
 const docRef=useRef(doc);docRef.current=doc;
 const [history,setHistory]=useState<CircuitDocument[]>([]),[future,setFuture]=useState<CircuitDocument[]>([]);
 const [selection,setSelection]=useState<Selection>(null),[selectedNodes,setSelectedNodes]=useState<string[]>([]);
 const [tool,setTool]=useState<'select'|'pan'>('select');
 const [connecting,setConnecting]=useState<{id:string;pin:string}|null>(null);
 const [placement,setPlacement]=useState<ComponentKind|null>(null);
 const [simulation,setSimulation]=useState<SimulationState>(initialSimulation);
 const [running,setRunning]=useState(false);
 const [zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:45,y:45});
 const [status,setStatus]=useState('Ready. Select a component to place it.');
 const [saveState,setSaveState]=useState<'saved'|'unsaved'|'error'>('saved');
 const [paletteOpen,setPaletteOpen]=useState(false),[inspectorOpen,setInspectorOpen]=useState(false);
 const [groupOpen,setGroupOpen]=useState<string[]>([...GROUPS]);
 const [truthVisible,setTruthVisible]=useState(false);
 const [activeSample,setActiveSample]=useState<SampleName|null>(null);
 const [showWelcome,setShowWelcome]=useState(doc.nodes.length===0);
 const [pointer,setPointer]=useState<{x:number;y:number}|null>(null);
 const [interaction,setInteraction]=useState<Interaction>(null);
 const [importing,setImporting]=useState(false);
 const importRef=useRef<HTMLInputElement>(null);
 const boardRef=useRef<SVGSVGElement>(null);
 const simResult=useMemo(()=>evaluateCircuit(doc,simulation),[doc,simulation]);
 const signals=simResult.signals;
 const selectedNode=selection?.type==='node'?doc.nodes.find(n=>n.id===selection.id):undefined;
 const selectedWire=selection?.type==='wire'?doc.wires.find(w=>w.id===selection.id):undefined;
 const truth=useMemo(()=>{if(!truthVisible)return null;try{return {data:generateTruthTable(doc),error:''};}catch(error){return {data:null,error:error instanceof Error?error.message:'Truth table unavailable.'};}},[truthVisible,doc]);
 useEffect(()=>{if(!simResult.warning)return;setStatus(simResult.warning);},[simResult.warning]);
 useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setSimulation(prev=>advanceSimulation(docRef.current,prev,50).state),50);return()=>window.clearInterval(timer);},[running]);
 useEffect(()=>{setSaveState('unsaved');const timer=window.setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(doc));setSaveState('saved');}catch{setSaveState('error');}},350);return()=>window.clearTimeout(timer);},[doc]);
 function edit(next:CircuitDocument){if(contentEqual(docRef.current,next))return;setHistory(prev=>[...prev.slice(-79),docRef.current]);setFuture([]);setDoc(next);setActiveSample(null);}
 function change(mutator:(prev:CircuitDocument)=>CircuitDocument){edit(mutator(docRef.current));}
 function undo(){if(!history.length)return;setFuture(f=>[docRef.current,...f]);setDoc(history[history.length-1]!);setHistory(h=>h.slice(0,-1));setSelection(null);}
 function redo(){if(!future.length)return;setHistory(h=>[...h,docRef.current]);setDoc(future[0]!);setFuture(f=>f.slice(1));setSelection(null);}
 function addNode(kind:ComponentKind,x:number,y:number){const n=makeNode(kind,snap(x,doc.snap),snap(y,doc.snap));change(d=>({...d,nodes:[...d.nodes,n]}));setSelection({type:'node',id:n.id});setSelectedNodes([n.id]);setPlacement(null);setPaletteOpen(false);setShowWelcome(false);setStatus(SPECS[kind].title+' added. Drag it or connect its pins.');}
 function remove(){const ids=new Set(selectedNodes.length>1?selectedNodes:selection?.type==='node'?[selection.id]:[]);change(d=>({...d,nodes:d.nodes.filter(n=>!ids.has(n.id)),wires:d.wires.filter(w=>!ids.has(w.from)&&!ids.has(w.to)&&!(selection?.type==='wire'&&w.id===selection.id))}));setSelection(null);setSelectedNodes([]);}
 function duplicate(){const picked=doc.nodes.filter(n=>selectedNodes.length>1?selectedNodes.includes(n.id):selection?.type==='node'&&n.id===selection.id);if(!picked.length)return;const mapping=new Map(picked.map(n=>[n.id,crypto.randomUUID()]));const copies=picked.map(n=>({...n,id:mapping.get(n.id)!,x:n.x+36,y:n.y+36}));const wires=doc.wires.filter(w=>mapping.has(w.from)&&mapping.has(w.to)).map(w=>({...w,id:crypto.randomUUID(),from:mapping.get(w.from)!,to:mapping.get(w.to)!}));change(d=>({...d,nodes:[...d.nodes,...copies],wires:[...d.wires,...wires]}));setSelectedNodes(copies.map(n=>n.id));setSelection({type:'node',id:copies[0]!.id});}
 function rotate(){const ids=new Set(selectedNodes.length?selectedNodes:selection?.type==='node'?[selection.id]:[]);change(d=>({...d,nodes:d.nodes.map(n=>ids.has(n.id)?{...n,rotation:(n.rotation+90)%360}:n)}));}
 function attemptConnect(to:string,pin:string){
  if(!connecting)return;
  const wire={id:crypto.randomUUID(),from:connecting.id,fromPin:connecting.pin,to,toPin:pin};
  const invalid=isWireValid(doc,wire);
  if(invalid){setStatus(invalid);return;}
  change(d=>({...d,wires:[...d.wires,wire]}));setConnecting(null);setStatus('Wire connected.');
 }
 function load(id:SampleName){if(doc.nodes.length&&!window.confirm('Replace the current circuit with this sample? Your current circuit is locally saved and can be restored with Undo.'))return;edit(loadSample(id));setActiveSample(id);setShowWelcome(false);setSelection(null);setSimulation(initialSimulation());setRunning(false);setStatus('Sample loaded. Toggle its switches to explore.');setZoom(1);setOffset({x:45,y:45});}
 function fresh(){if(doc.nodes.length&&!window.confirm('Start a new blank circuit? Use Undo to return to the previous document.'))return;edit(makeDocument());setSelection(null);setSelectedNodes([]);setActiveSample(null);setSimulation(initialSimulation());setRunning(false);setShowWelcome(false);}
 function reset(){setRunning(false);setSimulation(initialSimulation());setStatus('Simulation reset.');}
 function toggleInput(node:CircuitNode,value?:0|1){setSimulation(s=>({...s,inputs:{...s.inputs,[node.id]:value??(s.inputs[node.id]??node.initial??0?0:1)}}));}
 function canvasPoint(event:{clientX:number;clientY:number}){const b=boardRef.current!.getBoundingClientRect();return {x:(event.clientX-b.left-offset.x)/zoom,y:(event.clientY-b.top-offset.y)/zoom};}
 function startMove(event:ReactPointerEvent<SVGGElement>,node:CircuitNode){
  if(tool==='pan'||placement)return;event.stopPropagation();
  if(event.shiftKey){setSelectedNodes(s=>s.includes(node.id)?s.filter(id=>id!==node.id):[...s,node.id]);}
  else{setSelection({type:'node',id:node.id});setSelectedNodes([node.id]);}
  setInspectorOpen(true);
  if(event.button!==0)return;
  const b=boardRef.current?.getBoundingClientRect();if(!b)return;
  setInteraction({type:'move',x:event.clientX,y:event.clientY,origX:node.x,origY:node.y,nodeId:node.id,before:doc});
 }
 function pointerMove(event:ReactPointerEvent<SVGSVGElement>){
  setPointer(canvasPoint(event));
  if(!interaction)return;
  if(interaction.type==='pan')setOffset({x:interaction.origX+event.clientX-interaction.x,y:interaction.origY+event.clientY-interaction.y});
  else {
   const original=interaction.before?.nodes.find(n=>n.id===interaction.nodeId);
   if(!original)return;
   const dx=(event.clientX-interaction.x)/zoom,dy=(event.clientY-interaction.y)/zoom;
   const x=snap(interaction.origX+dx,doc.snap),y=snap(interaction.origY+dy,doc.snap);
   setDoc(d=>({...d,nodes:d.nodes.map(n=>n.id===interaction.nodeId?{...n,x,y}:n)}));
  }
 }
 function pointerUp(){
  if(interaction?.type==='move'&&interaction.before&&!contentEqual(interaction.before,docRef.current)){
   setHistory(h=>[...h.slice(-79),interaction.before!]);setFuture([]);setActiveSample(null);
  }
  setInteraction(null);
 }
 function canvasClick(event:ReactPointerEvent<SVGSVGElement>){
  if(event.target!==boardRef.current&&!(event.target as Element).classList.contains('logic-surface'))return;
  if(placement){const p=canvasPoint(event);addNode(placement,p.x-61,p.y-36);return;}
  setSelection(null);setSelectedNodes([]);setConnecting(null);
 }
 function fit(){if(!doc.nodes.length){setZoom(1);setOffset({x:45,y:45});return;}
  const width=boardRef.current?.clientWidth??800,height=boardRef.current?.clientHeight??500;
  const minx=Math.min(...doc.nodes.map(n=>n.x))-45,maxx=Math.max(...doc.nodes.map(n=>n.x+NODE_WIDTH))+45,miny=Math.min(...doc.nodes.map(n=>n.y))-45,maxy=Math.max(...doc.nodes.map(n=>n.y+nodeHeight(n)))+45;
  const z=validNumber(Math.min(width/(maxx-minx),height/(maxy-miny)),.35,1.7);
  setZoom(z);setOffset({x:(width-(maxx-minx)*z)/2-minx*z,y:(height-(maxy-miny)*z)/2-miny*z});
 }
 useEffect(()=>{function onKey(e:KeyboardEvent){const el=e.target as HTMLElement;if(el.closest('input,textarea,select')||e.defaultPrevented)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
  if(e.key==='Escape'){setConnecting(null);setPlacement(null);setPaletteOpen(false);setInspectorOpen(false);}
 }window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);});
 async function importFile(file:File){try{if(file.size>800000)throw Error('This circuit file exceeds the 800 KB limit.');const data=parseDocument(JSON.parse(await file.text()));if(doc.nodes.length&&!window.confirm('Replace the current circuit with this imported project?'))return;edit(data);setSimulation(initialSimulation());setSelection(null);setRunning(false);setShowWelcome(false);setStatus('Circuit imported successfully.');}catch(error){setStatus(error instanceof Error?error.message:'Invalid circuit file.');}finally{setImporting(false);}}
 const inspectorContent=<div className="logic-inspector-body">
  {selectedNode?<><span className="logic-eyebrow">SELECTED COMPONENT</span><h3>{SPECS[selectedNode.kind].title}</h3><p>{SPECS[selectedNode.kind].description}</p>
   <label>Label<input aria-label="Component label" value={selectedNode.label} maxLength={120} onChange={e=>change(d=>({...d,nodes:d.nodes.map(n=>n.id===selectedNode.id?{...n,label:e.target.value}:n)}))}/></label>
   <div className="logic-ports"><b>Inputs</b><span>{SPECS[selectedNode.kind].inputs.join(', ')||'None'}</span><b>Outputs</b><span>{SPECS[selectedNode.kind].outputs.join(', ')||'None'}</span></div>
   {(selectedNode.kind==='switch'||selectedNode.kind==='button')&&<label>Initial value<select aria-label="Initial value" value={selectedNode.initial??0} onChange={e=>change(d=>({...d,nodes:d.nodes.map(n=>n.id===selectedNode.id?{...n,initial:Number(e.target.value) as 0|1}:n)}))}><option value="0">LOW (0)</option><option value="1">HIGH (1)</option></select></label>}
   {selectedNode.kind==='clock'&&<><label>Period (ms)<input aria-label="Clock period" type="number" min="100" max="60000" value={selectedNode.period??1000} onChange={e=>{const v=Number(e.target.value);if(v>=100&&v<=60000)change(d=>({...d,nodes:d.nodes.map(n=>n.id===selectedNode.id?{...n,period:v}:n)}));}}/></label><label>Duty cycle (%)<input aria-label="Clock duty cycle" type="number" min="1" max="99" value={selectedNode.duty??50} onChange={e=>{const v=Number(e.target.value);if(v>=1&&v<=99)change(d=>({...d,nodes:d.nodes.map(n=>n.id===selectedNode.id?{...n,duty:v}:n)}));}}/></label></>}
   <div className="logic-inspector-actions"><button onClick={rotate}><RotateCw size={14}/> Rotate</button><button onClick={duplicate}><Copy size={14}/> Duplicate</button><button onClick={remove}><Trash2 size={14}/> Delete</button></div>
  </>:selectedWire?<><span className="logic-eyebrow">SELECTED CONNECTION</span><h3>Wire</h3><p>{selectedWire.fromPin} → {selectedWire.toPin}</p><p>Signal: {stateName[signals[key(selectedWire.from,selectedWire.fromPin)]??'Z']}</p><button onClick={remove}><Trash2 size={14}/> Remove wire</button></>:<><span className="logic-eyebrow">CIRCUIT SETTINGS</span><h3>Document</h3><label>Title<input aria-label="Circuit title" value={doc.title} maxLength={120} onChange={e=>change(d=>({...d,title:e.target.value}))}/></label><label className="logic-check"><input type="checkbox" checked={doc.strict} onChange={e=>change(d=>({...d,strict:e.target.checked}))}/> Strict floating inputs</label>{!doc.strict&&<label>Loose input default<select value={doc.looseDefault} onChange={e=>change(d=>({...d,looseDefault:Number(e.target.value) as 0|1}))}><option value="0">LOW (0)</option><option value="1">HIGH (1)</option></select></label>}<label className="logic-check"><input type="checkbox" checked={doc.grid} onChange={e=>change(d=>({...d,grid:e.target.checked}))}/> Show grid</label><label className="logic-check"><input type="checkbox" checked={doc.snap} onChange={e=>change(d=>({...d,snap:e.target.checked}))}/> Snap to grid</label><p className="logic-help">Strict mode treats unconnected inputs as X. Loose mode uses your chosen 0 or 1 for unconnected and high-impedance inputs. A pin with multiple conflicting drivers resolves to X.</p></>}
 </div>;
 return <div className="logic-app">
 <header className="logic-header"><div className="logic-brand"><button aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={17}/></button><img src="/pico-logo.svg" alt=""/><span>Pico<span className="logic-dot">.</span></span><span className="logic-header-slash">/</span><strong>Logic Simulator</strong></div><div className="logic-header-right"><span className={'logic-save '+saveState}>{saveState==='saved'?<Check size={13}/>:<Save size={13}/>} {saveState==='saved'?'Saved locally':saveState==='error'?'Autosave failed':'Unsaved'}</span><button onClick={()=>{setImporting(true);importRef.current?.click();}}><Upload size={15}/> <span>Import</span></button><button className="logic-primary" onClick={()=>download(JSON.stringify(doc,null,2),filename(doc.title,'.logic.json'),'application/json')}><Download size={15}/><span> Export</span></button><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value='';}}/></div></header>
 <div className="logic-toolbar"><button className="logic-mobile-only" onClick={()=>setPaletteOpen(s=>!s)} aria-label="Toggle components"><Menu size={17}/></button><button className={tool==='select'?'active':''} title="Select / Move" aria-label="Select tool" onClick={()=>setTool('select')}><MousePointer2 size={15}/><span>Select</span></button><button className={tool==='pan'?'active':''} onClick={()=>setTool('pan')} title="Pan"><Hand size={15}/><span>Pan</span></button><i/><button disabled={!history.length} onClick={undo} title="Undo" aria-label="Undo"><Undo2 size={16}/></button><button disabled={!future.length} onClick={redo} title="Redo" aria-label="Redo"><Redo2 size={16}/></button><button disabled={!selection} onClick={remove} title="Delete selection" aria-label="Delete selection"><Trash2 size={16}/></button><button disabled={!selectedNode} onClick={rotate} title="Rotate component" aria-label="Rotate"><RotateCw size={16}/></button><i/><button aria-label="Zoom out" onClick={()=>setZoom(z=>validNumber(z-.15,.35,2.5))}><ZoomOut size={16}/></button><span className="logic-zoom">{Math.round(zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setZoom(z=>validNumber(z+.15,.35,2.5))}><ZoomIn size={16}/></button><button title="Fit circuit" onClick={fit} aria-label="Fit circuit"><Maximize size={16}/></button><i/><button onClick={()=>setTruthVisible(v=>!v)} className={truthVisible?'active':''}>Truth table</button><button onClick={()=>setInspectorOpen(v=>!v)} className="logic-mobile-only">Properties</button></div>
 <div className="logic-main">
 <aside className={'logic-palette '+(paletteOpen?'mobile-open':'')} aria-label="Component palette"><div className="logic-pane-heading"><b>COMPONENTS</b><button className="logic-mobile-only" aria-label="Close components" onClick={()=>setPaletteOpen(false)}><X size={16}/></button></div><div className="logic-palette-scroll">{GROUPS.map(group=><section key={group}><button className="logic-group" onClick={()=>setGroupOpen(g=>g.includes(group)?g.filter(x=>x!==group):[...g,group])}><span>{group}</span><ChevronDown size={15} className={groupOpen.includes(group)?'':'collapsed'}/></button>{groupOpen.includes(group)&&<div className="logic-component-list">{(Object.keys(SPECS) as ComponentKind[]).filter(k=>SPECS[k].group===group).map(kind=><button key={kind} draggable onDragStart={event=>event.dataTransfer.setData('text/pico-logic',kind)} className={'logic-part '+(placement===kind?'active':'')} onClick={()=>{setPlacement(kind);setStatus('Click on the canvas to place '+SPECS[kind].title+'.');setPaletteOpen(false);}}><span className="logic-part-symbol">{kind==='lamp'?'◉':kind==='clock'?'∿':kind==='switch'?'⇄':kind==='hex'?'▣':kind==='label'?'T':kind==='not'?'¬':kind==='and'?'&':kind==='xor'?'⊕':'▱'}</span><span>{SPECS[kind].title}</span><Plus size={12}/></button>)}</div>}</section>)}</div><div className="logic-palette-tip">Click a component, then click the grid to place it. Connect output pins to input pins.</div></aside>
 <section className="logic-workarea" aria-label="Circuit workspace">
  <div className="logic-board" role="region" aria-label="Digital circuit canvas"><svg ref={boardRef} aria-label="Circuit canvas" tabIndex={0} onWheel={e=>{if(e.ctrlKey){e.preventDefault();setZoom(z=>validNumber(z+(e.deltaY<0?.08:-.08),.35,2.5));}}} onPointerDown={e=>{if(e.target===boardRef.current||(e.target as Element).classList.contains('logic-surface')){if(tool==='pan'||e.button===1)setInteraction({type:'pan',x:e.clientX,y:e.clientY,origX:offset.x,origY:offset.y});canvasClick(e);}}} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={pointerUp} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const k=e.dataTransfer.getData('text/pico-logic');if(Object.hasOwn(SPECS,k)){const p=canvasPoint(e);addNode(k as ComponentKind,p.x-61,p.y-39);}}} style={{touchAction:'none'}}>
  <defs><pattern id="logic-grid" width={24*zoom} height={24*zoom} x={offset.x} y={offset.y} patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#545566" opacity=".45"/></pattern><marker id="logic-arrow" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6Z" fill="#85879a"/></marker></defs>
  <rect className="logic-surface" width="100%" height="100%" fill={doc.grid?'url(#logic-grid)':'transparent'}/>
  <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
  {doc.wires.map(w=>{const from=doc.nodes.find(n=>n.id===w.from),to=doc.nodes.find(n=>n.id===w.to);if(!from||!to)return null;const a=portPosition(from,w.fromPin,'out'),b=portPosition(to,w.toPin,'in');const mx=(a.x+b.x)/2;const path=`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;const signal=signals[key(w.from,w.fromPin)]??'Z';return <g key={w.id} role="button" aria-label={`Wire ${w.fromPin} to ${w.toPin}, ${stateName[signal]}`} onPointerDown={e=>{e.stopPropagation();setSelection({type:'wire',id:w.id});setSelectedNodes([]);setInspectorOpen(true);}}><path d={path} fill="none" stroke="transparent" strokeWidth="16"/><path d={path} className={'logic-wire '+signalClass(signal)+(selection?.type==='wire'&&selection.id===w.id?' selected':'')} strokeWidth={selection?.type==='wire'&&selection.id===w.id?5:3} fill="none"/><title>{stateName[signal]} ({String(signal)})</title></g>;})}
  {doc.nodes.map(node=>{const spec=SPECS[node.kind],height=nodeHeight(node),selected=selection?.type==='node'&&selection.id===node.id||selectedNodes.includes(node.id),output=spec.outputs[0]?signals[key(node.id,spec.outputs[0])]??'Z':'Z',lamp=signals[key(node.id,'IN')]??'Z',hex=spec.inputs.map(pin=>signals[key(node.id,pin)]??'X'),hexValue=hex.some(b=>b!==0&&b!==1)?'X':parseInt(hex.join(''),2).toString(16).toUpperCase();return <g key={node.id} className={'logic-node '+(selected?'selected':'')} onPointerDown={e=>startMove(e,node)} onDoubleClick={e=>{e.stopPropagation();if(node.kind==='switch')toggleInput(node);}} style={{cursor:'move'}}>
  <g transform={`translate(${node.x+NODE_WIDTH/2} ${node.y+height/2}) rotate(${node.rotation}) translate(${-NODE_WIDTH/2} ${-height/2})`}><rect className="logic-node-body" width={NODE_WIDTH} height={height} rx="8"/><text className="logic-node-kind" x={NODE_WIDTH/2} y="20" textAnchor="middle">{node.label||spec.title}</text>
  {(node.kind==='switch'||node.kind==='button')?<foreignObject x="29" y="27" width="64" height="37"><button className={'logic-switch '+signalClass(output)} onPointerDown={e=>e.stopPropagation()} onClick={()=>toggleInput(node)} onPointerUp={e=>{if(node.kind==='button'){e.stopPropagation();toggleInput(node,0);}}} onPointerDownCapture={()=>{if(node.kind==='button')toggleInput(node,1);}} aria-label={node.kind==='button'?'Press and hold button':'Toggle switch'}>{String(output)}</button></foreignObject>:node.kind==='lamp'?<g><circle cx={NODE_WIDTH/2} cy="49" r="17" className={'logic-lamp '+signalClass(lamp)}/><text className="logic-value" x={NODE_WIDTH/2} y="54" textAnchor="middle">{String(lamp)}</text></g>:node.kind==='hex'?<text className="logic-hex" x={NODE_WIDTH/2} y="77" textAnchor="middle">{hexValue}</text>:<text className="logic-node-glyph" x={NODE_WIDTH/2} y={Math.max(56,height-17)} textAnchor="middle">{node.kind==='clock'?'∿':node.kind==='xor'?'⊕':node.kind==='not'?'¬':node.kind==='and'||node.kind==='nand'?'&':node.kind==='or'||node.kind==='nor'?'≥1':node.kind.endsWith('ff')||node.kind==='sr'?'Q':node.kind==='label'?'T':String(output)}</text>}
  </g>
  {(['in','out'] as const).flatMap(direction=>spec[direction==='in'?'inputs':'outputs'].map(pin=>{const pos=portPosition(node,pin,direction),isTarget=connecting&&direction==='in'&&isWireValid(doc,{id:'preview',from:connecting.id,fromPin:connecting.pin,to:node.id,toPin:pin})===null;const sig=signals[key(node.id,pin)]??'Z';return <g key={direction+pin} className="logic-port" onPointerDown={e=>{e.stopPropagation();if(direction==='out'){setConnecting({id:node.id,pin});setStatus('Choose an input pin to connect '+pin+'.');}else if(connecting)attemptConnect(node.id,pin);}}><circle cx={pos.x} cy={pos.y} r={9} className={'logic-port-hit '+(isTarget?'target':'')}/><circle cx={pos.x} cy={pos.y} r={5} className={'logic-port-dot '+signalClass(sig)}/><text x={pos.x+(direction==='in'?13:-13)} y={pos.y-10} textAnchor={direction==='in'?'start':'end'} className="logic-port-label">{pin}</text><title>{direction==='in'?'Input':'Output'} {pin}: {stateName[sig]}</title></g>;}))}
  </g>;})}
  {connecting&&pointer&&(()=>{const source=doc.nodes.find(n=>n.id===connecting.id);if(!source)return null;const p=portPosition(source,connecting.pin,'out');return <path d={`M${p.x},${p.y} L${pointer.x},${pointer.y}`} stroke="#aca4ff" strokeWidth="2" strokeDasharray="8 5" fill="none" pointerEvents="none"/>;})()}
  </g></svg>
  {showWelcome&&doc.nodes.length===0&&<div className="logic-welcome"><span className="logic-welcome-mark">◇</span><h2>Build your first circuit</h2><p>Place logic gates, connect pins, and watch signals move through your circuit.</p><button className="logic-primary" onClick={()=>{setShowWelcome(false);setPlacement('switch');}}>Start blank <Plus size={14}/></button><span>Or open a working example</span><div className="logic-sample-buttons">{SAMPLES.map(s=><button key={s.id} onClick={()=>load(s.id)}>{s.title}</button>)}</div></div>}
  {placement&&<div className="logic-placement-hint">Placing {SPECS[placement].title} <button onClick={()=>setPlacement(null)}>Cancel <X size={12}/></button></div>}
  {connecting&&<div className="logic-placement-hint">Connect to an input pin <button onClick={()=>setConnecting(null)}>Cancel <X size={12}/></button></div>}
  </div>
  <div className="logic-bottom"><div><span className={'logic-run-dot '+(running?'active':'')}/><span>{running?'RUNNING':'PAUSED'}</span><span>{doc.nodes.length} components · {doc.wires.length} wires</span></div><div className="logic-sim-controls"><button onClick={()=>setRunning(r=>!r)} className="logic-run">{running?<Pause size={15}/>:<Play size={15}/>} {running?'Pause':'Run'}</button><button title="Step next clock transition" onClick={()=>{setRunning(false);setSimulation(s=>stepSimulation(docRef.current,s).state);}}><StepForward size={16}/> Step</button><button onClick={reset}><RotateCw size={14}/> Reset</button><span>{Math.round(simulation.time)} ms</span></div></div>
  <div className="logic-status" role="status">{status}</div>
  {truthVisible&&<div className="logic-truth"><div className="logic-truth-head"><b>Truth table</b><div>{truth?.data&&<button onClick={()=>download(truthTableCSV(truth.data!),filename(doc.title,'-truth.csv'),'text/csv')}>Export CSV</button>}<button aria-label="Close truth table" onClick={()=>setTruthVisible(false)}><X size={16}/></button></div></div>{truth?.error?<p>{truth.error}</p>:truth?.data?<div className="logic-truth-scroll"><table><thead><tr>{truth.data.headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{truth.data.rows.map((row,i)=><tr key={i}>{row.map((value,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table></div>:null}</div>}
 </section>
 <aside className={'logic-inspector '+(inspectorOpen?'mobile-open':'')}><div className="logic-pane-heading"><b>PROPERTIES</b><button className="logic-mobile-only" onClick={()=>setInspectorOpen(false)} aria-label="Close properties"><X size={16}/></button></div>{inspectorContent}<div className="logic-samples-panel"><div className="logic-eyebrow">EXAMPLE CIRCUITS</div>{activeSample&&<button onClick={()=>{setDoc(loadSample(activeSample));setSimulation(initialSimulation());setRunning(false);setStatus('Sample reset to its original state.');}}><b>Reset sample</b><small>Restore the initial circuit and inputs</small></button>}{SAMPLES.map(sample=><button key={sample.id} onClick={()=>load(sample.id)}><b>{sample.title}</b><small>{sample.description}</small></button>)}<button onClick={fresh}><b>New blank circuit</b><small>Create a fresh workspace</small></button></div></aside>
 </div>
 <footer className="statusbar logic-footer"><Credits logic /></footer>
 {importing&&<button className="logic-import-close" onClick={()=>setImporting(false)}>Cancel import</button>}
 </div>;
}

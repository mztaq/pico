import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Download,Pause,Play,RefreshCw,Settings2,StepForward,Upload,X} from 'lucide-react';
import {Credits} from '../app/components/HomeScreen';
import {ThemePicker} from '../app/components/ThemePicker';
import {cssVariables,getTheme} from '../app/themes';
import {loadSettings,saveSettings} from '../storage/settings';
import {useExitWarning} from '../app/components/useExitWarning';
import {assemble,AssemblyError,binary4,binary8,DEFAULT_PROGRAM,type AssemblyImage} from './assembler';
import {boot,step,type Machine,type Register} from './engine';
import './cpu.css';

const STORAGE='pico.cpu.source.v1';
function assembleSafe(source:string):AssemblyImage|null{try{return assemble(source);}catch{return null;}}
const EXAMPLES=[
 {name:'Add two values',code:DEFAULT_PROGRAM},
 {name:'Load and store',code:'LDA INPUT\nSTA RESULT\nHLT\n.ORG 0101\nINPUT: DAT 13\nRESULT: DAT 0'},
 {name:'Branch if zero',code:'LDI 0\nBRZ FINISH\nLDI 9\nFINISH: STA RESULT\nHLT\n.ORG 1111\nRESULT: DAT 0'},
 {name:'8-bit wraparound',code:'LDA FIRST\nADD SECOND\nSTA RESULT\nHLT\n.ORG 0101\nFIRST: DAT 250\nSECOND: DAT 10\nRESULT: DAT 0'},
];
const DETAILS:Record<string,string>={
 PC:'Program Counter: address of the next instruction.',MAR:'Memory Address Register: the address used for a read or write.',MDR:'Memory Data Register: transfers data or instructions to and from RAM.',CIR:'Current Instruction Register: stores the instruction being decoded and executed.',ACC:'Accumulator: holds input values and arithmetic results.',ALU:'Arithmetic Logic Unit: performs additions and subtractions.',CU:'Control Unit: coordinates instruction decoding and sends control signals.',RAM:'Main memory: instructions and program data share the same address space (Von Neumann).',
};
const POS:Record<Register,{x:number;y:number}>={
 PC:{x:125,y:103},MAR:{x:125,y:173},MDR:{x:330,y:173},CIR:{x:330,y:103},
 ACC:{x:330,y:246},ALU:{x:125,y:246},CU:{x:230,y:326},RAM:{x:635,y:174},
};
const BUSES={address:{x1:175,y1:174,x2:579,y2:174},data:{x1:381,y1:202,x2:579,y2:202},control:{x1:275,y1:328,x2:581,y2:233}};
function tone(phase:string){return phase==='error'?'bad':phase==='halted'?'done':phase==='execute'?'execute':phase==='decode'?'decode':phase==='fetch'?'fetch':'ready';}
function unitTime(ghz:number){return Math.max(180,Math.min(1400,Math.round(1750/(ghz+0.7))));}
/** GHz is illustrative: it scales the animation rate, not real nanosecond CPU timing. */
export function CpuStudio({onHome}:{onHome:()=>void}){
 const [source,setSource]=useState(()=>{try{return localStorage.getItem(STORAGE)??DEFAULT_PROGRAM;}catch{return DEFAULT_PROGRAM;}});
 const [themeName,setThemeName]=useState(()=>loadSettings().theme);
 const theme=getTheme(themeName);
 const [themeOpen,setThemeOpen]=useState(false);
 const [tutorial,setTutorial]=useState(false);
 const [ghz,setGhz]=useState(2.5);
 const [playing,setPlaying]=useState(false);
 const [selected,setSelected]=useState<Register|'address'|'data'|'control'>('PC');
 const [notice,setNotice]=useState('');
 const [image,setImage]=useState<AssemblyImage>(()=>assemble(DEFAULT_PROGRAM));
 const [machine,setMachine]=useState<Machine>(()=>boot(assemble(DEFAULT_PROGRAM)));
 const [lastStep,setLastStep]=useState(0);
 const [sourceError,setSourceError]=useState<AssemblyError|null>(null);
 const machineRef=useRef(machine);machineRef.current=machine;
 const importRef=useRef<HTMLInputElement>(null);
 const markExported=useExitWarning(source);
 const activeFrame=machine.frame;
 const active=activeFrame.active;
 const running=playing&&!machine.halted;
 useEffect(()=>{try{localStorage.setItem(STORAGE,source);}catch{/* Export remains available. */}},[source]);
 useEffect(()=>{const settings=loadSettings();saveSettings({...settings,theme:themeName});for(const [k,v] of Object.entries(cssVariables(theme)))document.documentElement.style.setProperty(k,v);document.documentElement.style.colorScheme=theme.appearance;},[themeName,theme]);
 const load=useCallback((code=source)=>{
  try{const compiled=assemble(code);setImage(compiled);setMachine(boot(compiled));setSourceError(null);setPlaying(false);setLastStep(x=>x+1);setNotice('Assembled '+compiled.memory.filter(c=>c.kind==='instruction').length+' instructions. Ready to run.');return true;}
  catch(error){setSourceError(error as AssemblyError);setPlaying(false);setNotice('Fix the assembly error before running.');return false;}
 },[source]);
 const next=useCallback(()=>{setMachine(current=>step(current));setLastStep(n=>n+1);},[]);
 useEffect(()=>{if(!running)return;const id=window.setInterval(()=>{const m=machineRef.current;if(m.halted){setPlaying(false);return;}if(m.cycles>=10000){setPlaying(false);setNotice('Execution paused after 10,000 micro-steps. Possible infinite loop.');return;}const progressed=step(m);machineRef.current=progressed;setMachine(progressed);setLastStep(x=>x+1);},unitTime(ghz));return()=>window.clearInterval(id);},[running,ghz]);
 useEffect(()=>{if(machine.halted)setPlaying(false);},[machine.halted]);
 function run(){if(source!==image.code&&!load())return;setPlaying(true);}
 function single(){if(source!==image.code){const compiled=assembleSafe(source);if(!compiled){load();return;}setImage(compiled);setSourceError(null);setPlaying(false);setMachine(step(boot(compiled)));setLastStep(x=>x+1);return;}next();}
 function reset(){setMachine(boot(image));setPlaying(false);setLastStep(x=>x+1);setNotice('Registers and memory restored to the assembled program.');}
 function exportFile(){const file=new Blob([source],{type:'text/plain'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='cpu-studio.asm';a.click();URL.revokeObjectURL(url);markExported();}
 async function importFile(file:File){const content=await file.text();if(content.length>16000){setNotice('File exceeds 16,000 characters.');return;}setSource(content);setPlaying(false);setNotice('Assembly loaded. Select Assemble.');}
 const transfer=activeFrame.transfer;
 const from=transfer?POS[transfer.from]:undefined;
 const to=transfer?POS[transfer.to]:undefined;
 const focused=selected in POS?DETAILS[selected]:({address:'Address bus: MAR sends a memory location address toward RAM.',data:'Data bus: RAM and MDR exchange binary instructions or values in either direction.',control:'Control bus: CU sends READ or WRITE requests and receives status signals.'} as Record<string,string>)[selected];
 return <div className="cpu-app" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
  <header className="cpu-topbar"><div className="cpu-identity"><button aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={17}/></button><img src="/pico-logo.svg" alt=""/><b>Pico<span>.</span></b><i>/</i><strong>CPU Studio</strong></div>
   <div className="cpu-header-actions"><button onClick={()=>setTutorial(true)}><BookOpen size={15}/> Guide</button><button aria-label="Choose theme" onClick={()=>setThemeOpen(v=>!v)}><Settings2 size={15}/> Themes</button><button onClick={()=>importRef.current?.click()}><Upload size={15}/> Import</button><button onClick={exportFile}><Download size={15}/> Export</button></div>
   <input ref={importRef} type="file" hidden accept=".asm,.txt,text/plain" onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value='';}}/>
  </header>
  <div className="cpu-toolbar">
   <button className="cpu-assemble" onClick={()=>load()}><RefreshCw size={15}/> Assemble</button>
   <button onClick={single} disabled={playing||machine.halted} aria-label="Step one micro-operation"><StepForward size={16}/> Step</button>
   <button className="cpu-run" onClick={playing?()=>setPlaying(false):run} disabled={machine.halted}>{playing?<><Pause size={15}/> Pause</>:<><Play size={15}/> Run</>}</button>
   <button onClick={reset}><RefreshCw size={15}/> Reset</button>
   <div className="cpu-toolbar-separator"/>
   <label className="cpu-speed">Clock <strong>{ghz.toFixed(1)} GHz</strong><input aria-label="CPU clock speed GHz" type="range" min="0.5" max="5" step=".5" value={ghz} onChange={e=>setGhz(Number(e.target.value))}/></label>
   <span className="cpu-clock-note">Illustrative GHz · adjusts playback speed</span>
   <span className="cpu-counter">Cycle {machine.cycles} · Instructions {machine.instructions}</span>
  </div>
  <div className="cpu-body">
   <aside className="cpu-editor"><div className="cpu-pane-head"><strong>ASSEMBLY EDITOR</strong><small>8-bit · 16 RAM cells</small></div>
    <textarea aria-label="Assembly source code" spellCheck={false} value={source} onChange={e=>{setSource(e.target.value);setSourceError(null);setPlaying(false);}}/>
    <div className="cpu-error" role={sourceError?'alert':undefined}>{sourceError?sourceError.message:'One instruction per line. Use labels, DAT and .ORG to set RAM.'}</div>
    <div className="cpu-section-label">EXAMPLE PROGRAMS</div><div className="cpu-samples">{EXAMPLES.map(example=><button key={example.name} onClick={()=>{setSource(example.code);load(example.code);}}>{example.name}</button>)}</div>
    <div className="cpu-isa"><b>INSTRUCTION SET</b><dl>{[['0000','LDA','Load RAM → ACC'],['0001','STA','Store ACC → RAM'],['0010','ADD','Add RAM to ACC'],['0011','HLT','Stop'],['0100','SUB','Subtract'],['0101','BRA','Branch'],['0110','BRZ','Branch if zero'],['0111','LDI','Load immediate']].map(([bits,op,desc])=><div key={op}><dt><code>{bits}</code> <strong>{op}</strong></dt><dd>{desc}</dd></div>)}</dl><small>The first four opcodes follow the slides. Extras are Pico teaching extensions.</small></div>
   </aside>
   <main className="cpu-stage"><div className="cpu-pane-head"><strong>VON NEUMANN ARCHITECTURE</strong><small>Click any register, bus or memory unit to learn its role</small></div>
    <div className={'cpu-visual cpu-'+tone(activeFrame.phase)}>
     <svg viewBox="0 0 780 425" role="img" aria-label="Live CPU architecture with control unit, ALU, PC, MAR, MDR, CIR, accumulator and RAM">
      <defs><marker id="cpu-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="var(--accent)"/></marker></defs>
      <rect className="cpu-unit-outline" x="38" y="36" width="443" height="337" rx="17"/><text className="cpu-legend" x="56" y="58">CENTRAL PROCESSING UNIT (CPU)</text>
      <rect className="cpu-memory-outline" x="568" y="89" width="182" height="202" rx="14"/><text className="cpu-legend" x="588" y="110">MAIN MEMORY (RAM)</text>
      {Object.entries(BUSES).map(([key,pos])=><g key={key} className={'cpu-bus cpu-bus-'+key+(transfer?.bus===key?' is-active':'')} onClick={()=>setSelected(key as 'address'|'data'|'control')} role="button" tabIndex={0} aria-label={key+' bus'}><line x1={pos.x1} y1={pos.y1} x2={pos.x2} y2={pos.y2} /><circle cx={pos.x2} cy={pos.y2} r="4"/><text x="508" y={pos.y2-8}>{key.toUpperCase()} BUS</text></g>)}
      {([[125,103,330,103],[125,173,330,173],[125,246,330,246],[230,305,230,240]] as number[][]).map(([x,y,xx,yy],i)=><line className="cpu-internal" key={i} x1={x} y1={y} x2={xx} y2={yy}/>)}
      {(Object.entries(POS) as [Register,{x:number;y:number}][]).filter(([key])=>key!=='RAM').map(([key,pos])=><g key={key} className={'cpu-register '+(active.includes(key)?'cpu-lit ':'')+(selected===key?'cpu-picked':'')} role="button" tabIndex={0} aria-label={DETAILS[key]} onClick={()=>setSelected(key)} onKeyDown={e=>{if(e.key==='Enter')setSelected(key);}}><rect x={pos.x-73} y={pos.y-26} width="146" height="53" rx="7"/><text className="cpu-register-label" x={pos.x} y={pos.y-9}>{key==='ACC'?'ACCUMULATOR':key==='CU'?'CONTROL UNIT':key==='ALU'?'ALU':key}</text><text className="cpu-register-value" x={pos.x} y={pos.y+12}>{key==='CU'?'READ · DECODE':key==='ALU'?binary8(machine.alu):key==='PC'||key==='MAR'?binary4(machine[key.toLowerCase() as 'pc'|'mar']):binary8(machine[key.toLowerCase() as 'mdr'|'cir'|'acc'])}</text></g>)}
      <g className={'cpu-ram-unit '+(active.includes('RAM')?'cpu-lit':'')} role="button" tabIndex={0} onClick={()=>setSelected('RAM')}><rect x="584" y="121" width="151" height="156" rx="7"/>{[0,1,2,3,4].map(i=><g key={i}><text x="599" y={144+i*26}>{binary4(i)}</text><text x="722" y={144+i*26} textAnchor="end">{binary8(machine.memory[i]!)}</text></g>)}<text x="659" y="266" textAnchor="middle">… 16 CELLS</text></g>
      {transfer&&from&&to&&<g key={lastStep} className={'cpu-packet-track bus-'+transfer.bus}><path d={'M '+from.x+' '+from.y+' Q '+((from.x+to.x)/2)+' '+(Math.min(from.y,to.y)-40)+' '+to.x+' '+to.y} className="cpu-packet-path"/><g className="cpu-moving" style={{animationDuration:Math.max(.15,unitTime(ghz)/1000*.85)+'s'}}><circle r="8"/><text textAnchor="middle" y="-14">{transfer.value}</text><animateMotion dur={Math.max(.15,unitTime(ghz)/1000*.85)+'s'} fill="freeze" path={'M '+from.x+' '+from.y+' Q '+((from.x+to.x)/2)+' '+(Math.min(from.y,to.y)-40)+' '+to.x+' '+to.y}/></g></g>}
      <text className="cpu-svg-caption" x="390" y="402" textAnchor="middle">One Step = one micro-operation, not a complete instruction</text>
     </svg>
    </div>
    <section className="cpu-step-detail"><div className="cpu-phase-row"><span className={'cpu-phase cpu-phase-'+tone(activeFrame.phase)}>{activeFrame.phase.toUpperCase()}</span><strong>{activeFrame.description}</strong></div>{transfer&&<p><b>{transfer.from} → {transfer.to}</b> · {transfer.bus} bus · {transfer.value}</p>}<div className="cpu-component-explain"><strong>{selected.toUpperCase()}</strong> {focused}</div></section>
    <div className="cpu-pane-head cpu-memory-head"><strong>RAM CONTENTS</strong><small>Instruction and data share one memory</small></div>
    <div className="cpu-memory-grid">{machine.memory.map((value,address)=><div key={address} className={'cpu-memory-cell '+(machine.mar===address&&activeFrame.phase!=='ready'?'cpu-addressed':'')+(image.memory[address]?.kind==='instruction'?' cpu-instruction':'')} title={image.memory[address]?.text||'Empty memory'}><small>{binary4(address)} <span>{image.memory[address]?.kind==='instruction'?'INS':image.memory[address]?.kind==='data'?'DAT':'—'}</span></small><b>{binary8(value)}</b><span>{image.memory[address]?.text||'—'}</span></div>)}</div>
   </main>
  </div>
  <div className="cpu-status" role="status">{notice||'Ready for CPU simulation.'}<span>{machine.error?'Execution stopped: '+machine.error:machine.halted?'CPU halted.':playing?'Running micro-operations.':'Paused / ready.'}</span></div>
  <footer className="cpu-footer"><Credits/></footer>
  {themeOpen&&<div className="cpu-overlay" role="dialog" aria-label="Choose CPU Studio theme"><div className="cpu-dialog"><div className="cpu-dialog-title"><b>Theme</b><button aria-label="Close theme picker" onClick={()=>setThemeOpen(false)}><X size={17}/></button></div><ThemePicker value={themeName} onChange={id=>setThemeName(id)}/></div></div>}
  {tutorial&&<div className="cpu-overlay" role="dialog" aria-modal="true" aria-label="CPU Studio tutorial"><div className="cpu-dialog cpu-guide"><div className="cpu-dialog-title"><b>CPU Studio · Quick Guide</b><button aria-label="Close CPU tutorial" onClick={()=>setTutorial(false)}><X size={17}/></button></div><p>Write instructions in the editor, then select <b>Assemble</b>. The CPU and RAM diagram follows the stored-program architecture in your Cambridge CPU lessons.</p><p><b>Step</b> advances one operation: PC → MAR → address bus → control READ → RAM → MDR → CIR → increment PC → decode → execute.</p><p><b>Run</b> animates consecutive steps. Pause or Reset anytime. Change the GHz slider to adjust how quickly the simulation plays, not actual CPU time.</p><p>Try the supplied addition program: 3 + 5 is stored as 8 at address 0111. Hover over RAM cells to inspect the original source lines.</p><button className="cpu-run" onClick={()=>setTutorial(false)}>Start learning</button></div></div>}
 </div>;
}

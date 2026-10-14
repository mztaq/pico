import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Cpu,Gauge,Pause,Play,RotateCcw,Settings2,StepForward,X} from 'lucide-react';
import {Credits} from '../app/components/HomeScreen';
import {ThemePicker} from '../app/components/ThemePicker';
import {cssVariables,getTheme} from '../app/themes';
import {loadSettings,saveSettings} from '../storage/settings';
import {assemble,binary4,binary8,DEFAULT_PROGRAM} from './assembler';
import {boot,step,type Machine,type Register} from './engine';
import {CpuTutorial,CPU_TUTORIAL_KEY} from './CpuTutorial';
import './cpu.css';

export type CpuMode='fetch-decode'|'fetch-decode-execute';
const DEFAULT_IMAGE=assemble(DEFAULT_PROGRAM);
const POINTS:Record<Register,{x:number;y:number}>={
 PC:{x:122,y:116},MAR:{x:631,y:115},MDR:{x:629,y:341},
 CIR:{x:396,y:447},ACC:{x:394,y:225},ALU:{x:396,y:334},
 CU:{x:629,y:480},RAM:{x:940,y:300},
};
const LABELS:Record<Register,string>={
 PC:'Program Counter (PC)',MAR:'Memory Address Register (MAR)',
 MDR:'Memory Data Register (MDR)',CIR:'Current Instruction Register (CIR)',
 ACC:'Accumulator (ACC)',ALU:'Arithmetic Logic Unit (ALU)',
 CU:'Control Unit (CU)',RAM:'Main memory (RAM)',
};
const HELP:Record<Register|string,string>={
 PC:'Holds the address of the next instruction. After fetching, the PC increments.',
 MAR:'Holds the memory address that the processor needs to access.',
 MDR:'Holds an instruction or data transferred to or from main memory.',
 CIR:'Holds the current instruction so the control unit can decode it.',
 ACC:'Stores a value being processed and receives the result from the ALU.',
 ALU:'Performs arithmetic and logical operations on data held by the CPU.',
 CU:'Decodes instructions and sends signals to coordinate the CPU, registers and buses.',
 RAM:'Stores program instructions and data together, as in Von Neumann architecture.',
 CACHE:'Fast memory close to the CPU that stores frequently used instructions or data. Shown for syllabus context; not simulated here.',
 DECODE:'Interprets the instruction held in CIR and tells the CPU what operation to perform.',
 ADDRESS:'The address bus carries the location of a memory cell from the CPU to RAM.',
 DATA:'The data bus carries instructions and values between the CPU and RAM in both directions.',
 CONTROL:'The control bus carries control signals such as READ and WRITE.',
};
export function waitForStep(ghz:number){return Math.round(1700/(ghz+1));}
export function shouldStopAtDecode(mode:CpuMode,m:Machine){return mode==='fetch-decode'&&m.micro===8;}
const BOXES:{key:Register|'DECODE'|'CACHE';x:number;y:number;w:number;h:number;label:string;value:(m:Machine)=>string}[]=[
 {key:'PC',x:45,y:64,w:158,h:106,label:'Program Counter',value:m=>binary4(m.pc)},
 {key:'MAR',x:548,y:64,w:160,h:102,label:'Memory Address Register',value:m=>binary4(m.mar)},
 {key:'DECODE',x:45,y:185,w:247,h:241,label:'Decode Unit',value:m=>m.frame.phase==='decode'?'DECODING':'CONTROLLED BY CU'},
 {key:'ACC',x:315,y:184,w:165,h:81,label:'Accumulator',value:m=>binary8(m.acc)},
 {key:'ALU',x:315,y:283,w:165,h:102,label:'Arithmetic Logic Unit',value:m=>binary8(m.alu)},
 {key:'CIR',x:315,y:401,w:165,h:89,label:'Current Instruction Register',value:m=>binary8(m.cir)},
 {key:'CACHE',x:45,y:443,w:247,h:88,label:'Cache',value:()=>'CPU CACHE'},
 {key:'MDR',x:548,y:290,w:160,h:102,label:'Memory Data Register',value:m=>binary8(m.mdr)},
 {key:'CU',x:548,y:424,w:160,h:107,label:'Control Unit',value:m=>m.frame.signal??'DECODE / CONTROL'},
];
export function CpuStudio({onHome}:{onHome:()=>void}){
 const [mode,setMode]=useState<CpuMode>('fetch-decode-execute');
 const [machine,setMachine]=useState<Machine>(()=>boot(DEFAULT_IMAGE));
 const [playing,setPlaying]=useState(false);
 const [selected,setSelected]=useState<string>('PC');
 const [clock,setClock]=useState(2);
 const [themeId,setThemeId]=useState(()=>loadSettings().theme);
 const [themeOpen,setThemeOpen]=useState(false);
 const [tourStep,setTourStep]=useState<number|null>(()=>{
  try{return localStorage.getItem(CPU_TUTORIAL_KEY)==='done'?null:0;}catch{return 0;}
 });
 const [stepKey,setStepKey]=useState(0);
 const machineRef=useRef(machine);machineRef.current=machine;
 const theme=getTheme(themeId);
 const active=machine.frame.active;
 const transfer=machine.frame.transfer;
 const modeDone=shouldStopAtDecode(mode,machine)||machine.halted;
 const isRunning=playing&&!modeDone;
 useEffect(()=>{const previous=loadSettings();saveSettings({...previous,theme:themeId});for(const [k,v] of Object.entries(cssVariables(theme)))document.documentElement.style.setProperty(k,v);document.documentElement.style.colorScheme=theme.appearance;},[theme,themeId]);
 useEffect(()=>{if(!isRunning)return;const interval=window.setInterval(()=>{
  const current=machineRef.current;
  if(shouldStopAtDecode(mode,current)||current.halted){setPlaying(false);return;}
  const next=step(current);
  machineRef.current=next;setMachine(next);setStepKey(n=>n+1);
  if(shouldStopAtDecode(mode,next)||next.halted)setPlaying(false);
 },waitForStep(clock));return()=>window.clearInterval(interval);},[isRunning,mode,clock]);
 useEffect(()=>{if(modeDone)setPlaying(false);},[modeDone]);
 function reset(nextMode=mode){setMode(nextMode);setPlaying(false);const fresh=boot(DEFAULT_IMAGE);machineRef.current=fresh;setMachine(fresh);setStepKey(n=>n+1);}
 function advance(){
  if(playing||modeDone)return;
  const next=step(machineRef.current);machineRef.current=next;setMachine(next);setStepKey(n=>n+1);
 }
 function finishTutorial(){setTourStep(null);try{localStorage.setItem(CPU_TUTORIAL_KEY,'done');}catch{/* Tutorial still closes. */}}
 const transferFrom=transfer?POINTS[transfer.from]:null,transferTo=transfer?POINTS[transfer.to]:null;
 const route=transferFrom&&transferTo?'M '+transferFrom.x+' '+transferFrom.y+' C '+((transferFrom.x+transferTo.x)/2)+' '+transferFrom.y+', '+((transferFrom.x+transferTo.x)/2)+' '+transferTo.y+', '+transferTo.x+' '+transferTo.y:'';
 const phase=machine.frame.phase;
 return <div className="cpu-app" style={cssVariables(theme) as React.CSSProperties} data-pico-theme={theme.id}>
  <header className="cpu-topbar">
   <div className="cpu-brand"><button aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={16}/></button><img src="/pico-logo.svg" alt=""/><b>Pico<span>.</span></b><i>/</i><strong>CPU Studio</strong></div>
   <div className="cpu-actions"><button aria-label="Open CPU Studio tutorial" onClick={()=>{setPlaying(false);setTourStep(0);}}><BookOpen size={15}/> Tutorial</button><button aria-label="Choose CPU Studio theme" onClick={()=>setThemeOpen(true)}><Settings2 size={15}/> Theme</button></div>
  </header>
  <div className="cpu-controls">
   <fieldset className="cpu-mode-switch" data-cpu-tour="modes"><legend>SIMULATION</legend>
    <label><input type="radio" name="cpu-mode" checked={mode==='fetch-decode'} onChange={()=>reset('fetch-decode')}/> Fetch–Decode</label>
    <label><input type="radio" name="cpu-mode" checked={mode==='fetch-decode-execute'} onChange={()=>reset('fetch-decode-execute')}/> Fetch–Decode–Execute</label>
   </fieldset>
   <div className="cpu-playback" data-cpu-tour="controls">
    <button aria-label="Step one CPU micro-operation" onClick={advance} disabled={playing||modeDone}><StepForward size={16}/> Step</button>
    <button className="cpu-play" onClick={()=>setPlaying(v=>!v)} disabled={modeDone}>{playing?<><Pause size={16}/> Pause</>:<><Play size={16}/> Run</>}</button>
    <button onClick={()=>reset()}><RotateCcw size={16}/> Reset</button>
   </div>
   <label className="cpu-speed" data-cpu-tour="speed"><Gauge size={17}/><span>Playback speed <strong>{clock.toFixed(1)} GHz</strong></span><input aria-label="Illustrative CPU clock speed GHz" type="range" min="0.5" max="5" step=".5" value={clock} onChange={e=>setClock(Number(e.target.value))}/></label>
   <span className="cpu-counter">Step {machine.cycles} · {machine.instructions} instruction(s)</span>
  </div>
  <main className="cpu-content">
   <div className="cpu-heading"><Cpu size={17}/><strong>CPU architecture</strong><span>Von Neumann · Cambridge IGCSE</span></div>
   <div className="cpu-diagram-scroll" data-cpu-tour="diagram">
    <svg className="cpu-diagram" viewBox="0 0 1085 558" role="img" aria-label="CPU architectural diagram with Program Counter, MAR, decode unit, accumulator, ALU, CIR, cache, MDR and Control Unit on the left; RAM and three buses on the right">
     <defs><marker id="cpu-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="var(--accent)"/></marker></defs>
     <rect className="cpu-shell" x="17" y="15" width="706" height="532" rx="8"/>
     <text className="cpu-main-title" x="370" y="40" textAnchor="middle">Central Processing Unit (CPU)</text>
     <g className="cpu-connectors">
      <path d="M203 110 H548" markerEnd="url(#cpu-arr)"/>
      <path d="M548 130 H221 V158 H203" markerEnd="url(#cpu-arr)"/>
      <path d="M292 219 H315"/>
      <path d="M548 350 H480 V447 H480" markerEnd="url(#cpu-arr)"/>
      <path d="M315 225 H294 V322 H315" markerEnd="url(#cpu-arr)"/>
      <path d="M397 265 V283" markerEnd="url(#cpu-arr)"/>
      <path d="M397 283 V265"/>
      <path d="M397 385 V401" markerEnd="url(#cpu-arr)"/>
      <path d="M548 478 H504 V445 H480" markerEnd="url(#cpu-arr)"/>
      <path d="M548 465 H520 V363 H480"/>
      <path d="M548 492 H535 V222 H480"/>
     </g>
     {BOXES.map(box=><g key={box.key} data-cpu-tour={box.key==='CU'?'control':box.key==='PC'?'pc':undefined} tabIndex={0} role="button" aria-label={box.label} className={'cpu-block '+(active.includes(box.key as Register)?'cpu-active ':'')+(selected===box.key?'cpu-selected':'')} onClick={()=>setSelected(box.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(box.key);}}}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4"/>
      <text className="cpu-block-title" x={box.x+box.w/2} y={box.y+19} textAnchor="middle">{box.label}</text>
      {box.key==='DECODE'?<g className="cpu-gears"><circle cx="143" cy="272" r="33"/><circle cx="202" cy="348" r="27"/><circle cx="143" cy="272" r="12"/><circle cx="202" cy="348" r="10"/><path d="M143 232V243M143 301V313M105 272H115M171 272H182M202 315V326M202 371V382M171 348H180M226 348H235"/></g>:<text className="cpu-block-value" x={box.x+box.w/2} y={box.y+Math.max(49,box.h*.65)} textAnchor="middle">{box.value(machine)}</text>}
     </g>)}
     <g className="cpu-connection-buses" data-cpu-tour="buses">
      {([{key:'ADDRESS',y:121,start:708,end:833,direction:1},{key:'DATA',y:343,start:708,end:833,direction:0},{key:'CONTROL',y:485,start:708,end:833,direction:0}] as const).map(b=><g key={b.key} tabIndex={0} role="button" aria-label={b.key+' bus'} className={'cpu-external-bus '+(selected===b.key?'cpu-selected':'')+(transfer?.bus.toUpperCase()===b.key?' cpu-bus-active':'')} onClick={()=>setSelected(b.key)} onKeyDown={e=>{if(e.key==='Enter')setSelected(b.key);}}>
        <path d={'M'+b.start+' '+b.y+' H'+b.end} markerEnd="url(#cpu-arr)"/>{b.direction===0&&<path d={'M'+b.end+' '+(b.y+6)+' H'+b.start} markerEnd="url(#cpu-arr)"/>}
        <text x="770" y={b.y-11} textAnchor="middle">{b.key[0]+b.key.slice(1).toLowerCase()} bus</text>
       </g>)}
     </g>
     <g data-cpu-tour="ram" className="cpu-ram" role="button" aria-label="RAM with sixteen memory addresses" onClick={()=>setSelected('RAM')}>
      <rect className="cpu-ram-shell" x="834" y="15" width="233" height="532" rx="8"/>
      <text className="cpu-ram-title" x="950" y="40" textAnchor="middle">Main Memory (RAM)</text>
      <rect className="cpu-ram-header" x="847" y="53" width="207" height="31" rx="3"/>
      <text className="cpu-column-title" x="887" y="73" textAnchor="middle">Address</text><text className="cpu-column-title" x="997" y="73" textAnchor="middle">Data</text>
      {machine.memory.map((value,index)=>{
       const y=85+index*27;
       return <g key={index} className={'cpu-ram-row '+(machine.mar===index&&phase!=='ready'?'cpu-ram-highlight':'')}><rect x="847" y={y} width="207" height="27"/><text x="887" y={y+17} textAnchor="middle">{binary4(index)}</text><text x="998" y={y+17} textAnchor="middle">{binary8(value)}</text></g>;
      })}
     </g>
     {route&&transfer&&<g className="cpu-flow-token" key={stepKey}><path className="cpu-flow-path" d={route}/><g><circle r="6"/><animateMotion path={route} dur={Math.min(.85,waitForStep(clock)/1000*.88)+'s'} fill="freeze"/></g></g>}
    </svg>
   </div>
   <section className="cpu-information" data-cpu-tour="steps">
    <div className="cpu-step-heading"><span className={'cpu-phase cpu-phase-'+phase}>{phase==='ready'?'READY':phase==='halted'?'COMPLETE':phase.toUpperCase()}</span><span>Micro-step {machine.cycles}</span></div>
    <p className="cpu-explanation">{machine.frame.description}</p>
    {transfer&&<p className="cpu-transit">{transfer.from} → {transfer.to} · {transfer.value}</p>}
    {shouldStopAtDecode(mode,machine)&&<p className="cpu-end-message">Fetch–Decode complete. Select Fetch–Decode–Execute to continue through execution.</p>}
    <div className="cpu-component-details"><strong>{selected==='DECODE'?'Decode unit':selected==='CACHE'?'Cache':selected==='ADDRESS'?'Address bus':selected==='DATA'?'Data bus':selected==='CONTROL'?'Control bus':LABELS[selected as Register]}</strong><span>{HELP[selected]}</span></div>
   </section>
  </main>
  <footer className="cpu-footer"><Credits/></footer>
  {themeOpen&&<div className="cpu-overlay" role="dialog" aria-label="Choose CPU Studio theme"><div className="cpu-dialog"><div className="cpu-dialog-head"><strong>Theme</strong><button aria-label="Close themes" onClick={()=>setThemeOpen(false)}><X size={16}/></button></div><ThemePicker value={themeId} onChange={setThemeId}/></div></div>}
  {tourStep!==null&&<CpuTutorial step={tourStep} onStep={setTourStep} onClose={finishTutorial}/>}
 </div>;
}

import { WorkspaceFluidBackground } from '../app/components/WorkspaceFluidBackground';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Cpu,Gauge,Pause,Play,RotateCcw,Settings2,StepBack,StepForward,X} from 'lucide-react';
import {ThemePicker} from '../app/components/ThemePicker';
import {cssVariables,getTheme} from '../app/themes';
import {loadSettings,saveSettings} from '../storage/settings';
import {assemble,binary4,binary8,DEFAULT_PROGRAM} from './assembler';
import {boot,step,type Machine,type Register} from './engine';
import {CpuTutorial,CPU_TUTORIAL_KEY} from './CpuTutorial';
import {advanceWithInterrupt,initialInterrupt,requestInterrupt} from './advanced';
import {advanceRunFrame} from './playback';
import {playCue} from '../app/sound';
import {cpuFrameCue} from './frame-sound';
import {cpuTransferRoute,normalTransferRoute,NORMAL_WIRES,ADVANCED_WIRES,NORMAL_LAYOUT,ADVANCED_LAYOUT,type CpuWire} from './diagram-wires';
export {cpuTransferRoute,normalTransferRoute,NORMAL_WIRES,ADVANCED_WIRES} from './diagram-wires';
import './cpu.css';
import '../styles/cpu.css';

export type CpuMode='normal'|'advanced';
const DEFAULT_IMAGE=assemble(DEFAULT_PROGRAM);
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
 CLOCK:'Illustrative clock signal: synchronises operations. The numerical tick display is an extended teaching model (out of specification).',
 STATUS:'Illustrative status register showing whether the accumulator is zero (out of specification).',
 INTERRUPT:'Illustrative interrupt-control register for the Advanced walkthrough (out of specification).',
 CACHE:'Fast memory close to the CPU that stores frequently used instructions or data. Shown for syllabus context; not simulated here.',
 DECODE:'Interprets the instruction held in CIR and tells the CPU what operation to perform.',
 ADDRESS:'The address bus carries the location of a memory cell from the CPU to RAM.',
 DATA:'The data bus carries instructions and values between the CPU and RAM in both directions.',
 CONTROL:'The control bus carries control signals such as READ and WRITE.',
};
export function waitForStep(ghz:number){return Math.max(45,Math.round(1180/Math.pow(ghz+0.7,1.45)));}
const BOXES:{key:Register|'DECODE'|'CACHE'|'CLOCK'|'STATUS'|'INTERRUPT';x:number;y:number;w:number;h:number;label:string;value:(m:Machine)=>string}[]=[
 {key:'PC',x:45,y:64,w:158,h:106,label:'Program Counter',value:m=>binary4(m.pc)},
 {key:'MAR',x:548,y:64,w:160,h:102,label:'Memory Address Register',value:m=>binary4(m.mar)},
 {key:'DECODE',x:45,y:185,w:247,h:225,label:'Decode Unit',value:m=>m.frame.phase==='decode'?'DECODING':'CONTROLLED BY CU'},
 {key:'CACHE',x:45,y:423,w:247,h:108,label:'Cache',value:()=>'FAST MEMORY'},
 {key:'ACC',x:315,y:184,w:165,h:81,label:'Accumulator',value:m=>binary8(m.acc)},
 {key:'ALU',x:315,y:283,w:165,h:95,label:'Arithmetic Logic Unit',value:m=>binary8(m.alu)},
 {key:'CIR',x:315,y:389,w:165,h:73,label:'Current Instruction Register',value:m=>binary8(m.cir)},
 {key:'STATUS',x:315,y:468,w:165,h:32,label:'Status Register',value:m=>m.acc===0?'Z = 1':'Z = 0'},
 {key:'INTERRUPT',x:315,y:505,w:165,h:33,label:'Interrupt Register',value:()=>'READY'},
 {key:'MDR',x:548,y:268,w:160,h:90,label:'Memory Data Register',value:m=>binary8(m.mdr)},
 {key:'CLOCK',x:548,y:367,w:160,h:52,label:'Clock',value:m=>'TICK '+m.cycles},
 {key:'CU',x:548,y:443,w:160,h:95,label:'Control Unit',value:m=>m.frame.signal??'DECODE / CONTROL'},
];
export function CpuStudio({onHome,landingPreview=false}:{onHome:()=>void;landingPreview?:boolean}){
 const [mode,setMode]=useState<CpuMode>('normal');
 const [machine,setMachine]=useState<Machine>(()=>boot(DEFAULT_IMAGE));
 const [playing,setPlaying]=useState(false);
 const previewRef=useRef<HTMLDivElement>(null);
 const manualPlayback=useRef(false);
 useEffect(()=>{
  if(!landingPreview)return;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const root=previewRef.current;
  if(!root)return;
  if(!('IntersectionObserver' in window)){setPlaying(true);return;}
  const observer=new IntersectionObserver(([entry])=>{
   if(!manualPlayback.current)setPlaying(Boolean(entry?.isIntersecting));
  },{threshold:.06});
  observer.observe(root);
  return()=>observer.disconnect();
 },[landingPreview]);
 const historyRef=useRef<{machine:Machine;interrupt:ReturnType<typeof initialInterrupt>}[]>([]);
 const [historyLength,setHistoryLength]=useState(0);
 const [interrupt,setInterrupt]=useState(initialInterrupt);
 const interruptRef=useRef(interrupt);interruptRef.current=interrupt;
 const [selected,setSelected]=useState<string>('PC');
 const [clock,setClock]=useState(()=>landingPreview?4.7:2);
 const [themeId,setThemeId]=useState(()=>loadSettings().theme);
 const [themeOpen,setThemeOpen]=useState(false);
 const [tourStep,setTourStep]=useState<number|null>(()=>{
  if(landingPreview)return null;
  try{return localStorage.getItem(CPU_TUTORIAL_KEY)==='done'?null:0;}catch{return 0;}
 });
 const [stepKey,setStepKey]=useState(0);
 const machineRef=useRef(machine);machineRef.current=machine;
 const theme=getTheme(landingPreview?'catppuccin-mocha':themeId);
 function soundFrame(previous:Machine,next:Machine){
  if(landingPreview||document.hidden)return;
  const cue=cpuFrameCue(previous,next);
  if(!cue)return;
  playCue(cue);
 }
 const active=machine.frame.active;
 const transfer=machine.frame.transfer;
 const modeDone=machine.halted;
 const isRunning=playing;
 function recordPrevious(previous:Machine,prior:ReturnType<typeof initialInterrupt>){
  historyRef.current.push({machine:previous,interrupt:prior});
  if(historyRef.current.length>2048)historyRef.current.shift();
  setHistoryLength(historyRef.current.length);
 }
 useEffect(()=>{if(landingPreview)return;const previous=loadSettings();saveSettings({...previous,theme:themeId});for(const [k,v] of Object.entries(cssVariables(theme)))document.documentElement.style.setProperty(k,v);document.documentElement.style.colorScheme=theme.appearance;},[theme,themeId,landingPreview]);
 useEffect(()=>{if(!isRunning)return;const interval=window.setInterval(()=>{
  const current=machineRef.current;
  const result=advanceRunFrame(current,interruptRef.current,mode);
  const next=result.machine;recordPrevious(current,interruptRef.current);
  interruptRef.current=result.interrupt;setInterrupt(result.interrupt);
  soundFrame(current,next);
  machineRef.current=next;setMachine(next);setStepKey(n=>n+1);
  if(next.error)setPlaying(false);
 },waitForStep(clock));return()=>window.clearInterval(interval);},[isRunning,mode,clock,landingPreview]);
 function reset(nextMode=mode){setMode(nextMode);setPlaying(false);historyRef.current=[];setHistoryLength(0);const fresh=boot(DEFAULT_IMAGE);const empty=initialInterrupt();interruptRef.current=empty;setInterrupt(empty);machineRef.current=fresh;setMachine(fresh);setStepKey(n=>n+1);}
 function advance(){
  if(playing||modeDone)return;
  const result=mode==='advanced'?advanceWithInterrupt(machineRef.current,interruptRef.current):{machine:step(machineRef.current),interrupt:interruptRef.current};
  recordPrevious(machineRef.current,interruptRef.current);
  interruptRef.current=result.interrupt;setInterrupt(result.interrupt);const next=result.machine;soundFrame(machineRef.current,next);machineRef.current=next;setMachine(next);setStepKey(n=>n+1);
 }
 function back(){
  if(playing)return;
  const previous=historyRef.current.pop();if(!previous)return;
  machineRef.current=previous.machine;interruptRef.current=previous.interrupt;
  setMachine(previous.machine);setInterrupt(previous.interrupt);setHistoryLength(historyRef.current.length);
  setStepKey(n=>n+1);
 }
 function finishTutorial(){setTourStep(null);try{localStorage.setItem(CPU_TUTORIAL_KEY,'done');}catch{/* Tutorial still closes. */}}
 const route=transfer?(mode==='normal'?normalTransferRoute(transfer.from,transfer.to):cpuTransferRoute(transfer.from,transfer.to)):'';
 const phase=machine.frame.phase;
 const focused=machine.cycles>0&&phase!=='error';
 const activeUnits=new Set<string>(active);
 if(phase==='decode'&&mode==='advanced')activeUnits.add('DECODE');
 if(phase==='interrupt'){activeUnits.add('CU');activeUnits.add('INTERRUPT');}
 if(mode==='advanced'&&(interrupt.pending||interrupt.stage>0))activeUnits.add('INTERRUPT');
 if(mode==='advanced'&&machine.cycles>0)activeUnits.add('CLOCK');
 if(mode==='advanced'&&phase==='execute'&&machine.frame.active.includes('ACC'))activeUnits.add('STATUS');
 const wires=mode==='normal'?NORMAL_WIRES:ADVANCED_WIRES;
 const wireActive=(wire:CpuWire)=>{
  if(wire.control)return activeUnits.has('CU')&&(!wire.target||activeUnits.has(wire.target));
  if(wire.id.includes('clock'))return machine.cycles>0;
  if(wire.id.includes('interrupt'))return phase==='interrupt'||interrupt.pending||interrupt.stage>0;
  if(wire.id.includes('status'))return phase==='execute'&&(active.includes('ALU')||active.includes('ACC'));
  if(wire.id.includes('decode'))return phase==='decode';
  return !!transfer&&!!wire.from&&((wire.from===transfer.from&&wire.to===transfer.to)||(wire.bidirectional&&wire.from===transfer.to&&wire.to===transfer.from));
 };
 const activeBus=transfer?.bus==='address'?'ADDRESS':transfer?.bus==='data'?'DATA':transfer?.bus==='control'?'CONTROL':null;
 const memoryActive=activeUnits.has('RAM');
 const layout=mode==='normal'?NORMAL_LAYOUT:ADVANCED_LAYOUT;
 const renderedBoxes=BOXES.filter(box=>mode==='advanced'||!['DECODE','CLOCK','STATUS','INTERRUPT'].includes(box.key)).map(box=>({...box,...layout[box.key]}));
 return <div ref={previewRef} className={landingPreview?"cpu-app cpu-embedded":"cpu-app workspace-fluid-surface"} style={cssVariables(theme) as React.CSSProperties} data-pico-theme={theme.id}>
    {!landingPreview && <WorkspaceFluidBackground theme={theme}/>}
  <header className="cpu-topbar topbar pico-appbar">
   <div className="pico-appbar-lead cpu-brand"><button className="toolbar-button home-button" aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={16}/></button><button type="button" className="brand-lockup pico-brand-home" aria-label="Pico, back to Workspaces" onClick={onHome}><img className="brand-mark" src="/pico-logo.svg" alt="" width="26" height="26"/><span>Pico<span className="brand-period">.</span></span></button></div>
   <div className="topbar-spacer"/>
   <div className="topbar-actions cpu-actions"><div className="pico-appbar-group" role="group" aria-label="Help and appearance"><button className="help-button" aria-label="Open CPU Studio tutorial" onClick={()=>{setPlaying(false);setTourStep(0);}}><BookOpen size={15}/><span>Tutorial</span></button><button className="toolbar-button" aria-label="Choose CPU Studio theme" onClick={()=>setThemeOpen(true)}><Settings2 size={15}/><span>Theme</span></button></div></div>
  </header>
  <div className="cpu-controls">
   <fieldset className="cpu-mode-switch" data-cpu-tour="modes" aria-label="CPU learning mode">
    <label><input type="radio" name="cpu-mode" checked={mode==='normal'} onChange={()=>reset('normal')}/> Normal</label>
    <label><input type="radio" name="cpu-mode" checked={mode==='advanced'} onChange={()=>reset('advanced')}/> Advanced</label>
   </fieldset>
   <div className="cpu-playback" data-cpu-tour="controls">
    <button aria-label="Step backward one CPU micro-operation" onClick={back} disabled={playing||historyLength===0}><StepBack size={16}/> Back</button>
    <button aria-label="Step forward one CPU micro-operation" onClick={advance} disabled={playing||modeDone}><StepForward size={16}/> Step</button>
    <button className="cpu-play" onClick={()=>{manualPlayback.current=true;setPlaying(v=>!v);}} disabled={Boolean(machine.error)}>{playing?<><Pause size={16}/> Pause</>:<><Play size={16}/> Run</>}</button>
    <button onClick={()=>reset()}><RotateCcw size={16}/> Reset</button>
    {mode==='advanced'&&<button aria-label="Request CPU interrupt" disabled={machine.halted||interrupt.pending||interrupt.stage>0} onClick={()=>{const pending=requestInterrupt(interruptRef.current);interruptRef.current=pending;setInterrupt(pending);}}>Trigger interrupt</button>}
   </div>
   <label className="cpu-speed" data-cpu-tour="speed"><Gauge size={17}/><span>{landingPreview?'Simulated speed':'Playback speed'} <strong>{clock.toFixed(1)} GHz</strong></span><input aria-label="Illustrative CPU clock speed GHz" type="range" min="0.5" max="9.2" step=".1" value={clock} onChange={e=>setClock(Number(e.target.value))}/></label>
   <span className="cpu-counter">Step {machine.cycles} · {machine.instructions} instruction(s)</span>
  </div>
  <main className="cpu-content">
   <div className="cpu-heading"><Cpu size={17}/><strong>CPU architecture</strong></div>
   <div className="cpu-workspace-main">
   <div className="cpu-diagram-scroll" data-cpu-tour="diagram">
    <svg className={"cpu-diagram"+(focused?" cpu-has-focus":"")} viewBox="0 0 1190 558" role="img" aria-label="CPU architecture with registers, ALU and Control Unit connected to RAM by address, data and control buses">
     <defs>
      <marker id="cpu-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 Z" fill="var(--accent)"/></marker>
      <marker id="cpu-wire-arrow" viewBox="0 0 8 8" markerWidth="4" markerHeight="4" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="var(--muted)"/></marker>
      <marker id="cpu-wire-active-arrow" viewBox="0 0 8 8" markerWidth="4" markerHeight="4" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="var(--accent)"/></marker>
     </defs>
     <rect className="cpu-shell" x="17" y="15" width="706" height="532" rx="8"/>
     <text className="cpu-main-title" x="370" y="40" textAnchor="middle">Central Processing Unit (CPU)</text>
     <g className="cpu-advanced-wiring" aria-label={mode==='normal'?'CPU connections':'Advanced CPU connections'}>
      {wires.map(wire=>{
       const highlighted=wireActive(wire);
       const arrow=highlighted?'url(#cpu-wire-active-arrow)':'url(#cpu-wire-arrow)';
       return <path key={wire.id} data-wire-id={wire.id}
        className={'cpu-advanced-wire'+(wire.control?' cpu-control-wire':'')+(highlighted?' cpu-wire-active':'')}
        d={wire.path} markerStart={wire.bidirectional?arrow:undefined} markerEnd={wire.control?undefined:arrow}>
        <title>{wire.label}</title>
       </path>;
      })}
     </g>
     {renderedBoxes.map(box=><g key={box.key} data-cpu-tour={box.key==='CU'?'control':box.key==='PC'?'pc':undefined} tabIndex={0} role="button" aria-label={box.label} className={'cpu-block '+(focused?(activeUnits.has(box.key)?'cpu-active ':'cpu-dimmed '):'')+(selected===box.key&&!focused?'cpu-selected':'')} onClick={()=>setSelected(box.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(box.key);}}}>
      <title>{HELP[box.key]}</title><rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4"/>
      {box.key==='STATUS'||box.key==='INTERRUPT'?<g className="cpu-compact-register">
       {box.key==='STATUS'?<text className="cpu-block-title" x={box.x+8} y={box.y+21} textAnchor="start">Status Register</text>:<>
        <text className="cpu-block-title" x={box.x+8} y={box.y+12} textAnchor="start">Interrupt</text>
        <text className="cpu-block-title" x={box.x+8} y={box.y+25} textAnchor="start">Register</text>
       </>}
       <text className="cpu-block-value" x={box.x+box.w-7} y={box.y+22} textAnchor="end">{box.key==='STATUS'?box.value(machine):interrupt.stage>0?'SERVICING':interrupt.pending?'PENDING':interrupt.handled>0?'HANDLED':'READY'}</text>
      </g>:<g>
       <text className="cpu-block-title" x={box.x+box.w/2} y={box.y+19} textAnchor="middle">
        {box.key==='CIR'?<><tspan x={box.x+box.w/2}>Current Instruction</tspan><tspan x={box.x+box.w/2} dy="15">Register</tspan></>:box.key==='MAR'?<><tspan x={box.x+box.w/2}>Memory Address</tspan><tspan x={box.x+box.w/2} dy="15">Register</tspan></>:box.key==='MDR'?<><tspan x={box.x+box.w/2}>Memory Data</tspan><tspan x={box.x+box.w/2} dy="15">Register</tspan></>:box.key==='ALU'?<><tspan x={box.x+box.w/2}>Arithmetic Logic</tspan><tspan x={box.x+box.w/2} dy="15">Unit</tspan></>:box.label}
       </text>
       {box.key==='DECODE'?<g className="cpu-gears">
        <circle cx="130" cy="259" r="25"/><circle cx="193" cy="266" r="19"/>
        <circle cx="130" cy="259" r="9"/><circle cx="193" cy="266" r="7"/>
        <path d="M130 227V237M130 281V291M98 259H108M152 259H162M193 241V246M193 286V292M169 266H174M212 266H218"/>
       </g>:box.key==='CLOCK'?<g className="cpu-clock-face" aria-label="Illustrative clock tick">
        <circle cx={box.x+42} cy={box.y+34} r="13"/>
        <path d={'M'+(box.x+42)+' '+(box.y+34)+' v-9'} transform={'rotate('+((machine.cycles*30)%360)+' '+(box.x+42)+' '+(box.y+34)+')'}/>
        <text className="cpu-block-value" x={box.x+box.w-10} y={box.y+35} textAnchor="end">{box.value(machine)}</text>
       </g>:<text className="cpu-block-value" x={box.x+box.w/2} y={box.y+Math.max(41,box.h*.65)} textAnchor="middle">{box.value(machine)}</text>}
      </g>}
     </g>)}
     <g className="cpu-connection-buses" data-cpu-tour="buses">
      {([{key:'ADDRESS',y:121,direction:1},{key:'DATA',y:343,direction:0},{key:'CONTROL',y:485,direction:0}] as const).map(b=><g key={b.key} tabIndex={0} role="button" aria-label={b.key+' bus'} className={'cpu-external-bus '+(focused?(activeBus===b.key?'cpu-bus-active ':'cpu-dimmed '):'')+(selected===b.key&&!focused?'cpu-selected':'')} onClick={()=>setSelected(b.key)} onKeyDown={e=>{if(e.key==='Enter')setSelected(b.key);}}>
        <path d={'M708 '+(b.direction===0?b.y-15:b.y)+' H924'} markerEnd="url(#cpu-arr)"/>{b.direction===0&&<path d={'M924 '+(b.y+15)+' H708'} markerEnd="url(#cpu-arr)"/>}
        <text x="821" y={b.y-29} textAnchor="middle">{b.key[0]+b.key.slice(1).toLowerCase()} bus</text>
       </g>)}
     </g>
     <g data-cpu-tour="ram" className={"cpu-ram"+(focused&&!memoryActive?" cpu-dimmed":"")+(focused&&memoryActive?" cpu-active":"")} role="button" aria-label="RAM with sixteen memory addresses" onClick={()=>setSelected('RAM')}>
      <rect className="cpu-ram-shell" x="929" y="15" width="233" height="532" rx="8"/>
      <text className="cpu-ram-title" x="1045" y="40" textAnchor="middle">Main Memory (RAM)</text>
      <rect className="cpu-ram-header" x="942" y="53" width="207" height="31" rx="3"/>
      <text className="cpu-column-title" x="982" y="73" textAnchor="middle">Address</text><text className="cpu-column-title" x="1092" y="73" textAnchor="middle">Data</text>
      {machine.memory.map((value,index)=>{
       const y=85+index*27;
       return <g key={index} tabIndex={0} role="button" aria-label={'RAM address '+binary4(index)+' contains '+binary8(value)} onMouseEnter={()=>setSelected('RAM')} className={'cpu-ram-row '+(machine.mar===index&&phase!=='ready'?'cpu-ram-highlight':'')}><title>{'Address '+binary4(index)+' ('+index+'): '+(machine.kind[index]==='instruction'?'instruction':machine.kind[index]==='data'?'stored data':'unused location')+'. Contents '+binary8(value)+(machine.kind[index]==='instruction'?'. Opcode '+binary4(value>>4)+', operand '+binary4(value)+'. Instruction encoding is a teaching simplification (out of specification).':'.')}</title><rect x="942" y={y} width="207" height="27"/><text x="982" y={y+17} textAnchor="middle">{binary4(index)}</text><text x="1093" y={y+17} textAnchor="middle">{binary8(value)}</text></g>;
      })}
     </g>
     {route&&transfer&&<g className="cpu-flow-token cpu-emphasis" key={stepKey}><path className="cpu-flow-path" d={route}/><g><circle r="6"/><animateMotion path={route} dur={Math.max(.15,Math.min(.8,waitForStep(clock)/1000*.78))+'s'} fill="freeze"/></g></g>}
    </svg>
   </div>
   <section className="cpu-information" data-cpu-tour="steps" aria-live="polite">
    <div className="cpu-step-heading"><span className={'cpu-phase cpu-phase-'+phase}>{phase==='ready'?'READY':phase==='halted'?'COMPLETE':phase.toUpperCase()}</span><span>Micro-step {machine.cycles}</span></div>
    <p className="cpu-explanation" key={machine.cycles}>{machine.cycles===0?'Press Run to start the CPU, or Step to follow one operation at a time.':machine.frame.description}</p>
    {transfer&&<p className="cpu-transit" key={'t'+machine.cycles}>{transfer.from} → {transfer.to} · {transfer.value}</p>}
    {mode==='advanced'&&<div className="cpu-advanced"><strong>Advanced · instruction decode and interrupts</strong><span>Opcode: {binary4(machine.cir>>4)} · Operand: {binary4(machine.cir)}. Four-bit opcodes and 16 memory locations are a teaching model (out of specification), not a Cambridge ISA.</span><span>Interrupt: {interrupt.stage>0?'Servicing request':interrupt.pending?'Waiting until the current instruction finishes':interrupt.handled>0?'Handled '+interrupt.handled+' interrupt(s)':'No pending request'}. Interrupt handling includes finishing the instruction, saving state, servicing the ISR and returning to the program.</span></div>}
    <div className="cpu-component-details" key={selected}><strong>{selected==='DECODE'?'Decode unit':selected==='CACHE'?'Cache':selected==='ADDRESS'?'Address bus':selected==='DATA'?'Data bus':selected==='CONTROL'?'Control bus':LABELS[selected as Register]}</strong><span>{HELP[selected]}</span></div>
   </section>
   </div>
  </main>

  {themeOpen&&<div className="cpu-overlay" role="dialog" aria-label="Choose CPU Studio theme"><div className="cpu-dialog"><div className="cpu-dialog-head"><strong>Theme</strong><button aria-label="Close themes" onClick={()=>setThemeOpen(false)}><X size={16}/></button></div><ThemePicker value={themeId} onChange={setThemeId}/></div></div>}
  {tourStep!==null&&<CpuTutorial step={tourStep} onStep={setTourStep} onClose={finishTutorial}/>}
 </div>;
}

import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,X} from 'lucide-react';
import {placeTutorialCard} from '../app/components/GuidedTutorial';
import './cpu-tutorial.css';

export const CPU_TUTORIAL_KEY='pico.cpu.tutorial.v1';
export const CPU_TOUR_STEPS=[
 {target:'',title:'Welcome to CPU Studio',description:'Explore the fetch–decode–execute cycle using the same CPU components as your Cambridge IGCSE course. Each Step follows one operation.'},
 {target:'modes',title:'Choose what to study',description:'Fetch–Decode stops after the instruction has been fetched and decoded. Fetch–Decode–Execute continues into execution.'},
 {target:'diagram',title:'Explore the architecture',description:'This is a Von Neumann CPU. The processor contains registers, an ALU and control unit. Main memory is on the right, connected by three buses.'},
 {target:'pc',title:'Start with the Program Counter',description:'The PC stores the next instruction address. Step copies it to MAR, sends it along the address bus and requests a RAM read.'},
 {target:'ram',title:'Watch the RAM contents',description:'RAM stores both instructions and data. Each row displays a four-bit memory address and eight-bit stored value.'},
 {target:'buses',title:'The three system buses',description:'The address bus carries memory addresses. The data bus transfers instructions and values. The control bus carries READ and WRITE signals.'},
 {target:'control',title:'Understand decoding',description:'The instruction travels RAM → MDR → CIR. The Control Unit decodes its opcode and determines what operation happens next.'},
 {target:'steps',title:'Read the explanations',description:'The panel explains every micro-operation, highlighting the relevant registers and showing information moving between components.'},
 {target:'controls',title:'Step or run the cycle',description:'Step advances one operation. Run animates the whole process. Pause and Reset are available in the same toolbar.'},
 {target:'speed',title:'Adjust playback speed',description:'The illustrative GHz slider changes animation pacing, not real processor timing. Higher values make the simulation advance faster.'},
] as const;
type Bounds={top:number;left:number;width:number;height:number};
export function CpuTutorial({step,onStep,onClose}:{step:number;onStep:(next:number)=>void;onClose:()=>void}){
 const card=useRef<HTMLElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 const [spot,setSpot]=useState<Bounds|null>(null);
 const [position,setPosition]=useState<{top:number;left:number}>({top:0,left:0});
 const current=CPU_TOUR_STEPS[Math.max(0,Math.min(step,CPU_TOUR_STEPS.length-1))]!;
 useLayoutEffect(()=>{
  let raf=0;
  const measure=()=>{
   const element=current.target?document.querySelector<HTMLElement>('[data-cpu-tour="'+current.target+'"]'):null;
   const rect=element?.getBoundingClientRect();
   const bounds=rect?{top:Math.max(4,rect.top-5),left:Math.max(4,rect.left-5),width:rect.width+10,height:rect.height+10}:null;
   setSpot(bounds);
   const w=Math.min(375,window.innerWidth-32),h=290;
   const at=placeTutorialCard(bounds,w,h,window.innerWidth,window.innerHeight);
   setPosition({top:at.top,left:at.left});
  };
  measure();
  const listener=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(measure);};
  window.addEventListener('resize',listener);
  return()=>{window.removeEventListener('resize',listener);cancelAnimationFrame(raf);};
 },[step,current.target]);
 useEffect(()=>{closeRef.current?.focus();},[step]);
 useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}};window.addEventListener('keydown',listener,true);return()=>window.removeEventListener('keydown',listener,true);},[onClose]);
 return <div className="cpu-tour" role="presentation">
  <svg className="cpu-tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="cpu-tour-cutout"><rect width="100%" height="100%" fill="white"/>{spot&&<rect x={spot.left} y={spot.top} width={spot.width} height={spot.height} rx="9" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,.72)" mask="url(#cpu-tour-cutout)"/></svg>
  {spot&&<div className="cpu-tour-focus" style={{top:spot.top,left:spot.left,width:spot.width,height:spot.height}}/>}
  <section className="cpu-tour-card" role="dialog" aria-modal="true" aria-labelledby="cpu-tour-title" style={position} ref={card}>
   <div className="cpu-tour-meta"><span>CPU STUDIO · {step+1} / {CPU_TOUR_STEPS.length}</span><button ref={closeRef} onClick={onClose} aria-label="Skip CPU Studio tutorial"><X size={17}/></button></div>
   <h2 id="cpu-tour-title">{current.title}</h2>
   <p>{current.description}</p>
   <div className="cpu-tour-nav"><button onClick={onClose}>Skip tutorial</button><span/><button disabled={step===0} onClick={()=>onStep(step-1)}><ArrowLeft size={14}/> Back</button><button className="cpu-tour-primary" onClick={()=>step===CPU_TOUR_STEPS.length-1?onClose():onStep(step+1)}>{step===CPU_TOUR_STEPS.length-1?<><CheckCircle2 size={14}/> Finish</>:<>Next <ArrowRight size={14}/></>}</button></div>
  </section>
 </div>;
}

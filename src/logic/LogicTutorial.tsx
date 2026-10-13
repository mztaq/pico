import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,X} from 'lucide-react';
export const LOGIC_TOUR_KEY='pico.logic.tutorial.v1';
export const LOGIC_TOUR_STEPS=[
 {title:'Welcome to Logic Sim',description:'Build digital circuits with switches, logic gates and bulbs. This walkthrough takes about a minute.',selector:null},
 {title:'Choose a component',description:'Select a switch or gate from Components, then click the canvas to place it. You can also drag it straight onto the canvas.',selector:'.logic-palette'},
 {title:'Arrange your circuit',description:'Drag a component to move it. Drag a box over several components to select and move them together.',selector:'.logic-board'},
 {title:'Connect the terminals',description:'Drag from an output terminal to an input terminal. Release on the destination to connect the wire.',selector:'.logic-board'},
 {title:'Check the output',description:'Add a bulb. Toggle a switch to change its signal and see whether the bulb turns on.',selector:'.logic-sim-controls'},
 {title:'Read Boolean expressions',description:'Open Boolean Expression to see word notation, algebraic symbols and supported simplified equivalent forms.',selector:'.logic-toolbar'},
 {title:'Keep your circuit',description:'Use Export to download your circuit as a file. Import loads it again. Help replays this tutorial.',selector:'.logic-header-right'},
] as const;
export function LogicTutorial({step,onStep,onClose}:{step:number;onStep:(step:number)=>void;onClose:()=>void}){
 const card=useRef<HTMLElement>(null);
 const [rect,setRect]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 const current=LOGIC_TOUR_STEPS[step]??LOGIC_TOUR_STEPS[0];
 useLayoutEffect(()=>{
  const element=current.selector?document.querySelector<HTMLElement>(current.selector):null;
  let raf=0;
  const measure=()=>{
   if(!element){setRect(null);return;}
   const r=element.getBoundingClientRect();
   setRect({x:Math.max(0,r.left-5),y:Math.max(0,r.top-5),width:Math.min(window.innerWidth,r.right+5)-Math.max(0,r.left-5),height:Math.min(window.innerHeight,r.bottom+5)-Math.max(0,r.top-5)});
  };
  const update=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(measure);};
  measure();
  const obs=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);if(element)obs?.observe(element);
  window.addEventListener('resize',update);
  return()=>{cancelAnimationFrame(raf);obs?.disconnect();window.removeEventListener('resize',update);};
 },[step,current.selector]);
 useEffect(()=>{card.current?.querySelector<HTMLButtonElement>('button')?.focus();},[step]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[onClose]);
 return <div className="logic-tour" role="presentation">
  <svg className="logic-tour-shade" width="100%" height="100%" aria-hidden="true"><defs><mask id="logic-tour-mask"><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="8" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,.65)" mask="url(#logic-tour-mask)"/></svg>
  {rect&&<div className="logic-tour-focus" style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}}/>}
  <section className="logic-tour-card" role="dialog" aria-modal="true" aria-labelledby="logic-tour-title" ref={card}>
   <div className="logic-tour-top"><span>LOGIC SIM TUTORIAL · {step+1}/{LOGIC_TOUR_STEPS.length}</span><button aria-label="Close tutorial" onClick={onClose}><X size={17}/></button></div>
   <h2 id="logic-tour-title">{current.title}</h2><p>{current.description}</p>
   <div className="logic-tour-navigation"><button onClick={onClose}>Skip tutorial</button><span/><button disabled={step===0} onClick={()=>onStep(step-1)}><ArrowLeft size={14}/> Back</button><button className="logic-tour-next" onClick={()=>step===LOGIC_TOUR_STEPS.length-1?onClose():onStep(step+1)}>{step===LOGIC_TOUR_STEPS.length-1?'Finish':'Next'}<ArrowRight size={14}/></button></div>
  </section>
 </div>;
}

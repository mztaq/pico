import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GitBranch } from 'lucide-react';
import type { FlowchartProject } from './model';
import type { RunResult } from '../runtime/interpreter';
export const TUTORIAL_STEPS=10;
interface Props {step:number;project:FlowchartProject;result:RunResult|null;pending:boolean;running:boolean;panel:string;onNext:()=>void;onBack:()=>void;}
export function lessonReady(step:number,project:FlowchartProject,result:RunResult|null,panel:string):boolean {
  const output=project.nodes.find(n=>n.kind==='output'),start=project.nodes.find(n=>n.kind==='start'),end=project.nodes.find(n=>n.kind==='end');
  if(step===1)return Boolean(start);
  if(step===2)return Boolean(output);
  if(step===3)return output?.text.trim()==='"Hello, Pico!"';
  if(step===4)return Boolean(end);
  if(step===5)return project.edges.some(e=>e.from===start?.id&&e.to===output?.id&&e.port==='next');
  if(step===6)return project.edges.some(e=>e.from===output?.id&&e.to===end?.id&&e.port==='next');
  if(step===7)return Boolean(result?.output.includes('Hello, Pico!'));
  if(step===8)return panel==='pseudocode';
  return true;
}
export function FlowchartTutorial({step,project,result,pending,running,panel,onNext,onBack}:Props) {
  const ready=lessonReady(step,project,result,panel);
  const card=useRef<HTMLElement>(null);
  const instructions=[
    ['Learn the flowchart workspace','Complete this walkthrough before using the builder. You’ll create your own practice chart, drag connections, run it, and convert it to pseudocode. Your saved charts stay untouched.'],
    ['Add Start','Drag Start from the Blocks palette onto the empty canvas. Start marks where execution begins. Clicking the block in the palette also adds it.'],
    ['Add Output','Drag Output onto the canvas below Start. Each block represents one step. Drag a block on the canvas to arrange it.'],
    ['Edit what it prints','Select your Output block. In Block settings, replace its expression with "Hello, Pico!", including the quotation marks.'],
    ['Add End','Drag End onto the canvas below Output. End marks where the program finishes.'],
    ['Connect Start to Output','Hold the round port below Start. Drag its line onto Output and release. The arrow shows which step runs next.'],
    ['Connect Output to End','Drag from the round port below Output onto End. Dropping a line on empty space leaves the chart unchanged. Escape cancels a line drag.'],
    ['Run your flowchart','Press Run. The console should display Hello, Pico! Input blocks wait for a typed value here. Invalid values end the run and highlight the affected block in red. Stop ends execution.'],
    ['Convert it to pseudocode','Press Convert to pseudocode. The panel shows the program behind your chart. Later, copy or download the code, or open it in a new compiler workspace.'],
    ['You’re ready to build','Input reads a value. Process calculates or assigns it. Decision uses Yes and No branches. Connect a branch back to an earlier block to make a loop. Debug records steps. Your work saves automatically. Help replays this walkthrough.'],
  ];
  const addKind=step===1?'start':step===2?'output':step===4?'end':null;
  const selectors=addKind?[`.flow-palette-block.flow-kind-${addKind}`,'.flow-viewport']:step===3?['.flow-inspector [aria-label="Block expression"]']:step===5||step===6?['.flow-viewport']:step===7?['.flow-builder > .topbar .run-button','.flow-dock']:step===8?['.flow-convert-button','.flow-code-panel']:[];
  const key=selectors.join('|');
  const [rects,setRects]=useState<{x:number;y:number;width:number;height:number}[]>([]);
  useLayoutEffect(()=>{
    let frame=0;const elements=selectors.map(selector=>document.querySelector<HTMLElement>(selector)).filter((e):e is HTMLElement=>Boolean(e));
    elements.forEach(element=>element.classList.add('flow-tour-target'));
    function measure(){setRects(elements.map(element=>{const r=element.getBoundingClientRect();return {x:Math.max(0,r.x-6),y:Math.max(0,r.y-6),width:Math.max(0,Math.min(window.innerWidth,r.right+6)-Math.max(0,r.x-6)),height:Math.max(0,Math.min(window.innerHeight,r.bottom+6)-Math.max(0,r.y-6))};}));}
    const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);elements.forEach(e=>observer?.observe(e));
    window.addEventListener('resize',update);document.addEventListener('scroll',update,true);
    return()=>{cancelAnimationFrame(frame);observer?.disconnect();elements.forEach(e=>e.classList.remove('flow-tour-target'));window.removeEventListener('resize',update);document.removeEventListener('scroll',update,true);};
  },[key,step,pending,running,panel]);
  useEffect(()=>{card.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[step]);
  useEffect(()=>{
    function keyboard(event:KeyboardEvent) {
      if(event.key==='Escape'){event.preventDefault();return;}
      if(event.key!=='Tab')return;
      const focusable='button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
      const allowed=selectors.flatMap(selector=>{const e=document.querySelector<HTMLElement>(selector);return e?[...(e.matches(focusable)?[e]:[]),...e.querySelectorAll<HTMLElement>(focusable)]:[];});
      const controls=[...new Set([...allowed,...card.current?.querySelectorAll<HTMLElement>(focusable)??[]])].filter(e=>!e.closest('[inert]'));
      const current=controls.indexOf(document.activeElement as HTMLElement),index=(current+(event.shiftKey?-1:1)+controls.length)%controls.length;
      if(controls.length){event.preventDefault();controls[index]?.focus();}
    }
    document.addEventListener('keydown',keyboard);return()=>document.removeEventListener('keydown',keyboard);
  },[key,step,pending,running,panel]);
  // Cut independent holes with a mask. The overlay still catches clicks outside them.
  const outline=rects.map(r=>`M ${r.x} ${r.y} h ${r.width} v ${r.height} h ${-r.width} Z`).join(' ');
  const focused=step===0||step===9?'in-centre':step===3||pending||((step===7||step===8)&&ready)?'at-top':'at-bottom';
  return <div className="flow-tutorial" data-step={step}>
    <svg className="flow-tour-shade" width="100%" height="100%" aria-hidden="true"><path d={`M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z ${outline}`} fillRule="evenodd"/></svg>
    {rects.map((r,i)=><div key={i} className="flow-tour-outline" style={{left:r.x,top:r.y,width:r.width,height:r.height}}/>)}
    <section className={`flow-tour-card ${focused}`} ref={card} role="dialog" aria-modal="true" aria-labelledby="flow-tour-title" aria-describedby="flow-tour-description">
      <div className="flow-tour-progress"><GitBranch size={17}/><span>Flowchart walkthrough</span><strong>{step+1} / {TUTORIAL_STEPS}</strong></div>
      <h2 id="flow-tour-title">{instructions[step][0]}</h2><p id="flow-tour-description">{instructions[step][1]}</p>
      {step===3&&<pre>"Hello, Pico!"</pre>}
      {step>0&&step<9&&<p className={`flow-tour-task ${ready?'is-complete':''}`} role="status">{ready?<><Check size={15}/>Step complete</>:'Complete this step to continue.'}</p>}
      <div className="flow-tour-actions">{step>0&&<button type="button" disabled={running} onClick={onBack}><ArrowLeft size={15}/>Back</button>}<button className="run-button" type="button" disabled={!ready||running} onClick={onNext}>{step===0?'Start walkthrough':step===9?'Finish walkthrough':'Next'}<ArrowRight size={15}/></button></div>
    </section>
  </div>;
}

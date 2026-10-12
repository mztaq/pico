import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FlowchartProject } from './model';
import type { RunResult } from '../runtime/interpreter';
export const TUTORIAL_STEPS=10;
interface Props {step:number;project:FlowchartProject;result:RunResult|null;pending:boolean;running:boolean;panel:string;onNext:()=>void;onBack:()=>void;onSkip:()=>void;}
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
export function FlowchartTutorial({step,project,result,pending,running,panel,onNext,onBack,onSkip}:Props) {
  const ready=lessonReady(step,project,result,panel);
  const card=useRef<HTMLElement>(null);
  const instructions=[
    ['Learn the flowchart workspace','Build a three-block program. Follow each highlighted step.'],
    ['Add Start','Drag Start onto the canvas, or click it in Blocks.'],
    ['Add Output','Drag Output below Start, or click it in Blocks.'],
    ['Edit what it prints','Type this into the highlighted field, including the quotes.'],
    ['Add End','Drag End below Output, or click it in Blocks.'],
    ['Connect Start to Output','Drag the highlighted dot below Start onto Output.'],
    ['Connect Output to End','Drag the highlighted dot below Output onto End.'],
    ['Run your flowchart','Click Run. Your message appears in the console below.'],
    ['Convert it to pseudocode','Click Convert to pseudocode to see your chart as code.'],
    ['You’re ready to build','Start your own chart. Open Help to repeat these steps.'],
  ];
  const addKind=step===1?'start':step===2?'output':step===4?'end':null;
  const selectors=addKind?[`.flow-palette-block.flow-kind-${addKind}`,'.flow-viewport']:step===3?['.flow-inspector [aria-label="Block expression"]']:step===5?['.flow-node.flow-kind-start .port-next','.flow-node.flow-kind-output']:step===6?['.flow-node.flow-kind-output .port-next','.flow-node.flow-kind-end']:step===7?['.flow-builder > .topbar .run-button','.flow-dock']:step===8?['.flow-convert-button','.flow-code-panel']:[];
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
      <div className="flow-tour-progress"><span>Flowchart tutorial</span><strong>{step+1} / {TUTORIAL_STEPS}</strong></div>
      <h2 id="flow-tour-title">{instructions[step][0]}</h2><p id="flow-tour-description">{instructions[step][1]}</p>
      {step===3&&<pre>"Hello, Pico!"</pre>}
      {step>0&&step<9&&<p className={`flow-tour-task ${ready?'is-complete':''}`} role="status">{ready?'Done. Select Next.':'Follow the highlighted step.'}</p>}
      <div className="flow-tour-actions"><button className="flow-tour-skip" type="button" onClick={onSkip}>Skip tutorial</button>{step>0&&<button type="button" disabled={running} onClick={onBack}>Back</button>}<button className="run-button" type="button" disabled={!ready||running} onClick={onNext}>{step===0?'Start walkthrough':step===9?'Finish walkthrough':'Next'}</button></div>
    </section>
  </div>;
}

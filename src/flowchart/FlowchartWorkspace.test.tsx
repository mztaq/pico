// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App from '../app/App';
import {loadCharts,saveCharts,serializeChart} from './storage';
import {exampleProject,type ExampleKey} from './fixtures/testCharts';
import { createInteractiveSession } from '../runtime/worker';
import type { WorkerRequest, ExecutionReply } from '../runtime/worker';
import type { ExecutionCallbacks } from '../runtime/runner';
const executions=vi.hoisted(()=>[] as {cancel:ReturnType<typeof vi.fn>;provideInput:ReturnType<typeof vi.fn>;callbacks:ExecutionCallbacks}[]);
vi.mock('../app/components/CodeEditor',()=>({CodeEditor:({value,onChange}:{value:string;onChange:(code:string)=>void})=><textarea aria-label="pseudocode editor" value={value} onChange={e=>onChange(e.target.value)}/>}));
vi.mock('../runtime/runner',()=>({startExecution:(request:WorkerRequest,callbacks:ExecutionCallbacks)=>{
  let resolve!:(replies:ExecutionReply[])=>void,finished=false;
  const promise=new Promise<ExecutionReply[]>(done=>resolve=done);
  const session=createInteractiveSession(request,reply=>{
    if(finished||Array.isArray(reply))return;
    if(reply.type==='output')callbacks.onOutput?.(reply.lines);
    if(reply.type==='input')callbacks.onInput?.(reply.request);
    if(reply.type==='complete'){finished=true;resolve(reply.replies);}
  });
  const cancel=vi.fn(()=>{finished=true;resolve([{error:{code:'cancelled',message:'Execution stopped.'}}]);});
  const provideInput=vi.fn((id:number,value:string)=>{queueMicrotask(()=>session.input({type:'input',id,value}));return true;});
  executions.push({cancel,provideInput,callbacks});queueMicrotask(()=>{if(!finished)session.start();});
  return {promise,cancel,provideInput};
}}));
let root:Root,container:HTMLDivElement;
const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label)!;
async function click(element:HTMLElement){await act(async()=>element.click());}
async function change(element:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string){await act(async()=>{const prototype=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
const open=async()=>{await click([...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(b=>b.querySelector('h2')?.textContent==='Flowchart Builder')!);};
beforeEach(async()=>{localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');(()=>{const p=exampleProject();saveCharts({projects:[p],activeId:p.id,tutorialCompleted:true});})();executions.length=0;vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<App/>));await open();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('uses the same compiler footer credits in the flowchart workspace',()=>{
  const footer=container.querySelector('.flow-builder > footer.statusbar');
  expect(footer).not.toBeNull();
  expect([...footer!.querySelectorAll('.credit-item')].map(item=>item.textContent)).toEqual(['Deployed by Mustaqim 11 Boys Red','Made by Amar 11 Boys Blue']);
  expect(footer!.querySelectorAll('.credit-divider')).toHaveLength(1);
});
it('opens a themed canvas and replays the guided walkthrough from Help',async()=>{expect(container.querySelector('.flow-builder')?.getAttribute('data-pico-theme')).toBe('catppuccin-mocha');expect(container.querySelectorAll('.flow-palette-block[draggable="true"]')).toHaveLength(7);expect(container.querySelectorAll('.flow-node')).toHaveLength(5);await click(button('Help'));expect(container.querySelector('#flow-tour-title')?.textContent).toBe('Learn the flowchart workspace');expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to home screen"]')?.disabled).toBe(true);expect(container.querySelectorAll('.flow-node')).toHaveLength(0);});
it('adds, edits, connects, deletes, undoes and redoes blocks',async()=>{await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-process')!);expect(container.querySelectorAll('.flow-node')).toHaveLength(6);await change(container.querySelector('[aria-label="Block expression"]')!,'Total ← 2 * 5');expect(container.querySelector('.flow-node.is-selected')?.textContent).toContain('Total ← 2 * 5');await click(button('Delete block'));expect(container.querySelectorAll('.flow-node')).toHaveLength(5);await click(container.querySelector('[aria-label="Undo flowchart edit"]')!);expect(container.querySelectorAll('.flow-node')).toHaveLength(6);await click(container.querySelector('[aria-label="Redo flowchart edit"]')!);expect(container.querySelectorAll('.flow-node')).toHaveLength(5);
  await click(container.querySelector('[data-node-id="prompt"] .port-next')!);await click(container.querySelector('[data-node-id="hello"]')!);expect(container.querySelectorAll('.flow-edge')).toHaveLength(4);expect(container.querySelector('.flow-validation')?.textContent).toContain('Connect this block');
});
it('runs the chart, accepts console input, and builds a debugger trace',async()=>{await click(button('Debug'));expect(container.querySelector('.console-input-form')).not.toBeNull();await change(container.querySelector('.console-input-form input')!,'Ada');await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));for(let i=0;i<4;i++)await click(button('Step'));expect(container.querySelector('.debugger-panel')?.textContent).toContain('Ada');expect(container.querySelector('.debugger-panel')?.textContent).toContain('Hello Ada!');expect(button('Run').disabled).toBe(false);});
it('reports invalid integer input once and ends execution',async()=>{await importPractice('multiply');await click(button('Run'));await change(container.querySelector('.console-input-form input')!,'hello');await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(container.querySelector('.runtime-error-card')?.textContent).toContain('Error');expect(container.querySelector('.runtime-error-card')?.getAttribute('title')).toBe('Select the block with this error');expect(container.querySelector('.console-input-form')).toBeNull();expect(button('Run').disabled).toBe(false);expect(container.querySelector('.flow-node.has-error')?.getAttribute('data-node-id')).toBe('first');});
it('stops waiting input and ignores late output after going home',async()=>{await click(button('Run'));await click(button('Stop'));expect(executions[0].cancel).toHaveBeenCalled();expect(container.querySelector('.console-input-form')).toBeNull();expect(container.querySelector('.console-entry-note')?.textContent).toContain('Execution stopped');await click(button('Run'));await click(container.querySelector('[aria-label="Go to home screen"]')!);expect(executions[1].cancel).toHaveBeenCalled();await act(async()=>executions[1].callbacks.onOutput?.(['stale output']));expect(container.textContent).not.toContain('stale output');});
it('converts to highlighted pseudocode and opens a new compiler workspace',async()=>{await click(button('Convert to pseudocode'));expect(container.querySelector('.flow-code-panel pre')?.textContent).toContain('DECLARE Name : STRING');expect(container.querySelector('.flow-code-panel .syntax-keyword')).not.toBeNull();await click(button('Open in Pseudocode Compiler'));expect(container.querySelector('textarea')?.value).toContain('OUTPUT "Hello ", Name, "!"');expect(container.querySelectorAll('.workspace-tabs .project-row')).toHaveLength(2);await click(container.querySelector('[aria-label="Go to home screen"]')!);await open();expect(container.querySelectorAll('.flow-node')).toHaveLength(5);});
it('prevents duplicate names and preserves edits when browser storage is blocked',async()=>{await click(container.querySelector('[aria-label="New flowchart workspace"]')!);await change(container.querySelector('[aria-label="Flowchart workspace name"]')!,'Ask a name');await act(async()=>container.querySelector<HTMLInputElement>('[aria-label="Flowchart workspace name"]')!.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));expect(container.querySelector('.flow-message')?.textContent).toContain('already exists');vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-output')!);await click(container.querySelector('[aria-label="Go to home screen"]')!);await open();expect(container.querySelectorAll('.flow-node')).toHaveLength(1);});
it('persists charts and the selected workspace across reloads',async()=>{await importPractice('counter');await click(container.querySelector('[aria-label="Go to home screen"]')!);await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<App/>));await open();expect(container.querySelector<HTMLInputElement>('[aria-label="Flowchart workspace name"]')?.value).toBe('Count to five');expect(container.querySelectorAll('.flow-node')).toHaveLength(6);});

it('accepts successive console inputs and displays a calculation',async()=>{await importPractice('multiply');await click(button('Run'));for(const value of ['6','7']){await change(container.querySelector('.console-input-form input')!,value);await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}expect(container.querySelector('.output-list')?.textContent).toContain('42');expect(container.querySelector('.console-input-form')).toBeNull();});
it('drops palette blocks at canvas coordinates and moves them with keyboard controls',async()=>{
  const viewport=container.querySelector<HTMLElement>('.flow-viewport')!;
  const drop=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperties(drop,{dataTransfer:{value:{getData:()=> 'output'}},clientX:{value:350},clientY:{value:240}});
  await act(async()=>viewport.dispatchEvent(drop));expect(container.querySelectorAll('.flow-node')).toHaveLength(6);
  const node=container.querySelector<HTMLElement>('.flow-node.is-selected')!;const previous=parseFloat(node.style.left);
  await act(async()=>node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowRight'})));
  expect(parseFloat(node.style.left)).toBe(previous+16);
});
it('reconnects a decision branch through the inspector and validates missing connections',async()=>{
  await importPractice('largest');await click(container.querySelector('[data-node-id="compare"]')!);
  await change(container.querySelector('[aria-label="yes destination"]')!,'');await click(button('Run'));expect(container.querySelector('.runtime-error-card')?.textContent).toContain('Yes');
  await change(container.querySelector('[aria-label="yes destination"]')!,'larger1');await click(button('Convert to pseudocode'));expect(container.querySelector('.flow-code-panel pre')?.textContent).toContain('IF Number1 > Number2 THEN');
});

async function importPractice(key:ExampleKey) {
  const source=serializeChart(exampleProject(key)),file={size:source.length,text:async()=>source};
  const input=container.querySelector<HTMLInputElement>('.flow-palette input[type="file"]')!;
  Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
}
async function requiredWalkthrough() {
  await click(button('Start walkthrough'));expect(button('Next').disabled).toBe(true);
  await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-start')!);await click(button('Next'));
  await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-output')!);await click(button('Next'));
  expect(button('Next').disabled).toBe(true);await change(container.querySelector('[aria-label="Block expression"]')!,'"Hello, Pico!"');await click(button('Next'));
  await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-end')!);await click(button('Next'));
  await click(container.querySelector('.flow-kind-start.flow-node .port-next')!);await click(container.querySelector('.flow-kind-output.flow-node')!);await click(button('Next'));
  await click(container.querySelector('.flow-kind-output.flow-node .port-next')!);await click(container.querySelector('.flow-kind-end.flow-node')!);await click(button('Next'));
  expect(button('Next').disabled).toBe(true);await click(button('Run'));await click(button('Next'));
  await click(button('Convert to pseudocode'));await click(button('Next'));await click(button('Finish walkthrough'));
}
it('supports completing the full tutorial and preserves saved charts',async()=>{
  const previous=loadCharts();await act(async()=>root.unmount());saveCharts({...previous,tutorialCompleted:false});root=createRoot(container);await act(async()=>root.render(<App/>));await open();
  expect(container.querySelector('#flow-tour-title')?.textContent).toBe('Learn the flowchart workspace');expect(button('Skip tutorial')).toBeDefined();
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(container.querySelector('.flow-tutorial')).not.toBeNull();expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to home screen"]')!.disabled).toBe(true);
  await requiredWalkthrough();expect(container.querySelector('.flow-tutorial')).toBeNull();expect(container.querySelectorAll('.flow-node')).toHaveLength(5);
  await click(container.querySelector('[aria-label="Go to home screen"]')!);expect(loadCharts().tutorialCompleted).toBe(true);expect(loadCharts().projects).toEqual(previous.projects);await open();expect(container.querySelector('.flow-tutorial')).toBeNull();
});
it.each([false,true])('skips the tutorial, preserves user charts and remembers dismissal (practice started: %s)',async started=>{
  const previous=loadCharts();await act(async()=>root.unmount());saveCharts({...previous,tutorialCompleted:false});root=createRoot(container);await act(async()=>root.render(<App/>));await open();
  if(started){await click(button('Start walkthrough'));await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-start')!);}
  await click(button('Skip tutorial'));
  expect(container.querySelector('.flow-tutorial')).toBeNull();expect(container.querySelectorAll('.flow-node')).toHaveLength(5);
  expect(loadCharts().tutorialCompleted).toBe(true);expect(loadCharts().projects).toEqual(previous.projects);
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Go to home screen"]')!.disabled).toBe(false);
  await click(container.querySelector('[aria-label="Go to home screen"]')!);await open();expect(container.querySelector('.flow-tutorial')).toBeNull();
  await click(button('Help'));expect(container.querySelector('.flow-tutorial')).not.toBeNull();await click(button('Skip tutorial'));expect(container.querySelector('.flow-tutorial')).toBeNull();
});
it('opens new workspaces on an empty canvas without examples or a Variable block',async()=>{
  await click(container.querySelector('[aria-label="New flowchart workspace"]')!);
  expect(container.querySelectorAll('.flow-node')).toHaveLength(0);expect(container.querySelector('.flow-empty-canvas')?.textContent).toContain('Made by Mustaqim and Amar');
  expect(container.querySelector('[aria-label="New flowchart from example"]')).toBeNull();expect(container.querySelector('.flow-palette-block.flow-kind-declare')).toBeNull();
  await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-start')!);expect(container.querySelector('.flow-empty-canvas')).toBeNull();
  expect(container.querySelector('.flow-node.has-error')).not.toBeNull();
});
it('highlights invalid block syntax in red and uses the editor syntax classes',async()=>{
  await click(container.querySelector('[data-node-id="hello"]')!);await change(container.querySelector('[aria-label="Block expression"]')!,'"Hello ", Name, 5');
  expect(container.querySelector('.flow-node.is-selected .syntax-keyword')).not.toBeNull();expect(container.querySelector('.flow-node.is-selected .syntax-string')).not.toBeNull();expect(container.querySelector('.flow-node.is-selected .syntax-number')).not.toBeNull();
  await change(container.querySelector('[aria-label="Block expression"]')!,'"unfinished');expect(container.querySelector('[data-node-id="hello"]')?.classList.contains('has-error')).toBe(true);
});

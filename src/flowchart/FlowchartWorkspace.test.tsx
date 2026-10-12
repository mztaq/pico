// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import App from '../app/App';
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
beforeEach(async()=>{localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');executions.length=0;vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<App/>));await open();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('opens a themed canvas with draggable block types and meaningful help',async()=>{expect(container.querySelector('.flow-builder')?.getAttribute('data-pico-theme')).toBe('catppuccin-mocha');expect(container.querySelectorAll('.flow-palette-block[draggable="true"]')).toHaveLength(8);expect(container.querySelectorAll('.flow-node')).toHaveLength(5);await click(button('Help'));expect(container.querySelectorAll('.flow-help li')).toHaveLength(5);expect(container.querySelector('.flow-help')?.textContent).toContain('Mustaqim');expect(container.querySelector('.flow-help')?.textContent).toContain('Amar');await click(button('Start building'));expect(container.querySelector('.flow-help')).toBeNull();});
it('adds, edits, connects, deletes, undoes and redoes blocks',async()=>{await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-process')!);expect(container.querySelectorAll('.flow-node')).toHaveLength(6);await change(container.querySelector('[aria-label="Block expression"]')!,'Total ← 2 * 5');expect(container.querySelector('.flow-node.is-selected')?.textContent).toContain('Total ← 2 * 5');await click(button('Delete block'));expect(container.querySelectorAll('.flow-node')).toHaveLength(5);await click(container.querySelector('[aria-label="Undo flowchart edit"]')!);expect(container.querySelectorAll('.flow-node')).toHaveLength(6);await click(container.querySelector('[aria-label="Redo flowchart edit"]')!);expect(container.querySelectorAll('.flow-node')).toHaveLength(5);
  await click(container.querySelector('[data-node-id="prompt"] .port-next')!);await click(container.querySelector('[data-node-id="hello"]')!);expect(container.querySelectorAll('.flow-edge')).toHaveLength(4);expect(container.querySelector('.flow-validation')?.textContent).toContain('Connect this block');
});
it('runs the chart, accepts console input, and builds a debugger trace',async()=>{await click(button('Debug'));expect(container.querySelector('.console-input-form')).not.toBeNull();await change(container.querySelector('.console-input-form input')!,'Ada');await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));for(let i=0;i<4;i++)await click(button('Step'));expect(container.querySelector('.debugger-panel')?.textContent).toContain('Ada');expect(container.querySelector('.debugger-panel')?.textContent).toContain('Hello Ada!');expect(button('Run').disabled).toBe(false);});
it('reports invalid integer input once and ends execution',async()=>{await change(container.querySelector('[aria-label="New flowchart from example"]')!,'multiply');await click(button('Run'));await change(container.querySelector('.console-input-form input')!,'hello');await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(container.querySelector('.runtime-error-card')?.textContent).toContain('Error');expect(container.querySelector('.runtime-error-card')?.getAttribute('title')).toBe('Select the block with this error');expect(container.querySelector('.console-input-form')).toBeNull();expect(button('Run').disabled).toBe(false);expect(container.querySelector('.flow-node.has-error')?.getAttribute('data-node-id')).toBe('first');});
it('stops waiting input and ignores late output after going home',async()=>{await click(button('Run'));await click(button('Stop'));expect(executions[0].cancel).toHaveBeenCalled();expect(container.querySelector('.console-input-form')).toBeNull();expect(container.querySelector('.console-entry-note')?.textContent).toContain('Execution stopped');await click(button('Run'));await click(container.querySelector('[aria-label="Go to home screen"]')!);expect(executions[1].cancel).toHaveBeenCalled();await act(async()=>executions[1].callbacks.onOutput?.(['stale output']));expect(container.textContent).not.toContain('stale output');});
it('converts to highlighted pseudocode and opens a new compiler workspace',async()=>{await click(button('Convert to pseudocode'));expect(container.querySelector('.flow-code-panel pre')?.textContent).toContain('DECLARE Name : STRING');expect(container.querySelector('.flow-code-panel .syntax-keyword')).not.toBeNull();await click(button('Open in Pseudocode Compiler'));expect(container.querySelector('textarea')?.value).toContain('OUTPUT "Hello ", Name, "!"');expect(container.querySelectorAll('.workspace-tabs .project-row')).toHaveLength(2);await click(container.querySelector('[aria-label="Go to home screen"]')!);await open();expect(container.querySelectorAll('.flow-node')).toHaveLength(5);});
it('prevents duplicate names and preserves edits when browser storage is blocked',async()=>{await click(container.querySelector('[aria-label="New flowchart workspace"]')!);await change(container.querySelector('[aria-label="Flowchart workspace name"]')!,'Ask a name');await act(async()=>container.querySelector<HTMLInputElement>('[aria-label="Flowchart workspace name"]')!.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));expect(container.querySelector('.flow-message')?.textContent).toContain('already exists');vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});await click(container.querySelector<HTMLElement>('.flow-palette-block.flow-kind-output')!);await click(container.querySelector('[aria-label="Go to home screen"]')!);await open();expect(container.querySelectorAll('.flow-node')).toHaveLength(3);});
it('persists charts and the selected workspace across reloads',async()=>{await change(container.querySelector('[aria-label="New flowchart from example"]')!,'counter');await click(container.querySelector('[aria-label="Go to home screen"]')!);await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<App/>));await open();expect(container.querySelector<HTMLInputElement>('[aria-label="Flowchart workspace name"]')?.value).toBe('Count to five');expect(container.querySelectorAll('.flow-node')).toHaveLength(6);});

it('accepts successive console inputs and displays a calculation',async()=>{await change(container.querySelector('[aria-label="New flowchart from example"]')!,'multiply');await click(button('Run'));for(const value of ['6','7']){await change(container.querySelector('.console-input-form input')!,value);await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}expect(container.querySelector('.output-list')?.textContent).toContain('42');expect(container.querySelector('.console-input-form')).toBeNull();});
it('drops palette blocks at canvas coordinates and moves them with keyboard controls',async()=>{
  const viewport=container.querySelector<HTMLElement>('.flow-viewport')!;
  const drop=new Event('drop',{bubbles:true,cancelable:true});Object.defineProperties(drop,{dataTransfer:{value:{getData:()=> 'output'}},clientX:{value:350},clientY:{value:240}});
  await act(async()=>viewport.dispatchEvent(drop));expect(container.querySelectorAll('.flow-node')).toHaveLength(6);
  const node=container.querySelector<HTMLElement>('.flow-node.is-selected')!;const previous=parseFloat(node.style.left);
  await act(async()=>node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowRight'})));
  expect(parseFloat(node.style.left)).toBe(previous+16);
});
it('reconnects a decision branch through the inspector and validates missing connections',async()=>{
  await change(container.querySelector('[aria-label="New flowchart from example"]')!,'largest');await click(container.querySelector('[data-node-id="compare"]')!);
  await change(container.querySelector('[aria-label="yes destination"]')!,'');await click(button('Run'));expect(container.querySelector('.runtime-error-card')?.textContent).toContain('Yes');
  await change(container.querySelector('[aria-label="yes destination"]')!,'larger1');await click(button('Convert to pseudocode'));expect(container.querySelector('.flow-code-panel pre')?.textContent).toContain('IF Number1 > Number2 THEN');
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runRequests, type WorkerRequest } from '../runtime/worker';
import App from './App';

vi.mock('./components/CodeEditor',()=>({CodeEditor:({value,onChange}:{value:string;onChange:(value:string)=>void})=><textarea aria-label="Test pseudocode editor" value={value} onChange={event=>onChange(event.target.value)} />}));
class BrowserWorker {
  static pending: BrowserWorker[]=[];
  onmessage?: (event:{data:ReturnType<typeof runRequests>})=>void;
  onerror?: (event:{preventDefault:()=>void})=>void;
  terminated=false;
  request?:WorkerRequest;
  constructor() { BrowserWorker.pending.push(this); }
  postMessage(request:WorkerRequest) { this.request=request; }
  terminate() { this.terminated=true; }
  complete() { this.onmessage?.({data:runRequests(this.request!)}); }
}
let container:HTMLDivElement;
let root:Root;
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
const click=async(element:HTMLElement)=>act(async()=>{element.click();});
beforeEach(async()=>{
  localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');localStorage.setItem('pico.settings.v4',JSON.stringify({autoDeclare:false,promptForInput:false}));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',BrowserWorker);BrowserWorker.pending=[];
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<App/>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe('workspace execution integration',()=>{
  it('runs through a worker, shows output and replays final debugger state',async()=>{
    await click(button('Run⌘ ↵'));expect(button('Stop')).toBeTruthy();
    await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect([...container.querySelectorAll('.output-line')].map(line=>line.textContent)).toEqual(['›1','›2','›3','›4','›5']);
    await click(button('Debug'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(container.querySelector('.debugger-panel')).not.toBeNull();
    const steps=BrowserWorker.pending.at(-1)!.request!;expect(steps.runs[0]!.options.files).toEqual({});
  });
  it('stops a pending run and rejects a late worker response',async()=>{
    await click(button('Run⌘ ↵'));const worker=BrowserWorker.pending.at(-1)!;
    await click(button('Stop'));await act(async()=>worker.complete());
    expect(container.textContent).toContain('Execution stopped.');expect(worker.terminated).toBe(true);expect(container.querySelector('.output-line')).toBeNull();
  });
  it('runs saved tests in isolated worker batches',async()=>{
    await click(button('Test cases1'));await click(button('Run tests'));
    await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(container.querySelector('.result-chip')?.textContent).toBe('Passed');expect(BrowserWorker.pending.at(-1)!.request!.runs[0]!.options.trace).toBe(false);
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import type { ExecutionCallbacks, ExecutionJob } from '../runtime/runner';
import type { ExecutionReply } from '../runtime/worker';
import { preloadPythonRuntime } from '../runtime/python/runner';
import type { PythonRequest } from '../runtime/python/config';
const jobs=vi.hoisted(()=>[] as {request:PythonRequest;callbacks:ExecutionCallbacks;job:ExecutionJob;finish:(value:ExecutionReply[])=>void}[]);
vi.mock('./components/CodeEditor',()=>({CodeEditor:({value,onChange,language,preferences}:{value:string;onChange:(value:string)=>void;language:string;preferences:{fontSize:number}})=><textarea aria-label={`${language} editor`} data-font-size={preferences.fontSize} value={value} onInput={event=>onChange(event.currentTarget.value)} />}));
vi.mock('../runtime/python/runner',()=>({preloadPythonRuntime:vi.fn(),startPythonExecution:(request:PythonRequest,callbacks:ExecutionCallbacks)=>{
  let finish!:(value:ExecutionReply[])=>void;const promise=new Promise<ExecutionReply[]>(resolve=>{finish=resolve;});
  const job={promise,cancel:vi.fn(()=>finish([{error:{code:'cancelled',message:'Execution stopped.'}}])),provideInput:vi.fn(()=>true)};
  jobs.push({request,callbacks,job,finish});return job;
}}));
let container:HTMLDivElement,root:Root;
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
const click=async(element:HTMLElement)=>act(async()=>element.click());
const choose=async(language:string)=>{await click(container.querySelector(`.compiler-choice h2`)?.textContent===language?container.querySelector<HTMLElement>('.compiler-choice')!:container.querySelectorAll<HTMLElement>('.compiler-choice')[1]!);};
async function type(element:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeEach(async()=>{
  localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');localStorage.setItem('pico.python.visitCount.v1','3');jobs.length=0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<App/>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('opens on a themed home screen with all workspace choices and creator credits',()=>{
  expect(document.title).toBe('Pico | Home');
  expect(container.querySelector('.pico-home')?.getAttribute('data-pico-theme')).toBe('catppuccin-mocha');
  expect([...container.querySelectorAll('.compiler-choice h2')].map(h=>h.textContent)).toEqual(['Pseudocode Compiler','Python Compiler','Flowchart Builder','Logic Sim','CPU Studio']);
  expect(container.querySelector('.home-credits')?.textContent).toContain('Mustaqim');expect(container.querySelector('.home-credits')?.textContent).toContain('Amar');
  expect(container.querySelector('.compiler-choices .syntax-keyword')).not.toBeNull();
});
it('shows left, center and right contributor credits in Logic Sim',async()=>{
  const logicChoice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(choice=>choice.querySelector('h2')?.textContent==='Logic Sim');
  expect(logicChoice).toBeDefined();
  await click(logicChoice!);
  expect(document.title).toBe('Pico | Logic Sim');
  const footer=container.querySelector('.logic-app > footer.statusbar.logic-footer');
  expect(footer).not.toBeNull();
  expect(footer!.querySelector('.attribution.logic-attribution')).not.toBeNull();
  expect([...footer!.querySelectorAll('.credit-item')].map(item=>item.textContent)).toEqual([
    'Deployed by Mustaqim 11 Boys Red',
    'Logic Sim conceptualised by Mohamed Hamza 11 Boys Red',
    'Made by Amar 11 Boys Blue',
  ]);
  expect(footer!.querySelectorAll('.credit-divider')).toHaveLength(2);
});
it('shows the updated Logic Sim editor controls and shared theme picker',async()=>{
  const choice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='Logic Sim');
  await click(choice!);
  expect(container.textContent).not.toContain('Saved locally');
  expect(container.textContent).not.toContain('EXAMPLE CIRCUITS');
  expect(container.querySelector('.logic-toolbar')?.textContent).toContain('Select all');
  expect(container.querySelector('.logic-toolbar')?.textContent).toContain('Boolean Expression');
  await click(container.querySelector<HTMLElement>('[aria-label="Logic Simulator theme"]')!);
  expect(container.querySelector('.logic-theme-menu .theme-picker')).not.toBeNull();
  expect(container.querySelector('.logic-theme-menu')?.textContent).toContain('Dracula');
});
it('moves workspaces below the top bar and removes the obsolete UI',async()=>{
  await choose('Pseudocode Compiler');
  expect(document.title).toBe('Pico | Pseudocode Compiler');
  expect(button('Go to Python Compiler')).toBeDefined();expect(button('Go to Pseudocode Compiler')).toBeUndefined();
  expect(container.querySelector('.topbar')?.nextElementSibling?.className).toBe('workspace-tabs');
  expect(container.querySelector('.sidebar')).toBeNull();expect(container.querySelector('textarea')?.dataset.fontSize).toBe('19');
  expect(container.textContent).not.toMatch(/Saved on this device|Saved locally|Stored locally|Test cases/i);
});
it('preserves separate projects, source and settings through switches and reloads',async()=>{
  await choose('Pseudocode Compiler');
  await type(container.querySelector('[aria-label="Workspace name"]')!,'Algorithms');
  await type(container.querySelector('textarea')!,'OUTPUT "Pseudocode kept"');
  await click(container.querySelector('[aria-label="Open settings"]')!);await click(button('High Contrast Blue'));
  await click(button('Go to Python Compiler'));
  expect(document.title).toBe('Pico | Python Compiler');
  expect(container.querySelector('.file-tab-select span')?.textContent).toBe('main.py');
  expect(container.querySelector('textarea')?.getAttribute('aria-label')).toBe('python editor');
  expect(container.querySelector('.pico-app')?.getAttribute('data-pico-theme')).toBe('high-contrast-blue');
  expect(button('Go to Pseudocode Compiler')).toBeDefined();expect(button('Go to Python Compiler')).toBeUndefined();
  expect([...container.querySelectorAll('.dock-tab')].map(b=>b.textContent)).toEqual(['Console','Debugger']);
  await type(container.querySelector('[aria-label="Workspace name"]')!,'Python lesson');
  await type(container.querySelector('textarea')!,'number=5\nprint(f"Value: {number} <- unchanged")');
  await click(button('Go to Pseudocode Compiler'));
  expect(container.querySelector('textarea')?.value).toBe('OUTPUT "Pseudocode kept"');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Workspace name"]')?.value).toBe('Algorithms');
  await click(button('Go to Python Compiler'));
  expect(container.querySelector('textarea')?.value).toBe('number=5\nprint(f"Value: {number} <- unchanged")');
  await click(container.querySelector('[aria-label="Go to home screen"]')!);await choose('Python Compiler');
  expect(container.querySelector('textarea')?.value).toContain('unchanged');
  await click(container.querySelector('[aria-label="Go to home screen"]')!);
  await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<App/>));
  expect(container.querySelector('.pico-home')).not.toBeNull();await choose('Python Compiler');
  expect(container.querySelector('textarea')?.value).toContain('unchanged');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Workspace name"]')?.value).toBe('Python lesson');
});
it('preserves edits in memory even when browser storage rejects saves',async()=>{
  await choose('Pseudocode Compiler');await type(container.querySelector('textarea')!,'OUTPUT "Kept"');
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
  await click(button('Go to Python Compiler'));await type(container.querySelector('textarea')!,'print("Python kept")');
  await click(button('Go to Pseudocode Compiler'));expect(container.querySelector('textarea')?.value).toBe('OUTPUT "Kept"');
  await click(button('Go to Python Compiler'));expect(container.querySelector('textarea')?.value).toBe('print("Python kept")');
});
it('runs Python source, accepts console input and displays final debugger variables',async()=>{
  await choose('Python Compiler');expect(preloadPythonRuntime).toHaveBeenCalled();expect(container.querySelector('textarea')?.value).toBe('');await type(container.querySelector('textarea')!,'name=input("Enter your name: ")\nprint(f"Hello {name}!")');await click(button('Debug'));const execution=jobs[0]!;
  expect(execution.request.code).toContain('input(');expect(execution.request.debug).toBe(true);expect(execution.request.filename).toBe('main.py');
  await act(async()=>{execution.callbacks.onStatus?.('Python 3.14.2');execution.callbacks.onOutput?.(['Enter your name: ']);execution.callbacks.onInput?.({id:1,variable:'input()',dataType:'STRING',line:3});});
  expect(container.querySelector('.brand-subtitle')?.textContent).toBe('Python 3.14.2');
  await type(container.querySelector('.console-input-form input')!,'Ada');
  await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(execution.job.provideInput).toHaveBeenCalledWith(1,'Ada');
  await act(async()=>{execution.callbacks.onOutput?.(['Hello Ada!']);execution.finish([{result:{output:['Hello Ada!'],variables:{name:'Ada'},coverage:[],trace:[{line:4,label:'Finished',variables:{name:'Ada',ready:true},output:['Hello Ada!']}],steps:2,files:{},traceTruncated:false}}]);});
  expect(container.querySelector('.debugger-panel')).not.toBeNull();expect(container.querySelector('.variable-list')?.textContent).toContain('"Ada"');expect(container.querySelector('.variable-list')?.textContent).toContain('True');
});
it('shows Python failures as Error, ends pending input, and cancels runs on compiler switches',async()=>{
  await choose('Python Compiler');await click(button('Run⌘ ↵'));const execution=jobs[0]!;
  await act(async()=>{execution.callbacks.onStderr?.(['problem']);execution.finish([{error:{message:'ValueError: invalid integer',line:3,code:'python',diagnostic:'main.py\nValueError: invalid integer'}}]);});
  expect(container.querySelector('.console-entry-error')?.textContent).toBe('Errorproblem');
  expect(container.querySelector('.error-heading')?.textContent).toContain('Error');expect(container.querySelector('.diagnostic-message')?.textContent).toContain('ValueError');expect(container.querySelector('.error-tip')).toBeNull();
  expect(button('Run⌘ ↵').disabled).toBe(false);expect(container.querySelector('.console-input-form')).toBeNull();
  await click(button('Run⌘ ↵'));const pending=jobs[1]!;
  await click(button('Go to Pseudocode Compiler'));expect(pending.job.cancel).toHaveBeenCalled();
  await act(async()=>pending.callbacks.onOutput?.(['stale output']));
  expect(container.textContent).not.toContain('stale output');
});
it('shows a Python tutorial with matching syntax and no rendering loop',async()=>{
  await choose('Python Compiler');await click(button('Help'));await click(button('Next'));
  expect(container.querySelector('#tutorial-description')?.textContent).toContain('Python');expect(container.querySelector('.tutorial-example')?.textContent).toContain('input(');
  expect(container.querySelector('.tutorial-example')?.textContent).not.toContain('DECLARE');
  for(let i=0;i<6;i++)await click(button('Next')??button('Finish tour'));
  expect(container.querySelector('#tutorial-description')?.textContent).toContain('.py');await click(button('Finish tour'));
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('Tour complete');
});

it('opens the CPU Studio workspace with themed registers and memory',async()=>{
  const cpuChoice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(choice=>choice.querySelector('h2')?.textContent==='CPU Studio');
  expect(cpuChoice).toBeDefined();
  await click(cpuChoice!);
  expect(document.title).toBe('Pico | CPU Studio');
  expect(container.querySelector('.cpu-app')).not.toBeNull();
  expect(container.querySelectorAll('.cpu-memory-cell')).toHaveLength(16);
  expect(container.querySelector('[aria-label="CPU clock speed GHz"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Assembly source code"]')).not.toBeNull();
  await click(button('Step'));
  expect(container.textContent).toContain('PC identifies the next instruction');
});

it('assembles new CPU source and restores RAM after reset',async()=>{
 const choice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='CPU Studio');
 await click(choice!);
 const editor=container.querySelector<HTMLTextAreaElement>('[aria-label="Assembly source code"]')!;
 await type(editor,'LDI 7\\nSTA 0101\\nHLT\\n.ORG 0101\\nDAT 0'.replaceAll('\\n','\\n'));
 await click(button('Assemble'));
 expect(container.textContent).toContain('Assembled 3 instructions');
 expect(container.querySelectorAll('.cpu-memory-cell')).toHaveLength(16);
 const ghz=container.querySelector<HTMLInputElement>('[aria-label="CPU clock speed GHz"]')!;
 expect(ghz.min).toBe('0.5');
 expect(ghz.max).toBe('5');
 await click(button('Step'));
 expect(container.textContent).toContain('PC identifies');
 await click(button('Reset'));
 expect(container.textContent).toContain('Registers and memory restored');
});

// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInteractiveSession, runRequests, type InputMessage, type WorkerReply, type WorkerRequest } from '../runtime/worker';
import { Workspace } from './App';
const App = () => <Workspace language="pseudocode" onChoose={()=>{}} onHome={()=>{}} />;
import { referenceExamples, referenceTerms } from './reference';
import { tutorialSteps } from './components/GuidedTutorial';

vi.mock('./components/CodeEditor',()=>({CodeEditor:({value,onChange,preferences}:{value:string;onChange:(value:string)=>void;preferences:{fontSize:number}})=><textarea aria-label="Test pseudocode editor" data-font-size={preferences.fontSize} value={value} onInput={event=>onChange(event.currentTarget.value)} />}));
class BrowserWorker {
  static pending: BrowserWorker[]=[];
  onmessage?: (event:{data:WorkerReply})=>void;
  onerror?: (event:{preventDefault:()=>void})=>void;
  terminated=false;
  request?:WorkerRequest;
  session?:ReturnType<typeof createInteractiveSession>;
  constructor() { BrowserWorker.pending.push(this); }
  postMessage(request:WorkerRequest | InputMessage) {
    if('type' in request) queueMicrotask(()=>{ if(!this.terminated)this.session?.input(request); });
    else this.request=request;
  }
  terminate() { this.terminated=true; }
  complete() {
    if(this.request!.interactive){
      this.session=createInteractiveSession(this.request!,data=>this.onmessage?.({data}));this.session.start();
    }else this.onmessage?.({data:runRequests(this.request!)});
  }
}
let container:HTMLDivElement;
let root:Root;
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
const click=async(element:HTMLElement)=>act(async()=>{element.click();});
async function typeValue(element:HTMLInputElement | HTMLTextAreaElement,value:string){
  await act(async()=>{
    const prototype=element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);
    element.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
const codeEditor=()=>container.querySelector<HTMLTextAreaElement>('[aria-label="Test pseudocode editor"]')!;
const consoleInput=()=>container.querySelector<HTMLInputElement>('.console-input-form input')!;
const submitInput=async()=>act(async()=>{container.querySelector('form.console-input-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
beforeEach(async()=>{
  localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');localStorage.setItem('pico.settings.v5',JSON.stringify({autoDeclare:false}));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Worker',BrowserWorker);BrowserWorker.pending=[];
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<App/>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe('workspace execution integration',()=>{
  it('runs through a worker, shows output and replays final debugger state',async()=>{
    expect(container.querySelector('.pico-app')?.getAttribute('data-pico-theme')).toBe('catppuccin-mocha');
    expect(button('Run⌘ ↵').closest('.topbar')).not.toBeNull();
    expect(container.querySelector('.command-bar')).toBeNull();
    await click(button('Run⌘ ↵'));expect(button('Stop')).toBeTruthy();
    expect(button('Stop').closest('.topbar')).not.toBeNull();
    await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(codeEditor().value).toBe('// PICO - CAIE Friendly Pseudocode Compiler made by Mustaqim and Amar\n\nDECLARE Name : STRING\nOUTPUT "Enter your name"\nINPUT Name\nOUTPUT "Hello ", Name, "!"');
    expect(container.querySelector('.output-line')?.textContent).toBe('›Enter your name');
    expect(consoleInput().getAttribute('aria-label')).toBe('Value for Name');
    await typeValue(consoleInput(),'Ada');await submitInput();
    expect([...container.querySelectorAll('.output-line > span:last-child')].map(line=>line.textContent)).toEqual(['Enter your name','Ada','Hello Ada!']);
    await click(button('Debug'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    await typeValue(consoleInput(),'Ada');await submitInput();
    expect(container.querySelector('.debugger-panel')).not.toBeNull();
    const steps=BrowserWorker.pending.at(-1)!.request!;expect(steps.runs[0]!.options.files).toEqual({});
  });
  it('stops a pending run and rejects a late worker response',async()=>{
    await click(button('Run⌘ ↵'));const worker=BrowserWorker.pending.at(-1)!;
    await click(button('Stop'));await act(async()=>worker.complete());
    expect(container.textContent).toContain('Execution stopped.');expect(worker.terminated).toBe(true);expect(container.querySelector('.output-line')).toBeNull();
  });
  it('removes the unwanted sections and File actions',async()=>{
    expect(codeEditor().dataset.fontSize).toBe('19');
    expect(button('History')).toBeUndefined();
    expect(container.querySelector('.example-list')).toBeNull();
    const tabs=[...container.querySelectorAll('.dock-tab > span:not([class])')].map(tab=>tab.textContent);
    expect(tabs).toEqual(['Console','Debugger','Flowchart']);
    await click(button('File'));
    expect(button('Format code')).toBeUndefined();
    expect(button('Export Python')).toBeUndefined();
    expect(button('Import .pico')).toBeDefined();
    expect(button('Export .pico')).toBeDefined();
  });
  it('rejects duplicate project creation and rename while allowing unique names',async()=>{
    const prompt=vi.spyOn(window,'prompt').mockReturnValue(' untitled   PROGRAM ');
    const alert=vi.spyOn(window,'alert').mockImplementation(()=>{});
    try {
      await click(container.querySelector('[aria-label="New project"]')!);
      expect(container.querySelectorAll('.project-row')).toHaveLength(1);
      expect(alert).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      prompt.mockReturnValue('Lesson');
      await click(container.querySelector('[aria-label="New project"]')!);
      expect(container.querySelectorAll('.project-row')).toHaveLength(2);
      const name=container.querySelector<HTMLInputElement>('[aria-label="Workspace name"]')!;
      await typeValue(name,'UNTITLED PROGRAM');
      expect(name.getAttribute('aria-invalid')).toBe('true');
      expect(container.querySelector('#project-name-error')?.textContent).toContain('already exists');
      expect(container.querySelector('.project-row.active .project-select span')?.textContent).toBe('Lesson');
      await typeValue(name,'');
      expect(container.querySelector('.project-row.active .project-select span')?.textContent).toBe('Lesson');
      await typeValue(name,'Lesson two');
      expect(name.getAttribute('aria-invalid')).toBe('false');
      expect(container.querySelector('.project-row.active .project-select span')?.textContent).toBe('Lesson two');
    } finally { prompt.mockRestore(); alert.mockRestore(); }
  });
  it('imports repeated projects with unique names and preserved source',async()=>{
    const input=container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file={size:100,text:async()=>JSON.stringify({id:'import',name:'Untitled program',code:'OUTPUT 91',tests:[]})};
    for(let i=0;i<2;i++) {
      Object.defineProperty(input,'files',{value:[file],configurable:true});
      await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
      expect(codeEditor().value).toBe('OUTPUT 91');
    }
    expect([...container.querySelectorAll('.project-select span')].map(item=>item.textContent)).toEqual(['Untitled program','Untitled program (2)','Untitled program (3)']);
  });
  it('keeps the selected file when another tab closes and avoids repeated default filenames',async()=>{
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
    try {
      await click(container.querySelector('[aria-label="New file"]')!);
      await click(container.querySelector('[aria-label="New file"]')!);
      await typeValue(codeEditor(),'OUTPUT "Selected"');
      await click(container.querySelector('[aria-label="Close untitled-2.pico"]')!);
      expect(codeEditor().value).toBe('OUTPUT "Selected"');
      expect(container.querySelector('.file-tab.active .file-tab-select span')?.textContent).toBe('untitled-3.pico');
      await click(container.querySelector('[aria-label="New file"]')!);
      expect([...container.querySelectorAll('.file-tab-select span')].map(tab=>tab.textContent)).toEqual(['main.pico','untitled-3.pico','untitled-4.pico']);
    } finally { confirm.mockRestore(); }
  });
  it('shows stopped debug runs in the Console instead of an empty debugger',async()=>{
    await click(button('Debug'));
    await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    await click(button('Stop'));
    expect(container.querySelector('.console-input-form')).toBeNull();
    expect(container.querySelector('.console-entry-note')?.textContent).toContain('Execution stopped.');
    expect(container.querySelector('.debugger-panel')).toBeNull();
  });
  it.each(['hello', '5'])('ends a REAL input run with an Error for %s',async(value)=>{
    await typeValue(codeEditor(),'DECLARE Value : REAL\nINPUT Value\nOUTPUT Value');
    await click(button('Run⌘ ↵'));
    await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    await typeValue(consoleInput(),value);await submitInput();
    expect(container.querySelector('.runtime-error-card .error-heading')?.textContent).toContain('Error');
    expect(container.querySelector('.runtime-error-card')?.textContent).toContain('not a REAL');
    expect(container.querySelector('.console-input-form')).toBeNull();
    expect(button('Run⌘ ↵').disabled).toBe(false);
    expect(BrowserWorker.pending.at(-1)!.terminated).toBe(true);
    await click(button('Run⌘ ↵'));
    await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    await typeValue(consoleInput(),'5.0');await submitInput();
    expect(container.querySelector('.runtime-error-card')).toBeNull();
    expect(container.querySelector('.output-line:last-child')?.textContent).toBe('›5');
  });
  it('keeps project renaming in File and typing helpers in Settings',async()=>{
    const workspaceName = container.querySelector<HTMLInputElement>('.topbar [aria-label="Workspace name"]')!;
    vi.useFakeTimers();
    try {
      await typeValue(workspaceName,'Lesson workspace');
      expect(container.querySelector('.project-row.active .project-select span')?.textContent).toBe('Lesson workspace');
      await act(async()=>{ vi.advanceTimersByTime(400); });
      expect(JSON.parse(localStorage.getItem('pico.projects.v1')!)[0].name).toBe('Lesson workspace');
    } finally { vi.useRealTimers(); }
    await click(button('File'));
    await typeValue(container.querySelector<HTMLInputElement>('[aria-label="Workspace name in File menu"]')!,'Greeting');
    expect(container.querySelector<HTMLInputElement>('.topbar [aria-label="Workspace name"]')?.value).toBe('Greeting');
    await click(container.querySelector('[aria-label="Open settings"]')!);
    for (const label of ['Autocomplete','Autocorrect','Hover documentation']) {
      const control = container.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`)!;
      expect(control.getAttribute('aria-checked')).toBe('true');
      await click(control);
      expect(control.getAttribute('aria-checked')).toBe('false');
    }
    const stored = JSON.parse(localStorage.getItem('pico.settings.v6')!);
    expect([stored.autocomplete,stored.autocorrect,stored.hoverDocs]).toEqual([false,false,false]);
  });
  it('pauses for each value inline, retains the transcript and removes preset input',async()=>{
    await typeValue(codeEditor(),'DECLARE Name : STRING\nDECLARE Age : INTEGER\nOUTPUT "Name?"\nINPUT Name\nOUTPUT "Age?"\nINPUT Age\nOUTPUT Name, " is ", Age');
    expect(container.querySelector('[aria-label="Standard input values"]')).toBeNull();
    expect(container.textContent).not.toContain('STANDARD INPUT');
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(container.querySelector('.output-list')?.textContent).toContain('Name?');
    expect(document.activeElement).toBe(consoleInput());
    expect(consoleInput().getAttribute('aria-label')).toBe('Value for Name');
    expect(container.querySelector('.input-modal')).toBeNull();
    await typeValue(consoleInput(),'Ada');await submitInput();
    expect(consoleInput().getAttribute('aria-label')).toBe('Value for Age');
    await typeValue(consoleInput(),'16');await submitInput();
    expect(container.querySelector('.console-input-form')).toBeNull();
    expect([...container.querySelectorAll('.output-line > span:last-child')].map(line=>line.textContent)).toEqual(['Name?','Ada','Age?','16','Ada is 16']);
    expect(BrowserWorker.pending).toHaveLength(1);
  });
  it('stops while waiting, then starts a fresh session without old values',async()=>{
    await typeValue(codeEditor(),'DECLARE N : INTEGER\nOUTPUT "Enter"\nINPUT N\nOUTPUT N');
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    const oldWorker=BrowserWorker.pending.at(-1)!;
    await click(button('Stop'));
    expect(container.querySelector('.console-input-form')).toBeNull();
    expect(container.textContent).toContain('Execution stopped.');expect(oldWorker.terminated).toBe(true);
    await act(async()=>oldWorker.session!.input({type:'input',id:1,value:'99'}));
    expect(container.querySelector('.output-list')?.textContent).not.toContain('99');
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(container.querySelectorAll('.output-line')).toHaveLength(1);
    await typeValue(consoleInput(),'2');await submitInput();
    expect(container.querySelector('.output-list')?.textContent).not.toContain('99');
    expect(container.querySelector('.output-line:last-child')?.textContent).toBe('›2');
  });
  it('cancels a waiting run on an editor change and discards late responses',async()=>{
    await typeValue(codeEditor(),'DECLARE N : INTEGER\nINPUT N\nOUTPUT N');
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    const worker=BrowserWorker.pending.at(-1)!;
    await typeValue(codeEditor(),'OUTPUT "New program"');
    expect(worker.terminated).toBe(true);expect(container.querySelector('.console-input-form')).toBeNull();
    await act(async()=>worker.session!.input({type:'input',id:1,value:'12'}));
    expect(container.querySelector('.output-line')).toBeNull();
  });
  it('accepts an empty string and builds the debugger trace after interactive input',async()=>{
    await typeValue(codeEditor(),'DECLARE Name : STRING\nINPUT Name\nOUTPUT LENGTH(Name)');
    await click(button('Debug'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(container.querySelector('.console-input-form')).not.toBeNull();
    await submitInput();
    expect(container.querySelector('.debugger-panel')).not.toBeNull();
    await click(button('Console'));
    expect(container.querySelector('.output-line:last-child')?.textContent).toBe('›0');
  });
  it('cancels waiting input when switching source files',async()=>{
    await typeValue(codeEditor(),'DECLARE N : INTEGER\nOUTPUT "Old file"\nINPUT N');
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    const worker=BrowserWorker.pending.at(-1)!;
    await click(container.querySelector('[aria-label="New file"]')!);
    expect(worker.terminated).toBe(true);expect(container.querySelector('.console-input-form')).toBeNull();
    expect(container.querySelector('.output-line')).toBeNull();
  });
  it.each([
    ['Amar','The dev who engineered me day and night ☾'],
    ['Mustaqim','The soul who unleashed me to the World Wide Web 🌏︎'],
    ['Mr.Boyle','The Computer Science teacher who backed my creators and their work 🕮'],
    ['Mr. Boyle','The Computer Science teacher who backed my creators and their work 🕮'],
    ['Boyle','The Computer Science teacher who backed my creators and their work 🕮'],
    ['Mr Boyle','The Computer Science teacher who backed my creators and their work 🕮'],
    ['Fore','The head of Computer Science and ICT at our school 🖳'],
    ['mr fore','The head of Computer Science and ICT at our school 🖳'],
    ['Mr.Fore','The head of Computer Science and ICT at our school 🖳'],
    ['Mr. Fore','The head of Computer Science and ICT at our school 🖳'],
    ['  mUsTaQiM  ','The soul who unleashed me to the World Wide Web 🌏︎'],
  ])('shows the %s Easter egg while preserving the exact input and program output',async(value,message)=>{
    const code='DECLARE Name : STRING\nINPUT Name\nOUTPUT Name';
    await typeValue(codeEditor(),code);
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    await typeValue(consoleInput(),value);await submitInput();
    expect(container.querySelector('.console-entry-note > span:last-child')?.textContent).toBe(message);
    expect(container.querySelector('.console-entry-input > span:last-child')?.textContent).toBe(value);
    expect([...container.querySelectorAll('.output-line:not(.console-entry-input) > span:last-child')].map(line=>line.textContent)).toEqual([value]);
    expect(codeEditor().value).toBe(code);
  });
  it('leaves ordinary input alone and does not match names embedded in other text',async()=>{
    await typeValue(codeEditor(),'DECLARE Text : STRING\nINPUT Text\nOUTPUT Text');
    await click(button('Run⌘ ↵'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    await typeValue(consoleInput(),'Amar and Mustaqim are here');await submitInput();
    expect(container.querySelector('.console-entry-note')).toBeNull();
    expect(container.querySelector('.output-line:last-child > span:last-child')?.textContent).toBe('Amar and Mustaqim are here');
  });
});

describe('guided help and readable reference',()=>{
  it('shows a first-visit modal, traps focus, and starts the normal tutorial',async()=>{
    await act(async()=>root.unmount());
    localStorage.removeItem('pico.visitCount.v1');
    root=createRoot(container);
    await act(async()=>root.render(<StrictMode><App/></StrictMode>));
    const code=codeEditor().value;
    const offer=container.querySelector('.tutorial-offer')!;
    expect(offer.getAttribute('aria-modal')).toBe('true');
    expect(container.querySelector('.tutorial-offer-backdrop')).not.toBeNull();
    expect(container.querySelector('#tutorial-offer-title')?.textContent).toBe('New to Pico?');
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.topbar')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('footer')?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(button('Show tutorial'));
    expect(localStorage.getItem('pico.visitCount.v1')).toBe('1');
    await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true})));
    expect(document.activeElement).toBe(button('Not now'));
    await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true})));
    expect(document.activeElement).toBe(button('Show tutorial'));
    await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true})));
    expect(BrowserWorker.pending).toHaveLength(0);
    await click(button('Show tutorial'));
    expect(container.querySelector('.tutorial-offer-backdrop')).toBeNull();
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Name your workspace');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close tutorial');
    for(let i=0;i<tutorialSteps.length-1;i++)await click(button('Next'));
    await click(button('Finish tour'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Tour complete');
    expect(container.querySelector('.tutorial-tip')?.textContent).toBe('Try Mustaqim or Amar when your program asks for a name. A couple of familiar faces from your Computer Science department get a special greeting too. "Help" opens this tour again.');
    await click(button('Start coding'));
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(false);
    expect(codeEditor().value).toBe(code);
    await act(async()=>root.unmount());root=createRoot(container);
    await act(async()=>root.render(<StrictMode><App/></StrictMode>));
    expect(container.querySelector('.tutorial-offer')).toBeNull();
    expect(localStorage.getItem('pico.visitCount.v1')).toBe('2');
  });
  it('dismisses the welcome with Escape and leaves Help available',async()=>{
    await act(async()=>root.unmount());localStorage.removeItem('pico.visitCount.v1');root=createRoot(container);
    await act(async()=>root.render(<App/>));
    await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(container.querySelector('.tutorial-offer')).toBeNull();
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(false);
    await click(button('Help'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Name your workspace');
  });
  it('dismisses the welcome with Not now and restores the workspace',async()=>{
    await act(async()=>root.unmount());localStorage.removeItem('pico.visitCount.v1');root=createRoot(container);
    await act(async()=>root.render(<App/>));
    await click(button('Not now'));
    expect(container.querySelector('.tutorial-offer-backdrop')).toBeNull();
    expect(container.querySelector('.topbar')?.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('.tutorial-layer')).toBeNull();
  });
  it('walks through highlights, reaches the end screen, and restores the workspace without editing code',async()=>{
    const editor=container.querySelector('textarea')!.value;
    const workspaceName = container.querySelector<HTMLInputElement>('[data-tour="workspace"]')!;
    const measuredName = vi.spyOn(workspaceName,'getBoundingClientRect').mockReturnValue(new DOMRect(200,80,150,32));
    await click(button('Help'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Name your workspace');
    expect(container.querySelector('#tutorial-description')?.textContent).toContain('saves automatically');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('open File');
    expect(container.querySelector<HTMLElement>('.tutorial-spotlight')?.style.left).toBe('195px');
    measuredName.mockRestore();
    await click(button('Next'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Start with your code');
    expect(container.querySelector('.tutorial-example')?.textContent).toBe(editor.split('\n\n')[1]);
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.reference-card')).toBeNull();
    await click(button('Next'));await click(button('Next'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Read the result');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('press Enter');
    expect(container.querySelector('.tutorial-example')?.textContent).toBe(editor.split('\n\n')[1]);
    await click(button('Back'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Run your program');
    await click(button('Next'));await click(button('Next'));
    expect(container.querySelector('.dock-tab[aria-selected="true"]')?.textContent).toBe('Debugger');
    await click(button('Next'));expect(container.querySelector('[data-tour="reference"]')).not.toBeNull();
    await click(button('Next'));await click(button('Next'));await click(button('Finish tour'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Tour complete');
    expect(container.querySelector('.tutorial-tip')?.textContent).toBe('Try Mustaqim or Amar when your program asks for a name. A couple of familiar faces from your Computer Science department get a special greeting too. "Help" opens this tour again.');
    await click(button('Replay tour'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Name your workspace');
    await click(button('Skip for now'));
    expect(container.querySelector('.tutorial-layer')).toBeNull();
    expect(container.querySelector('.console-panel')).not.toBeNull();
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('textarea')!.value).toBe(editor);
    expect(container.querySelector('.reference-card')).not.toBeNull();
  });
  it('handles keyboard exit and brings focus back to Help',async()=>{
    const help=button('Help');help.focus();await click(help);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close tutorial');
    await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(container.querySelector('.tutorial-layer')).toBeNull();expect(document.activeElement).toBe(help);
  });
  it('highlights File for renaming when the workspace name is hidden',async()=>{
    const fileButton = container.querySelector<HTMLElement>('[data-tour="files"]')!;
    const measure = vi.spyOn(fileButton,'getBoundingClientRect').mockReturnValue(new DOMRect(700,16,60,36));
    await click(button('Help'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Name your workspace');
    expect(container.querySelector<HTMLElement>('.tutorial-spotlight')?.style.left).toBe('695px');
    measure.mockRestore();
  });
  it('adjusts and persists reference size with keyboard resizing',async()=>{
    await click(container.querySelector('[aria-label="Increase reference text size"]')!);
    expect(container.querySelector('.reference-controls output')?.textContent).toBe('14px');
    const splitter=container.querySelector('[aria-label="Resize quick reference panel"]')!;
    await act(async()=>splitter.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
    const settings=JSON.parse(localStorage.getItem('pico.settings.v6')!);
    expect(settings.referenceWidth).toBe(370);expect(settings.referenceFontSize).toBe(14);
    expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--reference-width: 370px');
    await click(button('FOR'));expect(container.querySelector('.reference-explanation > strong')?.textContent).toBe('FOR');
  });
  it('uses .pico for existing and newly created source tabs',async()=>{
    expect(container.querySelector('.file-tab-select')?.textContent).toBe('main.pico');
    await click(container.querySelector('[aria-label="New file"]')!);
    expect(container.querySelector('.file-tab.active .file-tab-select')?.textContent).toBe('untitled-2.pico');
  });
  it('opens the reference drawer from the completion screen on a small viewport',async()=>{
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    await click(button('Help'));
    for(let i=0;i<tutorialSteps.length-1;i++)await click(button('Next'));
    await click(button('Finish tour'));await click(button('Open quick reference'));
    expect(container.querySelector('.tutorial-layer')).toBeNull();
    expect(container.querySelector('.ide-shell.reference-open .reference-card')).not.toBeNull();
    await click(container.querySelector('[aria-label="Close quick reference"]')!);
    expect(container.querySelector('.ide-shell.reference-open')).toBeNull();
  });
});

it('shows coloured, selectable reference examples and a credits-only footer',async()=>{
  await click(button('DECLARE'));
  const example=container.querySelector('.reference-example pre')!;
  expect(example.textContent).toBe(referenceExamples.DECLARE.code);
  expect(example.querySelector('.syntax-keyword')?.textContent).toBe('DECLARE');
  expect(example.querySelector('.syntax-type')?.textContent).toBe('STRING');
  expect(example.querySelector('.syntax-string')?.textContent).toBe('"Pico"');
  const footer=container.querySelector('footer')!;
  expect(footer.querySelectorAll('.credit-item strong').length).toBe(2);
  expect(footer.textContent).toContain('Mustaqim');expect(footer.textContent).toContain('Amar');
  expect(footer.querySelector('.status-left')).toBeNull();expect(footer.querySelector('.status-right')).toBeNull();
});

it('colours only the example code in the reference, leaving keyword labels plain',async()=>{
  expect(container.querySelector('.reference-keywords .highlighted-code')).toBeNull();
  expect(container.querySelector('.reference-explanation > strong .highlighted-code')).toBeNull();
  expect(button('DECLARE').textContent).toBe('DECLARE');
  await click(button('DECLARE'));
  expect(container.querySelector('.reference-explanation > strong')?.textContent).toBe('DECLARE');
  expect(container.querySelector('.reference-example .syntax-keyword')).not.toBeNull();
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--reference-label: #ffffff');
});

it('shows the selected keyword example for every reference entry without changing the editor',async()=>{
  const originalCode=container.querySelector('textarea')!.value;
  expect(container.querySelector('.reference-keywords')?.textContent).not.toContain('Syntax cheat sheet');
  expect(container.querySelector('.reference-card details')).toBeNull();
  for(const keyword of referenceTerms){
    await click(button(keyword));
    const example=container.querySelector('.reference-example pre')!;
    expect(example.getAttribute('aria-label')).toBe(`${keyword} code example`);
    expect(example.textContent).toBe(referenceExamples[keyword].code);
    expect(button(keyword).getAttribute('aria-pressed')).toBe('true');
  }
  await click(button('INPUT'));
  expect(container.querySelector('.reference-input-hint')?.textContent).toBe('Example input: Ada');
  await click(button('FOR'));
  expect(container.querySelector('.reference-input-hint')).toBeNull();
  expect(container.querySelector('textarea')!.value).toBe(originalCode);
  expect(container.querySelector('.reference-controls')).not.toBeNull();
  expect(container.querySelector('.reference-scope')).toBeNull();
  expect(container.querySelector('.sidebar-bottom')).toBeNull();
  expect(container.querySelector('.reference-controls')?.textContent).not.toContain('CAMBRIDGE');
  expect(container.querySelector('.reference-controls')?.textContent).toContain('Drag the divider to resize');
  expect(container.querySelector('.hover-doc-setting')).toBeNull();
  expect(container.querySelector('.editor-preferences')).toBeNull();
  await click(container.querySelector('[aria-label="Open settings"]')!);
  const hoverDocs = container.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Hover documentation"]')!;
  const wasEnabled = hoverDocs.getAttribute('aria-checked') === 'true';
  await click(hoverDocs);
  expect(hoverDocs.getAttribute('aria-checked')).toBe(String(!wasEnabled));
});

it('lets the user choose either high-contrast theme and saves the preference',async()=>{
  await click(container.querySelector('[aria-label="Open settings"]')!);
  await click(button('High Contrast Dark'));
  expect(container.querySelector('.pico-app')?.getAttribute('data-high-contrast')).toBe('true');
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--bg: #000000');
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--text: #ffffff');
  await click(button('High Contrast Light'));
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--bg: #ffffff');
  expect(JSON.parse(localStorage.getItem('pico.settings.v6')!).theme).toBe('high-contrast-light');
});

it('offers coloured and gradient high-contrast themes and preserves the chosen palette',async()=>{
  await click(container.querySelector('[aria-label="Open settings"]')!);
  expect(container.querySelector('.theme-group-label')?.textContent).toBe('High contrast');
  for (const [label, id, accent] of [
    ['High Contrast Red', 'high-contrast-red', '#ff9999'],
    ['High Contrast Blue', 'high-contrast-blue', '#82baff'],
    ['High Contrast Yellow', 'high-contrast-yellow', '#ffe45e'],
    ['High Contrast Spectrum', 'high-contrast-spectrum', '#ff99ff'],
    ['High Contrast Sunset', 'high-contrast-sunset', '#ff9999'],
  ]) {
    await click(button(label!));
    const app = container.querySelector('.pico-app')!;
    expect(app.getAttribute('data-pico-theme')).toBe(id);
    expect(app.getAttribute('data-high-contrast')).toBe('true');
    expect(app.getAttribute('style')).toContain(`--accent: ${accent}`);
    expect(app.getAttribute('style')).toContain('--on-accent: #000000');
    expect(JSON.parse(localStorage.getItem('pico.settings.v6')!).theme).toBe(id);
    if (id!.includes('spectrum') || id!.includes('sunset')) {
      expect(app.getAttribute('style')).toContain('--accent-fill: linear-gradient(');
      expect(button(label!).querySelector('.theme-swatch i:last-child')?.getAttribute('style')).toContain('linear-gradient(');
    }
  }
});

it('keeps editor shortcuts while removing the scope caption shown in the screenshot',()=>{
  const footer = container.querySelector('.editor-card-foot')!;
  expect(footer.querySelector('.scope-note')).toBeNull();
  expect(footer.textContent).toContain('to run');
  expect(footer.textContent).toContain('go to line');
  expect(footer.textContent).not.toContain('Cambridge subset');
});

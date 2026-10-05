// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInteractiveSession, runRequests, type InputMessage, type WorkerReply, type WorkerRequest } from '../runtime/worker';
import App from './App';
import { referenceExamples, referenceTerms } from './reference';

vi.mock('./components/CodeEditor',()=>({CodeEditor:({value,onChange}:{value:string;onChange:(value:string)=>void})=><textarea aria-label="Test pseudocode editor" value={value} onInput={event=>onChange(event.currentTarget.value)} />}));
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
    await typeValue(consoleInput(),'sixteen');await click(button('Send'));
    expect(container.querySelector('.console-input-error')?.textContent).toContain('not an INTEGER');
    expect(document.activeElement).toBe(consoleInput());
    await typeValue(consoleInput(),'16');await submitInput();
    expect(container.querySelector('.console-input-form')).toBeNull();
    expect([...container.querySelectorAll('.output-line > span:last-child')].map(line=>line.textContent)).toEqual(['Name?','Ada','Age?','sixteen','16','Ada is 16']);
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
  it('uses saved test inputs automatically without opening console input',async()=>{
    await typeValue(codeEditor(),'DECLARE N : INTEGER\nINPUT N\nOUTPUT N * 2');
    await click(button('Test cases1'));
    await typeValue(container.querySelector<HTMLTextAreaElement>('[aria-label="Counts from 1 to 5 input"]')!,'3');
    await typeValue(container.querySelector<HTMLTextAreaElement>('[aria-label="Counts from 1 to 5 expected output"]')!,'6');
    await click(button('Run tests'));await act(async()=>BrowserWorker.pending.at(-1)!.complete());
    expect(container.querySelector('.result-chip')?.textContent).toBe('Passed');
    expect(BrowserWorker.pending.at(-1)!.request!.interactive).not.toBe(true);
    expect(BrowserWorker.pending.at(-1)!.request!.runs[0]!.inputs).toEqual(['3']);
    await click(button('Console'));expect(container.querySelector('.console-input-form')).toBeNull();
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
    ['Mr.Boyle','The Computer Science teacher who backed my creators and their work 📚'],
    ['Mr. Boyle','The Computer Science teacher who backed my creators and their work 📚'],
    ['Boyle','The Computer Science teacher who backed my creators and their work 📚'],
    ['Mr Boyle','The Computer Science teacher who backed my creators and their work 📚'],
    ['Fore','The head of Computer Science and ICT at our school 💻'],
    ['mr fore','The head of Computer Science and ICT at our school 💻'],
    ['Mr.Fore','The head of Computer Science and ICT at our school 💻'],
    ['Mr. Fore','The head of Computer Science and ICT at our school 💻'],
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
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Start with your code');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close tutorial');
    for(let i=0;i<6;i++)await click(button('Next'));
    await click(button('Finish tour'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Tour complete');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('Amar, Mustaqim, Boyle, and Fore');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('Mr Boyle, Mr. Boyle, Mr Fore, and Mr. Fore');
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
    await click(button('Help'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Start with your code');
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
    await click(button('Help'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Start with your code');
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.reference-card')).toBeNull();
    await click(button('Next'));await click(button('Next'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Read the result');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('STRING INPUT');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('Names ignore capitalisation');
    expect(container.querySelector('.tutorial-example')?.textContent).toBe('DECLARE Name : STRING\nINPUT Name\nOUTPUT Name');
    await click(button('Back'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Run your program');
    await click(button('Next'));await click(button('Next'));
    expect(container.querySelector('.dock-tab[aria-selected="true"]')?.textContent).toBe('Debugger');
    await click(button('Next'));expect(container.querySelector('[data-tour="reference"]')).not.toBeNull();
    await click(button('Next'));await click(button('Next'));await click(button('Finish tour'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Tour complete');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('Amar, Mustaqim, Boyle, and Fore');
    expect(container.querySelector('.tutorial-tip')?.textContent).toContain('Mr Boyle, Mr. Boyle, Mr Fore, and Mr. Fore');
    await click(button('Replay tour'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Start with your code');
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
  it('adjusts and persists reference size with keyboard resizing',async()=>{
    await click(container.querySelector('[aria-label="Increase reference text size"]')!);
    expect(container.querySelector('.reference-controls output')?.textContent).toBe('14px');
    const splitter=container.querySelector('[aria-label="Resize quick reference panel"]')!;
    await act(async()=>splitter.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
    const settings=JSON.parse(localStorage.getItem('pico.settings.v5')!);
    expect(settings.referenceWidth).toBe(370);expect(settings.referenceFontSize).toBe(14);
    expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--reference-width: 370px');
    await click(button('FOR'));expect(container.querySelector('.reference-explanation > strong')?.textContent).toBe('FOR');
  });
  it('uses .pico for existing and newly created source tabs',async()=>{
    expect(container.querySelector('.file-extension')?.textContent).toBe('.pico');
    expect(container.querySelector('.file-tab-select')?.textContent).toBe('main.pico');
    await click(container.querySelector('[aria-label="New file"]')!);
    expect(container.querySelector('.file-tab.active .file-tab-select')?.textContent).toBe('untitled-2.pico');
  });
  it('opens the reference drawer from the completion screen on a small viewport',async()=>{
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    await click(button('Help'));
    for(let i=0;i<6;i++)await click(button('Next'));
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
  expect(container.querySelector('.hover-doc-setting')).not.toBeNull();
});

it('lets the user choose either high-contrast theme and saves the preference',async()=>{
  await click(container.querySelector('[aria-label="Open settings"]')!);
  await click(button('High Contrast Dark'));
  expect(container.querySelector('.pico-app')?.getAttribute('data-high-contrast')).toBe('true');
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--bg: #000000');
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--text: #ffffff');
  await click(button('High Contrast Light'));
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--bg: #ffffff');
  expect(JSON.parse(localStorage.getItem('pico.settings.v5')!).theme).toBe('high-contrast-light');
});

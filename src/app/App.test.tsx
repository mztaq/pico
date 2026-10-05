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
  localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');localStorage.setItem('pico.settings.v5',JSON.stringify({autoDeclare:false,promptForInput:false}));
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

describe('guided help and readable reference',()=>{
  it('walks through highlights, reaches the end screen, and restores the workspace without editing code',async()=>{
    const editor=container.querySelector('textarea')!.value;
    await click(button('Help'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Start with your code');
    expect(container.querySelector('.ide-shell')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('.reference-card')).toBeNull();
    await click(button('Next'));await click(button('Next'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Read the result');
    await click(button('Back'));expect(container.querySelector('#tutorial-title')?.textContent).toBe('Bring your program to life');
    await click(button('Next'));await click(button('Next'));
    expect(container.querySelector('.dock-tab[aria-selected="true"]')?.textContent).toBe('Debugger');
    await click(button('Next'));expect(container.querySelector('[data-tour="reference"]')).not.toBeNull();
    await click(button('Next'));await click(button('Next'));await click(button('Finish tour'));
    expect(container.querySelector('#tutorial-title')?.textContent).toBe('Your next idea starts here.');
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

it('shows coloured, selectable reference examples and a credits-only footer',()=>{
  const example=container.querySelector('.syntax-cheat-sheet pre')!;
  expect(example.textContent).toContain('DECLARE Name : STRING\nName ← "Pico"');
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
  expect(container.querySelector('.reference-explanation .highlighted-code')).toBeNull();
  expect(button('DECLARE').textContent).toBe('DECLARE');
  await click(button('DECLARE'));
  expect(container.querySelector('.reference-explanation > strong')?.textContent).toBe('DECLARE');
  expect(container.querySelector('.syntax-cheat-sheet .syntax-keyword')).not.toBeNull();
  expect(container.querySelector('.pico-app')?.getAttribute('style')).toContain('--reference-label: #ffffff');
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

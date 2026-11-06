// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PasteJsonDialog} from './PasteJsonDialog';

let host:HTMLDivElement;
let root:Root;
beforeEach(()=>{
  (globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  host=document.createElement('div');
  document.body.append(host);
  root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(onImport:(text:string)=>boolean,onClose=vi.fn()){
  await act(async()=>root.render(<PasteJsonDialog kind="flowchart" onImport={onImport} onClose={onClose}/>));
  return onClose;
}
async function type(source:string){
  const textarea=host.querySelector('textarea')!;
  await act(async()=>{
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!;
    setter.call(textarea,source);
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
    textarea.dispatchEvent(new Event('change',{bubbles:true}));
  });
}
async function click(){await act(async()=>host.querySelector<HTMLButtonElement>('.pico-json-submit')!.click());}
describe('Paste JSON dialog',()=>{
  it('keeps empty JSON from importing and shows an error',async()=>{
    const importFn=vi.fn(()=>true);
    await render(importFn);
    await click();
    expect(importFn).not.toHaveBeenCalled();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Paste your Pico JSON');
  });
  it('submits pasted text and closes only after success',async()=>{
    const importFn=vi.fn(()=>true);
    const onClose=await render(importFn);
    await type('{"version":1}');
    await click();
    expect(importFn).toHaveBeenCalledWith('{"version":1}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('shows validation errors without closing or destroying pasted text',async()=>{
    const importFn=vi.fn(()=>{throw Error('Invalid Pico project.');});
    const onClose=await render(importFn);
    await type('{bad json}');
    await click();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Invalid Pico project.');
    expect(host.querySelector('textarea')?.value).toBe('{bad json}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {LogicWorkspace} from './LogicWorkspace';
import {LOGIC_TOUR_KEY} from './LogicTutorial';
import {makeDocument, makeNode} from './model';

let root:Root,host:HTMLDivElement;
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  localStorage.clear();localStorage.setItem(LOGIC_TOUR_KEY,'done');
  const doc=makeDocument();doc.nodes=[makeNode('label',0,0),makeNode('switch',180,0)];
  localStorage.setItem('pico.logic.document.v1',JSON.stringify(doc));
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<LogicWorkspace onHome={()=>{}}/>));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const nodes=()=>host.querySelectorAll<SVGGElement>('.logic-node');
async function select(index:number){await act(async()=>nodes()[index]!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0})));}
async function label(value:string){await act(async()=>{
  const input=host.querySelector<HTMLInputElement>('[aria-label="Component label"]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
  input.dispatchEvent(new Event('input',{bubbles:true}));
});}
it('updates text annotations immediately and restores them through undo and redo',async()=>{
  await select(0);await label('A');expect(nodes()[0]!.querySelector('.logic-symbol-letter')?.textContent).toBe('A');
  await label('Input A');expect(nodes()[0]!.querySelector('.logic-symbol-letter')?.textContent).toBe('Input A');
  await act(async()=>host.querySelector<HTMLButtonElement>('[title="Undo"]')!.click());
  expect(nodes()[0]!.querySelector('.logic-symbol-letter')?.textContent).toBe('A');
  await act(async()=>host.querySelector<HTMLButtonElement>('[title="Redo"]')!.click());
  expect(nodes()[0]!.querySelector('.logic-symbol-letter')?.textContent).toBe('Input A');
  await select(0);await label('');expect(nodes()[0]!.querySelector('.logic-symbol-letter')?.textContent).toBe('Text');
  expect(host.querySelector<HTMLInputElement>('[aria-label="Component label"]')?.placeholder).toBe('Text');
});
it('shows edited component labels without replacing their logic symbol or signal',async()=>{
  await select(1);await label('Door sensor');
  expect(nodes()[1]!.querySelector('.logic-component-label')?.textContent).toBe('Door sensor');
  expect(nodes()[1]!.querySelector('.logic-switch-arm')).not.toBeNull();
  expect(nodes()[1]!.querySelector('.logic-signal-caption')?.textContent).toBe('0');
  await label('');expect(nodes()[1]!.querySelector('.logic-component-label')).toBeNull();
});

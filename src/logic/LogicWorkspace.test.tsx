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
it('keeps a node drag active across the canvas edge and cancels it cleanly',async()=>{
  const board=host.querySelector<SVGSVGElement>('svg[aria-label="Circuit canvas"]')!;
  const capture=vi.fn(),release=vi.fn();
  board.setPointerCapture=capture;
  board.hasPointerCapture=()=>true;
  board.releasePointerCapture=release;
  const nodeTransform=()=>nodes()[0]!.firstElementChild!.getAttribute('transform');
  const original=nodeTransform();
  const pointer=(target:Element,type:string,x:number)=>{
    const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:0});
    Object.defineProperty(event,'pointerId',{value:7});
    target.dispatchEvent(event);
  };
  await act(async()=>pointer(nodes()[0]!,'pointerdown',0));
  expect(capture).toHaveBeenCalledWith(7);
  await act(async()=>pointer(board,'pointermove',48));
  const first=nodeTransform();
  await act(async()=>pointer(board,'pointerleave',60));
  await act(async()=>pointer(board,'pointermove',96));
  expect(nodeTransform()).not.toBe(first);
  await act(async()=>pointer(board,'pointercancel',96));
  expect(nodeTransform()).toBe(original);
  expect(release).toHaveBeenCalledWith(7);
});

it('suppresses native selection and context menus without losing canvas pointer capture',async()=>{
  const board=host.querySelector<SVGSVGElement>('svg[aria-label="Circuit canvas"]')!;
  const capture=vi.fn();
  board.setPointerCapture=capture;
  const contextMenu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
  await act(async()=>board.dispatchEvent(contextMenu));
  expect(contextMenu.defaultPrevented).toBe(true);
  const nativeDrag=new Event('dragstart',{bubbles:true,cancelable:true});
  await act(async()=>board.dispatchEvent(nativeDrag));
  expect(nativeDrag.defaultPrevented).toBe(true);
  const pointerDown=new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:10,clientY:10});
  Object.defineProperty(pointerDown,'pointerId',{value:5});
  await act(async()=>nodes()[0]!.dispatchEvent(pointerDown));
  expect(pointerDown.defaultPrevented).toBe(true);
  expect(capture).toHaveBeenCalledWith(5);
});

it('drops a palette component using pointer events without the WebView native Copy drag',async()=>{
  const board=host.querySelector<SVGSVGElement>('svg[aria-label="Circuit canvas"]')!;
  vi.spyOn(board,'getBoundingClientRect').mockReturnValue({
    left:200,top:100,right:1000,bottom:800,width:800,height:700,x:200,y:100,toJSON:()=>({})
  } as DOMRect);
  const palette=host.querySelector<HTMLButtonElement>('.logic-part')!;
  expect(palette.draggable).toBe(false);
  const pointer=(target:EventTarget,type:string,x:number,y:number)=>{
    const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});
    Object.defineProperty(event,'pointerId',{value:8});
    target.dispatchEvent(event);
    return event;
  };
  await act(async()=>{
    const down=pointer(palette,'pointerdown',40,200);
    expect(down.defaultPrevented).toBe(true);
    pointer(window,'pointermove',400,350);
  });
  expect(host.querySelector('.pico-palette-drag-preview')).not.toBeNull();
  expect(host.querySelector('.logic-drag-preview .logic-palette-symbol')).not.toBeNull();
  expect(host.querySelector('.logic-drag-preview span')).toBeNull();
  await act(async()=>{
    pointer(window,'pointerup',400,350);
    palette.click(); // Suppress the click following a completed drag.
  });
  expect(nodes()).toHaveLength(3);
  expect(host.querySelector('.pico-palette-drag-preview')).toBeNull();
  expect(host.querySelector('.logic-placement-hint')).toBeNull();
});

it('fits the rendered circuit again after auto-layout commits its new positions',async()=>{
  const board=host.querySelector<SVGSVGElement>('svg[aria-label="Circuit canvas"]')!;
  Object.defineProperties(board,{clientWidth:{value:1000},clientHeight:{value:600}});
  const group=board.querySelector<SVGGElement>('.logic-circuit-content')!;
  const getBounds=vi.fn(()=>({x:-1000,y:-500,width:6000,height:3000}));
  Object.defineProperty(group,'getBBox',{value:getBounds});
  const fit=host.querySelector<HTMLButtonElement>('[aria-label="Fit circuit"]')!;
  const auto=host.querySelector<HTMLButtonElement>('[aria-label="Auto-layout circuit"]')!;
  await act(async()=>fit.click());
  expect(group.parentElement!.getAttribute('transform')).toContain('scale(0.');
  expect(Number(host.querySelector('.logic-zoom')!.textContent!.replace('%',''))).toBeLessThan(35);
  const before=nodes()[0]!.firstElementChild!.getAttribute('transform');
  getBounds.mockImplementation(()=>{
    expect(nodes()[0]!.firstElementChild!.getAttribute('transform')).not.toBe(before);
    return {x:64,y:48,width:5000,height:2400};
  });
  await act(async()=>auto.click());
  const fitted=group.parentElement!.getAttribute('transform');
  expect(getBounds).toHaveBeenCalledTimes(2);
  await act(async()=>fit.click());
  expect(group.parentElement!.getAttribute('transform')).toBe(fitted);
});

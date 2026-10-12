// @vitest-environment jsdom
import {exampleProject} from './fixtures/testCharts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChartCanvas } from './Canvas';
import { type Port } from './model';
let root:Root,container:HTMLDivElement,target:Element|null;
const onLink=vi.fn<(from:string,port:Port,to:string)=>void>(),onConnect=vi.fn(),onChange=vi.fn();
async function pointer(element:Element,type:string,x:number,y:number,id=1){await act(async()=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:id});element.dispatchEvent(event);});}
async function render(disabled=false,zoom=.5){await act(async()=>root.render(<ChartCanvas project={exampleProject()} selected={null} connection={null} zoom={zoom} disabled={disabled} onSelect={()=>{}} onChange={onChange} onConnect={onConnect} onTarget={()=>{}} onLink={onLink} onCancelConnection={()=>{}}/>));}
beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);onLink.mockClear();onConnect.mockClear();onChange.mockClear();target=null;Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>target)});container=document.createElement('div');document.body.append(container);root=createRoot(container);await render();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('draws a scaled live line and connects to the block under the released pointer',async()=>{
  const port=container.querySelector('[data-node-id="start"] .flow-port')!,destination=container.querySelector('[data-node-id="hello"]')!;
  await pointer(port,'pointerdown',100,100);target=destination;await pointer(port,'pointermove',250,200);
  expect(container.querySelector('.flow-connection-preview')?.getAttribute('d')).toContain('500 400');expect(destination.classList.contains('is-drop-target')).toBe(true);
  await pointer(port,'pointerup',250,200);expect(onLink).toHaveBeenCalledWith('start','next','hello');expect(onConnect).not.toHaveBeenCalled();expect(container.querySelector('.flow-connection-preview')).toBeNull();expect(destination.classList.contains('is-drop-target')).toBe(false);expect(onChange).not.toHaveBeenCalled();
});
it('leaves existing connections untouched when dropped on empty space or Start',async()=>{
  const port=container.querySelector('[data-node-id="input"] .flow-port')!;
  await pointer(port,'pointerdown',100,100);await pointer(port,'pointermove',200,200);await pointer(port,'pointerup',200,200);expect(onLink).not.toHaveBeenCalled();
  await pointer(port,'pointerdown',100,100);target=container.querySelector('[data-node-id="start"]')!;await pointer(port,'pointermove',200,200);expect(target.classList.contains('is-drop-invalid')).toBe(true);await pointer(port,'pointerup',200,200);expect(onLink).not.toHaveBeenCalled();expect(container.querySelector('.flow-connection-preview')).toBeNull();
});
it('cancels safely on Escape, pointer cancellation, and lost capture',async()=>{
  const port=container.querySelector('[data-node-id="input"] .flow-port')!;target=container.querySelector('[data-node-id="hello"]')!;
  for(const end of ['pointercancel','lostpointercapture']){await pointer(port,'pointerdown',100,100);await pointer(port,'pointermove',200,200);await pointer(port,end,200,200);expect(container.querySelector('.flow-connection-preview')).toBeNull();}
  await pointer(port,'pointerdown',100,100);await pointer(port,'pointermove',200,200);await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));expect(container.querySelector('.flow-connection-preview')).toBeNull();expect(onLink).not.toHaveBeenCalled();
});
it('retains keyboard connections and disables line dragging during execution',async()=>{
  const port=container.querySelector<HTMLButtonElement>('[data-node-id="start"] .flow-port')!;await act(async()=>port.click());expect(onConnect).toHaveBeenCalledWith('start','next');await render(true);await pointer(port,'pointerdown',100,100);await pointer(port,'pointermove',200,200);expect(container.querySelector('.flow-connection-preview')).toBeNull();expect(onLink).not.toHaveBeenCalled();
});

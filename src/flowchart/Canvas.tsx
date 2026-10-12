import { useRef, useId, useEffect, useState, type PointerEvent } from 'react';
import { HighlightedCode } from '../app/components/HighlightedCode';
import { BLOCKS, NODE_HEIGHT as H, NODE_WIDTH as W, createNode, nodeLabel, blockName, ports, type ChartNode, type FlowchartProject, type NodeKind, type Port } from './model';

interface CanvasProps {
  project:FlowchartProject;selected:string|null;activeNode?:string;errorNode?:string;
  connection:{from:string;port:Port}|null;zoom:number;disabled:boolean;
  onSelect:(id:string|null)=>void;onChange:(project:FlowchartProject)=>void;
  onConnect:(from:string,port:Port)=>void;onTarget:(id:string)=>void;
  onLink:(from:string,port:Port,to:string)=>void;onCancelConnection:()=>void;
}
export function blockShape(kind:NodeKind):string {
  if(kind==='decision')return `M ${W/2} 1 L ${W-1} ${H/2} L ${W/2} ${H-1} L 1 ${H/2} Z`;
  if(kind==='input'||kind==='output')return `M 24 1 H ${W-1} L ${W-25} ${H-1} H 1 Z`;
  if(kind==='start'||kind==='end')return `M ${H/2} 1 H ${W-H/2} A ${H/2-1} ${H/2-1} 0 0 1 ${W-H/2} ${H-1} H ${H/2} A ${H/2-1} ${H/2-1} 0 0 1 ${H/2} 1 Z`;
  return `M 9 1 H ${W-9} Q ${W-1} 1 ${W-1} 9 V ${H-9} Q ${W-1} ${H-1} ${W-9} ${H-1} H 9 Q 1 ${H-1} 1 ${H-9} V 9 Q 1 1 9 1 Z`;
}
export function BlockSymbol({kind}:{kind:NodeKind}) {return <svg className="flow-symbol" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={blockShape(kind)}/>{kind==='call'&&<path d={`M 20 1 V ${H-1} M ${W-20} 1 V ${H-1}`} />}</svg>;}
function point(node:ChartNode,port:Port) {return port==='yes'?{x:node.x,y:node.y+H/2}:port==='no'?{x:node.x+W,y:node.y+H/2}:{x:node.x+W/2,y:node.y+H};}
export function edgePath(from:ChartNode,to:ChartNode,port:Port) {
  const a=point(from,port),b={x:to.x+W/2,y:to.y-5};
  if(from.id===to.id) return `M ${a.x} ${a.y} C ${from.x-130} ${from.y+H+160}, ${from.x-150} ${from.y-80}, ${b.x} ${b.y}`;
  if(b.y>=a.y+25) {const mid=(a.y+b.y)/2;return port==='next'?`M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`:`M ${a.x} ${a.y} C ${a.x+(port==='yes'?-65:65)} ${a.y}, ${b.x} ${a.y+30}, ${b.x} ${b.y}`;}
  const left=Math.max(12,Math.min(from.x,to.x)-60),right=Math.max(from.x,to.x)+W+60;
  const side=port==='no'?right:left;
  return `M ${a.x} ${a.y} L ${a.x} ${a.y+24} C ${a.x} ${a.y+65}, ${side} ${a.y+65}, ${side} ${a.y+24} L ${side} ${b.y-35} Q ${side} ${b.y-65}, ${b.x} ${b.y-35} L ${b.x} ${b.y}`;
}
export function ChartCanvas({project,selected,activeNode,errorNode,connection,zoom,disabled,onSelect,onChange,onConnect,onTarget,onLink,onCancelConnection}:CanvasProps) {
  const viewport=useRef<HTMLDivElement>(null),plane=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:string;pointerId:number;clientX:number;clientY:number;x:number;y:number;node:ChartNode}|null>(null);
  const pan=useRef<{pointerId:number;x:number;y:number;left:number;top:number}|null>(null);
  const lineDrag=useRef<{pointerId:number;from:ChartNode;port:Port;startX:number;startY:number;dragged:boolean;button:HTMLButtonElement}|null>(null);
  const draftPath=useRef<SVGPathElement>(null),hoverTarget=useRef<HTMLElement|null>(null);
  const [drawing,setDrawing]=useState(false);
  const moved=useRef(false);const marker=useId().replace(/:/g,'');
  const width=Math.max(1080,...project.nodes.map(n=>n.x+W+180)),height=Math.max(900,...project.nodes.map(n=>n.y+H+180));
  useEffect(()=>{
    const id=activeNode??errorNode;
    if(!id)return;
    const node=Array.from(plane.current?.querySelectorAll<HTMLElement>('.flow-node')??[]).find(element=>element.dataset.nodeId===id);
    node?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  },[activeNode,errorNode,zoom]);
  function clearLine() {
    const d=lineDrag.current;lineDrag.current=null;
    hoverTarget.current?.classList.remove('is-drop-target','is-drop-invalid');hoverTarget.current=null;
    if(d?.button.hasPointerCapture?.(d.pointerId))d.button.releasePointerCapture(d.pointerId);
    setDrawing(false);
  }
  useEffect(()=>{
    const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'&&lineDrag.current){clearLine();onCancelConnection();}};
    window.addEventListener('keydown',cancel);return()=>{window.removeEventListener('keydown',cancel);hoverTarget.current?.classList.remove('is-drop-target','is-drop-invalid');};
  },[onCancelConnection]);
  function startLine(event:PointerEvent<HTMLButtonElement>,node:ChartNode,port:Port) {
    if(disabled||event.button!==0)return;
    event.preventDefault();event.stopPropagation();onCancelConnection();onSelect(node.id);
    lineDrag.current={pointerId:event.pointerId,from:node,port,startX:event.clientX,startY:event.clientY,dragged:false,button:event.currentTarget};
    setDrawing(true);event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function lineTarget(x:number,y:number):HTMLElement|null {
    const element=document.elementFromPoint?.(x,y)?.closest<HTMLElement>('.flow-node')??null;
    return element&&plane.current?.contains(element)?element:null;
  }
  function moveLine(event:PointerEvent<HTMLButtonElement>) {
    const d=lineDrag.current;if(!d||d.pointerId!==event.pointerId)return;
    event.stopPropagation();
    if(Math.abs(event.clientX-d.startX)+Math.abs(event.clientY-d.startY)>4)d.dragged=true;
    const view=viewport.current!,viewBounds=view.getBoundingClientRect();
    if(event.clientY<viewBounds.top+22)view.scrollTop-=12;else if(event.clientY>viewBounds.bottom-22)view.scrollTop+=12;
    if(event.clientX<viewBounds.left+22)view.scrollLeft-=12;else if(event.clientX>viewBounds.right-22)view.scrollLeft+=12;
    const bounds=plane.current!.getBoundingClientRect(),a=point(d.from,d.port),x=(event.clientX-bounds.left)/zoom,y=(event.clientY-bounds.top)/zoom;
    draftPath.current?.setAttribute('d',`M ${a.x} ${a.y} C ${a.x} ${a.y+55}, ${x} ${y-55}, ${x} ${y}`);
    const target=lineTarget(event.clientX,event.clientY);
    if(target!==hoverTarget.current){hoverTarget.current?.classList.remove('is-drop-target','is-drop-invalid');hoverTarget.current=target;target?.classList.add(project.nodes.find(n=>n.id===target.dataset.nodeId)?.kind==='start'?'is-drop-invalid':'is-drop-target');}
  }
  function endLine(event:PointerEvent<HTMLButtonElement>,cancel=false) {
    const d=lineDrag.current;if(!d||d.pointerId!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const target=cancel?null:lineTarget(event.clientX,event.clientY);
    const id=target?.dataset.nodeId,valid=project.nodes.some(n=>n.id===id&&n.kind!=='start');
    clearLine();
    if(!cancel&&d.dragged&&id&&valid)onLink(d.from.id,d.port,id);
    else if(!cancel&&!d.dragged)onConnect(d.from.id,d.port);
  }
  function startDrag(event:PointerEvent<HTMLDivElement>,node:ChartNode) {
    if(disabled||connection||event.button!==0||(event.target as HTMLElement).closest('button'))return;
    event.preventDefault();event.stopPropagation();onSelect(node.id);moved.current=false;
    drag.current={id:node.id,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:node.x,y:node.y,node};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function move(event:PointerEvent<HTMLDivElement>) {
    const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;
    if(Math.abs(event.clientX-d.clientX)+Math.abs(event.clientY-d.clientY)>3)moved.current=true;
    const x=Math.min(10000,Math.max(0,Math.round((d.x+(event.clientX-d.clientX)/zoom)/16)*16));
    const y=Math.min(10000,Math.max(0,Math.round((d.y+(event.clientY-d.clientY)/zoom)/16)*16));
    event.currentTarget.style.left=`${x}px`;event.currentTarget.style.top=`${y}px`;
    // Keep one lightweight canvas preview during dragging. Commit once on release.
    d.node={...d.node,x,y};
    const edges=plane.current?.querySelectorAll<SVGPathElement>('path[data-edge]');
    edges?.forEach(path=>{
      const edge=project.edges.find(e=>e.id===path.dataset.edge)!;
      const source=edge.from===d.id?d.node:project.nodes.find(n=>n.id===edge.from);
      const target=edge.to===d.id?d.node:project.nodes.find(n=>n.id===edge.to);
      if(source&&target)path.setAttribute('d',edgePath(source,target,edge.port));
    });
  }
  function endDrag(event:PointerEvent<HTMLDivElement>,cancel=false) {
    const d=drag.current;if(!d||d.pointerId!==event.pointerId)return;drag.current=null;
    if(!cancel&&moved.current)onChange({...project,nodes:project.nodes.map(n=>n.id===d.id?d.node:n)});
    else {
      moved.current=false;
      event.currentTarget.style.left=`${d.x}px`;event.currentTarget.style.top=`${d.y}px`;
      plane.current?.querySelectorAll<SVGPathElement>('path[data-edge]').forEach(path=>{
        const edge=project.edges.find(e=>e.id===path.dataset.edge),source=project.nodes.find(n=>n.id===edge?.from),target=project.nodes.find(n=>n.id===edge?.to);
        if(source&&target&&edge)path.setAttribute('d',edgePath(source,target,edge.port));
      });
    }
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function drop(event:React.DragEvent<HTMLDivElement>) {
    event.preventDefault();if(disabled)return;
    const kind=event.dataTransfer.getData('application/pico-flow-block') as NodeKind;
    if(!BLOCKS.some(b=>b.kind===kind)||project.nodes.length>=250)return;
    const bounds=plane.current!.getBoundingClientRect();
    const node=createNode(kind,Math.min(10000,(event.clientX-bounds.left)/zoom-W/2),Math.min(10000,(event.clientY-bounds.top)/zoom-H/2));
    onChange({...project,nodes:[...project.nodes,node]});onSelect(node.id);
  }
  return <div className={`flow-viewport ${connection||drawing?'is-connecting':''}`} ref={viewport} aria-label="Flowchart canvas" onDragOver={event=>event.preventDefault()} onDrop={drop} onPointerDown={event=>{
    if(event.button!==0||(event.target as HTMLElement).closest('.flow-node'))return;
    onSelect(null);pan.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:event.currentTarget.scrollLeft,top:event.currentTarget.scrollTop};event.currentTarget.setPointerCapture?.(event.pointerId);
  }} onPointerMove={event=>{const p=pan.current;if(p?.pointerId===event.pointerId){event.currentTarget.scrollLeft=p.left-event.clientX+p.x;event.currentTarget.scrollTop=p.top-event.clientY+p.y;}}} onPointerUp={()=>{pan.current=null;}} onPointerCancel={()=>{pan.current=null;}}>
    {!project.nodes.length&&<div className="flow-empty-canvas"><strong>Start your flowchart.</strong><p className="pico-placeholder-credit">Made by <strong>Mustaqim</strong> and <strong>Amar</strong>.</p><span>Drag Start onto the canvas.</span></div>}
    <div className="flow-plane-space" style={{width:width*zoom,height:height*zoom}}><div className="flow-plane" ref={plane} style={{width,height,transform:`scale(${zoom})`}}>
      <svg className="flow-connections" width={width} height={height} aria-label="Connections">
        <defs><marker id={marker} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M 0 0 L 8 4.5 L 0 9 Z" fill="currentColor"/></marker></defs>
        {project.edges.map(edge=>{const from=project.nodes.find(n=>n.id===edge.from),to=project.nodes.find(n=>n.id===edge.to);if(!from||!to)return null;
          return <g key={edge.id} className={`flow-edge ${selected===from.id?'is-selected':''}`}><path data-edge={edge.id} d={edgePath(from,to,edge.port)} markerEnd={`url(#${marker})`}/></g>;})}
        {drawing&&<path ref={draftPath} className="flow-connection-preview" markerEnd={`url(#${marker})`}/>}
      </svg>
      {project.nodes.map(node=><div key={node.id} className={`flow-node flow-kind-${node.kind} ${selected===node.id?'is-selected':''} ${activeNode===node.id?'is-active':''} ${errorNode===node.id?'has-error':''}`} style={{left:node.x,top:node.y,width:W,height:H}} data-node-id={node.id} role="button" tabIndex={0} aria-label={`${blockName(node.kind)}: ${node.text}`} aria-pressed={selected===node.id} onPointerDown={event=>startDrag(event,node)} onPointerMove={move} onPointerUp={event=>endDrag(event)} onPointerCancel={event=>endDrag(event,true)} onLostPointerCapture={event=>endDrag(event,true)} onClick={event=>{event.stopPropagation();if(moved.current){moved.current=false;return;}if(connection)onTarget(node.id);else onSelect(node.id);}} onKeyDown={event=>{
        if(event.target!==event.currentTarget)return;
        if(event.key==='Enter'||event.key===' '){event.preventDefault();if(connection)onTarget(node.id);else onSelect(node.id);}
        if(!disabled&&!connection&&event.key.startsWith('Arrow')){event.preventDefault();const delta=event.shiftKey?48:16;onChange({...project,nodes:project.nodes.map(n=>n.id===node.id?{...n,x:Math.min(10000,Math.max(0,n.x+(event.key==='ArrowRight'?delta:event.key==='ArrowLeft'?-delta:0))),y:Math.min(10000,Math.max(0,n.y+(event.key==='ArrowDown'?delta:event.key==='ArrowUp'?-delta:0)))}:n)});}
      }}>
        <svg className="flow-node-shape" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={blockShape(node.kind)}/>{node.kind==='call'&&<path d={`M 20 1 V ${H-1} M ${W-20} 1 V ${H-1}`}/>}</svg>
        <div className="flow-node-text"><span className="flow-node-type">{blockName(node.kind)}</span><strong title={nodeLabel(node)}>{node.kind==='start'||node.kind==='end'?node.text:<HighlightedCode code={nodeLabel(node)}/>}</strong></div>
        {ports(node).map(port=><button key={port} type="button" disabled={disabled} className={`flow-port port-${port} ${connection?.from===node.id&&connection.port===port?'is-pending':''}`} aria-label={`Connect ${port} from ${node.text}`} title={`${port==='next'?'Next':port==='yes'?'Yes':'No'}: drag to another block`} onPointerDown={event=>startLine(event,node,port)} onPointerMove={moveLine} onPointerUp={event=>endLine(event)} onPointerCancel={event=>endLine(event,true)} onLostPointerCapture={event=>endLine(event,true)} onClick={event=>{event.stopPropagation();if(event.detail===0)onConnect(node.id,port);}}><span>{port==='next'?'':port==='yes'?'Yes':'No'}</span></button>)}
      </div>)}
    </div></div>
  </div>;
}

import { SPECS, isWireValid, portPosition, type CircuitDocument, type CircuitWire } from './model';

export interface InputTarget { nodeId:string;pin:string;x:number;y:number;valid:boolean;reason:string|null }

/** Hit test the visible terminal coordinates, even when a pointer is captured
 * by the source gate and the browser reports the source as event.target. */
export function inputAtPoint(doc:CircuitDocument,from:string,fromPin:string,point:{x:number;y:number},radius=20):InputTarget|null {
  let best:InputTarget|null=null, distance=radius*radius;
  for(const node of doc.nodes)for(const pin of SPECS[node.kind].inputs) {
    const pos=portPosition(node,pin,'in'),d=(pos.x-point.x)**2+(pos.y-point.y)**2;
    if(d>distance)continue;
    const wire:CircuitWire={id:'preview',from,fromPin,to:node.id,toPin:pin};
    const reason=isWireValid(doc,wire);
    best={nodeId:node.id,pin,x:pos.x,y:pos.y,valid:reason===null,reason};
    distance=d;
  }
  return best;
}

export function connectionPath(a:{x:number;y:number},b:{x:number;y:number}) {
  const delta=Math.max(35,Math.min(130,Math.abs(a.x-b.x)*0.45));
  return `M ${a.x} ${a.y} C ${a.x+delta} ${a.y}, ${b.x-delta} ${b.y}, ${b.x} ${b.y}`;
}


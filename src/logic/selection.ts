import {NODE_WIDTH,nodeHeight,type CircuitDocument,type CircuitNode,type CircuitWire} from './model';

export interface CircuitClipboard {nodes:CircuitNode[];wires:CircuitWire[]}

/** Include every component intersecting a marquee, in either drag direction. */
export function selectionInRectangle(doc:CircuitDocument,a:{x:number;y:number},b:{x:number;y:number}):string[] {
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
 return doc.nodes.filter(n=>{
   const rotated=n.rotation===90||n.rotation===270;
   const width=rotated?nodeHeight(n):NODE_WIDTH,height=rotated?NODE_WIDTH:nodeHeight(n);
   const x=n.x+(NODE_WIDTH-width)/2,y=n.y+(nodeHeight(n)-height)/2;
   return x<=right&&x+width>=left&&y<=bottom&&y+height>=top;
 }).map(n=>n.id);
}
export function copyComponents(doc:CircuitDocument,ids:readonly string[]):CircuitClipboard {
 const selected=new Set(ids),nodes=doc.nodes.filter(n=>selected.has(n.id));
 const keys=new Set(nodes.map(n=>n.id));
 return {nodes:nodes.map(n=>({...n})),wires:doc.wires.filter(w=>keys.has(w.from)&&keys.has(w.to)).map(w=>({...w}))};
}
export function pasteComponents(doc:CircuitDocument,clipboard:CircuitClipboard,dx=36,dy=36):{doc:CircuitDocument;ids:string[]} {
 if(!clipboard.nodes.length)return {doc,ids:[]};
 const lookup=new Map(clipboard.nodes.map(n=>[n.id,crypto.randomUUID()]));
 const nodes=clipboard.nodes.map(n=>({...n,id:lookup.get(n.id)!,x:Math.max(-100000,Math.min(100000,n.x+dx)),y:Math.max(-100000,Math.min(100000,n.y+dy))}));
 const wires=clipboard.wires.filter(w=>lookup.has(w.from)&&lookup.has(w.to)).map(w=>({...w,id:crypto.randomUUID(),from:lookup.get(w.from)!,to:lookup.get(w.to)!}));
 return {doc:{...doc,nodes:[...doc.nodes,...nodes],wires:[...doc.wires,...wires]},ids:nodes.map(n=>n.id)};
}
export function deleteSelection(doc:CircuitDocument,ids:readonly string[],wireId?:string):CircuitDocument {
 const selected=new Set(ids);
 return {...doc,nodes:doc.nodes.filter(n=>!selected.has(n.id)),wires:doc.wires.filter(w=>!selected.has(w.from)&&!selected.has(w.to)&&w.id!==wireId)};
}

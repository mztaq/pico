import {describe,expect,it} from 'vitest';
import {makeDocument,makeNode} from './model';
import {copyComponents,deleteSelection,pasteComponents,selectionInRectangle} from './selection';
describe('logic editor selection and clipboard',()=>{
 it('selects in either drag direction and supports contact at an edge',()=>{
  const d=makeDocument(),a=makeNode('not',20,30),b=makeNode('and',310,170);
  d.nodes=[a,b];
  expect(selectionInRectangle(d,{x:450,y:280},{x:0,y:0})).toEqual([a.id,b.id]);
  expect(selectionInRectangle(d,{x:0,y:0},{x:120,y:100})).toEqual([a.id]);
  expect(selectionInRectangle(d,{x:200,y:0},{x:290,y:130})).toEqual([]);
 });
 it('copies only internal wires and creates unique identifiers',()=>{
  const d=makeDocument(),a=makeNode('switch',0,0),b=makeNode('not',200,0),c=makeNode('lamp',400,0);
  d.nodes=[a,b,c];d.wires=[{id:'one',from:a.id,fromPin:'Q',to:b.id,toPin:'A'},{id:'two',from:b.id,fromPin:'Q',to:c.id,toPin:'IN'}];
  const clip=copyComponents(d,[a.id,b.id]);
  expect(clip.nodes).toHaveLength(2);expect(clip.wires.map(w=>w.id)).toEqual(['one']);
  const pasted=pasteComponents(d,clip);
  expect(pasted.ids).toHaveLength(2);expect(new Set(pasted.ids).size).toBe(2);
  expect(pasted.doc.nodes).toHaveLength(5);expect(pasted.doc.wires).toHaveLength(3);
  expect(pasted.doc.wires.at(-1)!.from).toBe(pasted.ids[0]);expect(pasted.doc.wires.at(-1)!.to).toBe(pasted.ids[1]);
  expect(d.nodes).toHaveLength(3);
 });
 it('deletes a selected group and all attached connections',()=>{
  const d=makeDocument(),a=makeNode('switch',0,0),b=makeNode('not',200,0),c=makeNode('lamp',400,0);
  d.nodes=[a,b,c];d.wires=[{id:'one',from:a.id,fromPin:'Q',to:b.id,toPin:'A'},{id:'two',from:b.id,fromPin:'Q',to:c.id,toPin:'IN'}];
  const result=deleteSelection(d,[b.id]);expect(result.nodes).toHaveLength(2);expect(result.wires).toHaveLength(0);
 });
});

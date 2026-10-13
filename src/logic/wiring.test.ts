import {describe,expect,it} from 'vitest';
import {makeDocument,makeNode,portPosition} from './model';
import {connectionPath,inputAtPoint} from './wiring';
describe('logic canvas connection target detection',()=>{
 it('finds an output-to-input target at the exact pin even when the source holds pointer capture',()=>{
  const d=makeDocument(),source=makeNode('switch',20,30),gate=makeNode('not',300,100);
  d.nodes=[source,gate];
  const input=portPosition(gate,'A','in');
  expect(inputAtPoint(d,source.id,'Q',input)).toMatchObject({nodeId:gate.id,pin:'A',valid:true});
  expect(inputAtPoint(d,source.id,'Q',{x:input.x+100,y:input.y})).toBeNull();
 });
 it('rejects an invalid self-wire and duplicate wire, and respects rotated pins',()=>{
  const d=makeDocument(),a=makeNode('and',50,50),b=makeNode('not',300,50);
  b.rotation=90;d.nodes=[a,b];
  const pos=portPosition(b,'A','in');
  expect(inputAtPoint(d,a.id,'Q',pos)).toMatchObject({valid:true,pin:'A'});
  d.wires.push({id:'w1',from:a.id,fromPin:'Q',to:b.id,toPin:'A'});
  expect(inputAtPoint(d,a.id,'Q',pos)).toMatchObject({valid:false,reason:'Those pins are already connected.'});
  const own=portPosition(a,'A','in');
  expect(inputAtPoint(d,a.id,'Q',own)).toMatchObject({valid:false,reason:'A component cannot wire directly to itself.'});
 });
 it('draws a smooth continuous preview for all orientations',()=>{
  expect(connectionPath({x:20,y:40},{x:200,y:90})).toMatch(/^M 20 40 C /);
  expect(connectionPath({x:200,y:90},{x:20,y:40})).toContain('20 40');
 });
});

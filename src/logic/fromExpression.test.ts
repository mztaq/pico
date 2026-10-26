import {describe,expect,it} from 'vitest';
import {booleanExpressions} from './expressions';
import {circuitFromExpression,combineLampDriversWithAnd} from './fromExpression';
import {makeDocument,makeNode} from './model';

describe('code to circuit handoff',()=>{
 it('maps A AND B to two switches, one gate, and a lamp',()=>{
  const doc=circuitFromExpression('A AND B');
  expect(doc.nodes.map(node=>node.kind)).toEqual(['and','switch','switch','lamp']);
  expect(doc.wires).toHaveLength(3);
  expect(booleanExpressions(doc)[0]?.word).toBe('(A AND B)');
 });
 it('respects NOT, parentheses, and Python Boolean operators',()=>{
  const doc=circuitFromExpression('not (A or B) and A');
  expect(booleanExpressions(doc)[0]?.word).toBe('(NOT ((A OR B)) AND A)');
  expect(doc.nodes.filter(node=>node.kind==='switch')).toHaveLength(2);
 });
 it('reports malformed and overly large selections',()=>{
  expect(()=>circuitFromExpression('')).toThrow(/Select a Boolean expression/);
  expect(()=>circuitFromExpression('A AND')).toThrow(/ends before/);
  expect(()=>circuitFromExpression('A = B')).toThrow(/Unsupported character/);
  expect(()=>circuitFromExpression('A\nB')).toThrow(/one short/);
 });
});

describe('multiple lamp drivers',()=>{
 it('explains that two wires are not an AND expression, then combines them explicitly',()=>{
  const doc=makeDocument(),a=makeNode('switch',0,0,'A'),b=makeNode('switch',0,100,'B'),lamp=makeNode('lamp',300,0,'Lamp');
  doc.nodes=[a,b,lamp];doc.wires=[{id:'a',from:a.id,fromPin:'Q',to:lamp.id,toPin:'IN'},{id:'b',from:b.id,fromPin:'Q',to:lamp.id,toPin:'IN'}];
  expect(()=>booleanExpressions(doc)).toThrow(/two wires on one input do not mean AND/);
  const fixed=combineLampDriversWithAnd(doc)!;
  expect(fixed.nodes.filter(node=>node.kind==='and')).toHaveLength(1);
  expect(booleanExpressions(fixed)[0]?.word).toBe('(A AND B)');
  expect(doc.nodes).toHaveLength(3);
 });
});

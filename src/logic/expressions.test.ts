import {describe,it,expect} from 'vitest';
import {loadSample} from './samples';
import {booleanExpressions} from './expressions';
import {makeDocument,makeNode} from './model';
describe('Cambridge IGCSE Boolean expressions',()=>{
 it('derives AND and equivalent formats directly from wires',()=>{
  const views=booleanExpressions(loadSample('and'));
  expect(views).toHaveLength(1);expect(views[0].word).toBe('(A AND B)');
  expect(views[0].algebraic).toBe('(A · B)');
  expect(views[0].minimalSOP).toBe('(A AND B)');
  expect(views[0].minimalPOS).toMatch(/\(A\).*\(B\)|\(B\).*\(A\)/);
 });
 it('includes SUM and CARRY for the half adder',()=>{
  const views=booleanExpressions(loadSample('half'));
  expect(views.map(v=>v.word)).toEqual(['(A XOR B)','(A AND B)']);
  expect(views[0].minimalSOP).toContain('NOT');
 });
 it('generates correct constant and OR forms',()=>{
  const d=makeDocument(),one=makeNode('high',10,10),out=makeNode('lamp',200,10);
  d.nodes=[one,out];d.wires=[{id:'constant',from:one.id,fromPin:'Q',to:out.id,toPin:'IN'}];
  expect(booleanExpressions(d)[0]).toMatchObject({word:'1',minimalSOP:'1',minimalPOS:'1'});
  one.kind='low';
  expect(booleanExpressions(d)[0]).toMatchObject({word:'0',minimalSOP:'0',minimalPOS:'0'});
 });
 it('rejects cycles and multiple drivers',()=>{
  const doc=makeDocument();const a=makeNode('not',0,0),b=makeNode('not',100,0),out=makeNode('lamp',220,0);
  doc.nodes=[a,b,out];doc.wires=[{id:'a',from:a.id,fromPin:'Q',to:b.id,toPin:'A'},{id:'b',from:b.id,fromPin:'Q',to:a.id,toPin:'A'},{id:'c',from:b.id,fromPin:'Q',to:out.id,toPin:'IN'}];
  expect(()=>booleanExpressions(doc)).toThrow(/Feedback loop/);
 });
});

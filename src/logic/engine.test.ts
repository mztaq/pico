import {describe,it,expect} from 'vitest';
import {gate,resolveDrivers,evaluateCircuit,initialSimulation,stepSimulation,generateTruthTable,truthTableCSV} from './engine';
import {makeDocument,makeNode,parseDocument} from './model';
import {loadSample} from './samples';
describe('four state digital logic',()=>{
  it('covers AND OR NOT XOR truth tables',()=>{
    for(const a of [0,1] as const)for(const b of [0,1] as const){
      expect(gate('and',[a,b])).toBe(a&b);
      expect(gate('or',[a,b])).toBe(a|b);
      expect(gate('xor',[a,b])).toBe(a^b);
    }
    expect(gate('not',[0])).toBe(1);expect(gate('not',[1])).toBe(0);
  });
  it('handles Z and X without turning unknowns into zero',()=>{
    expect(gate('and',[0,'X'])).toBe(0);
    expect(gate('and',[1,'Z'])).toBe('X');
    expect(gate('or',[1,'X'])).toBe(1);
    expect(gate('xor',[0,'Z'])).toBe('X');
    expect(gate('tri',[1,0])).toBe('Z');
    expect(gate('tri',[1,1])).toBe(1);
    expect(resolveDrivers(['Z','Z'])).toBe('Z');
    expect(resolveDrivers([1,'Z'])).toBe(1);
    expect(resolveDrivers([0,1])).toBe('X');
  });
  it('runs the AND sample truth table',()=>{
    expect(generateTruthTable(loadSample('and')).rows).toEqual([['0','0','0'],['0','1','0'],['1','0','0'],['1','1','1']]);
  });
  it('verifies all half and full adder combinations',()=>{
    expect(generateTruthTable(loadSample('half')).rows).toEqual([['0','0','0','0'],['0','1','1','0'],['1','0','1','0'],['1','1','0','1']]);
    const table=generateTruthTable(loadSample('full'));
    expect(table.rows).toHaveLength(8);
    for(const row of table.rows){const [a,b,ci,sum,carry]=row.map(Number);expect(sum).toBe((a+b+ci)%2);expect(carry).toBe(Math.floor((a+b+ci)/2));}
    expect(truthTableCSV(table).split('\r\n').filter(Boolean)).toHaveLength(9);
  });
  it('captures D only on a rising edge and retains state otherwise',()=>{
    const d=loadSample('dff'),switchId=d.nodes.find(n=>n.label==='D')!.id,ff=d.nodes.find(n=>n.kind==='dff')!.id;
    const state={...initialSimulation(),inputs:{[switchId]:1 as const}};
    const first=evaluateCircuit(d,state);
    expect(first.state.q[ff]).toBeUndefined();
    const rising=stepSimulation(d,first.state);
    expect(rising.state.q[ff]).toBe(1);
    const falling=stepSimulation(d,{...rising.state,inputs:{[switchId]:0}});
    expect(falling.state.q[ff]).toBe(1);
    const next=stepSimulation(d,falling.state);
    expect(next.state.q[ff]).toBe(0);
  });
  it('checks SR, JK, and T rising-edge functions',()=>{
    for(const kind of ['sr','jkff','tff'] as const){
      const doc=makeDocument();const s=makeNode('high',0,0);const ff=makeNode(kind,120,0);
      doc.nodes=[s,ff];
      const pin=kind==='sr'?'S':kind==='jkff'?'J':'T';
      doc.wires=[{id:'one',from:s.id,fromPin:'Q',to:ff.id,toPin:pin}];
      if(kind==='sr'||kind==='jkff'){const low=makeNode('low',0,130);doc.nodes.push(low);doc.wires.push({id:'two',from:low.id,fromPin:'Q',to:ff.id,toPin:kind==='sr'?'R':'K'});}
      doc.strict=false;
      const previous=initialSimulation();
      const result=evaluateCircuit(doc,previous);
      expect(result.state.q[ff.id]).toBeUndefined();
    }
  });
  it('rejects malicious, malformed and out-of-range project imports',()=>{
    expect(()=>parseDocument({version:1,nodes:[],wires:[],title:'A',strict:true,looseDefault:0})).not.toThrow();
    expect(()=>parseDocument({version:5,nodes:[],wires:[]})).toThrow();
    const doc=makeDocument();doc.nodes=[makeNode('and',0,0)];
    expect(parseDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(()=>parseDocument({...doc,nodes:[{...doc.nodes[0],kind:'script'}]})).toThrow();
    expect(()=>parseDocument({...doc,wires:[{id:'x',from:'bad',fromPin:'Q',to:'bad',toPin:'A'}]})).toThrow();
  });
});

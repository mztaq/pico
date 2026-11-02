import {describe,it,expect} from 'vitest';
import {callTool,listTools} from './tools';
import {makeDocument, makeNode} from '../logic/model';
import {newChart,createNode} from '../flowchart/model';
import {importChart} from '../flowchart/storage';
describe('Pico MCP tool contracts',()=>{
  it('exposes named tools and valid JSON schemas',()=>{
    expect(listTools()).toHaveLength(9);
    for(const tool of listTools())expect(tool.inputSchema).toMatchObject({type:'object'});
  });
  it('executes pseudocode with the existing interpreter',()=>{
    const r=callTool('pico_run_pseudocode',{code:'OUTPUT "hello"'}) as {ok:boolean;output:string[]};
    expect(r.ok, JSON.stringify(r)).toBe(true);expect(r.output).toContain('hello');
  });
  it('returns bounded debug traces',()=>{
    const r=callTool('pico_debug_pseudocode',{code:'OUTPUT "hello"'}) as {trace:unknown[]};
    expect(r.trace, JSON.stringify(r)).toBeDefined();
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.trace.length).toBeLessThanOrEqual(120);
  });
  it('rejects oversized inputs and unknown tools',()=>{
    expect(()=>callTool('pico_run_pseudocode',{code:'x'.repeat(17000)})).toThrow();
    expect(()=>callTool('unknown',{})).toThrow();
  });
  it('simulates and generates truth table from native circuit format',()=>{
    const d=makeDocument('Test');
    expect((callTool('pico_simulate_circuit',{document:d}) as {signals:object}).signals).toBeDefined();
    expect(()=>callTool('pico_truth_table',{document:d})).toThrow(/lamp|display/i);
  });
  it('returns a file that Pico flowchart importer accepts',()=>{
    const project=newChart('From AI');
    const start=createNode('start',20,20),output=createNode('output',20,150),end=createNode('end',20,300);
    project.nodes=[start,output,end];
    project.edges=[{id:'one',from:start.id,to:output.id,port:'next'},{id:'two',from:output.id,to:end.id,port:'next'}];
    const generated=callTool('pico_create_flowchart',{project}) as {importFileContents:string;openUrl:string};
    const parsed=importChart(generated.importFileContents);
    expect(parsed.nodes).toHaveLength(3);
    expect(generated.openUrl).toContain('/app/flowchart');
  });
  it('generates a truth table using Pico circuit engine',()=>{
    const doc=makeDocument('Truth');
    const input=makeNode('switch',20,50),lamp=makeNode('lamp',260,50);
    doc.nodes=[input,lamp];
    doc.wires=[{id:'wire',from:input.id,fromPin:'Q',to:lamp.id,toPin:'IN'}];
    const table=callTool('pico_truth_table',{document:doc}) as {rows:string[][]};
    expect(table.rows).toHaveLength(2);
  });
  it('lists native syntax and circuit capabilities',()=>{
    const c=callTool('pico_capabilities',{}) as {flowchartBlocks:string[];circuitComponents:string[]};
    expect(c.flowchartBlocks).toContain('decision');
    expect(c.circuitComponents).toContain('xor');
  });
});

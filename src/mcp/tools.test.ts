import {describe,it,expect} from 'vitest';
import {callTool,listTools} from './tools';
import {makeDocument} from '../logic/model';
describe('Pico MCP tool contracts',()=>{
  it('exposes named tools and valid JSON schemas',()=>{
    expect(listTools()).toHaveLength(9);
    for(const tool of listTools())expect(tool.inputSchema).toMatchObject({type:'object'});
  });
  it('executes pseudocode with the existing interpreter',()=>{
    const r=callTool('pico_run_pseudocode',{code:'OUTPUT "hello"'}) as {ok:boolean;output:string[]};
    expect(r.ok).toBe(true);expect(r.output).toContain('hello');
  });
  it('returns bounded debug traces',()=>{
    const r=callTool('pico_debug_pseudocode',{code:'OUTPUT "hello"'}) as {trace:unknown[]};
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
  it('lists native syntax and circuit capabilities',()=>{
    const c=callTool('pico_capabilities',{}) as {flowchartBlocks:string[];circuitComponents:string[]};
    expect(c.flowchartBlocks).toContain('decision');
    expect(c.circuitComponents).toContain('xor');
  });
});

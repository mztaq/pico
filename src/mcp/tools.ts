import { compile, autoDeclareVariables } from '../language';
import { execute, RuntimeError } from '../runtime/interpreter';
import { compileFlowchart } from '../flowchart/compiler';
import { NODE_KINDS, DATA_TYPES, type FlowchartProject } from '../flowchart/model';
import { SPECS, parseDocument, type CircuitDocument } from '../logic/model';
import { evaluateCircuit, initialSimulation, generateTruthTable } from '../logic/engine';

const MAX_CODE = 16_384;
const MAX_STEPS = 10_000;
const MAX_TRACE = 120;
const fail = (message: string): never => { throw new Error(message); };
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 200): string {
  if (typeof value !== 'string' || value.length > max) return fail('Invalid or oversized text.');
  return value;
}
function boundedArray(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail('Invalid or oversized array.');
  return value;
}
function run(code: string, inputs: string[], trace: boolean) {
  try {
    const { ast } = compile(autoDeclareVariables(code));
    const result = execute(ast, inputs, { limit: MAX_STEPS, trace });
    return {ok: true, output: result.output, variables: result.variables, steps: result.steps,
      trace: trace ? result.trace.slice(0, MAX_TRACE) : undefined, traceTruncated: result.traceTruncated || result.trace.length > MAX_TRACE,
      outputTruncated: result.outputTruncated};
  } catch (error) {
    if (error instanceof RuntimeError) return {ok: false, error: error.message, line: error.line, code: error.code,
      output: error.result?.output, trace: trace ? error.result?.trace.slice(0, MAX_TRACE) : undefined};
    return {ok: false, error: error instanceof Error ? error.message : 'Execution error'};
  }
}
function flowchart(input: unknown): FlowchartProject {
  const p = obj(input);
  const nodes = boundedArray(p.nodes, 100).map(n => {
    const x = obj(n);
    if (!NODE_KINDS.includes(x.kind as typeof NODE_KINDS[number])) fail('Invalid flowchart block kind.');
    if (!DATA_TYPES.includes(x.dataType as typeof DATA_TYPES[number])) fail('Invalid flowchart data type.');
    return {id: string(x.id, 60), kind: x.kind as FlowchartProject['nodes'][number]['kind'],
      x: Number(x.x), y: Number(x.y), text: string(x.text, 500),
      dataType: x.dataType as FlowchartProject['nodes'][number]['dataType']};
  });
  const edges = boundedArray(p.edges, 250).map(e => {
    const x = obj(e);
    if (!['next','yes','no'].includes(String(x.port))) fail('Invalid edge port.');
    return {id:string(x.id,60),from:string(x.from,60),to:string(x.to,60),port:x.port as 'next'|'yes'|'no'};
  });
  if (nodes.some(n => !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 10000 || Math.abs(n.y) > 10000)) fail('Invalid block coordinates.');
  return {id:string(p.id ?? crypto.randomUUID(),80), name:string(p.name ?? 'AI flowchart',100),nodes,edges,routines:string(p.routines ?? '',MAX_CODE)};
}
function circuit(input: unknown): CircuitDocument {
  const p = obj(input);
  if (boundedArray(p.nodes, 100).length > 100 || boundedArray(p.wires, 200).length > 200) fail('Circuit too large.');
  return parseDocument(p);
}
export const TOOLS = [
  ['pico_run_pseudocode','Run Cambridge-style pseudocode with fixed inputs and an instruction limit.'],
  ['pico_debug_pseudocode','Run pseudocode with a bounded execution trace.'],
  ['pico_create_flowchart','Validate and return an editable Pico flowchart document.'],
  ['pico_run_flowchart','Compile and execute a Pico flowchart.'],
  ['pico_flowchart_to_pseudocode','Convert Pico flowchart connections to pseudocode.'],
  ['pico_create_circuit','Validate and return an editable Pico circuit document.'],
  ['pico_simulate_circuit','Evaluate a Pico circuit and return signal states.'],
  ['pico_truth_table','Generate a circuit truth table, up to eight toggle inputs.'],
  ['pico_capabilities','List supported constructs, blocks, gates and limits.'],
] as const;
const schemas: Record<string, object> = {
  pico_run_pseudocode:{type:'object',properties:{code:{type:'string',maxLength:MAX_CODE},inputs:{type:'array',items:{type:'string',maxLength:500},maxItems:32}},required:['code'],additionalProperties:false},
  pico_debug_pseudocode:{type:'object',properties:{code:{type:'string',maxLength:MAX_CODE},inputs:{type:'array',items:{type:'string',maxLength:500},maxItems:32}},required:['code'],additionalProperties:false},
  pico_create_flowchart:{type:'object',properties:{project:{type:'object'}},required:['project'],additionalProperties:false},
  pico_run_flowchart:{type:'object',properties:{project:{type:'object'},inputs:{type:'array',items:{type:'string',maxLength:500},maxItems:32}},required:['project'],additionalProperties:false},
  pico_flowchart_to_pseudocode:{type:'object',properties:{project:{type:'object'}},required:['project'],additionalProperties:false},
  pico_create_circuit:{type:'object',properties:{document:{type:'object'}},required:['document'],additionalProperties:false},
  pico_simulate_circuit:{type:'object',properties:{document:{type:'object'},inputs:{type:'object',additionalProperties:{type:'integer',enum:[0,1]}}},required:['document'],additionalProperties:false},
  pico_truth_table:{type:'object',properties:{document:{type:'object'}},required:['document'],additionalProperties:false},
  pico_capabilities:{type:'object',properties:{},additionalProperties:false},
};
export function listTools() { return TOOLS.map(([name, description]) => ({name,description,inputSchema:schemas[name]})); }
export function callTool(name:string, input:unknown):unknown {
  const a=obj(input);
  if (JSON.stringify(a).length > 32_768) fail('Tool arguments exceed 32 KB.');
  if (name === 'pico_capabilities') return {syntax:'Cambridge-style Pico pseudocode',flowchartBlocks:NODE_KINDS,variableTypes:DATA_TYPES,
    circuitComponents:Object.keys(SPECS),limits:{codeBytes:MAX_CODE,executionSteps:MAX_STEPS,traceSteps:MAX_TRACE,flowchartNodes:100,circuitNodes:100,circuitWires:200,truthTableInputs:8},
    projectImport:'The tools return native Pico JSON documents. Import into Pico manually until a verified import bridge is implemented.'};
  if (name === 'pico_run_pseudocode' || name === 'pico_debug_pseudocode') {
    const code=string(a.code,MAX_CODE);
    const inputs=boundedArray(a.inputs ?? [],32).map(v=>string(v,500));
    return run(code,inputs,name === 'pico_debug_pseudocode');
  }
  if (['pico_create_flowchart','pico_run_flowchart','pico_flowchart_to_pseudocode'].includes(name)) {
    const project=flowchart(a.project);
    const compiled=compileFlowchart(project);
    if(name==='pico_create_flowchart')return {document:project,code:compiled.code};
    if(name==='pico_flowchart_to_pseudocode')return {code:compiled.code};
    return {code:compiled.code, ...run(compiled.code,boundedArray(a.inputs??[],32).map(v=>string(v,500)),false)};
  }
  if(['pico_create_circuit','pico_simulate_circuit','pico_truth_table'].includes(name)) {
    const doc=circuit(a.document);
    if(name==='pico_create_circuit')return {document:doc};
    if(name==='pico_truth_table')return generateTruthTable(doc);
    const input=obj(a.inputs ?? {});
    for(const [id,value] of Object.entries(input))if(!doc.nodes.some(n=>n.id===id && n.kind==='switch') || (value!==0&&value!==1))fail('Invalid circuit switch input.');
    return evaluateCircuit(doc,{...initialSimulation(), inputs:input as Record<string,0|1>});
  }
  return fail('Unknown tool.');
}

import { describe, expect, it } from 'vitest';
import { compile, synchronizeAutoDeclarations } from '../language';
import { execute } from './interpreter';
import { createInteractiveSession, type WorkerReply } from './worker';

const inferred = (source: string) => compile(synchronizeAutoDeclarations(source).code, { autoDeclare: true }).ast;
const run = (source: string, inputs: string[]) => execute(inferred(source), inputs);

function interactive(source: string) {
  const messages: WorkerReply[] = [];
  const session = createInteractiveSession({ ast: inferred(source), runs: [{ inputs: [], options: { trace: true } }], interactive: true }, reply => messages.push(reply));
  session.start();
  const request = () => {
    const last = messages.at(-1);
    if (!last || Array.isArray(last) || last.type !== 'input') throw Error('Expected input');
    return last.request;
  };
  const input = (value: string) => session.input({ type: 'input', id: request().id, value });
  const result = () => {
    const last = messages.at(-1);
    if (!last || Array.isArray(last) || last.type !== 'complete') throw Error('Expected completion');
    return last.replies[0]!;
  };
  return { session, messages, request, input, result };
}

describe('input types inferred at runtime', () => {
  it.each(['Name', 'Age', 'Enabled', 'x', 'Student_42'])('runs the screenshot example with any variable name: %s', name => {
    const code = `INPUT ${name}\nOUTPUT "Your name is ", ${name}`;
    expect(synchronizeAutoDeclarations(code).code).toBe(code);
    expect(run(code, ['Alex']).output).toEqual(['Your name is Alex']);
    expect(run(code, ['Alex']).variables[name]).toBe('Alex');
  });

  it.each([
    ['5', 5], ['5.0', 5], ['-2.75', -2.75], ['+3', 3], ['TRUE', true], ['false', false],
    ['Alex', 'Alex'], ['A', 'A'], ['', ''], ['  hello  ', '  hello  '],
  ])('detects %j without forcing input to STRING', (raw, expected) => {
    const result = run('INPUT Value\nOUTPUT Value', [raw]);
    expect(result.variables.Value).toBe(expected);
    const session = interactive('INPUT Value\nOUTPUT Value');
    expect(session.request().dataType).toBe('AUTO');
    session.input(raw);
    expect(session.result().error).toBeUndefined();
    expect(session.result().result?.variables.Value).toBe(expected);
  });

  it('chooses a fresh type for each run', () => {
    const ast = inferred('INPUT Value\nOUTPUT Value');
    expect(execute(ast, ['5']).variables.Value).toBe(5);
    expect(execute(ast, ['Alex']).variables.Value).toBe('Alex');
  });

  it('retains the detected type through subsequent inputs', () => {
    const session = interactive('INPUT Value\nOUTPUT Value\nINPUT Value\nOUTPUT Value');
    session.input('5.0');
    expect(session.request().dataType).toBe('REAL');
    session.input('6');
    expect(session.result().error?.message).toMatch(/REAL/);
    expect(session.result().result?.output).toEqual(['5']);
    expect(session.messages.filter(message => !Array.isArray(message) && message.type === 'input')).toHaveLength(2);
  });

  it('detects numeric inputs within the constraints of arithmetic use', () => {
    expect(run('INPUT Value\nOUTPUT Value * 2', ['3']).output).toEqual(['6']);
    expect(run('INPUT Value\nOUTPUT Value * 2', ['3.5']).output).toEqual(['7']);
    const session = interactive('OUTPUT "Before"\nINPUT Value\nOUTPUT Value * 2\nOUTPUT "After"');
    session.input('hello');
    expect(session.result().error).toMatchObject({ line: 2, code: 'type' });
    expect(session.result().result?.output).toEqual(['Before']);
  });

  it('honours text-only context even when input looks numeric or boolean', () => {
    expect(run('INPUT Value\nOUTPUT LENGTH(Value)', ['123']).output).toEqual(['3']);
    expect(run('INPUT Value\nOUTPUT UCASE(Value)', ['true']).output).toEqual(['TRUE']);
  });

  it('propagates detected types through assignments and constants', () => {
    const code = 'INPUT Value\nCopy ← Value\nCONSTANT Saved ← Copy\nOther ← Saved\nOUTPUT Other\nINPUT Other';
    const session = interactive(code);
    session.input('3.0');
    expect(session.request().dataType).toBe('REAL');
    session.input('4.0');
    expect(session.result().error).toBeUndefined();
    expect(session.result().result?.variables).toMatchObject({ Value: 3, Copy: 3, Saved: 3, Other: 4 });
  });

  it('creates independent routine bindings on every call', () => {
    const code = 'PROCEDURE Show()\nINPUT Value\nOUTPUT Value\nENDPROCEDURE\nCALL Show()\nCALL Show()';
    const session = interactive(code);
    expect(session.request().dataType).toBe('AUTO');
    session.input('3');
    expect(session.request().dataType).toBe('AUTO');
    session.input('hello');
    expect(session.result().result?.output).toEqual(['3', 'hello']);
  });

  it('preserves manual declarations and strict invalid-input termination', () => {
    expect(run('DECLARE Value : STRING\nINPUT Value', ['5']).variables.Value).toBe('5');
    expect(run('DECLARE Value : STRING\nINPUT Value', ['TRUE']).variables.Value).toBe('TRUE');
    for (const [type, raw] of [['INTEGER', 'hello'], ['REAL', '5'], ['CHAR', 'long'], ['BOOLEAN', 'yes']]) {
      expect(() => run(`DECLARE Value : ${type}\nINPUT Value`, [raw])).toThrow();
    }
  });

  it('keeps statically inferred types strict', () => {
    const session = interactive('INPUT Value\nOUTPUT Value DIV 2');
    expect(session.request().dataType).toBe('INTEGER');
    session.input('3.0');
    expect(session.result().error?.message).toMatch(/INTEGER/);
  });

  it('does not invent unknown output variables or array bounds', () => {
    expect(() => compile('OUTPUT Missing', { autoDeclare: true })).toThrow(/not been declared/);
    expect(() => compile('INPUT Name\nOUTPUT Typo', { autoDeclare: true })).toThrow(/Typo has not been declared/);
    expect(() => compile('INPUT Items[1]', { autoDeclare: true })).toThrow(/not been declared/);
    expect(() => compile('INPUT Name')).toThrow(/not been declared/);
  });

  it('does not hide conflicting assignments or mixed-type addition', () => {
    expect(() => compile('INPUT Value\nValue ← 1\nValue ← "text"', { autoDeclare: true })).toThrow();
    expect(() => compile('INPUT Value\nOUTPUT "text" + Value', { autoDeclare: true })).toThrow();
    expect(() => compile('CONSTANT N ← 3\nOUTPUT N + "4"', { autoDeclare: true })).toThrow(/numeric/);
  });

  it.each(['9007199254740992', '9007199254740992.0'])('rejects unsafe numeric input %s instead of reclassifying it as text', raw => {
    expect(() => run('INPUT Value\nOUTPUT Value', [raw])).toThrow(/safe range/);
  });

  it('keeps unrelated undeclared identifiers as errors', () => {
    expect(() => compile('DECLARE Count : INTEGER\nDECLARE Copy : INTEGER\nINPUT First\nOUTPUT First = Count\nCopy ← Missing + Count', { autoDeclare: true })).toThrow(/Missing has not been declared/);
  });
});

describe('deferred input editing and debugger state', () => {
  it('removes an obsolete generated type when only unresolved INPUT remains', () => {
    const initial = synchronizeAutoDeclarations('INPUT Value\nValue ← 1');
    const edited = initial.code.replace('\nValue ← 1', '\nOUTPUT Value');
    const result = synchronizeAutoDeclarations(edited, initial.generatedTypes);
    expect(result).toEqual({ code: 'INPUT Value\nOUTPUT Value', generatedTypes: {} });
    expect(execute(compile(result.code, { autoDeclare: true }).ast, ['Alex']).variables.Value).toBe('Alex');
  });

  it('keeps declaration edits aligned when removing an old type and inserting a new one', () => {
    const initial = synchronizeAutoDeclarations('// heading\nINPUT Value\nValue ← 1');
    const edited = initial.code.replace('Value ← 1', 'Flag ← TRUE\nOUTPUT Value');
    const result = synchronizeAutoDeclarations(edited, initial.generatedTypes);
    expect(result.code).toBe('// heading\nDECLARE Flag : BOOLEAN\nINPUT Value\nFlag ← TRUE\nOUTPUT Value');
    expect(result.generatedTypes).toEqual({ 'global::Flag': 'BOOLEAN' });
    expect(execute(compile(result.code, { autoDeclare: true }).ast, ['Alex']).output).toEqual(['Alex']);
  });

  it('preserves typed variables in debugger snapshots after inferred input', () => {
    const result = execute(inferred('INPUT Value\nCopy ← Value\nOUTPUT Copy'), ['TRUE'], { trace: true });
    expect(result.trace.at(-1)?.variables).toMatchObject({ Value: true, Copy: true });
  });

  it('retains the detected type during repeated loop inputs', () => {
    const session = interactive('FOR I ← 1 TO 2\nINPUT Value\nOUTPUT Value\nNEXT I');
    session.input('2');
    expect(session.request().dataType).toBe('INTEGER');
    session.input('2.5');
    expect(session.result().error?.message).toMatch(/INTEGER/);
    expect(session.result().result?.output).toEqual(['2']);
  });

  it('detects type before a REAL routine argument and validates the final argument value', () => {
    const code = 'PROCEDURE Show(N : REAL)\nOUTPUT N\nENDPROCEDURE\nINPUT Value\nCALL Show(Value)';
    expect(run(code, ['3']).output).toEqual(['3']);
    expect(run(code, ['3.5']).output).toEqual(['3.5']);
    expect(() => run(code, ['hello'])).toThrow(/INTEGER or REAL/);
  });
});

 it('preserves comments attached to an obsolete generated declaration', () => {
  const initial = synchronizeAutoDeclarations('INPUT Value\nValue ← 1');
  const edited = initial.code.replace('DECLARE Value : INTEGER', 'DECLARE Value : INTEGER // keep this note').replace('Value ← 1', 'OUTPUT Value');
  const updated = synchronizeAutoDeclarations(edited, initial.generatedTypes);
  expect(updated.code).toBe('// keep this note\nINPUT Value\nOUTPUT Value');
  expect(execute(compile(updated.code, { autoDeclare: true }).ast, ['Alex']).output).toEqual(['Alex']);
});

import { beforeAll, describe, expect, it } from 'vitest';
import { loadPyodide } from 'pyodide';
import { runPythonProgram, type PythonRuntime } from './engine';
import type { PythonRequest } from './config';

let runtime: PythonRuntime;
beforeAll(async () => { runtime = await loadPyodide() as unknown as PythonRuntime; }, 60000);
function run(code: string, inputs: string[] = [], options: Partial<PythonRequest> = {}) {
  const stdout: string[] = [], stderr: string[] = [];
  const prompts: { prompt: string; line: number }[] = [];
  const reply = runPythonProgram(runtime, { code, filename: 'main.py', debug: true, files: {}, sources: {}, ...options }, {
    stdout: line => stdout.push(line), stderr: line => stderr.push(line),
    readInput: (prompt, line) => { prompts.push({ prompt, line }); if (!inputs.length) throw new Error('Unexpected input'); return inputs.shift()!; },
  });
  return { ...reply, stdout, stderr, prompts };
}
describe('real browser CPython runtime', () => {
  it('reports its actual Python 3.14 version', () => {
    expect(run('import sys\nprint(sys.version.split()[0])').stdout).toEqual(['3.14.2']);
  });
  it('runs input, f-strings, Unicode and records changing variables', () => {
    const r = run('name = input("Name? ")\ncount = 2\ncount += 3\nprint(f"Hello {name}: {count}!")', ['Ada 🌏']);
    expect(r.error).toBeUndefined();
    expect(r.stdout).toEqual(['Name? ', 'Hello Ada 🌏: 5!']);
    expect(r.prompts).toEqual([{prompt:'Name? ',line:1}]);
    expect(r.result?.variables).toEqual({name:'Ada 🌏',count:5});
    expect(r.result?.trace.some(step => step.variables.count === 2)).toBe(true);
    expect(r.result?.trace.at(-1)?.variables.count).toBe(5);
  });
  it.each(['hello','5.0',''])('terminates int(input()) for %s, without consuming another input', raw => {
    const r=run('print("Before")\nn = int(input("Number? "))\nprint("After")',[''+raw,'12']);
    expect(r.error).toMatchObject({code:'python',line:2});
    expect(r.error?.message).toContain('ValueError');
    expect(r.error?.diagnostic).toContain('main.py');
    expect(r.stdout).toEqual(['Before','Number? ']);
    expect(r.prompts).toHaveLength(1);
  });
  it('uses Python float semantics and terminates invalid conversions', () => {
    expect(run('print(float(input()))',['5']).stdout).toEqual(['5.0']);
    expect(run('print(float(input()))',['5.0']).stdout).toEqual(['5.0']);
    expect(run('print(float(input()))',['text']).error?.message).toContain('ValueError');
  });
  it('accepts empty text and preserves spaces', () => {
    expect(run('a=input()\nb=input()\nprint(repr(a),repr(b))',['','  Ada  ']).stdout).toEqual(["'' '  Ada  '"]);
  });
  it.each([
    ['a =\nprint("After")','SyntaxError',1],
    ['print("Before")\nprint(1/0)\nprint("After")','ZeroDivisionError',2],
    ['print("Before")\nprint(unknown)','NameError',2],
    ['number = 3\nprint(number + "hello")','TypeError',2],
    ['import sys\nsys.exit(2)\nprint("After")','SystemExit',2],
  ])('reports fatal %s with a source line and preserves partial results', (code, type, line) => {
    const r=run(code);
    expect(r.error).toMatchObject({line,code:'python'});
    expect(r.error?.message).toContain(type);
    expect(r.stdout).not.toContain('After');
    expect(r.result).toBeDefined();
  });
  it('treats exit(0) as successful termination', () => {
    const r=run('import sys\nprint("Before")\nsys.exit(0)\nprint("After")');
    expect(r.error).toBeUndefined();expect(r.stdout).toEqual(['Before']);
  });
  it('supports functions, local scopes and imports from another source tab', () => {
    const r=run('from helper import double\nvalue = double(4)\nprint(value)', [], {sources:{'helper.py':'def double(n):\n    return n * 2'}});
    expect(r.error).toBeUndefined();expect(r.stdout).toEqual(['8']);expect(r.result?.variables.value).toBe(8);
  });
  it('records Python function locals and points syntax-error snapshots at the failing line', () => {
    const r=run('def double(n):\n    result=n*2\n    return result\nanswer=double(4)\nprint(answer)');
    expect(r.result?.trace.some(step=>step.variables.n===4 && step.variables.result===8)).toBe(true);
    expect(r.result?.variables.answer).toBe(8);
    const bad=run('name="Ada"\ncount=3\nnumber =');
    expect(bad.error?.line).toBe(3);expect(bad.result?.trace.at(-1)?.line).toBe(3);
  });
  it('reads and writes project text files and keeps runs isolated', () => {
    const r=run('with open("data.txt") as f:\n    data = f.read()\nwith open("result.txt", "w") as f:\n    f.write(data.upper())', [], {files:{'data.txt':['first','second']}});
    expect(r.error).toBeUndefined();expect(r.result?.files['result.txt']).toEqual(['FIRST','SECOND']);
    expect(run('open("result.txt")').error?.message).toContain('FileNotFoundError');
    expect(run('print(data)').error?.message).toContain('NameError');
  });
  it('streams stderr separately and flushes partial output', () => {
    const r=run('import sys\nprint("partial", end="")\nprint("problem", file=sys.stderr)');
    expect(r.stdout).toEqual(['partial']);expect(r.stderr).toEqual(['problem']);
  });
  it('bounds output and trace without imposing a loop execution limit', () => {
    const r=run('i=0\nwhile i < 12000:\n    i+=1\nprint(i)');
    expect(r.error).toBeUndefined();expect(r.stdout).toEqual(['12000']);expect(r.result?.traceTruncated).toBe(true);
    const many=run('for i in range(2100):\n    print(i)', [], {debug:false});
    expect(many.result?.output).toHaveLength(2000);expect(many.result?.output[0]).toBe('100');expect(many.result?.outputTruncated).toBe(true);
  });
  it('inspects cyclic objects and large integers without invoking custom repr', () => {
    const r=run('class Thing:\n    def __repr__(self):\n        raise RuntimeError("Do not call")\nthing=Thing()\nvalues=[]\nvalues.append(values)\nbig=10**50\nnan=float("nan")');
    expect(r.error).toBeUndefined();expect(r.result?.variables.thing).toBe('<Thing>');expect(r.result?.variables.big).toBe('1'+'0'.repeat(50));expect(r.result?.variables.nan).toBe('nan');
  });
});

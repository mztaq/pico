import { afterEach, describe, expect, it, vi } from 'vitest';
import { compile } from '../language';
import { createInteractiveSession, type PendingInput, type WorkerReply } from './worker';

function sessionFor(code: string, files: Record<string, string[]> = {}) {
  const messages: WorkerReply[] = [];
  const session = createInteractiveSession({ ast: compile(code).ast, runs: [{ inputs: [], options: { files } }], interactive: true }, reply => messages.push(reply));
  session.start();
  const request = () => {
    const last = messages.at(-1);
    if (!last || Array.isArray(last) || last.type !== 'input') throw new Error('Expected a pending INPUT');
    return last.request;
  };
  const input = (value: string) => session.input({ type: 'input', id: request().id, value });
  const result = () => {
    const last = messages.at(-1);
    if (!last || Array.isArray(last) || last.type !== 'complete') throw new Error('Expected execution to finish');
    return last.replies[0]!;
  };
  return { session, messages, request, input, result };
}
afterEach(() => vi.restoreAllMocks());

describe('interactive execution', () => {
  it('prints each prompt before waiting, resumes loops and completes once', () => {
    const run = sessionFor('DECLARE N : INTEGER\nFOR I ← 1 TO 2\nOUTPUT "Number ", I\nINPUT N\nOUTPUT N * 2\nNEXT I');
    expect(run.messages[0]).toEqual({ type: 'output', lines: ['Number 1'] });
    expect(run.request()).toMatchObject({ variable: 'N', dataType: 'INTEGER', line: 4 });
    run.input('3');
    expect(run.messages[2]).toEqual({ type: 'output', lines: ['6', 'Number 2'] });
    run.input('5');
    expect(run.result().result?.output).toEqual(['Number 1', '6', 'Number 2', '10']);
    expect(run.result().result?.variables.N).toBe(5);
  });

  it('preserves caller scopes and partially evaluated function expressions', () => {
    const run = sessionFor(`DECLARE N : INTEGER
N ← 9
FUNCTION Ask() RETURNS INTEGER
    DECLARE N : INTEGER
    INPUT N
    RETURN N
ENDFUNCTION
OUTPUT Ask() + Ask()
OUTPUT N`);
    run.input('3');
    expect(run.request().variable).toBe('N');
    run.input('4');
    expect(run.result().result?.output).toEqual(['7', '9']);
    expect(run.result().result?.trace.at(-1)?.variables.N).toBe(9);
  });

  it('does not replay randomness, file writes, or file cursors on resume', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const run = sessionFor(`DECLARE Text, Line : STRING
OUTPUT RANDOM()
OPENFILE "data" FOR READ
READFILE "data", Line
OUTPUT Line
OPENFILE "log" FOR WRITE
WRITEFILE "log", "before"
INPUT Text
WRITEFILE "log", Text
READFILE "data", Line
OUTPUT Line
CLOSEFILE "data"
CLOSEFILE "log"`, { data: ['first', 'second'] });
    run.input('after');
    expect(random).toHaveBeenCalledTimes(1);
    expect(run.result().result?.output).toEqual(['0.25', 'first', 'second']);
    expect(run.result().result?.files.log).toEqual(['before', 'after']);
  });

  it('retains a REPEAT local while a function in UNTIL waits for input', () => {
    const run = sessionFor(`FUNCTION Finished(Value : INTEGER) RETURNS BOOLEAN
    DECLARE Answer : BOOLEAN
    OUTPUT Value
    INPUT Answer
    RETURN Answer
ENDFUNCTION
REPEAT
    DECLARE N : INTEGER
    N ← 7
UNTIL Finished(N)`);
    run.input('FALSE');
    expect(run.request().variable).toBe('Answer');
    run.input('TRUE');
    expect(run.result().result?.output).toEqual(['7', '7']);
  });

  it('accepts array element INPUT and does not request input in skipped branches', () => {
    const run = sessionFor('DECLARE A : ARRAY[1:2] OF INTEGER\nIF FALSE THEN\nINPUT A[2]\nENDIF\nINPUT A[1]\nOUTPUT A[1]');
    expect(run.request().line).toBe(5);
    run.input('12');
    expect(run.result().result?.output).toEqual(['12']);
  });

  it.each([
    ['INTEGER', 'bad', '12', '12'],
    ['REAL', 'NaN', '1.5', '1.5'],
    ['BOOLEAN', 'yes', 'false', 'FALSE'],
    ['CHAR', 'AB', 'P', 'P'],
  ])('retries invalid %s input without repeating preceding output', (type, invalid, valid, expected) => {
    const run = sessionFor(`DECLARE Value : ${type}\nOUTPUT "Enter value"\nINPUT Value\nOUTPUT Value`);
    const old: PendingInput = run.request();
    run.input(invalid);
    expect(run.request().error).toBeTruthy();
    expect(run.request().id).not.toBe(old.id);
    const count = run.messages.length;
    run.session.input({ type: 'input', id: old.id, value: valid });
    expect(run.messages).toHaveLength(count);
    run.input(valid);
    expect(run.result().result?.output).toEqual(['Enter value', expected]);
  });

  it('accepts an empty STRING and preserves whitespace', () => {
    const run = sessionFor('DECLARE Text : STRING\nINPUT Text\nOUTPUT Text\nINPUT Text\nOUTPUT Text');
    run.input('');
    run.input('  Pico  ');
    expect(run.result().result?.output).toEqual(['', '  Pico  ']);
  });

  it('reports partial output and trace on an error after INPUT', () => {
    const run = sessionFor('DECLARE N : INTEGER\nOUTPUT "Before"\nINPUT N\nOUTPUT 10 / N');
    run.input('0');
    expect(run.result().error).toMatchObject({ line: 4 });
    expect(run.result().result?.output).toEqual(['Before']);
    expect(run.result().result?.trace.length).toBeGreaterThan(0);
    const count = run.messages.length;
    run.session.input({ type: 'input', id: 1, value: '2' });
    run.session.start();
    expect(run.messages).toHaveLength(count);
  });

  it('keeps the execution step limit across repeated input pauses', () => {
    const messages: WorkerReply[] = [];
    const session = createInteractiveSession({ ast: compile('DECLARE N : INTEGER\nWHILE TRUE DO\nINPUT N\nENDWHILE').ast, runs: [{ inputs: [], options: { limit: 6 } }] }, reply => messages.push(reply));
    session.start();
    for (let i = 0; i < 10; i++) {
      const last = messages.at(-1);
      if (!last || Array.isArray(last) || last.type !== 'input') break;
      session.input({ type: 'input', id: last.request.id, value: '1' });
    }
    expect(messages.at(-1)).toMatchObject({ type: 'complete', replies: [{ error: { code: 'step-limit' } }] });
  });
});

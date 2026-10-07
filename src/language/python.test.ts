import { describe, expect, it } from 'vitest';
import { compile, compileToPython } from './index';

describe('Python compiler', () => {
  it('generates runnable Python for typed input, output, arithmetic and loops', () => {
    const source = 'DECLARE Number : REAL\nINPUT Number\nFOR I ← 1 TO 2\nOUTPUT Number + I\nNEXT I';
    const python = compileToPython(compile(source).ast);
    expect(python).toContain('def _pico_program()');
    expect(python).toContain('_pico_input("REAL"');
    expect(python).toContain('_pico_range(1, 2, 1)');
  });

  it('preserves one-based array bounds and Cambridge output formatting', () => {
    const python = compileToPython(compile('DECLARE A : ARRAY[1:2] OF INTEGER\nA[1] ← 7\nOUTPUT A[1]').ast);
    expect(python).toContain('_PicoArray([[1, 2]])');
    expect(python).toContain("print(_pico_format(A[1]), sep='')");
  });

});

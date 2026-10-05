import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { completionSource, visibleNames } from './completions';

const labels = (source: string) => visibleNames(source).map(option => option.label);
const suggest = (doc: string, explicit = false) => completionSource(new CompletionContext(EditorState.create({ doc }), doc.length, explicit));

describe('declared name suggestions', () => {
  it('includes typed variables, comma declarations, arrays and constants with their original spelling', () => {
    const options = visibleNames('DECLARE Total, Count : INTEGER\nDECLARE Grid : ARRAY[1:3, 1:3] OF REAL\nCONSTANT Greeting ← "Hello"\nOUTPUT To');
    expect(options.map(option => [option.label, option.detail, option.type])).toEqual([
      ['Total', 'INTEGER', 'variable'], ['Count', 'INTEGER', 'variable'],
      ['Grid', 'ARRAY[1:3, 1:3] OF REAL', 'variable'], ['Greeting', 'Constant', 'constant'],
    ]);
    const result = suggest('DECLARE Total : INTEGER\nOUTPUT To')!;
    expect(result.from).toBe(31);
    expect(result.options.find(option => option.label === 'Total')).toMatchObject({ type: 'variable', boost: 5 });
    expect(result.options.some(option => option.label === 'OUTPUT')).toBe(true);
  });

  it('works before the whole program parses and does not suggest later declarations or the declaration being typed', () => {
    expect(labels('DECLARE Name : STRING\nIF Name =\nOUTPUT Na')).toEqual(['Name']);
    expect(labels('DECLARE Name : STRING')).toEqual([]);
    const doc = 'OUTPUT Na\nDECLARE Name : STRING';
    expect(completionSource(new CompletionContext(EditorState.create({ doc }), 9, false))!.options.some(option => option.label === 'Name')).toBe(false);
  });

  it('ignores fake declarations in strings and comments, including escaped quotes', () => {
    expect(labels('// DECLARE Fake : INTEGER\nOUTPUT "DECLARE FakeToo : INTEGER"\nOUTPUT "escaped \\" // DECLARE Hidden : INTEGER"\nDECLARE RealName : STRING // DECLARE Wrong : INTEGER\nOUTPUT Re')).toEqual(['RealName']);
  });

  it.each(['OUTPUT "Na', "OUTPUT 'N", 'OUTPUT “Na', '// Na', 'OUTPUT 1 // Na'])('suppresses suggestions inside %s', doc => {
    expect(suggest(doc, true)).toBeNull();
  });

  it('opens explicitly on an empty line, but waits for typing otherwise', () => {
    expect(suggest('DECLARE Name : STRING\n')).toBeNull();
    expect(suggest('DECLARE Name : STRING\n', true)!.options.some(option => option.label === 'Name')).toBe(true);
    expect(suggest('OUTPUT "Name" + Na')!.options.some(option => option.label === 'OUTPUT')).toBe(true);
  });

  it('keeps nested declarations inside their branch and prefers the nearest shadow', () => {
    const start = 'DECLARE Value : INTEGER\nIF TRUE\nTHEN\nDECLARE Value : STRING\nDECLARE LocalName : CHAR\n';
    expect(visibleNames(start + 'OUTPUT Va').find(option => option.label === 'Value')?.detail).toBe('STRING');
    expect(labels(start + 'ELSE\nOUTPUT Lo')).toEqual(['Value']);
    expect(labels(start + 'ENDIF\nOUTPUT Lo')).toEqual(['Value']);
  });

  it('includes implicit counters in the enclosing scope while hiding loop-body declarations afterward', () => {
    const start = 'FOR Counter ← 1 TO 3\nDECLARE Temp : INTEGER\n';
    expect(labels(start + 'OUTPUT Co')).toEqual(['Counter', 'Temp']);
    expect(labels(start + 'NEXT Counter\nOUTPUT Co')).toEqual(['Counter']);
    expect(labels('WHILE TRUE DO\nDECLARE Hidden : INTEGER\nENDWHILE\nOUTPUT H')).toEqual([]);
  });

  it('keeps REPEAT locals visible in UNTIL and removes them on the next line', () => {
    const start = 'REPEAT\nDECLARE Finished : BOOLEAN\n';
    expect(labels(start + 'UNTIL Fi')).toEqual(['Finished']);
    expect(labels(start + 'UNTIL Finished\nOUTPUT Fi')).toEqual([]);
  });

  it('keeps CASE declarations within their own branch', () => {
    const start = 'DECLARE Choice : STRING\nCASE OF Choice\n"A":\nDECLARE First : INTEGER\n';
    expect(labels(start + 'OUTPUT Fi')).toEqual(['Choice', 'First']);
    expect(labels(start + '"B":\nOUTPUT Fi')).toEqual(['Choice']);
    expect(labels(start + 'OTHERWISE\nOUTPUT Fi')).toEqual(['Choice']);
    expect(labels(start + 'ENDCASE\nOUTPUT Fi')).toEqual(['Choice']);
  });

  it('suggests routine parameters and globals, without leaking locals between routines or from a caller block', () => {
    const start = 'DECLARE Global : INTEGER\nIF TRUE THEN\nDECLARE CallerLocal : INTEGER\nPROCEDURE Show(Name : STRING, Age : INTEGER)\nDECLARE Private : CHAR\n';
    expect(labels(start + 'OUTPUT Na')).toEqual(['Global', 'Name', 'Age', 'Private']);
    expect(labels(start + 'ENDPROCEDURE\nENDIF\nFUNCTION Double(N : INTEGER) RETURNS INTEGER\nRETURN N')).toEqual(['Global', 'N']);
    expect(labels(start + 'ENDPROCEDURE\nENDIF\nOUTPUT Pr')).toEqual(['Global']);
  });

  it('refreshes names after renaming, deleting, or switching the document', () => {
    expect(suggest('DECLARE Total : INTEGER\nOUTPUT T')!.options.some(option => option.label === 'Total')).toBe(true);
    const options = suggest('DECLARE Score : REAL\nOUTPUT S')!.options;
    expect(options.some(option => option.label === 'Score')).toBe(true);
    expect(options.some(option => option.label === 'Total')).toBe(false);
    expect(suggest('OUTPUT T')!.options.some(option => option.label === 'Total')).toBe(false);
  });
});

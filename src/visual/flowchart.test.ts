// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import { compile } from '../language';
import { toMermaid } from './flowchart';
import { executableLines } from './execution';

describe('execution visualizations', () => {
  it('runs a REPEAT body before testing UNTIL and loops on No', async () => {
    const diagram=toMermaid(compile('REPEAT\nOUTPUT "hi"\nUNTIL TRUE').ast);
    expect(diagram).toContain('start --> n1');
    expect(diagram).toContain('n1 --> n2');
    expect(diagram).toContain('n2 --> n3');
    expect(diagram).toContain('n3 -->|"No"| n1');
    expect(diagram).toContain('n3 -->|"Yes"| n4');
    await expect(mermaid.parse(diagram)).resolves.toMatchObject({diagramType:'flowchart-v2'});
  });
  it('draws every CASE branch, a fallback, array indexes and comparison operators', async () => {
    const source='DECLARE A : ARRAY[0:1] OF INTEGER\nDECLARE N : INTEGER\nN ← 1\nCASE OF N\n1 : A[0] ← 2\nOTHERWISE\nA[0] ← 3\nENDCASE\nIF N < 2 THEN\nOUTPUT A[0]\nENDIF';
    const diagram=toMermaid(compile(source).ast);
    expect(diagram).toContain('|"1"|');expect(diagram).toContain('|"Otherwise"|');
    expect(diagram).toContain('A[0] ← 2');expect(diagram).toContain('&lt;');
    await expect(mermaid.parse(diagram)).resolves.toBeTruthy();
  });
  it('keeps routine definitions outside the main path and stops at RETURN', async () => {
    const diagram=toMermaid(compile('FUNCTION F() RETURNS INTEGER\nRETURN 1\nOUTPUT "unreachable"\nENDFUNCTION\nOUTPUT F()').ast);
    expect(diagram.indexOf('OUTPUT F()')).toBeLessThan(diagram.indexOf('subgraph'));
    expect(diagram).not.toContain('unreachable');
    await expect(mermaid.parse(diagram)).resolves.toBeTruthy();
  });
  it('draws explicit FOR initialization and increment', async () => {
    const diagram=toMermaid(compile('DECLARE I : INTEGER\nFOR I ← 2 TO 1 STEP -1\nOUTPUT I\nNEXT I').ast);
    expect(diagram).toContain('I ← 2');expect(diagram).toContain('I ← I + (- (1))');
    await expect(mermaid.parse(diagram)).resolves.toBeTruthy();
  });
  it('counts executable AST lines rather than structural markers', () => {
    const source='FUNCTION F() RETURNS INTEGER\nRETURN 1\nENDFUNCTION\nIF TRUE\nTHEN\nOUTPUT F()\nELSE\nOUTPUT 0\nENDIF';
    expect(executableLines(compile(source).ast)).toEqual([2,4,6,8]);
  });
});

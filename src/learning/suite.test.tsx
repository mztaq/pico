import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowchartPreview } from './FlowchartPreview';
import { gateOutput } from './RetroArcade';

describe('Live Studio flowchart', () => {
  it('renders declarations, branches and loops from compiled pseudocode', () => {
    const code = [
      'DECLARE N : INTEGER', 'N <- 1', 'IF N > 0 THEN',
      '    OUTPUT "Positive"', 'ELSE', '    OUTPUT "Negative"',
      'ENDIF', 'WHILE N < 3 DO', '    N <- N + 1', 'ENDWHILE',
    ].join('\n');
    const html = renderToStaticMarkup(
      <FlowchartPreview program={compile(code).ast} lines={code.split('\n')} activeLine={3} />,
    );
    expect(html).toContain('suite-flow-node decision');
    expect(html).toContain('TRUE');
    expect(html).toContain('FALSE');
    expect(html).toContain('LOOP BODY');
    expect(html).toContain('Line 3');
    expect(html).toContain('suite-flow-node terminal');
  });
});

describe('Logic Rush', () => {
  it('evaluates every two-input gate correctly', () => {
    const expected = {
      AND: [0, 0, 0, 1],
      OR: [0, 1, 1, 1],
      XOR: [0, 1, 1, 0],
      NAND: [1, 1, 1, 0],
      NOR: [1, 0, 0, 0],
    } as const;
    for (const [gate, results] of Object.entries(expected)) {
      expect([gateOutput(gate as keyof typeof expected, 0, 0),
        gateOutput(gate as keyof typeof expected, 0, 1),
        gateOutput(gate as keyof typeof expected, 1, 0),
        gateOutput(gate as keyof typeof expected, 1, 1)]).toEqual(results);
    }
  });
});

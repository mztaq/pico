import { describe, expect, it } from 'vitest';
import { highlightPseudocode } from './HighlightedCode';

describe('reference syntax highlighting', () => {
  it('preserves whitespace, Unicode and HTML-like text exactly for copying', () => {
    const source = 'DECLARE Name : STRING\nName ← "<Pico & friends>"\n// comment\nOUTPUT Name\n';
    const parts = highlightPseudocode(source);
    expect(parts.map(part => part.text).join('')).toBe(source);
    expect(parts.find(part => part.className === 'syntax-string')?.text).toBe('"<Pico & friends>"');
    expect(parts.find(part => part.className === 'syntax-comment')?.text).toBe('// comment');
  });
  it('uses the editor categories for types, routines, booleans, numbers and control words', () => {
    const parts = highlightPseudocode('DECLARE Ready : BOOLEAN\nReady ← TRUE\nIF Ready THEN\n    OUTPUT ROUND(3.14, 1)\nENDIF');
    const textFor = (className: string) => parts.filter(part => part.className === className).map(part => part.text).join(' ');
    expect(textFor('syntax-type')).toContain('BOOLEAN');
    expect(textFor('syntax-bool')).toContain('TRUE');
    expect(textFor('syntax-function')).toContain('ROUND');
    expect(textFor('syntax-number')).toContain('3.14');
    expect(textFor('syntax-keyword')).toContain('IF');
    expect(textFor('syntax-variable')).toContain('Ready');
  });
});

const OPENERS = /^(THEN\b|IF\b.*\bTHEN|WHILE\b.*\bDO|FOR\b.*|REPEAT\b|CASE\s+OF\b|PROCEDURE\b|FUNCTION\b)/i;
const CLOSERS = /^(ENDIF\b|ENDWHILE\b|NEXT\b|UNTIL\b|ENDCASE\b|ENDPROCEDURE\b|ENDFUNCTION\b)/i;
const MID_BLOCK = /^(ELSE\b|OTHERWISE\b)/i;

/** Format indentation only; code text, comments and blank lines are preserved. */
export function formatPseudocode(source: string): string {
  let depth = 0;
  return source.split(/\r?\n/).map(raw => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (CLOSERS.test(trimmed) || MID_BLOCK.test(trimmed)) depth = Math.max(0, depth - 1);
    const result = `${' '.repeat(depth * 4)}${trimmed}`;
    if (OPENERS.test(trimmed) && !CLOSERS.test(trimmed)) depth += 1;
    if (MID_BLOCK.test(trimmed)) depth += 1;
    return result;
  }).join('\n');
}

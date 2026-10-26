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


const PYTHON_DEDENT = /^(?:async\s+)?(?:elif\b|else\s*:|except\b|finally\s*:|case\b)/i;
const PYTHON_BLOCK = /:\s*(?:#.*)?$/;

function scanPythonLine(line: string, triple: string | null): { code: string; bracketChange: number; triple: string | null; wasInTriple: boolean } {
  const wasInTriple = triple !== null;
  let bracketChange = 0;
  for (let i = 0; i < line.length;) {
    if (triple) {
      const end = line.indexOf(triple, i);
      if (end < 0) return { code: '', bracketChange, triple, wasInTriple };
      i = end + triple.length;
      triple = null;
      continue;
    }
    const character = line[i]!;
    if (character === '#') return { code: line.slice(0, i), bracketChange, triple, wasInTriple };
    if (character === '"' || character === "'") {
      const delimiter = line.slice(i, i + 3) === character.repeat(3) ? character.repeat(3) : character;
      if (delimiter.length === 3) {
        triple = delimiter;
        i += 3;
        continue;
      }
      i += 1;
      while (i < line.length) {
        if (line[i] === '\\') { i += 2; continue; }
        if (line[i] === character) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if ('([{'.includes(character)) bracketChange += 1;
    if (')]}'.includes(character)) bracketChange -= 1;
    i += 1;
  }
  return { code: line, bracketChange, triple, wasInTriple };
}

/** Indent Python blocks, clauses, and bracket continuations without rewriting code tokens. */
export function formatPython(source: string): string {
  let depth = 0;
  let bracketDepth = 0;
  let triple: string | null = null;
  let previousSourceIndent: number | null = null;
  return source.split(/\r?\n/).map(raw => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const scan = scanPythonLine(raw, triple);
    triple = scan.triple;
    if (scan.wasInTriple) return raw;

    const sourceIndent = (raw.match(/^[ \t]*/) ?? [''])[0]!.replace(/\t/g, '    ').length;
    const line = scan.code.trim();
    if (!line) return `${' '.repeat(depth * 4)}${trimmed}`;

    if (previousSourceIndent !== null && sourceIndent < previousSourceIndent && !PYTHON_DEDENT.test(line)) {
      depth = Math.min(depth, Math.floor(sourceIndent / 4));
    }
    if (PYTHON_DEDENT.test(line)) depth = Math.max(0, depth - 1);

    const closesBracket = /^[)\]}]/.test(line);
    const indentDepth = Math.max(0, depth + (bracketDepth > 0 && !closesBracket ? 1 : 0));
    const formatted = `${' '.repeat(indentDepth * 4)}${trimmed}`;

    bracketDepth = Math.max(0, bracketDepth + scan.bracketChange);
    const continuation = /\\\s*(?:#.*)?$/.test(line);
    if (bracketDepth === 0 && !continuation && PYTHON_BLOCK.test(line)) depth += 1;
    previousSourceIndent = sourceIndent;
    return formatted;
  }).join('\n');
}

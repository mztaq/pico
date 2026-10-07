import { COMPLETIONS, KEYWORDS, ROUTINES, TYPES } from '../language/lexer';
export interface Suggestion { line: number; column: number; endColumn: number; original: string; replacement: string; }
const docs: Record<string, string> = {
  DECLARE: 'Introduce a variable before using it. Examples: DECLARE Score : INTEGER or DECLARE Name : STRING.',
  CONSTANT: 'Give a named value that cannot be changed later. Example: CONSTANT Limit ← 10.',
  INPUT: 'Read a value into a declared variable. Example: DECLARE Name : STRING / INPUT Name.',
  OUTPUT: 'Display one or more values. Example: OUTPUT \"Total: \", Total.',
  IF: 'Choose which instructions run when a condition is TRUE. Example: IF Score >= 50 THEN … ENDIF.',
  THEN: 'Marks the start of the instructions selected by an IF condition.',
  ELSE: 'Optional alternative instructions when the IF condition is FALSE.',
  ENDIF: 'Closes an IF selection block.',
  CASE: 'Select one branch based on a value. Example: CASE OF Choice / 1 : OUTPUT \"One\" / OTHERWISE … / ENDCASE.', OF: 'Introduces the CASE expression.', OTHERWISE: 'Fallback branch when no CASE selector matches.', ENDCASE: 'Closes a CASE selection.',
  WHILE: 'Repeat its block while the condition stays TRUE. Cambridge syntax requires DO. Example: WHILE Number <> -1 DO.',
  ENDWHILE: 'Closes a WHILE loop.',
  DO: 'Required after a WHILE condition. Example: WHILE Number <> -1 DO.', REPEAT: 'Post-condition loop; example: REPEAT / Number ← Number + 1 / UNTIL Number = 5.', UNTIL: 'Ends REPEAT when its condition becomes TRUE.',
  FOR: 'Count through values. A new counter is implicitly INTEGER, so DECLARE is optional. Example: FOR Counter ← 1 TO 5 / OUTPUT Counter / NEXT Counter.',
  TO: 'Sets the inclusive end value of a FOR loop.',
  STEP: 'Optional change per FOR iteration. A negative step counts downward.',
  NEXT: 'Closes a FOR loop. The counter name after NEXT is optional.',
  PROCEDURE: 'Define a reusable instruction block.', FUNCTION: 'Define a reusable routine that returns a value.', CALL: 'Run a procedure with its parameters.', RETURN: 'Return a value from a function.', ARRAY: 'Declare an indexed one- or two-dimensional collection.', INTEGER: 'Whole-number variable type.', REAL: 'Number variable type that can include a decimal point.',
  CHAR: 'A single-character variable type.', STRING: 'Text variable type.', BOOLEAN: 'Logical TRUE or FALSE variable type.',
  AND: 'TRUE only when both Boolean conditions are TRUE.', OR: 'TRUE when either Boolean condition is TRUE.',
  NOT: 'Reverses a Boolean condition.', DIV: 'Integer division: 17 DIV 5 is 3.', MOD: 'Remainder: 17 MOD 5 is 2.',
  TRUE: 'Boolean value meaning yes.', FALSE: 'Boolean value meaning no.',
  ROUND: 'Round(number, decimalPlaces).', LENGTH: 'Return the number of characters in a string.',
  UPPER: 'Return a string in uppercase letters.', LOWER: 'Return a string in lowercase letters.', UCASE: 'Cambridge uppercase routine.', LCASE: 'Cambridge lowercase routine.', SUBSTRING: 'Return part of a string using one-based start and length. Example: SUBSTRING(\"Cambridge\", 1, 4) gives \"Camb\".', RANDOM: 'Return a random real number from 0 up to 1.', OPENFILE: 'Open a browser-local practice file for reading or writing.', READFILE: 'Read a line without deleting it. Example: READFILE \"notes.txt\", Line.', WRITEFILE: 'Write to a project file opened FOR WRITE. Example: WRITEFILE \"notes.txt\", Text.', CLOSEFILE: 'Close the open practice file.',
};
export function documentationFor(keyword: string): string | undefined { return docs[keyword.toUpperCase()]; }
function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) { let diagonal = row[0]!; row[0] = i; for (let j = 1; j <= b.length; j += 1) { const old = row[j]!; row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)); diagonal = old; } }
  return row[b.length]!;
}
function maskStrings(line: string): string {
  return line.replace(/"(?:\\.|[^"\\])*"|“(?:\\.|[^”\\])*”|'(?:\\.|[^'\\])*'/g, segment => ' '.repeat(segment.length)).split('//')[0] ?? '';
}
function declaredNames(source: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = maskStrings(rawLine);
    const declaration = /^\s*DECLARE\s+([^:]+)/i.exec(line)?.[1];
    if (declaration) for (const name of declaration.split(',')) {
      const trimmed = name.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) names.set(trimmed.toUpperCase(), trimmed);
    }
    const constant = /^\s*CONSTANT\s+([A-Za-z_][A-Za-z0-9_]*)/i.exec(line)?.[1];
    if (constant) names.set(constant.toUpperCase(), constant);
    const parameters = /^\s*(?:PROCEDURE|FUNCTION)\b[^()]*(?:\(([^)]*)\))?/i.exec(line)?.[1] ?? '';
    for (const parameter of parameters.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) names.set(parameter[1]!.toUpperCase(), parameter[1]!);
    const counter = /^\s*FOR\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:←|<-)/i.exec(line)?.[1];
    if (counter) names.set(counter.toUpperCase(), counter);
  }
  return names;
}
export function findSuggestions(source: string): Suggestion[] {
  const result: Suggestion[] = [];
  const names = declaredNames(source);
  const expressionCandidates = [...new Set([...ROUTINES, 'TRUE', 'FALSE', 'DIV', 'MOD'])];
  source.split('\n').forEach((line, index) => {
    const visible = maskStrings(line);
    if (!visible.trim()) return;
    const statement = /^\s*([A-Za-z_][A-Za-z0-9_]*)\b/i.exec(visible)?.[1]?.toUpperCase();
    const expressionContext = statement === 'OUTPUT' || statement === 'RETURN' || statement === 'IF' || statement === 'WHILE' || statement === 'UNTIL' || statement === 'CASE' || /(?:←|<-)\s*/.test(visible);
    const words = /[A-Za-z_][A-Za-z0-9_]*/g; let match: RegExpExecArray | null;
    while ((match = words.exec(visible))) {
      const word = match[0]!; const upper = word.toUpperCase();
      if (KEYWORDS.has(upper) || TYPES.has(upper) || ROUTINES.has(upper) || upper === 'RETURN' || names.has(upper)) continue;
      const candidates = expressionContext && match.index > (visible.search(/\b/) + (statement?.length ?? 0)) ? expressionCandidates : COMPLETIONS;
      const best = candidates.map(candidate => ({ candidate, distance: levenshtein(upper, candidate) })).sort((a, b) => a.distance - b.distance)[0];
      if (best && best.distance > 0 && best.distance <= Math.max(1, Math.ceil(word.length * 0.3))) result.push({ line: index + 1, column: match.index + 1, endColumn: match.index + word.length + 1, original: word, replacement: best.candidate });
    }
  });
  return result;
}
export function friendlyError(error: unknown, source?: string): { message: string; line?: number; column?: number; tip?: string; diagnostic?: string } {
  if (error instanceof Error && 'line' in error) {
    const positioned = error as Error & { line: number; column?: number };
    const text = error.message;
    let tip: string | undefined;
    if (/cannot assign|must return|needs numeric|must be BOOLEAN|must be an INTEGER|type/i.test(text)) tip = 'Check the declared data type. Cambridge pseudocode does not silently convert incompatible values; use a compatible literal, expression, or variable.';
    else if (/not been declared|used before declaration/i.test(text)) tip = 'Declare each variable before its first use.';
    else if (/ENDIF|ENDWHILE|NEXT/i.test(text)) tip = 'Block markers close a block and should each be on their own line.';
    else if (/arrow|←|assign/i.test(text)) tip = 'Cambridge assignment uses ← (or <-), not =.';
    const diagnostic = source && positioned.line
      ? formatDiagnostic(error, source, positioned.line, positioned.column)
      : undefined;
    return { message: text, line: positioned.line, column: positioned.column, tip, diagnostic };
  }
  return { message: error instanceof Error ? error.message : 'Something unexpected happened while running this program.' };
}

function formatDiagnostic(error: Error, source: string, line: number, column = 1): string {
  const sourceLine = source.split(/\r?\n/)[line - 1] ?? '';
  const label = error.name === 'PicoSyntaxError' ? 'Syntax Error' : error.name === 'PicoTypeError' ? 'Type Error' : error.name === 'RuntimeError' ? 'Runtime Error' : 'Error';
  const lineLabel = `${line}`;
  const caretColumn = Math.max(1, Math.min(column, sourceLine.length + 1));
  return `✕ ${label}\nLine ${line}, Column ${column}\n\n${lineLabel}  ${sourceLine}\n${' '.repeat(lineLabel.length + 2 + caretColumn - 1)}↑\n\n${error.message}`;
}

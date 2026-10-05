import type { Completion, CompletionContext } from '@codemirror/autocomplete';
import { COMPLETIONS, KEYWORDS, ROUTINES, TYPES } from '../../language/lexer';

interface Scope { kind: string; names: Map<string, Completion>; }
const lastScope = (scopes: Scope[], kind: string) => {
  for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i]!.kind === kind) return i;
  return -1;
};
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Mask literals and comments without needing a complete, parseable program. */
function maskLine(line: string): { code: string; literal: boolean; comment: boolean } {
  let quote = '';
  let code = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quote) {
      code += ' ';
      if (char === '\\') { i++; code += ' '; }
      else if (char === quote || (quote === '“' && char === '”')) quote = '';
    } else if (char === '"' || char === "'" || char === '“') {
      quote = char; code += ' ';
    } else if (char === '/' && line[i + 1] === '/') {
      return { code, literal: false, comment: true };
    } else code += char;
  }
  return { code, literal: Boolean(quote), comment: false };
}

/** Follow lexical blocks up to the cursor; never alter compiler declarations. */
export function visibleNames(source: string): Completion[] {
  const scopes: Scope[] = [{ kind: 'global', names: new Map() }];
  const push = (kind: string) => scopes.push({ kind, names: new Map() });
  const close = (kind: string) => {
    const index = lastScope(scopes, kind);
    if (index > 0) scopes.splice(index);
  };
  const add = (name: string, detail: string, type = 'variable') => {
    if (identifier.test(name) && !KEYWORDS.has(name.toUpperCase()) && !TYPES.has(name.toUpperCase()) && !ROUTINES.has(name.toUpperCase())) {
      scopes.at(-1)!.names.set(name, { label: name, type, detail, boost: 5 });
    }
  };
  // The last line is being typed. Process only complete preceding lines so a
  // declaration does not suggest itself and UNTIL can still see REPEAT locals.
  const lines = source.split('\n');
  for (const raw of lines.slice(0, -1)) {
    const line = maskLine(raw).code.trim();
    const first = /^\w+/.exec(line)?.[0]?.toUpperCase();
    if (['case', 'branch'].includes(scopes.at(-1)!.kind) && (/:\s*$/.test(line) || first === 'OTHERWISE')) {
      close('branch'); push('branch'); continue;
    }
    if (!first) continue;
    if (first === 'ENDPROCEDURE' || first === 'ENDFUNCTION') { close('routine'); continue; }
    if (first === 'ENDIF') { close('if'); continue; }
    if (first === 'ENDWHILE') { close('while'); continue; }
    if (first === 'NEXT') { close('for'); continue; }
    if (first === 'UNTIL') { close('repeat'); continue; }
    if (first === 'ENDCASE') { close('case'); continue; }
    if (first === 'ELSE') { close('if'); push('if'); continue; }
    if (first === 'DECLARE') {
      const declaration = /^DECLARE\s+([^:]+):\s*(.*)$/i.exec(line);
      if (declaration) {
        const detail = declaration[2]!.trim().toUpperCase() || 'Variable';
        for (const name of declaration[1]!.split(',')) add(name.trim(), detail);
      }
    } else if (first === 'CONSTANT') {
      const name = /^CONSTANT\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:←|<-)/i.exec(line)?.[1];
      if (name) add(name, 'Constant', 'constant');
    } else if (first === 'PROCEDURE' || first === 'FUNCTION') {
      push('routine');
      const parameters = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')') > -1 ? line.lastIndexOf(')') : undefined);
      for (const match of parameters.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(INTEGER|REAL|CHAR|STRING|BOOLEAN)\b/gi)) add(match[1]!, `${match[2]!.toUpperCase()} parameter`);
    } else if (first === 'FOR') {
      const name = /^FOR\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:←|<-)/i.exec(line)?.[1];
      // An implicit FOR counter belongs to the enclosing scope, as at runtime.
      if (name && !scopes.some(scope => scope.names.has(name))) add(name, 'INTEGER loop counter');
      push('for');
    } else if (first === 'IF' || first === 'THEN') {
      // Cambridge also permits THEN on the following line.
      if (first === 'IF') push('if');
    } else if (first === 'WHILE') push('while');
    else if (first === 'REPEAT') push('repeat');
    else if (first === 'CASE') push('case');
  }
  const visible = new Map(scopes[0]!.names);
  const routine = lastScope(scopes, 'routine');
  for (const scope of scopes.slice(routine > 0 ? routine : 1)) {
    for (const [name, completion] of scope.names) visible.set(name, completion);
  }
  return [...visible.values()];
}

export function completionSource(context: CompletionContext) {
  const prefix = context.state.doc.sliceString(0, context.pos);
  const currentLine = maskLine(prefix.slice(prefix.lastIndexOf('\n') + 1));
  if (currentLine.literal || currentLine.comment) return null;
  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  if (!word && !context.explicit) return null;
  const options: Completion[] = COMPLETIONS.map(label => ({
    label, type: TYPES.has(label) ? 'type' : ROUTINES.has(label) ? 'function' : 'keyword',
    detail: TYPES.has(label) ? 'Type' : ROUTINES.has(label) ? 'Library routine' : 'Keyword',
    boost: label.startsWith(word?.text.toUpperCase() ?? '') ? 2 : 0,
  }));
  options.push(...visibleNames(prefix));
  return { from: word?.from ?? context.pos, options };
}

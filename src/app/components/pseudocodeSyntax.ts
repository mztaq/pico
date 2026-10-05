import { StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { KEYWORDS, ROUTINES, TYPES } from '../../language/lexer';

/** Statement/control keywords, coloured like a control-flow keyword in an IDE. */
const CONTROL_KEYWORDS = new Set(['IF', 'THEN', 'ELSE', 'ENDIF', 'CASE', 'OF', 'OTHERWISE', 'ENDCASE', 'WHILE', 'DO', 'ENDWHILE', 'FOR', 'TO', 'STEP', 'NEXT', 'REPEAT', 'UNTIL', 'PROCEDURE', 'ENDPROCEDURE', 'FUNCTION', 'RETURNS', 'ENDFUNCTION', 'RETURN', 'CALL', 'AND', 'OR', 'NOT']);

const tokenTable = {
  comment: tags.comment,
  string: tags.string,
  number: tags.number,
  boolean: tags.bool,
  type: tags.typeName,
  control: tags.controlKeyword,
  keyword: tags.keyword,
  routine: tags.standard(tags.variableName),
  fn: tags.function(tags.variableName),
  variable: tags.variableName,
  operator: tags.operator,
  punctuation: tags.punctuation,
};

export const pseudoLanguage = StreamLanguage.define({
  tokenTable,
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/["“](?:\\.|[^"”\\])*["”]?/)) return 'string';
    if (stream.match(/'(?:\\.|[^'\\])*'?/)) return 'string';
    if (stream.match(/\d+(?:\.\d+)?/)) return 'number';
    if (stream.match(/(?:TRUE|FALSE)\b/i)) return 'boolean';
    if (stream.match(/(?:←|<-|<=|>=|<>|!=|[=<>+\-*/^])/)) return 'operator';
    if (stream.match(/[:,()[\]{}]/)) return 'punctuation';
    if (stream.match(/[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current().toUpperCase();
      if (TYPES.has(word)) return 'type';
      if (ROUTINES.has(word) || ['DIV', 'MOD'].includes(word)) return 'routine';
      if (CONTROL_KEYWORDS.has(word)) return 'control';
      if (KEYWORDS.has(word)) return 'keyword';
      if (stream.string.slice(stream.pos).trimStart().startsWith('(')) return 'fn';
      return 'variable';
    }
    stream.next();
    return null;
  },
});


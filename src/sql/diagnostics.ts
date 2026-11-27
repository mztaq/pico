export interface SqlDiagnostic {
  title: string;
  message: string;
  detail: string;
  from?: number;
  to?: number;
  line?: number;
}
interface Token { text: string; from: number; to: number; }
function tokenize(source: string): Token[] {
  return Array.from(source.matchAll(/--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|`(?:``|[^`])*(?:`|$)|\[[^\]]*(?:\]|$)|[A-Za-z_][\w$]*|\d+(?:\.\d+)?|[^\s]/g), match => ({
    text: match[0], from: match.index!, to: match.index! + match[0].length,
  })).filter(token => !token.text.startsWith('--') && !token.text.startsWith('/*'));
}
function unclosedQuote(text: string) {
  const quote = text[0];
  if (quote === '[') return !text.endsWith(']');
  if (!["'", '"', '`'].includes(quote)) return false;
  for (let i = 1; i < text.length; i++) {
    if (text[i] !== quote) continue;
    if (text[i+1] === quote) { i++; continue; }
    return false;
  }
  return true;
}
/** Translate actual SQLite failures, without guessing at valid queries before execution. */
export function diagnoseSqlError(detail: string, source: string): SqlDiagnostic {
  const tokens = tokenize(source);
  function make(title: string, message: string, token?: Token): SqlDiagnostic {
    return { title, message, detail, ...(token ? { from: token.from, to: token.to, line: source.slice(0,token.from).split('\n').length } : {}) };
  }
  function locate(name: string) {
    const target = name.toLowerCase();
    const matches = tokens.filter(token => {
      const text = token.text;
      if (text.toLowerCase() === target) return true;
      if (/^["`\[]/.test(text)) return text.slice(1,-1).toLowerCase() === target;
      return false;
    });
    return matches.length === 1 ? matches[0] : undefined;
  }
  const unfinished = tokens.find(token => unclosedQuote(token.text));
  if (unfinished && /syntax error|unrecognized token|incomplete input/i.test(detail)) {
    return make('Missing closing quotation mark', 'Close the text value or quoted identifier before continuing the query.', unfinished);
  }
  let match: RegExpMatchArray | null;
  if ((match = detail.match(/no such table:\s*(.+)$/i))) return make('Table not found', 'Table "' + match[1] + '" does not exist in the selected database. Check the table name in the sidebar.', locate(match[1].split('.').pop()!));
  if ((match = detail.match(/no such column:\s*(.+)$/i))) return make('Field not found', 'Field "' + match[1] + '" does not exist in this query. Check the spelling and table name. If this is a text value, enclose it in single quotes.', locate(match[1].split('.').pop()!));
  if ((match = detail.match(/ambiguous column name:\s*(.+)$/i))) return make('Ambiguous field name', 'More than one table contains "' + match[1] + '". Use TableName.FieldName to identify the correct field.', locate(match[1]));
  if ((match = detail.match(/no such function:\s*(.+)$/i))) return make('Unknown function', 'Check the spelling of "' + match[1] + '" and whether SQLite supports it.', locate(match[1]));
  if ((match = detail.match(/wrong number of arguments to function\s+(.+?)\(\)/i))) return make('Incorrect function arguments', 'Check how many arguments ' + match[1] + ' requires.', locate(match[1]));
  if (/unique constraint failed/i.test(detail)) return make('Duplicate value', 'A primary key or unique field already contains this value. Enter a unique value.');
  if (/not null constraint failed/i.test(detail)) return make('Missing required value', 'A required field has no value.');
  if (/foreign key constraint failed/i.test(detail)) return make('Invalid relationship', 'The referenced record is missing or the change would break a foreign key.');
  if (/check constraint failed/i.test(detail)) return make('Invalid field value', 'A value does not satisfy the table’s validation rule.');
  if (/datatype mismatch|cannot store .* value in/i.test(detail)) return make('Data type mismatch', 'Use a value that matches the field’s data type.');
  if ((match = detail.match(/(?:table|view)\s+(.+?)\s+already exists/i))) return make('Name already in use', 'A table or view with this name already exists. Choose a different name.', locate(match[1]));
  if (/incomplete input|syntax error/i.test(detail)) {
    const stack: Token[] = [];
    let extra: Token | undefined;
    for (const token of tokens) {
      if (token.text === '(') stack.push(token);
      else if (token.text === ')' && !stack.pop()) { extra = token; break; }
    }
    if (extra) return make('Unexpected closing bracket', 'Remove the extra closing parenthesis or add its matching opening parenthesis.', extra);
    if (stack.length) return make('Missing closing bracket', 'Close the opening parenthesis with a matching closing parenthesis.', stack[stack.length-1]);
    if ((match = detail.match(/near "([^"]+)": syntax error/i))) return make('Syntax error', 'Unexpected token "' + match[1] + '". Check for missing keywords, commas, values or expressions before this token.', locate(match[1]));
    if (/incomplete input/i.test(detail)) return make('Incomplete SQL statement', 'Finish the statement. Check for a missing table name, condition, value or expression.');
    return make('Syntax error', 'Check the SQL keywords, punctuation and order of clauses.');
  }
  if ((match = detail.match(/unrecognized token:\s*"(.+)"$/is))) return make('Invalid token', 'SQL does not recognize this token. Check the punctuation and quotation marks.', locate(match[1]));
  return make('Query error', detail);
}

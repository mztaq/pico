import type { DataType, Expression, Program, Statement } from './ast';
import { parse } from './parser';
import { tokenize } from './lexer';

type SymbolTypes = Map<string, DataType>;
type RoutineTypes = Map<string, DataType>;
interface Candidate { name: string; types: DataType[]; }

const builtinReturns: Record<string, DataType> = {
  DIV: 'INTEGER', MOD: 'INTEGER', ROUND: 'REAL', LENGTH: 'INTEGER', SUBSTRING: 'STRING',
  UCASE: 'STRING', LCASE: 'STRING', UPPER: 'STRING', LOWER: 'STRING', RANDOM: 'REAL',
};

/**
 * Infer missing scalar declarations from parsed code, without changing the
 * language's compiler rules. Unsupported or ambiguous cases are left alone.
 */
export function autoDeclareVariables(source: string): string {
  let program: Program;
  try { program = parse(tokenize(source)); }
  catch { return source; }

  const routines: RoutineTypes = new Map();
  collectRoutineTypes(program.statements, routines);
  const globalSymbols: SymbolTypes = new Map();
  collectSymbols(program.statements, globalSymbols, true);
  inferConstants(program.statements, globalSymbols, routines, true);

  const globalCandidates = inferCandidates(program.statements, globalSymbols, routines, true);
  const edits: { line: number; declarations: string[] }[] = [];
  if (globalCandidates.length) {
    const line = globalInsertionLine(source.split(/\r?\n/));
    edits.push({ line, declarations: globalCandidates.map(item => `DECLARE ${item.name} : ${item.type}`) });
    for (const item of globalCandidates) globalSymbols.set(item.name, item.type);
  }

  for (const statement of program.statements) {
    if (statement.kind !== 'Procedure' && statement.kind !== 'Function') continue;
    const localSymbols = new Map(globalSymbols);
    for (const parameter of statement.parameters) localSymbols.set(parameter.name, parameter.dataType);
    collectSymbols(statement.body, localSymbols, false);
    inferConstants(statement.body, localSymbols, routines, false);
    const locals = inferCandidates(statement.body, localSymbols, routines, false);
    if (locals.length) edits.push({
      line: statement.line,
      declarations: locals.map(item => `DECLARE ${item.name} : ${item.type}`),
    });
  }

  if (!edits.length) return source;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  for (const edit of edits.sort((a, b) => b.line - a.line)) lines.splice(edit.line, 0, ...edit.declarations);
  return lines.join(newline);
}

function collectRoutineTypes(statements: Statement[], routines: RoutineTypes): void {
  for (const statement of statements) {
    if (statement.kind === 'Function') routines.set(statement.name.toUpperCase(), statement.returnType);
    if (statement.kind === 'IfStatement') { collectRoutineTypes(statement.thenBody, routines); collectRoutineTypes(statement.elseBody, routines); }
    else if (statement.kind === 'WhileStatement' || statement.kind === 'RepeatStatement' || statement.kind === 'ForStatement') collectRoutineTypes(statement.body, routines);
    else if (statement.kind === 'CaseStatement') { statement.branches.forEach(branch => collectRoutineTypes(branch.body, routines)); collectRoutineTypes(statement.otherwise, routines); }
  }
}

function collectSymbols(statements: Statement[], symbols: SymbolTypes, skipRoutines: boolean): void {
  for (const statement of statements) {
    if (statement.kind === 'Declaration') symbols.set(statement.name, statement.dataType);
    else if (statement.kind === 'Function' || statement.kind === 'Procedure') {
      if (!skipRoutines) collectSymbols(statement.body, symbols, false);
    } else if (statement.kind === 'IfStatement') { collectSymbols(statement.thenBody, symbols, skipRoutines); collectSymbols(statement.elseBody, symbols, skipRoutines); }
    else if (statement.kind === 'WhileStatement' || statement.kind === 'RepeatStatement' || statement.kind === 'ForStatement') collectSymbols(statement.body, symbols, skipRoutines);
    else if (statement.kind === 'CaseStatement') { statement.branches.forEach(branch => collectSymbols(branch.body, symbols, skipRoutines)); collectSymbols(statement.otherwise, symbols, skipRoutines); }
  }
}

function inferConstants(statements: Statement[], symbols: SymbolTypes, routines: RoutineTypes, skipRoutines: boolean): void {
  const pending: { name: string; value: Expression }[] = [];
  visitStatements(statements, statement => {
    if (statement.kind === 'Constant' && !symbols.has(statement.name)) pending.push({ name: statement.name, value: statement.value });
  }, skipRoutines);
  for (let pass = 0; pass < pending.length; pass += 1) {
    let changed = false;
    for (const item of pending) {
      if (symbols.has(item.name)) continue;
      const type = inferExpression(item.value, symbols, routines);
      if (type) { symbols.set(item.name, type); changed = true; }
    }
    if (!changed) break;
  }
}

function inferCandidates(statements: Statement[], symbols: SymbolTypes, routines: RoutineTypes, skipRoutines: boolean): { name: string; type: DataType }[] {
  const candidates = new Map<string, Candidate>();
  visitStatements(statements, statement => {
    if (statement.kind === 'Assignment' && statement.target.indexes.length === 0 && !symbols.has(statement.target.name)) {
      addCandidate(candidates, statement.target.name);
    } else if (statement.kind === 'ForStatement' && !symbols.has(statement.name)) {
      addCandidate(candidates, statement.name).types.push('INTEGER');
    }
  }, skipRoutines);

  const inferred = new Map<string, DataType>();
  const conflicts = new Set<string>();
  for (let pass = 0; pass <= candidates.size; pass += 1) {
    let changed = false;
    const available = new Map([...symbols, ...inferred]);
    visitStatements(statements, statement => {
      if (statement.kind !== 'Assignment' || statement.target.indexes.length) return;
      const candidate = candidates.get(statement.target.name);
      if (!candidate || conflicts.has(candidate.name)) return;
      const type = inferExpression(statement.value, available, routines);
      if (type) { candidate.types.push(type); changed = true; }
    }, skipRoutines);

    for (const [name, candidate] of candidates) {
      if (conflicts.has(name) || !candidate.types.length) continue;
      const merged = mergeTypes(candidate.types);
      if (!merged) { conflicts.add(name); inferred.delete(name); continue; }
      if (inferred.get(name) !== merged) { inferred.set(name, merged); changed = true; }
    }
    if (!changed) break;
  }

  return [...inferred].flatMap(([name, type]) => {
    const candidate = candidates.get(name)!;
    return conflicts.has(name) ? [] : [{ name: candidate.name, type }];
  });
}

function addCandidate(candidates: Map<string, Candidate>, name: string): Candidate {
  let candidate = candidates.get(name);
  if (!candidate) { candidate = { name, types: [] }; candidates.set(name, candidate); }
  return candidate;
}

function mergeTypes(types: DataType[]): DataType | undefined {
  let result = types[0];
  if (!result) return undefined;
  for (const type of types.slice(1)) {
    if (type === result) continue;
    if ((type === 'INTEGER' || type === 'REAL') && (result === 'INTEGER' || result === 'REAL')) result = 'REAL';
    else return undefined;
  }
  return result;
}

function inferExpression(expression: Expression, symbols: SymbolTypes, routines: RoutineTypes): DataType | undefined {
  switch (expression.kind) {
    case 'NumberLiteral': return Number.isInteger(expression.value) ? 'INTEGER' : 'REAL';
    case 'StringLiteral': return 'STRING';
    case 'BooleanLiteral': return 'BOOLEAN';
    case 'Variable':
    case 'ArrayAccess': return symbols.get(expression.name);
    case 'UnaryExpression': {
      if (expression.operator === 'NOT') return 'BOOLEAN';
      const inner = inferExpression(expression.operand, symbols, routines);
      return inner === 'INTEGER' || inner === 'REAL' ? inner : undefined;
    }
    case 'BinaryExpression': {
      const operator = expression.operator.toUpperCase();
      if (['=', '<>', '!=', '<', '<=', '>', '>=', 'AND', 'OR'].includes(operator)) return 'BOOLEAN';
      const left = inferExpression(expression.left, symbols, routines);
      const right = inferExpression(expression.right, symbols, routines);
      if (operator === '+' && (left === 'STRING' || right === 'STRING')) return 'STRING';
      if (operator === 'DIV' || operator === 'MOD') return 'INTEGER';
      if (operator === '/') return 'REAL';
      if (['+', '-', '*', '^'].includes(operator) && left && right && ['INTEGER', 'REAL'].includes(left) && ['INTEGER', 'REAL'].includes(right)) return left === 'REAL' || right === 'REAL' ? 'REAL' : 'INTEGER';
      return undefined;
    }
    case 'CallExpression': return builtinReturns[expression.name.toUpperCase()] ?? routines.get(expression.name.toUpperCase());
  }
}

function visitStatements(statements: Statement[], visit: (statement: Statement) => void, skipRoutines: boolean): void {
  for (const statement of statements) {
    if ((statement.kind === 'Procedure' || statement.kind === 'Function') && skipRoutines) continue;
    visit(statement);
    if (statement.kind === 'IfStatement') { visitStatements(statement.thenBody, visit, skipRoutines); visitStatements(statement.elseBody, visit, skipRoutines); }
    else if (statement.kind === 'WhileStatement' || statement.kind === 'RepeatStatement' || statement.kind === 'ForStatement') visitStatements(statement.body, visit, skipRoutines);
    else if (statement.kind === 'CaseStatement') { statement.branches.forEach(branch => visitStatements(branch.body, visit, skipRoutines)); visitStatements(statement.otherwise, visit, skipRoutines); }
  }
}

function globalInsertionLine(lines: string[]): number {
  let line = 0;
  while (line < lines.length && (!lines[line]!.trim() || lines[line]!.trim().startsWith('//'))) line += 1;
  return line;
}

import type { DataType, Declaration, Expression, Program, Statement } from './ast';
import { tokenize } from './lexer';
import { parse } from './parser';

type SymbolTypes = Map<string, DataType>;
type RoutineTypes = Map<string, DataType>;
interface Candidate { name: string; constraints: DataType[]; assignments: Expression[]; integerRequired: boolean; }
interface ManagedDeclarations { names: Set<string>; declarations: Map<string, Declaration>; }
export interface AutoDeclarationSync { code: string; generatedTypes: Record<string, DataType>; }

const builtinReturns: Record<string, DataType> = {
  DIV: 'INTEGER', MOD: 'INTEGER', ROUND: 'REAL', LENGTH: 'INTEGER', SUBSTRING: 'STRING',
  UCASE: 'STRING', LCASE: 'STRING', UPPER: 'STRING', LOWER: 'STRING', RANDOM: 'REAL',
};
const dataTypes = new Set<DataType>(['INTEGER', 'REAL', 'CHAR', 'STRING', 'BOOLEAN']);

/**
 * Analyze each source revision, create declarations for clear inferences, and
 * revise only declarations previously created by Auto-declare. Explicit
 * student declarations are deliberately never changed.
 */
export function synchronizeAutoDeclarations(source: string, previouslyGenerated: Record<string, DataType> = {}): AutoDeclarationSync {
  let program: Program;
  try { program = parse(tokenize(source)); }
  catch { return { code: source, generatedTypes: { ...previouslyGenerated } }; }

  const routines: RoutineTypes = new Map();
  collectRoutineTypes(program.statements, routines);
  const lines = source.split(/\r?\n/);
  const insertions: { line: number; declarations: string[] }[] = [];
  const generatedTypes: Record<string, DataType> = {};

  const globalScope = 'global';
  const globalManaged = findManagedDeclarations(program.statements, globalScope, previouslyGenerated, generatedTypes);
  const globalSymbols: SymbolTypes = new Map();
  collectSymbols(program.statements, globalSymbols, true);
  inferConstants(program.statements, globalSymbols, routines, true);
  const globalCandidates = inferCandidates(program.statements, globalSymbols, routines, true, globalManaged.names);
  const inferredGlobals = new Map(globalCandidates.map(item => [item.name, item.type]));

  const addedGlobal: string[] = [];
  for (const item of globalCandidates) {
    const declaration = globalManaged.declarations.get(item.name);
    if (declaration) replaceDeclarationType(lines, declaration, item.type);
    else addedGlobal.push(`DECLARE ${item.name} : ${item.type}`);
    generatedTypes[scopeKey(globalScope, item.name)] = item.type;
    globalSymbols.set(item.name, item.type);
  }
  for (const [name, declaration] of globalManaged.declarations) {
    if (!inferredGlobals.has(name)) globalSymbols.set(name, declaration.dataType);
  }
  if (addedGlobal.length) insertions.push({ line: globalInsertionLine(lines), declarations: addedGlobal });

  for (const statement of program.statements) {
    if (statement.kind !== 'Procedure' && statement.kind !== 'Function') continue;
    const scope = `routine:${statement.name.toUpperCase()}`;
    const managed = findManagedDeclarations(statement.body, scope, previouslyGenerated, generatedTypes);
    const localSymbols: SymbolTypes = new Map(globalSymbols);
    for (const parameter of statement.parameters) localSymbols.set(parameter.name, parameter.dataType);
    collectSymbols(statement.body, localSymbols, false);
    inferConstants(statement.body, localSymbols, routines, false);
    const localCandidates = inferCandidates(statement.body, localSymbols, routines, false, managed.names);
    const inferredLocals = new Map(localCandidates.map(item => [item.name, item.type]));
    const additions: string[] = [];
    for (const item of localCandidates) {
      const declaration = managed.declarations.get(item.name);
      if (declaration) replaceDeclarationType(lines, declaration, item.type);
      else additions.push(`DECLARE ${item.name} : ${item.type}`);
      generatedTypes[scopeKey(scope, item.name)] = item.type;
      localSymbols.set(item.name, item.type);
    }
    for (const [name, declaration] of managed.declarations) {
      if (!inferredLocals.has(name)) localSymbols.set(name, declaration.dataType);
    }
    if (additions.length) insertions.push({ line: statement.line, declarations: additions });
  }

  for (const insertion of insertions.sort((a, b) => b.line - a.line)) lines.splice(insertion.line, 0, ...insertion.declarations);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return { code: lines.join(newline), generatedTypes };
}

/** Backwards-compatible helper used by callers that do not persist provenance. */
export function autoDeclareVariables(source: string): string {
  return synchronizeAutoDeclarations(source).code;
}

function scopeKey(scope: string, name: string): string { return `${scope}::${name}`; }

function findManagedDeclarations(statements: Statement[], scope: string, tracked: Record<string, DataType>, retained: Record<string, DataType>): ManagedDeclarations {
  const names = new Set<string>();
  const declarations = new Map<string, Declaration>();
  for (const statement of statements) {
    if (statement.kind !== 'Declaration' || statement.array) continue;
    const key = scopeKey(scope, statement.name);
    if (tracked[key] !== statement.dataType) continue;
    names.add(statement.name);
    declarations.set(statement.name, statement);
    retained[key] = statement.dataType;
  }
  return { names, declarations };
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

function inferCandidates(statements: Statement[], symbols: SymbolTypes, routines: RoutineTypes, skipRoutines: boolean, forceRecheck: Set<string>): { name: string; type: DataType }[] {
  const candidates = new Map<string, Candidate>();
  visitStatements(statements, statement => {
    if (statement.kind === 'Assignment' && statement.target.indexes.length === 0 && (!symbols.has(statement.target.name) || forceRecheck.has(statement.target.name))) {
      addCandidate(candidates, statement.target.name).assignments.push(statement.value);
    } else if (statement.kind === 'ForStatement' && (!symbols.has(statement.name) || forceRecheck.has(statement.name))) {
      const candidate = addCandidate(candidates, statement.name);
      candidate.constraints.push('INTEGER');
      candidate.integerRequired = true;
    }
  }, skipRoutines);

  const inferred = new Map<string, DataType>();
  for (let pass = 0; pass <= candidates.size; pass += 1) {
    const available = new Map([...symbols, ...inferred]);
    const next = new Map<string, DataType>();
    for (const [name, candidate] of candidates) {
      const observations = [...candidate.constraints, ...candidate.assignments.map(expression => inferExpression(expression, available, routines)).filter((type): type is DataType => Boolean(type))];
      if (!observations.length || (candidate.integerRequired && observations.some(type => type !== 'INTEGER'))) continue;
      const merged = mergeTypes(observations);
      if (merged) next.set(name, merged);
    }
    const stable = next.size === inferred.size && [...next].every(([name, type]) => inferred.get(name) === type);
    inferred.clear();
    for (const [name, type] of next) inferred.set(name, type);
    if (stable) break;
  }
  return [...inferred].map(([name, type]) => ({ name: candidates.get(name)!.name, type }));
}

function addCandidate(candidates: Map<string, Candidate>, name: string): Candidate {
  let candidate = candidates.get(name);
  if (!candidate) { candidate = { name, constraints: [], assignments: [], integerRequired: false }; candidates.set(name, candidate); }
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

function replaceDeclarationType(lines: string[], declaration: Declaration, type: DataType): void {
  const index = declaration.line - 1;
  if (declaration.array || index < 0 || index >= lines.length) return;
  const name = declaration.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^(\\s*DECLARE\\s+${name}\\s*:\\s*)(INTEGER|REAL|CHAR|STRING|BOOLEAN)(\\b)`, 'i');
  const line = lines[index]!;
  if (pattern.test(line)) lines[index] = line.replace(pattern, `$1${type}$3`);
}

function globalInsertionLine(lines: string[]): number {
  let line = 0;
  while (line < lines.length && (!lines[line]!.trim() || lines[line]!.trim().startsWith('//'))) line += 1;
  return line;
}

/** Non-persisted callers use these type names to keep their API simple. */
export function isAutoDeclaredType(value: unknown): value is DataType {
  return typeof value === 'string' && dataTypes.has(value as DataType);
}

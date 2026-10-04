import type { DataType, Expression, Program, Statement, Target } from './ast';

export class PicoTypeError extends Error {
  name = 'PicoTypeError';
  constructor(message: string, public line: number, public column = 1) {
    super(message);
  }
}

type Type = DataType | 'UNKNOWN';
type Symbol = { type: Type; arrayDepth: number; constant: boolean };
type Routine = { parameters: { name: string; dataType: DataType }[]; returnType?: DataType };

const numeric = (t: Type) => t === 'INTEGER' || t === 'REAL';
const sameOrPromotable = (actual: Type, expected: Type) => actual === expected || (expected === 'REAL' && actual === 'INTEGER');

export function validate(program: Program): void {
  const symbols = new Map<string, Symbol>();
  const routines = new Map<string, Routine>();
  for (const statement of program.statements) {
    if (statement.kind === 'Procedure' || statement.kind === 'Function') {
      const name = statement.name.toUpperCase();
      if (routines.has(name) || symbols.has(statement.name)) fail(`${statement.name} has already been declared.`, statement);
      routines.set(name, { parameters: statement.parameters, returnType: statement.kind === 'Function' ? statement.returnType : undefined });
    }
  }
  checkBlock(program.statements, symbols, routines, undefined);
}

function checkBlock(statements: Statement[], symbols: Map<string, Symbol>, routines: Map<string, Routine>, functionReturn: DataType | undefined): void {
  for (const s of statements) {
    switch (s.kind) {
      case 'Declaration':
        declare(symbols, s.name, { type: s.dataType, arrayDepth: s.array?.bounds.length ?? 0, constant: false }, s);
        if (s.array?.bounds.some(b => b.start > b.end || !Number.isInteger(b.start) || !Number.isInteger(b.end))) fail(`${s.name} has an invalid ARRAY range.`, s);
        break;
      case 'Constant': {
        if (symbols.has(s.name)) fail(`${s.name} has already been declared.`, s);
        const type = expressionType(s.value, symbols, routines);
        symbols.set(s.name, { type, arrayDepth: 0, constant: true });
        break;
      }
      case 'Assignment': {
        const target = targetType(s.target, symbols, routines);
        const value = expressionType(s.value, symbols, routines);
        ensureAssignable(value, target.type, s.value.line, `Cannot assign ${display(value)} to ${s.target.name} (${display(target.type)}).`);
        break;
      }
      case 'Input': {
        const target = targetType(s.target, symbols, routines);
        if (target.arrayDepth) fail(`INPUT needs a scalar variable; ${s.target.name} is an ARRAY.`, s);
        break;
      }
      case 'Output': s.expressions.forEach(e => expressionType(e, symbols, routines)); break;
      case 'IfStatement':
        ensureBoolean(expressionType(s.condition, symbols, routines), s.condition.line, 'IF condition must be BOOLEAN.');
        checkBlock(s.thenBody, clone(symbols), routines, functionReturn); checkBlock(s.elseBody, clone(symbols), routines, functionReturn); break;
      case 'WhileStatement':
        ensureBoolean(expressionType(s.condition, symbols, routines), s.condition.line, 'WHILE condition must be BOOLEAN.');
        checkBlock(s.body, clone(symbols), routines, functionReturn); break;
      case 'RepeatStatement':
        checkBlock(s.body, clone(symbols), routines, functionReturn);
        ensureBoolean(expressionType(s.condition, symbols, routines), s.condition.line, 'UNTIL condition must be BOOLEAN.'); break;
      case 'ForStatement': {
        const counter = symbol(symbols, s.name, s);
        if (counter.arrayDepth || counter.type !== 'INTEGER') fail(`FOR counter ${s.name} must be an INTEGER scalar.`, s);
        ensureNumeric(expressionType(s.start, symbols, routines), s.start.line, 'FOR start value must be numeric.');
        ensureNumeric(expressionType(s.end, symbols, routines), s.end.line, 'FOR end value must be numeric.');
        if (s.step) ensureNumeric(expressionType(s.step, symbols, routines), s.step.line, 'FOR STEP value must be numeric.');
        checkBlock(s.body, clone(symbols), routines, functionReturn); break;
      }
      case 'CaseStatement': {
        const target = expressionType(s.expression, symbols, routines);
        for (const branch of s.branches) for (const selector of branch.selectors) {
          const selectorType = expressionType(selector, symbols, routines);
          if (!comparable(target, selectorType)) fail(`CASE selector type ${display(selectorType)} does not match ${display(target)}.`, selector);
          checkBlock(branch.body, clone(symbols), routines, functionReturn);
        }
        checkBlock(s.otherwise, clone(symbols), routines, functionReturn); break;
      }
      case 'Procedure':
      case 'Function': {
        const local = clone(symbols);
        for (const p of s.parameters) declare(local, p.name, { type: p.dataType, arrayDepth: 0, constant: false }, s);
        checkBlock(s.body, local, routines, s.kind === 'Function' ? s.returnType : undefined); break;
      }
      case 'CallStatement': expressionType({ kind: 'CallExpression', name: s.name, arguments: s.arguments, line: s.line, column: s.column, endColumn: s.endColumn }, symbols, routines); break;
      case 'ReturnStatement':
        if (!functionReturn) fail('RETURN can only be used inside a FUNCTION.', s);
        if (!s.value) fail(`FUNCTION must return a ${functionReturn}.`, s);
        else ensureAssignable(expressionType(s.value, symbols, routines), functionReturn, s.value.line, `FUNCTION must return ${display(functionReturn)}.`);
        break;
      case 'FileStatement':
        if (s.operation === 'READ' && s.target) {
          const target = targetType(s.target, symbols, routines);
          if (target.arrayDepth) fail(`READFILE needs a scalar variable; ${s.target.name} is an ARRAY.`, s);
        }
        if (s.operation === 'WRITE' && s.value) expressionType(s.value, symbols, routines);
        break;
    }
  }
}

function expressionType(e: Expression, symbols: Map<string, Symbol>, routines: Map<string, Routine>): Type {
  switch (e.kind) {
    case 'NumberLiteral': return Number.isInteger(e.value) ? 'INTEGER' : 'REAL';
    case 'StringLiteral': return 'STRING';
    case 'BooleanLiteral': return 'BOOLEAN';
    case 'Variable': return symbol(symbols, e.name, e).type;
    case 'ArrayAccess': return targetType(e, symbols, routines).type;
    case 'UnaryExpression': {
      const t = expressionType(e.operand, symbols, routines);
      if (e.operator === 'NOT') { ensureBoolean(t, e.line, 'NOT needs a BOOLEAN value.'); return 'BOOLEAN'; }
      ensureNumeric(t, e.line, 'Unary minus needs a numeric value.'); return t;
    }
    case 'BinaryExpression': {
      const l = expressionType(e.left, symbols, routines), r = expressionType(e.right, symbols, routines);
      if (['AND', 'OR'].includes(e.operator)) { ensureBoolean(l, e.left.line, `${e.operator} needs BOOLEAN values.`); ensureBoolean(r, e.right.line, `${e.operator} needs BOOLEAN values.`); return 'BOOLEAN'; }
      if (['=', '<>', '!=', '<', '<=', '>', '>='].includes(e.operator)) { if (!comparable(l, r)) fail(`Cannot compare ${display(l)} with ${display(r)}.`, e); return 'BOOLEAN'; }
      if (['+', '-', '*', '/', '^', 'DIV', 'MOD'].includes(e.operator)) {
        // Cambridge OUTPUT examples commonly concatenate text with numbers
        // (for example: "Total: " + Total). The interpreter formats the
        // non-string operand, so preserve that language behavior here.
        if (e.operator === '+' && (l === 'STRING' || r === 'STRING')) return 'STRING';
        ensureNumeric(l, e.left.line, `${e.operator} needs numeric values.`); ensureNumeric(r, e.right.line, `${e.operator} needs numeric values.`);
        return ['DIV', 'MOD'].includes(e.operator) ? 'INTEGER' : (l === 'REAL' || r === 'REAL' || e.operator === '/' ? 'REAL' : 'INTEGER');
      }
      return 'UNKNOWN';
    }
    case 'CallExpression': {
      const name = e.name.toUpperCase();
      const builtins: Record<string, { args: number; returnType: DataType }> = {
        DIV: { args: 2, returnType: 'INTEGER' }, MOD: { args: 2, returnType: 'INTEGER' }, ROUND: { args: 1, returnType: 'REAL' },
        LENGTH: { args: 1, returnType: 'INTEGER' }, SUBSTRING: { args: 3, returnType: 'STRING' }, UCASE: { args: 1, returnType: 'STRING' },
        LCASE: { args: 1, returnType: 'STRING' }, UPPER: { args: 1, returnType: 'STRING' }, LOWER: { args: 1, returnType: 'STRING' }, RANDOM: { args: 0, returnType: 'REAL' },
      };
      const builtin = builtins[name];
      if (builtin) {
        if (name === 'ROUND' && (e.arguments.length < 1 || e.arguments.length > 2)) fail('ROUND takes one or two arguments.', e);
        else if (name !== 'ROUND' && e.arguments.length !== builtin.args) fail(`${name} takes ${builtin.args} argument${builtin.args === 1 ? '' : 's'}.`, e);
        const argumentTypes = e.arguments.map(a => expressionType(a, symbols, routines));
        if (['DIV', 'MOD'].includes(name)) argumentTypes.forEach((t, i) => { if (!numeric(t)) fail(`${name} argument ${i + 1} must be numeric.`, e.arguments[i]!); });
        if (name === 'ROUND') { if (!numeric(argumentTypes[0]!)) fail('ROUND first argument must be numeric.', e.arguments[0]!); if (argumentTypes[1] && argumentTypes[1] !== 'INTEGER') fail('ROUND decimal places must be INTEGER.', e.arguments[1]!); }
        if (['LENGTH', 'SUBSTRING', 'UCASE', 'LCASE', 'UPPER', 'LOWER'].includes(name) && argumentTypes[0] !== 'STRING') fail(`${name} first argument must be STRING.`, e.arguments[0]!);
        if (name === 'SUBSTRING') argumentTypes.slice(1).forEach((t, i) => { if (t !== 'INTEGER') fail(`SUBSTRING argument ${i + 2} must be INTEGER.`, e.arguments[i + 1]!); });
        return builtin.returnType;
      }
      const routine = routines.get(name); if (!routine) fail(`${e.name} has not been declared as a procedure or function.`, e);
      if (!routine.returnType) fail(`${e.name} is a PROCEDURE and cannot be used as a value.`, e);
      if (e.arguments.length !== routine.parameters.length) fail(`${e.name} expects ${routine.parameters.length} parameter${routine.parameters.length === 1 ? '' : 's'}.`, e);
      e.arguments.forEach((a, i) => ensureAssignable(expressionType(a, symbols, routines), routine.parameters[i]!.dataType, a.line, `Argument ${i + 1} for ${e.name} must be ${routine.parameters[i]!.dataType}.`));
      return routine.returnType;
    }
  }
}

function targetType(target: Target, symbols: Map<string, Symbol>, routines: Map<string, Routine>): Symbol {
  const found = symbol(symbols, target.name, target);
  if (!target.indexes.length) { if (found.arrayDepth) fail(`${target.name} is an ARRAY and needs an index.`, target); return found; }
  if (!found.arrayDepth) fail(`${target.name} is not an ARRAY.`, target);
  if (target.indexes.length !== found.arrayDepth) fail(`${target.name} expects ${found.arrayDepth} index${found.arrayDepth === 1 ? '' : 'es'}.`, target);
  target.indexes.forEach(i => { if (expressionType(i, symbols, routines) !== 'INTEGER') fail('ARRAY indexes must be INTEGER values.', i); });
  return { type: found.type, arrayDepth: 0, constant: found.constant };
}
function symbol(symbols: Map<string, Symbol>, name: string, node: { line: number; column?: number }): Symbol { const found = symbols.get(name); if (!found) fail(`${name} has not been declared. Add DECLARE ${name} before using it.`, node); return found; }
function declare(symbols: Map<string, Symbol>, name: string, value: Symbol, node: { line: number; column?: number }): void { if (symbols.has(name)) fail(`${name} has already been declared.`, node); symbols.set(name, value); }
function clone(symbols: Map<string, Symbol>) { return new Map(symbols); }
function ensureNumeric(type: Type, line: number, message: string) { if (!numeric(type)) fail(message, { line }); }
function ensureBoolean(type: Type, line: number, message: string) { if (type !== 'BOOLEAN') fail(message, { line }); }
function comparable(a: Type, b: Type) { return (numeric(a) && numeric(b)) || a === b; }
function ensureAssignable(actual: Type, expected: Type, line: number, message: string) { if (!sameOrPromotable(actual, expected)) fail(message, { line }); }
function display(type: Type) { return type === 'UNKNOWN' ? 'an unknown type' : type; }
function fail(message: string, node: { line: number; column?: number }): never { throw new PicoTypeError(message, node.line, node.column ?? 1); }

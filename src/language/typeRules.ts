import type { DataType, NumberLiteral } from './ast';

export const DATA_TYPES: readonly DataType[] = ['INTEGER', 'REAL', 'CHAR', 'STRING', 'BOOLEAN'];
export const numeric = (type: string) => type === 'INTEGER' || type === 'REAL';
export const comparable = (left: string, right: string) => left === right || (numeric(left) && numeric(right));
export const assignable = (actual: string, expected: string) => actual === expected ||
  (actual === 'INTEGER' && expected === 'REAL') || (actual === 'CHAR' && expected === 'STRING');

// Preserve the spelling: 3.0 is a REAL even though JavaScript stores it as 3.
export const numberLiteralType = (literal: NumberLiteral): DataType =>
  literal.raw.includes('.') ? 'REAL' : 'INTEGER';

export function unaryType(operator: string, operand: DataType): DataType | undefined {
  if (operator === 'NOT') return operand === 'BOOLEAN' ? 'BOOLEAN' : undefined;
  return numeric(operand) ? operand : undefined;
}

export function binaryType(operator: string, left: DataType, right: DataType): DataType | undefined {
  if (operator === 'AND' || operator === 'OR') return left === 'BOOLEAN' && right === 'BOOLEAN' ? 'BOOLEAN' : undefined;
  if (['=', '<>', '!=', '<', '<=', '>', '>='].includes(operator)) return comparable(left, right) ? 'BOOLEAN' : undefined;
  if (!numeric(left) || !numeric(right)) return undefined;
  if (operator === 'DIV' || operator === 'MOD') return left === 'INTEGER' && right === 'INTEGER' ? 'INTEGER' : undefined;
  if (['+', '-', '*', '/', '^'].includes(operator)) return operator === '/' || left === 'REAL' || right === 'REAL' ? 'REAL' : 'INTEGER';
  return undefined;
}

export const BUILTINS: Record<string, { args: number; returnType: DataType }> = {
  DIV: { args: 2, returnType: 'INTEGER' }, MOD: { args: 2, returnType: 'INTEGER' },
  ROUND: { args: 1, returnType: 'REAL' }, LENGTH: { args: 1, returnType: 'INTEGER' },
  SUBSTRING: { args: 3, returnType: 'STRING' }, UCASE: { args: 1, returnType: 'STRING' },
  LCASE: { args: 1, returnType: 'STRING' }, UPPER: { args: 1, returnType: 'STRING' },
  LOWER: { args: 1, returnType: 'STRING' }, RANDOM: { args: 0, returnType: 'REAL' },
};

export function builtinType(name: string, args: DataType[]): DataType | undefined {
  const builtin = BUILTINS[name];
  if (!builtin || (name === 'ROUND' ? args.length < 1 || args.length > 2 : args.length !== builtin.args)) return undefined;
  if (['DIV', 'MOD'].includes(name) && args.some(type => type !== 'INTEGER')) return undefined;
  if (name === 'ROUND' && (!numeric(args[0]!) || (args[1] && args[1] !== 'INTEGER'))) return undefined;
  if (['LENGTH', 'SUBSTRING', 'UCASE', 'LCASE', 'UPPER', 'LOWER'].includes(name) && !['STRING', 'CHAR'].includes(args[0]!)) return undefined;
  if (name === 'SUBSTRING' && args.slice(1).some(type => type !== 'INTEGER')) return undefined;
  return ['UCASE', 'LCASE', 'UPPER', 'LOWER'].includes(name) && args[0] === 'CHAR' ? 'CHAR' : builtin.returnType;
}

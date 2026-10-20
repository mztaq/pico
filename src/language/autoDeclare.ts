import type { DataType, Declaration, Expression, Program, Statement, Target } from './ast';
import { tokenize } from './lexer';
import { parse } from './parser';
import { assignable, binaryType, BUILTINS, builtinType, comparable, DATA_TYPES, numberLiteralType, unaryType } from './typeRules';

interface Slot { types: Set<DataType>; relations: Set<Relation>; }
interface Relation { slots: Slot[]; tuples: DataType[][]; }
interface Binding { slot: Slot; arrayDepth: number; assignments: Expression[]; declaration?: Declaration; }
interface Scope {
  symbols: Map<string, Binding>;
  parent?: Scope;
  root: Scope;
  key: string;
  insertionLine: number;
  candidates: Map<string, Binding>;
}
export interface AutoDeclarationSync { code: string; generatedTypes: Record<string, DataType>; }

/** Infer only supported, unambiguous types. Never edit a manual declaration or guess array bounds. */
export function synchronizeAutoDeclarations(source: string, previouslyGenerated: Record<string, DataType> = {}): AutoDeclarationSync {
  let program: Program;
  try { program = parse(tokenize(source)); }
  catch { return { code: source, generatedTypes: { ...previouslyGenerated } }; }

  const lines = source.split(/\r?\n/);
  const solver = new Inference(previouslyGenerated);
  const global = solver.scope(program.statements, 'global', globalInsertionLine(lines));
  const scopes = [global];
  for (const statement of program.statements) {
    if (statement.kind !== 'Procedure' && statement.kind !== 'Function') continue;
    solver.routines.set(statement.name.toUpperCase(), statement);
  }
  solver.block(program.statements, global);
  for (const statement of program.statements) {
    if (statement.kind !== 'Procedure' && statement.kind !== 'Function') continue;
    const local = solver.scope(statement.body, `routine:${statement.name.toUpperCase()}`, statement.line, global, true);
    for (const parameter of statement.parameters) local.symbols.set(parameter.name, solver.binding(parameter.dataType));
    solver.block(statement.body, local, statement.kind === 'Function' ? statement.returnType : undefined);
    scopes.push(local);
  }
  solver.solve();
  const chosen = solver.choose();
  const generatedTypes: Record<string, DataType> = {};
  const insertions: { line: number; declarations: string[] }[] = [];
  for (const scope of scopes) {
    const declarations: string[] = [];
    for (const [name, binding] of scope.candidates) {
      const type = binding.arrayDepth === 0 ? chosen.get(binding.slot) : undefined;
      const key = `${scope.key}::${name}`;
      if (!type) {
        // Retain existing generated declarations on ambiguous/conflicting edits so
        // the normal compiler can explain the error without silently changing intent.
        if (binding.declaration) generatedTypes[key] = binding.declaration.dataType;
        continue;
      }
      if (binding.declaration) replaceDeclarationType(lines, binding.declaration, type);
      else declarations.push(`DECLARE ${name} : ${type}`);
      generatedTypes[key] = type;
    }
    if (declarations.length) insertions.push({ line: scope.insertionLine, declarations });
  }
  for (const insertion of insertions.sort((a, b) => b.line - a.line)) lines.splice(insertion.line, 0, ...insertion.declarations);
  return { code: lines.join(source.includes('\r\n') ? '\r\n' : '\n'), generatedTypes };
}

export function autoDeclareVariables(source: string): string { return synchronizeAutoDeclarations(source).code; }
export function isAutoDeclaredType(value: unknown): value is DataType { return DATA_TYPES.includes(value as DataType); }

class Inference {
  readonly routines = new Map<string, Extract<Statement, { kind: 'Function' | 'Procedure' }>>();
  private readonly relations: Relation[] = [];
  private readonly expressions = new Map<Expression, Slot>();
  private readonly bindings: Binding[] = [];
  constructor(private readonly tracked: Record<string, DataType>) {}

  private slot(type?: DataType): Slot { return { types: new Set(type ? [type] : DATA_TYPES), relations: new Set() }; }
  binding(type?: DataType, arrayDepth = 0): Binding {
    const binding = { slot: this.slot(type), arrayDepth, assignments: [] };
    this.bindings.push(binding);
    return binding;
  }

  scope(statements: Statement[], key: string, insertionLine: number, parent?: Scope, root = false): Scope {
    const scope: Scope = { symbols: new Map(), parent, root: undefined!, key, insertionLine, candidates: new Map() };
    scope.root = !parent || root ? scope : parent.root;
    // Precollect only this lexical block. A nested declaration must not leak into its parent.
    for (const statement of statements) {
      if (statement.kind === 'Declaration') {
        const managed = scope === scope.root && !statement.array && this.tracked[`${key}::${statement.name}`] === statement.dataType;
        const binding = this.binding(managed ? undefined : statement.dataType, statement.array?.bounds.length ?? 0);
        if (managed) { binding.declaration = statement; scope.candidates.set(statement.name, binding); }
        scope.symbols.set(statement.name, binding);
      } else if (statement.kind === 'Constant') scope.symbols.set(statement.name, this.binding());
    }
    for (const statement of statements) {
      if (statement.kind === 'ForStatement' && !this.lookup(scope, statement.name)) scope.symbols.set(statement.name, this.binding('INTEGER'));
    }
    return scope;
  }

  private lookup(scope: Scope, name: string): Binding | undefined {
    return scope.symbols.get(name) ?? (scope.parent ? this.lookup(scope.parent, name) : undefined);
  }
  private resolve(scope: Scope, name: string): Binding {
    const found = this.lookup(scope, name);
    if (found) return found;
    const binding = this.binding();
    scope.root.symbols.set(name, binding);
    scope.root.candidates.set(name, binding);
    return binding;
  }

  private constrain(slots: Slot[], valid: (types: DataType[]) => boolean): void {
    const tuples: DataType[][] = [];
    const enumerate = (index: number, tuple: DataType[]) => {
      if (index === slots.length) { if (valid(tuple)) tuples.push([...tuple]); return; }
      for (const type of slots[index]!.types) {
        // Repeated occurrences of the same variable must have the same type.
        const earlier = slots.indexOf(slots[index]!);
        if (earlier < index && tuple[earlier] !== type) continue;
        tuple.push(type); enumerate(index + 1, tuple); tuple.pop();
      }
    };
    enumerate(0, []);
    const relation = { slots, tuples };
    slots.forEach(slot => slot.relations.add(relation));
    this.relations.push(relation);
  }
  private require(slot: Slot, type: DataType) { this.constrain([slot], ([actual]) => actual === type); }

  private target(target: Target, scope: Scope): Slot {
    const binding = this.resolve(scope, target.name);
    for (const index of target.indexes) this.require(this.expression(index, scope), 'INTEGER');
    if (binding.arrayDepth !== target.indexes.length) {
      // An indexed use alone cannot determine an ARRAY's lower/upper bounds.
      if (scope.root.candidates.get(target.name) === binding) binding.arrayDepth = -1;
      const invalid = this.slot(); invalid.types.clear(); return invalid;
    }
    return binding.slot;
  }

  private expression(expression: Expression, scope: Scope): Slot {
    const cached = this.expressions.get(expression);
    if (cached) return cached;
    let result: Slot;
    switch (expression.kind) {
      case 'NumberLiteral': result = this.slot(numberLiteralType(expression)); break;
      case 'StringLiteral': result = this.slot(expression.dataType ?? 'STRING'); break;
      case 'BooleanLiteral': result = this.slot('BOOLEAN'); break;
      case 'Variable': result = this.target({ ...expression, indexes: [] }, scope); break;
      case 'ArrayAccess': result = this.target(expression, scope); break;
      case 'UnaryExpression': {
        result = this.slot();
        this.constrain([this.expression(expression.operand, scope), result], ([operand, output]) => unaryType(expression.operator, operand!) === output);
        break;
      }
      case 'BinaryExpression': {
        result = this.slot();
        this.constrain([this.expression(expression.left, scope), this.expression(expression.right, scope), result], ([left, right, output]) => binaryType(expression.operator, left!, right!) === output);
        break;
      }
      case 'CallExpression': result = this.call(expression.name, expression.arguments, scope, true); break;
    }
    this.expressions.set(expression, result);
    return result;
  }

  private call(name: string, args: Expression[], scope: Scope, asValue: boolean): Slot {
    const slots = args.map(arg => this.expression(arg, scope));
    const upper = name.toUpperCase();
    const result = this.slot();
    if (BUILTINS[upper]) {
      if (!asValue || (upper === 'ROUND' ? slots.length < 1 || slots.length > 2 : slots.length !== BUILTINS[upper]!.args)) result.types.clear();
      else this.constrain([...slots, result], types => builtinType(upper, types.slice(0, -1)) === types.at(-1));
    } else {
      const routine = this.routines.get(upper);
      if (!routine || slots.length !== routine.parameters.length || asValue !== (routine.kind === 'Function')) result.types.clear();
      else {
        slots.forEach((slot, index) => this.constrain([slot], ([type]) => assignable(type!, routine.parameters[index]!.dataType)));
        if (routine.kind === 'Function') this.require(result, routine.returnType);
      }
    }
    return result;
  }

  block(statements: Statement[], scope: Scope, returnType?: DataType): void {
    const child = (body: Statement[]) => this.scope(body, scope.key, 0, scope);
    for (const statement of statements) {
      switch (statement.kind) {
        case 'Constant':
          scope.symbols.get(statement.name)!.assignments.push(statement.value);
          this.constrain([scope.symbols.get(statement.name)!.slot, this.expression(statement.value, scope)], ([type, value]) => type === value);
          break;
        case 'Assignment': {
          const target = this.target(statement.target, scope);
          const value = this.expression(statement.value, scope);
          const binding = this.resolve(scope, statement.target.name);
          binding.assignments.push(statement.value);
          const charLiteral = statement.value.kind === 'StringLiteral' && [...statement.value.value].length === 1;
          this.constrain([value, target], ([actual, expected]) => assignable(actual!, expected!) || (charLiteral && expected === 'CHAR'));
          break;
        }
        case 'Input': this.target(statement.target, scope); break;
        case 'Output': statement.expressions.forEach(expression => this.expression(expression, scope)); break;
        case 'IfStatement':
          this.require(this.expression(statement.condition, scope), 'BOOLEAN');
          this.block(statement.thenBody, child(statement.thenBody), returnType);
          this.block(statement.elseBody, child(statement.elseBody), returnType);
          break;
        case 'WhileStatement':
          this.require(this.expression(statement.condition, scope), 'BOOLEAN');
          this.block(statement.body, child(statement.body), returnType);
          break;
        case 'RepeatStatement': {
          const local = child(statement.body);
          this.block(statement.body, local, returnType);
          this.require(this.expression(statement.condition, local), 'BOOLEAN');
          break;
        }
        case 'ForStatement':
          this.require(this.resolve(scope, statement.name).slot, 'INTEGER');
          [statement.start, statement.end, ...(statement.step ? [statement.step] : [])].forEach(expression => this.require(this.expression(expression, scope), 'INTEGER'));
          this.block(statement.body, child(statement.body), returnType);
          break;
        case 'CaseStatement': {
          const target = this.expression(statement.expression, scope);
          for (const branch of statement.branches) {
            for (const selector of branch.selectors) this.constrain([target, this.expression(selector, scope)], ([left, right]) => comparable(left!, right!));
            this.block(branch.body, child(branch.body), returnType);
          }
          this.block(statement.otherwise, child(statement.otherwise), returnType);
          break;
        }
        case 'ReturnStatement':
          if (statement.value) {
            const value = this.expression(statement.value, scope);
            if (returnType) this.constrain([value], ([actual]) => assignable(actual!, returnType));
          }
          break;
        case 'CallStatement': this.call(statement.name, statement.arguments, scope, false); break;
        case 'FileStatement':
          if (statement.target) this.target(statement.target, scope);
          if (statement.value) this.expression(statement.value, scope);
          break;
      }
    }
  }

  solve(): void {
    const pending = new Set(this.relations);
    for (const relation of pending) {
      pending.delete(relation);
      const valid = relation.tuples.filter(tuple => relation.slots.every((slot, index) => slot.types.has(tuple[index]!)));
      relation.slots.forEach((slot, index) => {
        const supported = new Set(valid.map(tuple => tuple[index]!));
        for (const type of slot.types) {
          if (supported.has(type)) continue;
          slot.types.delete(type);
          slot.relations.forEach(dependent => pending.add(dependent));
        }
      });
    }
  }

  choose(): Map<Slot, DataType> {
    const chosen = new Map<Slot, DataType>();
    const allSlots = new Set([...this.bindings.map(binding => binding.slot), ...this.expressions.values()]);
    for (const slot of allSlots) if (slot.types.size === 1) chosen.set(slot, [...slot.types][0]!);
    // Prefer the narrowest observed assignment type (INTEGER before REAL), but
    // never guess from a numeric-only INPUT use or an unanchored dependency cycle.
    for (let pass = 0; pass <= this.bindings.length; pass += 1) {
      let changed = false;
      const preferred = (expression: Expression): DataType | undefined => {
        const slot = this.expressions.get(expression)!;
        const known = chosen.get(slot);
        if (known) return known;
        if (expression.kind === 'UnaryExpression') { const operand = preferred(expression.operand); return operand && unaryType(expression.operator, operand); }
        if (expression.kind === 'BinaryExpression') { const left = preferred(expression.left), right = preferred(expression.right); return left && right && binaryType(expression.operator, left, right); }
        if (expression.kind === 'CallExpression' && BUILTINS[expression.name.toUpperCase()]) {
          const args = expression.arguments.map(preferred);
          if (args.every((arg): arg is DataType => Boolean(arg))) return builtinType(expression.name.toUpperCase(), args);
        }
        return undefined;
      };
      for (const binding of this.bindings) {
        if (binding.arrayDepth !== 0 || !binding.slot.types.size) continue;
        const observations = binding.assignments.map(preferred).filter((type): type is DataType => Boolean(type));
        const type = mergeTypes(observations);
        if (type && binding.slot.types.has(type) && chosen.get(binding.slot) !== type) { chosen.set(binding.slot, type); changed = true; }
      }
      if (!changed) break;
    }
    return chosen;
  }
}

function mergeTypes(types: DataType[]): DataType | undefined {
  let result = types[0];
  for (const type of types.slice(1)) {
    if (type === result) continue;
    if ((type === 'INTEGER' || type === 'REAL') && (result === 'INTEGER' || result === 'REAL')) result = 'REAL';
    else if ((type === 'CHAR' || type === 'STRING') && (result === 'CHAR' || result === 'STRING')) result = 'STRING';
    else return undefined;
  }
  return result;
}

function replaceDeclarationType(lines: string[], declaration: Declaration, type: DataType): void {
  const index = declaration.line - 1;
  const name = declaration.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^(\\s*DECLARE\\s+${name}\\s*:\\s*)(INTEGER|REAL|CHAR|STRING|BOOLEAN)(\\b)`, 'i');
  lines[index] = lines[index]!.replace(pattern, `$1${type}$3`);
}

function globalInsertionLine(lines: string[]): number {
  let line = 0;
  while (line < lines.length && (!lines[line]!.trim() || lines[line]!.trim().startsWith('//'))) line += 1;
  return line;
}

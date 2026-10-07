import type {
  ArraySpec,
  DataType,
  Expression,
  FileStatement,
  Parameter,
  Program,
  SourceSpan,
  Statement,
  Target,
} from '../language/ast';

export interface TraceStep {
  line: number;
  variables: Record<string, unknown>;
  output: string[];
  label: string;
}
export type VirtualFiles = Record<string, string[]>;
export interface RunResult {
  output: string[];
  variables: Record<string, unknown>;
  coverage: number[];
  trace: TraceStep[];
  steps: number;
  files: VirtualFiles;
  traceTruncated: boolean;
}
export interface InputRequest {
  variable: string;
  dataType: DataType;
  line: number;
  error?: string;
}
export type ExecutionEvent = ({ type: 'input' } & InputRequest) | { type: 'output'; text: string };
export type Execution<T> = Generator<ExecutionEvent, T, string>;

export interface ExecutionOptions {
  files?: VirtualFiles;
  trace?: boolean;
  limit?: number;
}
export class RuntimeError extends Error {
  name = 'RuntimeError';
  result?: RunResult;
  constructor(
    message: string,
    public line: number,
    public code = 'runtime',
  ) {
    super(message);
  }
}
export class MissingInputError extends RuntimeError {
  name = 'MissingInputError';
  constructor(
    public variable: string,
    public dataType: DataType,
    line: number,
  ) {
    super(`Enter a value for ${variable} (${dataType}).`, line, 'input');
  }
}
const ROUTINES = new Set([
  'DIV',
  'MOD',
  'ROUND',
  'LENGTH',
  'SUBSTRING',
  'UCASE',
  'LCASE',
  'UPPER',
  'LOWER',
  'RANDOM',
]);
type Routine = {
  parameters: Parameter[];
  body: Statement[];
  returnType?: DataType;
};
type Binding = {
  value: unknown;
  type?: DataType;
  constant: boolean;
  array?: ArraySpec;
};
class Scope {
  readonly bindings = new Map<string, Binding>();
  constructor(readonly parent?: Scope) {}
  find(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.find(name);
  }
  snapshot(): Record<string, unknown> {
    return Object.fromEntries([
      ...(this.parent ? Object.entries(this.parent.snapshot()) : []),
      ...[...this.bindings].map(
        ([name, binding]) => [name, binding.value] as const,
      ),
    ]);
  }
}
class ReturnSignal {
  constructor(readonly value: unknown) {}
}
class Interpreter {
  private readonly globals = new Scope();
  private scope = this.globals;
  private readonly routines = new Map<string, Routine>();
  private readonly files: VirtualFiles;
  private readonly handles = new Map<
    string,
    { mode: 'READ' | 'WRITE'; position: number }
  >();
  private openFile: string | undefined;
  private readonly output: string[] = [];
  private readonly trace: TraceStep[] = [];
  private readonly coverage = new Set<number>();
  private steps = 0;
  private inputPosition = 0;
  private depth = 0;
  private allocatedCells = 0;
  private traceBudget = 200_000;
  private traceTruncated = false;
  private readonly limit: number;
  constructor(
    private readonly inputs: string[],
    private readonly options: ExecutionOptions,
    private readonly interactive = false,
  ) {
    this.limit = Math.min(100_000, Math.max(1, options.limit ?? 10_000));
    this.files = Object.fromEntries(
      Object.entries(options.files ?? {}).map(([name, lines]) => [
        name,
        [...lines],
      ]),
    );
  }
  *run(program: Program): Execution<RunResult> {
    for (const s of program.statements) {
      if (s.kind === 'Procedure' || s.kind === 'Function') {
        this.routines.set(s.name.toUpperCase(), {
          parameters: s.parameters,
          body: s.body,
          returnType: s.kind === 'Function' ? s.returnType : undefined,
        });
      }
    }
    try {
      yield* this.executeBlock(
        program.statements.filter(
          (s) => s.kind !== 'Procedure' && s.kind !== 'Function',
        ),
      );
      const last = program.statements.at(-1);
      if (last) this.record(last.line, 'Finished');
      return this.result();
    } catch (error) {
      const failure =
        error instanceof RuntimeError
          ? error
          : new RuntimeError(
              error instanceof Error ? error.message : 'Execution failed.',
              1,
            );
      failure.result = this.result();
      throw failure;
    }
  }
  private result(): RunResult {
    return {
      output: [...this.output],
      variables: structuredClone(this.scope.snapshot()),
      coverage: [...this.coverage].sort((a, b) => a - b),
      trace: this.trace,
      steps: this.steps,
      files: structuredClone(this.files),
      traceTruncated: this.traceTruncated,
    };
  }
  private *executeBlock(statements: Statement[]): Execution<void> {
    for (const s of statements) yield* this.execute(s);
  }
  private *withBlock(statements: Statement[], condition?: Expression): Execution<boolean> {
    const previous = this.scope;
    this.scope = new Scope(previous);
    try {
      yield* this.executeBlock(statements);
      if (!condition) return false;
      this.record(condition.line, 'UNTIL condition');
      return this.boolean((yield* this.evaluate(condition)), condition.line);
    } finally {
      this.scope = previous;
    }
  }
  private consume(line: number): void {
    if (++this.steps > this.limit)
      throw new RuntimeError(
        `Execution stopped after ${this.limit.toLocaleString()} steps. Check your loop.`,
        line,
        'step-limit',
      );
  }
  private record(line: number, label: string): void {
    if (this.options.trace === false || this.traceTruncated) return;
    const variables = this.scope.snapshot();
    // Bound snapshot storage independently of statement count and array allocation.
    const cost =
      snapshotCost(variables) +
      this.output.reduce((total, text) => total + 1 + text.length, 0);
    if (cost > this.traceBudget) {
      this.traceTruncated = true;
      return;
    }
    this.traceBudget -= cost;
    this.trace.push({
      line,
      variables: structuredClone(variables),
      output: [...this.output],
      label,
    });
  }
  private tick(s: SourceSpan, label: string): void {
    this.consume(s.line);
    this.coverage.add(s.line);
    this.record(s.line, label);
  }
  private *execute(s: Statement): Execution<void> {
    this.tick(s, s.kind.replace(/([A-Z])/g, ' $1').trim());
    switch (s.kind) {
      case 'Declaration': {
        if (this.scope.bindings.has(s.name))
          throw new RuntimeError(
            `${s.name} has already been declared.`,
            s.line,
          );
        const value = s.array ? this.makeArray(s.array.bounds, s.line) : null;
        this.scope.bindings.set(s.name, {
          value,
          type: s.dataType,
          array: s.array,
          constant: false,
        });
        return;
      }
      case 'Constant':
        if (this.scope.bindings.has(s.name))
          throw new RuntimeError(
            `${s.name} has already been declared.`,
            s.line,
          );
        this.scope.bindings.set(s.name, {
          value: (yield* this.evaluate(s.value)),
          constant: true,
        });
        return;
      case 'Assignment':
        yield* this.setTarget(s.target, (yield* this.evaluate(s.value)));
        return;
      case 'Input': {
        const binding = this.binding(s.target.name, s.line);
        const dataType = binding.type ?? 'STRING';
        let value: unknown;
        if (this.interactive) {
          let error: string | undefined;
          while (true) {
            const raw = yield { type: 'input', variable: s.target.name, dataType, line: s.line, error };
            try {
              value = this.convertInput(raw, dataType, s.line);
              break;
            } catch (failure) {
              if (!(failure instanceof RuntimeError)) throw failure;
              error = failure.message;
            }
          }
        } else {
          if (this.inputPosition >= this.inputs.length)
            throw new MissingInputError(s.target.name, dataType, s.line);
          value = this.convertInput(this.inputs[this.inputPosition++]!, dataType, s.line);
        }
        yield* this.setTarget(s.target, value);
        return;
      }
      case 'Output': {
        const parts: string[] = [];
        for (const expression of s.expressions) parts.push(this.format((yield* this.evaluate(expression))));
        const text = parts.join('');
        this.output.push(text);
        yield { type: 'output', text };
        return;
      }
      case 'IfStatement':
        (yield* this.withBlock(
          this.boolean((yield* this.evaluate(s.condition)), s.line)
            ? s.thenBody
            : s.elseBody,
        ));
        return;
      case 'WhileStatement':
        while (true) {
          this.consume(s.line);
          if (!this.boolean((yield* this.evaluate(s.condition)), s.line)) break;
          this.record(s.line, 'WHILE condition');
          yield* this.withBlock(s.body);
        }
        return;
      case 'ForStatement': {
        if (!this.scope.find(s.name)) {
          this.scope.bindings.set(s.name, { value: null, type: 'INTEGER', constant: false });
        }
        const binding = this.binding(s.name, s.line);
        if (binding.constant)
          throw new RuntimeError(
            `${s.name} is a CONSTANT and cannot be changed.`,
            s.line,
          );
        if (binding.type !== 'INTEGER' || binding.array)
          throw new RuntimeError(
            `FOR counter ${s.name} must be an INTEGER scalar.`,
            s.line,
          );
        const first = this.integer((yield* this.evaluate(s.start)), s.line),
          last = this.integer((yield* this.evaluate(s.end)), s.line);
        const step = s.step ? this.integer((yield* this.evaluate(s.step)), s.line) : 1;
        if (step === 0)
          throw new RuntimeError('A FOR STEP cannot be zero.', s.line);
        binding.value = first;
        for (let v = first; step > 0 ? v <= last : v >= last; ) {
          this.consume(s.line);
          binding.value = v;
          this.record(s.line, 'FOR iteration');
          yield* this.withBlock(s.body);
          const next = v + step;
          if (!Number.isSafeInteger(next)) {
            if (step > 0 ? next > last : next < last) break;
            throw new RuntimeError(
              'FOR counter is outside the supported safe integer range.',
              s.line,
            );
          }
          v = next;
        }
        return;
      }
      case 'RepeatStatement':
        while (true) {
          this.consume(s.line);
          const finished = (yield* this.withBlock(s.body, s.condition));
          if (finished) return;
        }
      case 'CaseStatement': {
        const value = (yield* this.evaluate(s.expression));
        let body = s.otherwise;
        search: for (const branch of s.branches) {
          for (const selector of branch.selectors) {
            if ((yield* this.evaluate(selector)) === value) {
              body = branch.body;
              break search;
            }
          }
        }
        yield* this.withBlock(body);
        return;
      }
      case 'CallStatement':
        yield* this.callRoutine(s.name, s.arguments, s.line, false);
        return;
      case 'ReturnStatement':
        if (!s.value)
          throw new RuntimeError('FUNCTION must RETURN a value.', s.line);
        throw new ReturnSignal((yield* this.evaluate(s.value)));
      case 'FileStatement':
        yield* this.fileOp(s);
        return;
      case 'Procedure':
      case 'Function':
        throw new RuntimeError(
          'Routine definitions must be at the top level.',
          s.line,
        );
    }
  }
  private *callRoutine(
    name: string,
    args: Expression[],
    line: number,
    asValue = true,
  ): Execution<unknown> {
    const routine = this.routines.get(name.toUpperCase());
    if (!routine)
      throw new RuntimeError(
        `${name} has not been declared as a procedure or function.`,
        line,
        'routine',
      );
    if (asValue !== Boolean(routine.returnType))
      throw new RuntimeError(
        asValue
          ? `${name} is a PROCEDURE and cannot be used as a value.`
          : `${name} is a FUNCTION and must be used as a value.`,
        line,
      );
    if (args.length !== routine.parameters.length)
      throw new RuntimeError(
        `${name} expects ${routine.parameters.length} parameters.`,
        line,
      );
    this.consume(line);
    if (this.depth >= 100)
      throw new RuntimeError(
        'Maximum routine call depth (100) exceeded. Check recursion.',
        line,
        'recursion',
      );
    // Evaluate all arguments in the caller before introducing any parameter bindings.
    const values = (yield* this.evaluateArguments(args));
    const caller = this.scope;
    const local = new Scope(this.globals);
    routine.parameters.forEach((p, i) => {
      this.ensureValueType(values[i], p.dataType, line, p.name);
      local.bindings.set(p.name, {
        value: values[i],
        type: p.dataType,
        constant: false,
      });
    });
    this.scope = local;
    this.depth++;
    try {
      yield* this.executeBlock(routine.body);
      if (routine.returnType)
        throw new RuntimeError(`${name} finished without RETURN.`, line);
      return undefined;
    } catch (error) {
      if (!(error instanceof ReturnSignal)) throw error;
      if (!routine.returnType)
        throw new RuntimeError(
          'RETURN values are only allowed inside FUNCTIONs.',
          line,
        );
      this.ensureValueType(error.value, routine.returnType, line, name);
      return error.value;
    } finally {
      this.scope = caller;
      this.depth--;
    }
  }
  private *fileOp(s: FileStatement): Execution<void> {
    if (s.operation === 'OPEN') {
      if (!s.name || !s.mode)
        throw new RuntimeError('OPENFILE needs a filename and mode.', s.line);
      if (this.handles.has(s.name))
        throw new RuntimeError(`${s.name} is already open.`, s.line);
      if (s.mode === 'READ' && !Object.hasOwn(this.files, s.name))
        throw new RuntimeError(
          `File ${s.name} does not exist in this project.`,
          s.line,
        );
      if (s.mode === 'WRITE')
        Object.defineProperty(this.files, s.name, {
          value: [],
          writable: true,
          configurable: true,
          enumerable: true,
        });
      this.handles.set(s.name, { mode: s.mode, position: 0 });
      this.openFile = s.name;
      return;
    }
    const name = s.name ?? this.openFile;
    const handle = name ? this.handles.get(name) : undefined;
    if (!name || !handle)
      throw new RuntimeError(
        'Open the file before using file operations.',
        s.line,
      );
    if (s.operation === 'CLOSE') {
      this.handles.delete(name);
      if (this.openFile === name)
        this.openFile = [...this.handles.keys()].at(-1);
      return;
    }
    if (s.operation === 'WRITE') {
      if (handle.mode !== 'WRITE')
        throw new RuntimeError(`${name} is not open FOR WRITE.`, s.line);
      if (!s.value) throw new RuntimeError('WRITEFILE needs a value.', s.line);
      this.files[name]!.push(this.format((yield* this.evaluate(s.value))));
      return;
    }
    if (handle.mode !== 'READ')
      throw new RuntimeError(`${name} is not open FOR READ.`, s.line);
    if (!s.target) throw new RuntimeError('READFILE needs a target.', s.line);
    const raw = this.files[name]![handle.position];
    if (raw === undefined)
      throw new RuntimeError(`End of file reached in ${name}.`, s.line, 'eof');
    const binding = this.binding(s.target.name, s.line);
    yield* this.setTarget(
      s.target,
      this.convertInput(raw, binding.type ?? 'STRING', s.line),
    );
    handle.position++;
  }
  private makeArray(bounds: ArraySpec['bounds'], line: number): unknown[] {
    if (
      !bounds.length ||
      bounds.length > 2 ||
      bounds.some(
        (b) =>
          !Number.isSafeInteger(b.start) ||
          !Number.isSafeInteger(b.end) ||
          b.end < b.start,
      )
    )
      throw new RuntimeError('Invalid ARRAY bounds.', line);
    const cells = bounds.reduce((total, b) => total * (b.end - b.start + 1), 1);
    if (!Number.isSafeInteger(cells) || this.allocatedCells + cells > 100_000)
      throw new RuntimeError(
        'ARRAY allocation limit (100,000 cells) exceeded.',
        line,
      );
    this.allocatedCells += cells;
    const build = (dimension: number): unknown[] =>
      Array.from(
        { length: bounds[dimension]!.end - bounds[dimension]!.start + 1 },
        () => (dimension + 1 === bounds.length ? null : build(dimension + 1)),
      );
    return build(0);
  }
  private binding(name: string, line: number): Binding {
    const binding = this.scope.find(name);
    if (!binding)
      throw new RuntimeError(
        `${name} has not been declared. Add DECLARE ${name} before using it.`,
        line,
        'name',
      );
    return binding;
  }
  private *location(
    target: Target,
    binding: Binding,
  ): Execution<{ array: unknown[]; index: number }> {
    if (!binding.array || binding.array.bounds.length !== target.indexes.length)
      throw new RuntimeError(
        `${target.name} needs ${binding.array?.bounds.length ?? 0} ARRAY indexes.`,
        target.line,
      );
    let array = binding.value as unknown[];
    let index = 0;
    for (const [dimension, expression] of target.indexes.entries()) {
      const value = this.integer((yield* this.evaluate(expression)), target.line);
      const bound = binding.array!.bounds[dimension]!;
      if (value < bound.start || value > bound.end)
        throw new RuntimeError(
          `${target.name} index ${value} is outside ${bound.start}:${bound.end}.`,
          target.line,
          'bounds',
        );
      index = value - bound.start;
      if (dimension + 1 < target.indexes.length)
        array = array[index] as unknown[];
    }
    return { array, index };
  }
  private *getTarget(target: Target): Execution<unknown> {
    const binding = this.binding(target.name, target.line);
    if (!target.indexes.length && binding.array)
      throw new RuntimeError(
        `${target.name} is an ARRAY and needs an index.`,
        target.line,
      );
    const location = target.indexes.length
      ? (yield* this.location(target, binding))
      : undefined;
    const value = location ? location.array[location.index] : binding.value;
    if (value === null || value === undefined)
      throw new RuntimeError(
        `${target.name} has been declared but does not have a value yet.`,
        target.line,
        'unassigned',
      );
    return value;
  }
  private *setTarget(target: Target, value: unknown): Execution<void> {
    const binding = this.binding(target.name, target.line);
    if (binding.constant)
      throw new RuntimeError(
        `${target.name} is a CONSTANT and cannot be changed.`,
        target.line,
      );
    this.ensureValueType(
      value,
      binding.type ?? 'STRING',
      target.line,
      target.name,
    );
    if (target.indexes.length) {
      const location = (yield* this.location(target, binding));
      location.array[location.index] = value;
    } else {
      if (binding.array)
        throw new RuntimeError(
          `${target.name} is an ARRAY and needs an index.`,
          target.line,
        );
      binding.value = value;
    }
  }
  private ensureValueType(
    value: unknown,
    type: DataType,
    line: number,
    name: string,
  ): void {
    const valid =
      type === 'INTEGER'
        ? typeof value === 'number' && Number.isSafeInteger(value)
        : type === 'REAL'
          ? typeof value === 'number' && Number.isFinite(value)
          : type === 'CHAR'
            ? typeof value === 'string' && [...value].length === 1
            : type === 'BOOLEAN'
              ? typeof value === 'boolean'
              : typeof value === 'string';
    if (!valid)
      throw new RuntimeError(
        `Cannot assign ${this.format(value)} to ${name} (${type}).`,
        line,
        'type',
      );
  }
  private integer(value: unknown, line: number): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value))
      throw new RuntimeError(
        'An INTEGER in the supported safe range is required.',
        line,
        'integer',
      );
    return value;
  }
  private boolean(value: unknown, line: number): boolean {
    if (typeof value !== 'boolean')
      throw new RuntimeError('Condition must be BOOLEAN.', line, 'type');
    return value;
  }
  private convertInput(raw: string, type: DataType, line: number): unknown {
    const text = raw.trim();
    if (type === 'INTEGER') {
      if (!/^[+-]?\d+$/.test(text))
        throw new RuntimeError(`“${raw}” is not an INTEGER.`, line);
      return this.integer(Number(text), line);
    }
    if (type === 'REAL') {
      if (
        !/^[+-]?\d+\.\d+$/.test(text) ||
        !Number.isFinite(Number(text))
      )
        throw new RuntimeError(`“${raw}” is not a REAL number. Use a decimal such as 5.0.`, line);
      return Number(text);
    }
    if (type === 'CHAR') {
      this.ensureValueType(raw, type, line, 'input');
      return raw;
    }
    if (type === 'BOOLEAN') {
      if (/^TRUE$/i.test(text)) return true;
      if (/^FALSE$/i.test(text)) return false;
      throw new RuntimeError('BOOLEAN input must be TRUE or FALSE.', line);
    }
    return raw;
  }
  private *evaluateArguments(args: Expression[]): Execution<unknown[]> {
    const values: unknown[] = [];
    for (const argument of args) values.push((yield* this.evaluate(argument)));
    return values;
  }
  private *evaluate(e: Expression): Execution<unknown> {
    switch (e.kind) {
      case 'NumberLiteral':
        if (
          !Number.isFinite(e.value) ||
          (Number.isInteger(e.value) && !Number.isSafeInteger(e.value))
        )
          throw new RuntimeError(
            'Number is outside the supported safe range.',
            e.line,
          );
        return e.value;
      case 'StringLiteral':
      case 'BooleanLiteral':
        return e.value;
      case 'Variable':
        return yield* this.getTarget({ ...e, indexes: [] });
      case 'ArrayAccess':
        return yield* this.getTarget(e);
      case 'UnaryExpression':
        return e.operator === 'NOT'
          ? !this.boolean((yield* this.evaluate(e.operand)), e.line)
          : this.finite(-Number((yield* this.evaluate(e.operand))), e.line);
      case 'BinaryExpression':
        return yield* this.binary(e.operator, e.left, e.right, e.line);
      case 'CallExpression':
        return ROUTINES.has(e.name.toUpperCase())
          ? (yield* this.call(e.name.toUpperCase(), e.arguments, e.line))
          : (yield* this.callRoutine(e.name, e.arguments, e.line));
    }
  }
  private finite(value: number, line: number): number {
    if (
      !Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value))
    )
      throw new RuntimeError(
        'Numeric result is outside the supported safe range.',
        line,
        'number',
      );
    return value;
  }
  private *binary(
    op: string,
    a: Expression,
    b: Expression,
    line: number,
  ): Execution<unknown> {
    const left = (yield* this.evaluate(a));
    if (op === 'AND' && !this.boolean(left, line)) return false;
    if (op === 'OR' && this.boolean(left, line)) return true;
    const right = (yield* this.evaluate(b));
    switch (op) {
      case '+':
        return typeof left === 'string' || typeof right === 'string'
          ? this.format(left) + this.format(right)
          : this.finite(Number(left) + Number(right), line);
      case '-':
        return this.finite(Number(left) - Number(right), line);
      case '*':
        return this.finite(Number(left) * Number(right), line);
      case '/':
        if (right === 0)
          throw new RuntimeError('You cannot divide by zero.', line);
        return this.finite(Number(left) / Number(right), line);
      case 'DIV':
      case 'MOD':
        return this.integerOperation(op, left, right, line);
      case '^':
        return this.finite(Number(left) ** Number(right), line);
      case '=':
        return left === right;
      case '<>':
      case '!=':
        return left !== right;
      case '<':
        return (left as number) < (right as number);
      case '<=':
        return (left as number) <= (right as number);
      case '>':
        return (left as number) > (right as number);
      case '>=':
        return (left as number) >= (right as number);
      case 'AND':
        return this.boolean(left, line) && this.boolean(right, line);
      case 'OR':
        return this.boolean(left, line) || this.boolean(right, line);
      default:
        throw new RuntimeError(`The operator ${op} is not supported.`, line);
    }
  }
  private integerOperation(
    op: string,
    left: unknown,
    right: unknown,
    line: number,
  ): number {
    const a = this.integer(left, line),
      b = this.integer(right, line);
    if (b === 0)
      throw new RuntimeError(
        op === 'MOD'
          ? 'You cannot use MOD with zero.'
          : 'You cannot divide by zero.',
        line,
      );
    return this.finite(op === 'DIV' ? Math.floor(a / b) : a % b, line);
  }
  private *call(name: string, args: Expression[], line: number): Execution<unknown> {
    const values = (yield* this.evaluateArguments(args));
    const need = (count: number) => {
      if (values.length !== count)
        throw new RuntimeError(`${name}() takes ${count} arguments.`, line);
    };
    const text = () => {
      if (typeof values[0] !== 'string')
        throw new RuntimeError(`${name} needs text.`, line);
      return values[0];
    };
    switch (name) {
      case 'DIV':
      case 'MOD':
        need(2);
        return this.integerOperation(name, values[0], values[1], line);
      case 'ROUND': {
        if (values.length < 1 || values.length > 2)
          throw new RuntimeError('ROUND() takes one or two arguments.', line);
        const places = values.length === 2 ? this.integer(values[1], line) : 0;
        if (places < -100 || places > 100)
          throw new RuntimeError(
            'ROUND decimal places must be between -100 and 100.',
            line,
          );
        return this.finite(roundLikePython(Number(values[0]), places), line);
      }
      case 'LENGTH':
        need(1);
        return [...text()].length;
      case 'UCASE':
      case 'UPPER':
        need(1);
        return text().toUpperCase();
      case 'LCASE':
      case 'LOWER':
        need(1);
        return text().toLowerCase();
      case 'SUBSTRING': {
        need(3);
        const characters = [...text()];
        const start = this.integer(values[1], line),
          length = this.integer(values[2], line);
        if (start < 1 || length < 0 || start - 1 + length > characters.length)
          throw new RuntimeError(
            'SUBSTRING range is outside the text.',
            line,
            'bounds',
          );
        return characters.slice(start - 1, start - 1 + length).join('');
      }
      case 'RANDOM':
        need(0);
        return Math.random();
    }
  }
  private format(value: unknown): string {
    return value === true ? 'TRUE' : value === false ? 'FALSE' : String(value);
  }
}
export function execute(
  program: Program,
  inputs: string[] = [],
  options: ExecutionOptions = {},
): RunResult {
  const execution = new Interpreter(inputs, options).run(program);
  let step = execution.next();
  while (!step.done) step = execution.next();
  return step.value;
}
/** A generator retains scopes, loop positions, file handles and evaluated values across INPUT. */
export function executeInteractive(program: Program, options: ExecutionOptions = {}): Execution<RunResult> {
  return new Interpreter([], options, true).run(program);
}
function snapshotCost(value: unknown): number {
  if (Array.isArray(value))
    return 1 + value.reduce((total, item) => total + snapshotCost(item), 0);
  if (value && typeof value === 'object')
    return (
      1 +
      Object.values(value).reduce<number>(
        (total, item) => total + snapshotCost(item),
        0,
      )
    );
  return typeof value === 'string' ? 1 + value.length : 1;
}
function roundLikePython(value: number, places: number): number {
  const factor = 10 ** places,
    scaled = value * factor,
    lower = Math.floor(scaled),
    fraction = scaled - lower;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  const rounded =
    Math.abs(fraction - 0.5) <= tolerance
      ? lower % 2 === 0
        ? lower
        : lower + 1
      : Math.round(scaled);
  return rounded / factor;
}

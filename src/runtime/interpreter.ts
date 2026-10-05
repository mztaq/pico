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
  ) {
    this.limit = Math.min(100_000, Math.max(1, options.limit ?? 10_000));
    this.files = Object.fromEntries(
      Object.entries(options.files ?? {}).map(([name, lines]) => [
        name,
        [...lines],
      ]),
    );
  }
  run(program: Program): RunResult {
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
      this.executeBlock(
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
  private executeBlock(statements: Statement[]): void {
    for (const s of statements) this.execute(s);
  }
  private withBlock(statements: Statement[], after?: () => boolean): boolean {
    const previous = this.scope;
    this.scope = new Scope(previous);
    try {
      this.executeBlock(statements);
      return after?.() ?? false;
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
  private execute(s: Statement): void {
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
          value: this.evaluate(s.value),
          constant: true,
        });
        return;
      case 'Assignment':
        this.setTarget(s.target, this.evaluate(s.value));
        return;
      case 'Input': {
        const binding = this.binding(s.target.name, s.line);
        if (this.inputPosition >= this.inputs.length)
          throw new MissingInputError(
            s.target.name,
            binding.type ?? 'STRING',
            s.line,
          );
        this.setTarget(
          s.target,
          this.convertInput(
            this.inputs[this.inputPosition++]!,
            binding.type ?? 'STRING',
            s.line,
          ),
        );
        return;
      }
      case 'Output':
        this.output.push(
          s.expressions.map((e) => this.format(this.evaluate(e))).join(''),
        );
        return;
      case 'IfStatement':
        this.withBlock(
          this.boolean(this.evaluate(s.condition), s.line)
            ? s.thenBody
            : s.elseBody,
        );
        return;
      case 'WhileStatement':
        while (true) {
          this.consume(s.line);
          if (!this.boolean(this.evaluate(s.condition), s.line)) break;
          this.record(s.line, 'WHILE condition');
          this.withBlock(s.body);
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
        const first = this.integer(this.evaluate(s.start), s.line),
          last = this.integer(this.evaluate(s.end), s.line);
        const step = s.step ? this.integer(this.evaluate(s.step), s.line) : 1;
        if (step === 0)
          throw new RuntimeError('A FOR STEP cannot be zero.', s.line);
        binding.value = first;
        for (let v = first; step > 0 ? v <= last : v >= last; ) {
          this.consume(s.line);
          binding.value = v;
          this.record(s.line, 'FOR iteration');
          this.withBlock(s.body);
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
          const finished = this.withBlock(s.body, () => {
            this.record(s.condition.line, 'UNTIL condition');
            return this.boolean(this.evaluate(s.condition), s.line);
          });
          if (finished) return;
        }
      case 'CaseStatement': {
        const value = this.evaluate(s.expression);
        const branch = s.branches.find((b) =>
          b.selectors.some((selector) => this.evaluate(selector) === value),
        );
        this.withBlock(branch?.body ?? s.otherwise);
        return;
      }
      case 'CallStatement':
        this.callRoutine(s.name, s.arguments, s.line, false);
        return;
      case 'ReturnStatement':
        if (!s.value)
          throw new RuntimeError('FUNCTION must RETURN a value.', s.line);
        throw new ReturnSignal(this.evaluate(s.value));
      case 'FileStatement':
        this.fileOp(s);
        return;
      case 'Procedure':
      case 'Function':
        throw new RuntimeError(
          'Routine definitions must be at the top level.',
          s.line,
        );
    }
  }
  private callRoutine(
    name: string,
    args: Expression[],
    line: number,
    asValue = true,
  ): unknown {
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
    const values = args.map((argument) => this.evaluate(argument));
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
      this.executeBlock(routine.body);
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
  private fileOp(s: FileStatement): void {
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
      this.files[name]!.push(this.format(this.evaluate(s.value)));
      return;
    }
    if (handle.mode !== 'READ')
      throw new RuntimeError(`${name} is not open FOR READ.`, s.line);
    if (!s.target) throw new RuntimeError('READFILE needs a target.', s.line);
    const raw = this.files[name]![handle.position];
    if (raw === undefined)
      throw new RuntimeError(`End of file reached in ${name}.`, s.line, 'eof');
    const binding = this.binding(s.target.name, s.line);
    this.setTarget(
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
  private location(
    target: Target,
    binding: Binding,
  ): { array: unknown[]; index: number } {
    if (!binding.array || binding.array.bounds.length !== target.indexes.length)
      throw new RuntimeError(
        `${target.name} needs ${binding.array?.bounds.length ?? 0} ARRAY indexes.`,
        target.line,
      );
    let array = binding.value as unknown[];
    let index = 0;
    target.indexes.forEach((expression, dimension) => {
      const value = this.integer(this.evaluate(expression), target.line);
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
    });
    return { array, index };
  }
  private getTarget(target: Target): unknown {
    const binding = this.binding(target.name, target.line);
    if (!target.indexes.length && binding.array)
      throw new RuntimeError(
        `${target.name} is an ARRAY and needs an index.`,
        target.line,
      );
    const location = target.indexes.length
      ? this.location(target, binding)
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
  private setTarget(target: Target, value: unknown): void {
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
      const location = this.location(target, binding);
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
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
        !Number.isFinite(Number(text))
      )
        throw new RuntimeError(`“${raw}” is not a REAL number.`, line);
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
  private evaluate(e: Expression): unknown {
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
        return this.getTarget({ ...e, indexes: [] });
      case 'ArrayAccess':
        return this.getTarget(e);
      case 'UnaryExpression':
        return e.operator === 'NOT'
          ? !this.boolean(this.evaluate(e.operand), e.line)
          : this.finite(-Number(this.evaluate(e.operand)), e.line);
      case 'BinaryExpression':
        return this.binary(e.operator, e.left, e.right, e.line);
      case 'CallExpression':
        return ROUTINES.has(e.name.toUpperCase())
          ? this.call(e.name.toUpperCase(), e.arguments, e.line)
          : this.callRoutine(e.name, e.arguments, e.line);
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
  private binary(
    op: string,
    a: Expression,
    b: Expression,
    line: number,
  ): unknown {
    const left = this.evaluate(a);
    if (op === 'AND' && !this.boolean(left, line)) return false;
    if (op === 'OR' && this.boolean(left, line)) return true;
    const right = this.evaluate(b);
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
  private call(name: string, args: Expression[], line: number): unknown {
    const values = args.map((a) => this.evaluate(a));
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
  return new Interpreter(inputs, options).run(program);
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

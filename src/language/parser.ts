import type {
  DataType,
  Expression,
  Program,
  Statement,
  Token,
  Target,
  Parameter,
  CaseBranch,
} from './ast';
import { COMPLETIONS, PicoSyntaxError } from './lexer';
const PRECEDENCE: Record<string, number> = {
  OR: 1,
  AND: 2,
  '=': 3,
  '<>': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  DIV: 5,
  MOD: 5,
  '^': 6,
};
const typeNames = new Set(['INTEGER', 'REAL', 'CHAR', 'STRING', 'BOOLEAN']);
export class Parser {
  private position = 0;
  constructor(private readonly tokens: Token[]) {}
  private get current() {
    return this.tokens[this.position] ?? this.tokens[this.tokens.length - 1]!;
  }
  private advance() {
    const t = this.current;
    if (t.type !== 'EOF') this.position++;
    return t;
  }
  private match(type: string) {
    return this.current.type === type ? this.advance() : null;
  }
  private expect(type: string, hint?: string) {
    if (this.current.type !== type) {
      const t = this.current;
      throw new PicoSyntaxError(
        hint ?? `Expected ${type}, but found “${t.value || t.type}”.`,
        t.line,
        t.column,
      );
    }
    return this.advance();
  }
  private skipNewlines() {
    while (this.match('NEWLINE')) {}
  }
  parse(): Program {
    this.skipNewlines();
    const statements = this.parseBlock(new Set(['EOF']));
    this.expect('EOF');
    return { kind: 'Program', statements };
  }
  private parseBlock(end: Set<string>): Statement[] {
    const out: Statement[] = [];
    this.skipNewlines();
    while (
      !(
        end.has(this.current.type) &&
        (this.current.type !== 'IDENTIFIER' || this.isCaseLabel())
      ) &&
      this.current.type !== 'EOF'
    ) {
      const parsed = this.parseStatement() as Statement | Statement[];
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      if (this.current.type !== 'EOF')
        this.expect('NEWLINE', 'Put each instruction on its own line.');
      this.skipNewlines();
    }
    return out;
  }
  private isCaseLabel(): boolean {
    let i = this.position;
    while (!['NEWLINE', 'EOF'].includes(this.tokens[i]!.type)) {
      if (this.tokens[i]!.type === 'ARROW') return false;
      if (this.tokens[i]!.type === ':') return true;
      i++;
    }
    return false;
  }
  private parseStatement(): Statement | Statement[] {
    switch (this.current.type) {
      case 'DECLARE':
        return this.parseDeclaration();
      case 'CONSTANT':
        return this.parseConstant();
      case 'INPUT':
        return this.parseInput();
      case 'OUTPUT':
        return this.parseOutput();
      case 'IF':
        return this.parseIf();
      case 'WHILE':
        return this.parseWhile();
      case 'FOR':
        return this.parseFor();
      case 'REPEAT':
        return this.parseRepeat();
      case 'CASE':
        return this.parseCase();
      case 'PROCEDURE':
        return this.parseRoutine(false);
      case 'FUNCTION':
        return this.parseRoutine(true);
      case 'CALL':
        return this.parseCall();
      case 'RETURN':
        return this.parseReturn();
      case 'OPENFILE':
      case 'READFILE':
      case 'WRITEFILE':
      case 'CLOSEFILE':
        return this.parseFile();
      case 'IDENTIFIER':
        if (this.current.value && this.looksLikeKeywordTypo()) {
          const typo = this.current;
          const replacement = this.closestKeyword(typo.value);
          if (replacement)
            throw new PicoSyntaxError(
              `“${typo.value}” is not a Cambridge keyword. Did you mean ${replacement}?`,
              typo.line,
              typo.column,
            );
        }
        return this.parseAssignment();
      default:
        throw new PicoSyntaxError(
          `“${this.current.value || this.current.type}” cannot start an instruction here.`,
          this.current.line,
          this.current.column,
        );
    }
  }
  private parseDeclaration(): Statement | Statement[] {
    const start = this.expect('DECLARE');
    const names = [this.expect('IDENTIFIER')];
    while (this.match(',')) names.push(this.expect('IDENTIFIER'));
    this.expect(':', 'Add a colon and a Cambridge type.');
    if (this.match('ARRAY')) {
      this.expect('[');
      const bounds: { start: number; end: number }[] = [];
      do {
        const startN = this.parseBound();
        this.expect(':');
        bounds.push({ start: startN, end: this.parseBound() });
      } while (this.match(','));
      this.expect(']');
      this.expect('OF');
      const dataType = this.expectType();
      return names.map((name) => ({
        kind: 'Declaration' as const,
        name: name.value,
        dataType,
        array: { bounds, dataType },
        line: start.line,
        column: start.column,
        endColumn: this.tokens[this.position - 1]!.endColumn,
      }));
    }
    const dataType = this.expectType();
    const endColumn = this.tokens[this.position - 1]!.endColumn;
    return names.map((name) => ({
      kind: 'Declaration' as const,
      name: name.value,
      dataType,
      line: start.line,
      column: start.column,
      endColumn,
    }));
  }
  private parseBound(): number {
    const sign = this.match('-') ? -1 : 1;
    return sign * Number(this.expect('NUMBER').value);
  }
  private expectType(): DataType {
    if (!typeNames.has(this.current.type))
      throw new PicoSyntaxError(
        'Choose INTEGER, REAL, CHAR, STRING, or BOOLEAN.',
        this.current.line,
        this.current.column,
      );
    return this.advance().type as DataType;
  }
  private parseConstant(): Statement {
    const s = this.expect('CONSTANT'),
      name = this.expect('IDENTIFIER');
    this.expect('ARROW');
    const value = this.parseExpression();
    return {
      kind: 'Constant',
      name: name.value,
      value,
      line: s.line,
      column: s.column,
      endColumn: value.endColumn,
    };
  }
  private parseTarget(): Target {
    const n = this.expect('IDENTIFIER');
    const indexes: Expression[] = [];
    if (this.match('[')) {
      indexes.push(this.parseExpression());
      while (this.match(',')) indexes.push(this.parseExpression());
      this.expect(']');
    }
    return {
      name: n.value,
      indexes,
      line: n.line,
      column: n.column,
      endColumn: this.tokens[this.position - 1]!.endColumn,
    };
  }
  private parseAssignment(): Statement {
    const target = this.parseTarget();
    this.expect('ARROW', 'Use ← to assign a value.');
    const value = this.parseExpression();
    return {
      kind: 'Assignment',
      target,
      value,
      line: target.line,
      column: target.column,
      endColumn: value.endColumn,
    };
  }
  private parseInput(): Statement {
    const s = this.expect('INPUT'),
      target = this.parseTarget();
    return {
      kind: 'Input',
      target,
      line: s.line,
      column: s.column,
      endColumn: target.endColumn,
    };
  }
  private parseOutput(): Statement {
    const s = this.expect('OUTPUT'),
      expressions = [this.parseExpression()];
    while (this.match(',')) expressions.push(this.parseExpression());
    return {
      kind: 'Output',
      expressions,
      line: s.line,
      column: s.column,
      endColumn: expressions.at(-1)!.endColumn,
    };
  }
  private parseIf(): Statement {
    const s = this.expect('IF'),
      condition = this.parseExpression();
    if (this.current.type === 'NEWLINE') this.skipNewlines();
    if (this.current.type !== 'THEN')
      throw new PicoSyntaxError(
        'Expected THEN after IF condition. IF requires THEN before its body.',
        condition.line,
        condition.endColumn,
      );
    this.expect(
      'THEN',
      'IF requires THEN on the same line or the following line.',
    );
    this.expectLineEnd();
    const thenBody = this.parseBlock(new Set(['ELSE', 'ENDIF', 'EOF']));
    let elseBody: Statement[] = [];
    if (this.match('ELSE')) {
      this.expectLineEnd();
      elseBody = this.parseBlock(new Set(['ENDIF', 'EOF']));
    }
    const e = this.expect('ENDIF', 'Close this selection with ENDIF.');
    return {
      kind: 'IfStatement',
      condition,
      thenBody,
      elseBody,
      line: s.line,
      column: s.column,
      endColumn: e.endColumn,
    };
  }
  private parseWhile(): Statement {
    const s = this.expect('WHILE'),
      condition = this.parseExpression();
    this.expect(
      'DO',
      'Cambridge WHILE syntax requires DO after the condition, for example: WHILE Number <> -1 DO.',
    );
    this.expectLineEnd();
    const body = this.parseBlock(new Set(['ENDWHILE', 'EOF'])),
      e = this.expect('ENDWHILE');
    return {
      kind: 'WhileStatement',
      condition,
      body,
      line: s.line,
      column: s.column,
      endColumn: e.endColumn,
    };
  }
  private parseFor(): Statement {
    const s = this.expect('FOR'),
      name = this.expect('IDENTIFIER');
    this.expect('ARROW');
    const start = this.parseExpression();
    this.expect('TO');
    const end = this.parseExpression();
    const step = this.match('STEP') ? this.parseExpression() : null;
    this.expectLineEnd();
    const body = this.parseBlock(new Set(['NEXT', 'EOF'])),
      n = this.expect('NEXT');
    if (
      this.current.type === 'IDENTIFIER' &&
      this.advance().value !== name.value
    )
      throw new PicoSyntaxError(
        `NEXT does not match FOR ${name.value}.`,
        n.line,
        n.column,
      );
    return {
      kind: 'ForStatement',
      name: name.value,
      start,
      end,
      step,
      body,
      line: s.line,
      column: s.column,
      endColumn: n.endColumn,
    };
  }
  private parseRepeat(): Statement {
    const s = this.expect('REPEAT');
    this.expectLineEnd();
    const body = this.parseBlock(new Set(['UNTIL', 'EOF']));
    this.expect('UNTIL');
    const condition = this.parseExpression();
    return {
      kind: 'RepeatStatement',
      body,
      condition,
      line: s.line,
      column: s.column,
      endColumn: condition.endColumn,
    };
  }
  private parseCase(): Statement {
    const s = this.expect('CASE');
    this.expect('OF');
    const expression = this.parseExpression();
    this.expectLineEnd();
    const branches: CaseBranch[] = [];
    let otherwise: Statement[] = [];
    while (!['ENDCASE', 'EOF'].includes(this.current.type)) {
      if (this.match('OTHERWISE')) {
        this.expectLineEnd();
        otherwise = this.parseBlock(new Set(['ENDCASE', 'EOF']));
        break;
      }
      const line = this.current.line;
      const selectors = [this.parseExpression()];
      while (this.match(',')) selectors.push(this.parseExpression());
      this.expect(':');
      let body: Statement[];
      if (this.current.type === 'NEWLINE') {
        this.expectLineEnd();
        body = this.parseBlock(
          new Set([
            'OTHERWISE',
            'ENDCASE',
            'EOF',
            'NUMBER',
            'STRING',
            'CHAR_LITERAL',
            'TRUE',
            'FALSE',
            '-',
            'IDENTIFIER',
          ]),
        );
      } else {
        const inline = this.parseStatement();
        body = Array.isArray(inline) ? inline : [inline];
        if (this.current.type !== 'EOF') this.expect('NEWLINE');
        this.skipNewlines();
      }
      branches.push({ selectors, body, line });
    }
    const e = this.expect('ENDCASE');
    return {
      kind: 'CaseStatement',
      expression,
      branches,
      otherwise,
      line: s.line,
      column: s.column,
      endColumn: e.endColumn,
    };
  }
  private parseRoutine(isFunction: boolean): Statement {
    const s = this.advance(),
      name = this.expect('IDENTIFIER'),
      parameters = this.parseParameters();
    let returnType: DataType | undefined;
    if (isFunction) {
      this.expect('RETURNS');
      returnType = this.expectType();
    }
    this.expectLineEnd();
    const endType = isFunction ? 'ENDFUNCTION' : 'ENDPROCEDURE';
    const body = this.parseBlock(new Set([endType, 'EOF']));
    const e = this.expect(endType);
    return isFunction
      ? {
          kind: 'Function',
          name: name.value,
          parameters,
          returnType: returnType!,
          body,
          line: s.line,
          column: s.column,
          endColumn: e.endColumn,
        }
      : {
          kind: 'Procedure',
          name: name.value,
          parameters,
          body,
          line: s.line,
          column: s.column,
          endColumn: e.endColumn,
        };
  }
  private parseParameters(): Parameter[] {
    const result: Parameter[] = [];
    if (!this.match('(')) return result;
    if (!this.check(')')) {
      do {
        const name = this.expect('IDENTIFIER');
        this.expect(':');
        result.push({ name: name.value, dataType: this.expectType() });
      } while (this.match(','));
    }
    this.expect(')');
    return result;
  }
  private parseCall(): Statement {
    const s = this.expect('CALL'),
      name = this.expect('IDENTIFIER');
    const args = this.parseArguments();
    return {
      kind: 'CallStatement',
      name: name.value.toUpperCase(),
      arguments: args,
      line: s.line,
      column: s.column,
      endColumn: this.tokens[this.position - 1]!.endColumn,
    };
  }
  private parseReturn(): Statement {
    const s = this.expect('RETURN');
    const value = ['NEWLINE', 'EOF'].includes(this.current.type)
      ? null
      : this.parseExpression();
    return {
      kind: 'ReturnStatement',
      value,
      line: s.line,
      column: s.column,
      endColumn: value?.endColumn ?? s.endColumn,
    };
  }
  private parseFile(): Statement {
    const s = this.advance();
    const span = { line: s.line, column: s.column };
    if (s.type === 'OPENFILE') {
      const name = this.expect('STRING');
      this.expect('FOR');
      const mode = this.advance();
      if (!['READ', 'WRITE'].includes(mode.type))
        throw new PicoSyntaxError(
          'OPENFILE must use FOR READ or FOR WRITE.',
          mode.line,
          mode.column,
        );
      return {
        kind: 'FileStatement',
        operation: 'OPEN',
        name: name.value,
        mode: mode.type as 'READ' | 'WRITE',
        ...span,
        endColumn: mode.endColumn,
      };
    }
    if (s.type === 'CLOSEFILE') {
      const name = this.match('STRING');
      return {
        kind: 'FileStatement',
        operation: 'CLOSE',
        name: name?.value,
        ...span,
        endColumn: name?.endColumn ?? s.endColumn,
      };
    }
    // Named Cambridge forms and the previous implicit-open-file subset are accepted.
    let name: string | undefined;
    if (
      this.current.type === 'STRING' &&
      this.tokens[this.position + 1]?.type === ','
    ) {
      name = this.advance().value;
      this.expect(',');
    }
    if (s.type === 'READFILE') {
      const target = this.parseTarget();
      return {
        kind: 'FileStatement',
        operation: 'READ',
        name,
        target,
        ...span,
        endColumn: target.endColumn,
      };
    }
    const value = this.parseExpression();
    return {
      kind: 'FileStatement',
      operation: 'WRITE',
      name,
      value,
      ...span,
      endColumn: value.endColumn,
    };
  }
  private parseArguments(): Expression[] {
    if (!this.match('(')) return [];
    const args: Expression[] = [];
    if (!this.check(')')) {
      args.push(this.parseExpression());
      while (this.match(',')) args.push(this.parseExpression());
    }
    this.expect(')');
    return args;
  }
  private expectLineEnd() {
    if (this.current.type === 'NEWLINE') {
      this.advance();
      this.skipNewlines();
    } else if (this.current.type !== 'EOF')
      this.expect('NEWLINE', 'Put the body on the next line.');
  }
  private parseExpression(minimum = 0): Expression {
    let left = this.parseUnary();
    while (true) {
      const c = this.current,
        op =
          c.type === 'IDENTIFIER' &&
          ['DIV', 'MOD'].includes(c.value.toUpperCase())
            ? c.value.toUpperCase()
            : c.type,
        p = PRECEDENCE[op];
      if (p === undefined || p < minimum) break;
      this.advance();
      const right = this.parseExpression(p + (op === '^' ? 0 : 1));
      left = {
        kind: 'BinaryExpression',
        left,
        operator: op,
        right,
        line: left.line,
        column: left.column,
        endColumn: right.endColumn,
      };
    }
    return left;
  }
  private parseUnary(): Expression {
    if (this.current.type === 'NOT' || this.current.type === '-') {
      const t = this.advance(),
        operand = this.parseUnary();
      return {
        kind: 'UnaryExpression',
        operator: t.type as 'NOT' | '-',
        operand,
        line: t.line,
        column: t.column,
        endColumn: operand.endColumn,
      };
    }
    return this.parsePrimary();
  }
  private parsePrimary(): Expression {
    const t = this.current;
    if (this.match('NUMBER'))
      return {
        kind: 'NumberLiteral',
        value: Number(t.value),
        raw: t.value,
        line: t.line,
        column: t.column,
        endColumn: t.endColumn,
      };
    if (this.match('STRING') || this.match('CHAR_LITERAL'))
      return {
        kind: 'StringLiteral',
        dataType: t.type === 'CHAR_LITERAL' ? 'CHAR' : 'STRING',
        value: t.value,
        line: t.line,
        column: t.column,
        endColumn: t.endColumn,
      };
    if (this.match('TRUE') || this.match('FALSE'))
      return {
        kind: 'BooleanLiteral',
        value: t.type === 'TRUE',
        line: t.line,
        column: t.column,
        endColumn: t.endColumn,
      };
    if (this.match('(')) {
      const e = this.parseExpression();
      this.expect(')');
      return e;
    }
    if (this.current.type === 'IDENTIFIER') {
      const n = this.advance();
      if ((this.current as Token).type === '(') {
        const args = this.parseArguments();
        return {
          kind: 'CallExpression',
          name: n.value.toUpperCase(),
          arguments: args,
          line: n.line,
          column: n.column,
          endColumn: this.tokens[this.position - 1]!.endColumn,
        };
      }
      if (this.match('[')) {
        const indexes = [this.parseExpression()];
        while (this.match(',')) indexes.push(this.parseExpression());
        const e = this.expect(']');
        return {
          kind: 'ArrayAccess',
          name: n.value,
          indexes,
          line: n.line,
          column: n.column,
          endColumn: e.endColumn,
        };
      }
      return {
        kind: 'Variable',
        name: n.value,
        line: n.line,
        column: n.column,
        endColumn: n.endColumn,
      };
    }
    throw new PicoSyntaxError(
      `Expected a value; found “${t.value || t.type}”.`,
      t.line,
      t.column,
    );
  }
  private check(type: string) {
    return this.current.type === type;
  }

  private looksLikeKeywordTypo(): boolean {
    const next = this.tokens[this.position + 1];
    return next?.type !== 'ARROW' && next?.line === this.current.line;
  }

  private closestKeyword(word: string): string | null {
    const best = COMPLETIONS
      .map((candidate) => ({ candidate, distance: editDistance(word.toUpperCase(), candidate) }))
      .sort((a, b) => a.distance - b.distance)[0]!.candidate;
    const distance = editDistance(word.toUpperCase(), best);
    return distance <= Math.max(1, Math.ceil(word.length * 0.3)) ? best : null;
  }
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return row[b.length]!;
}
export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parse();
}

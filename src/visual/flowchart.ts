import type { Expression, Program, Statement, Target } from '../language/ast';
function cleanLabel(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '#quot;')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '&#124;');
}
function expressionText(e: Expression): string {
  switch (e.kind) {
    case 'NumberLiteral':
      return String(e.value);
    case 'StringLiteral':
      return JSON.stringify(e.value);
    case 'BooleanLiteral':
      return e.value ? 'TRUE' : 'FALSE';
    case 'Variable':
      return e.name;
    case 'ArrayAccess':
      return targetText(e);
    case 'UnaryExpression':
      return `${e.operator} (${expressionText(e.operand)})`;
    case 'BinaryExpression':
      return `(${expressionText(e.left)} ${e.operator} ${expressionText(e.right)})`;
    case 'CallExpression':
      return `${e.name}(${e.arguments.map(expressionText).join(', ')})`;
  }
}
function targetText(t: Target): string {
  return (
    t.name +
    (t.indexes.length ? `[${t.indexes.map(expressionText).join(', ')}]` : '')
  );
}
function statementLabel(s: Statement): string {
  switch (s.kind) {
    case 'Declaration':
      return `DECLARE ${s.name} : ${s.array ? `ARRAY[${s.array.bounds.map((b) => `${b.start}:${b.end}`).join(', ')}] OF ` : ''}${s.dataType}`;
    case 'Constant':
      return `CONSTANT ${s.name} ← ${expressionText(s.value)}`;
    case 'Assignment':
      return `${targetText(s.target)} ← ${expressionText(s.value)}`;
    case 'Input':
      return `INPUT ${targetText(s.target)}`;
    case 'Output':
      return `OUTPUT ${s.expressions.map(expressionText).join(', ')}`;
    case 'CallStatement':
      return `CALL ${s.name}(${s.arguments.map(expressionText).join(', ')})`;
    case 'ReturnStatement':
      return `RETURN ${s.value ? expressionText(s.value) : ''}`;
    case 'FileStatement':
      return `${s.operation}FILE ${s.name ? JSON.stringify(s.name) : ''}${s.target ? `, ${targetText(s.target)}` : ''}${s.value ? `, ${expressionText(s.value)}` : ''}`;
    case 'Procedure':
    case 'Function':
      return `${s.kind.toUpperCase()} ${s.name}`;
    default:
      return s.kind;
  }
}
export function toMermaid(program: Program): string {
  const lines = ['flowchart TD', '  start((START))'];
  let nextId = 0;
  type Edge = { id: string; label?: string };
  const node = (
    label: string,
    shape: 'box' | 'diamond' | 'round' = 'box',
  ): string => {
    const id = `n${++nextId}`,
      text = cleanLabel(label);
    lines.push(
      shape === 'diamond'
        ? `  ${id}{"${text}"}`
        : shape === 'round'
          ? `  ${id}(["${text}"])`
          : `  ${id}["${text}"]`,
    );
    return id;
  };
  const connect = (from: Edge, to: string) =>
    lines.push(
      `  ${from.id} -->${from.label ? `|"${cleanLabel(from.label)}"|` : ''} ${to}`,
    );
  const block = (statements: Statement[], initial: Edge[]): Edge[] => {
    let exits = initial;
    for (const s of statements) {
      if (s.kind === 'Procedure' || s.kind === 'Function') continue;
      if (!exits.length) break;
      if (s.kind === 'IfStatement') {
        const decision = node(`IF ${expressionText(s.condition)}?`, 'diamond');
        exits.forEach((e) => connect(e, decision));
        exits = [
          ...block(s.thenBody, [{ id: decision, label: 'Yes' }]),
          ...block(s.elseBody, [{ id: decision, label: 'No' }]),
        ];
      } else if (s.kind === 'CaseStatement') {
        const decision = node(
          `CASE OF ${expressionText(s.expression)}`,
          'diamond',
        );
        exits.forEach((e) => connect(e, decision));
        exits = s.branches.flatMap((branch) =>
          block(branch.body, [
            {
              id: decision,
              label: branch.selectors.map(expressionText).join(', '),
            },
          ]),
        );
        exits.push(
          ...block(s.otherwise, [{ id: decision, label: 'Otherwise' }]),
        );
      } else if (s.kind === 'RepeatStatement') {
        const entry = node('REPEAT', 'round');
        exits.forEach((e) => connect(e, entry));
        const body = block(s.body, [{ id: entry }]);
        if (body.length) {
          const condition = node(
            `UNTIL ${expressionText(s.condition)}?`,
            'diamond',
          );
          body.forEach((e) => connect(e, condition));
          connect({ id: condition, label: 'No' }, entry);
          exits = [{ id: condition, label: 'Yes' }];
        } else exits = [];
      } else if (s.kind === 'WhileStatement') {
        const decision = node(
          `WHILE ${expressionText(s.condition)}?`,
          'diamond',
        );
        exits.forEach((e) => connect(e, decision));
        block(s.body, [{ id: decision, label: 'Yes' }]).forEach((e) =>
          connect(e, decision),
        );
        exits = [{ id: decision, label: 'No' }];
      } else if (s.kind === 'ForStatement') {
        const init = node(`${s.name} ← ${expressionText(s.start)}`);
        exits.forEach((e) => connect(e, init));
        const step = s.step ? expressionText(s.step) : '1';
        const decision = node(
          `FOR ${s.name} within ${expressionText(s.start)} TO ${expressionText(s.end)} (STEP ${step})?`,
          'diamond',
        );
        connect({ id: init }, decision);
        const body = block(s.body, [{ id: decision, label: 'Yes' }]);
        if (body.length) {
          const increment = node(`${s.name} ← ${s.name} + (${step})`);
          body.forEach((e) => connect(e, increment));
          connect({ id: increment }, decision);
        }
        exits = [{ id: decision, label: 'No' }];
      } else {
        const action = node(statementLabel(s));
        exits.forEach((e) => connect(e, action));
        exits = s.kind === 'ReturnStatement' ? [] : [{ id: action }];
      }
    }
    return exits;
  };
  const exits = block(program.statements, [{ id: 'start' }]);
  const end = node('END', 'round');
  exits.forEach((e) => connect(e, end));
  // Definitions live in separate subgraphs, outside the main execution path.
  for (const routine of program.statements) {
    if (routine.kind !== 'Function' && routine.kind !== 'Procedure') continue;
    const id = `routine${++nextId}`;
    lines.push(`  subgraph ${id}["${cleanLabel(statementLabel(routine))}"]`);
    const entry = node(`${routine.name} entry`, 'round');
    const returned = block(routine.body, [{ id: entry }]);
    if (returned.length) {
      const exit = node('Return to caller', 'round');
      returned.forEach((e) => connect(e, exit));
    }
    lines.push('  end');
  }
  return lines.join('\n');
}

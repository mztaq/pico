import type { Program, Statement } from '../language/ast';

type Props = { program: Program; lines: string[]; activeLine?: number };
const branchKinds = new Set<Statement['kind']>([
  'IfStatement', 'WhileStatement', 'ForStatement', 'RepeatStatement', 'CaseStatement',
]);

/** A compact read-only flowchart of the actual parsed Pico program. */
export function FlowchartPreview({ program, lines, activeLine }: Props) {
  let rendered = 0;
  function label(statement: Statement): string {
    const text = lines[statement.line - 1]?.trim() || statement.kind;
    return text.length > 58 ? text.slice(0, 55) + '…' : text;
  }
  function arrow() { return <span className="suite-flow-arrow" aria-hidden="true">↓</span>; }
  function block(statement: Statement, depth: number) {
    if (rendered++ >= 65 || depth > 8) return null;
    const kind = statement.kind;
    const className = 'suite-flow-node ' +
      (kind === 'Input' || kind === 'Output' ? 'io' : branchKinds.has(kind) ? 'decision' : 'process') +
      (statement.line === activeLine ? ' selected' : '');
    const children: { name: string; statements: Statement[] }[] = [];
    switch (kind) {
      case 'IfStatement':
        children.push({ name: 'TRUE', statements: statement.thenBody });
        children.push({ name: 'FALSE', statements: statement.elseBody });
        break;
      case 'WhileStatement':
      case 'ForStatement':
      case 'RepeatStatement':
        children.push({ name: 'LOOP BODY', statements: statement.body });
        break;
      case 'CaseStatement':
        statement.branches.forEach((value, index) => {
          children.push({ name: 'CASE ' + (index + 1), statements: value.body });
        });
        if (statement.otherwise.length) children.push({ name: 'OTHERWISE', statements: statement.otherwise });
        break;
      case 'Procedure':
      case 'Function':
        children.push({ name: 'BODY', statements: statement.body });
        break;
      default: break;
    }
    return <div className="suite-flow-item" key={statement.line + '-' + rendered}>
      <div className={className} aria-label={kind + ': ' + label(statement)}><small>Line {statement.line}</small><span>{label(statement)}</span></div>
      {children.length > 0 && <div className={'suite-flow-branches' + (children.length === 1 ? ' single' : '')}>
        {children.map((child, index) => <div className="suite-flow-branch" key={child.name + index}>
          <span className="suite-flow-branch-label">{child.name}</span>
          {child.statements.length ? list(child.statements, depth + 1) : <span className="suite-flow-empty">No statements</span>}
        </div>)}
      </div>}
      {(kind === 'ForStatement' || kind === 'WhileStatement' || kind === 'RepeatStatement') &&
        <span className="suite-flow-loop">↶ Repeat while condition requires</span>}
    </div>;
  }
  function list(statements: Statement[], depth: number) {
    return <div className="suite-flow-chain">{statements.map((statement, index) => <div key={index}>
      {arrow()}{block(statement, depth)}
    </div>)}</div>;
  }
  return <div className="suite-flowchart" aria-label="Read-only pseudocode flowchart">
    <div className="suite-flow-node terminal">START</div>
    {list(program.statements, 0)}
    {arrow()}
    <div className="suite-flow-node terminal">END</div>
    {rendered >= 65 && <p className="suite-hint">Diagram shortened to 65 nodes for performance.</p>}
  </div>;
}

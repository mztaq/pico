import type { Program, Statement } from '../language/ast';
/** Structural markers and routine definitions are not executable instructions. */
export function executableLines(program: Program): number[] {
  const lines = new Set<number>();
  const visit = (statements: Statement[]) => {
    for (const s of statements) {
      if (s.kind !== 'Procedure' && s.kind !== 'Function') lines.add(s.line);
      if (s.kind === 'IfStatement') {
        visit(s.thenBody);
        visit(s.elseBody);
      } else if (s.kind === 'CaseStatement') {
        s.branches.forEach((b) => visit(b.body));
        visit(s.otherwise);
      } else if ('body' in s) visit(s.body);
    }
  };
  visit(program.statements);
  return [...lines].sort((a, b) => a - b);
}

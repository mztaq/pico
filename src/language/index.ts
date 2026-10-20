import type { Program, Token } from './ast';
import { tokenize } from './lexer';
import { parse } from './parser';
import { validate } from './semantic';
import { inferRuntimeInputs } from './autoDeclare';
export { compileToPython } from './python';
export { autoDeclareVariables, synchronizeAutoDeclarations } from './autoDeclare';
export type { AutoDeclarationSync } from './autoDeclare';
export interface Compilation { tokens: Token[]; ast: Program; }
export function compile(source: string, options: { autoDeclare?: boolean } = {}): Compilation {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  if (options.autoDeclare) ast.inferredInputs = inferRuntimeInputs(ast);
  validate(ast);
  return { tokens: tokens.filter(token => token.type !== 'NEWLINE' && token.type !== 'EOF'), ast };
}

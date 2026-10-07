import type { Program, Token } from './ast';
import { tokenize } from './lexer';
import { parse } from './parser';
import { validate } from './semantic';
<<<<<<< HEAD
=======
export { compileToPython } from './python';
>>>>>>> 66dc25c (Initial commit)
export { autoDeclareVariables, synchronizeAutoDeclarations } from './autoDeclare';
export type { AutoDeclarationSync } from './autoDeclare';
export interface Compilation { tokens: Token[]; ast: Program; }
export function compile(source: string): Compilation { const tokens = tokenize(source); const ast = parse(tokens); validate(ast); return { tokens: tokens.filter(token => token.type !== 'NEWLINE' && token.type !== 'EOF'), ast }; }

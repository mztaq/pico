import type { Program, Token } from './ast';
import { tokenize } from './lexer';
import { parse } from './parser';
export interface Compilation { tokens: Token[]; ast: Program; }
export function compile(source: string): Compilation { const tokens = tokenize(source); return { tokens: tokens.filter(token => token.type !== 'NEWLINE' && token.type !== 'EOF'), ast: parse(tokens) }; }

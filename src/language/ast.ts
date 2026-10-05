export interface SourceSpan { line: number; column: number; endColumn: number; }
export interface Token extends SourceSpan { type: string; value: string; }
export interface Program { kind: 'Program'; statements: Statement[]; }
export type DataType = 'INTEGER' | 'REAL' | 'CHAR' | 'STRING' | 'BOOLEAN';
export interface ArraySpec { bounds: { start: number; end: number }[]; dataType: DataType; }
export type Target = { name: string; indexes: Expression[]; line: number; column: number; endColumn: number };
export type Statement = Declaration | Constant | Assignment | Input | Output | IfStatement | WhileStatement | ForStatement | RepeatStatement | CaseStatement | Procedure | Function | CallStatement | ReturnStatement | FileStatement;
export interface Declaration extends SourceSpan { kind: 'Declaration'; name: string; dataType: DataType; array?: ArraySpec; }
export interface Constant extends SourceSpan { kind: 'Constant'; name: string; value: Expression; }
export interface Assignment extends SourceSpan { kind: 'Assignment'; target: Target; value: Expression; }
export interface Input extends SourceSpan { kind: 'Input'; target: Target; }
export interface Output extends SourceSpan { kind: 'Output'; expressions: Expression[]; }
export interface IfStatement extends SourceSpan { kind: 'IfStatement'; condition: Expression; thenBody: Statement[]; elseBody: Statement[]; }
export interface WhileStatement extends SourceSpan { kind: 'WhileStatement'; condition: Expression; body: Statement[]; }
export interface ForStatement extends SourceSpan { kind: 'ForStatement'; name: string; start: Expression; end: Expression; step: Expression | null; body: Statement[]; }
export interface RepeatStatement extends SourceSpan { kind: 'RepeatStatement'; body: Statement[]; condition: Expression; }
export interface CaseBranch { selectors: Expression[]; body: Statement[]; line: number; }
export interface CaseStatement extends SourceSpan { kind: 'CaseStatement'; expression: Expression; branches: CaseBranch[]; otherwise: Statement[]; }
export interface Parameter { name: string; dataType: DataType; }
export interface Procedure extends SourceSpan { kind: 'Procedure'; name: string; parameters: Parameter[]; body: Statement[]; }
export interface Function extends SourceSpan { kind: 'Function'; name: string; parameters: Parameter[]; returnType: DataType; body: Statement[]; }
export interface CallStatement extends SourceSpan { kind: 'CallStatement'; name: string; arguments: Expression[]; }
export interface ReturnStatement extends SourceSpan { kind: 'ReturnStatement'; value: Expression | null; }
export interface FileStatement extends SourceSpan { kind: 'FileStatement'; operation: 'OPEN' | 'READ' | 'WRITE' | 'CLOSE'; name?: string; mode?: 'READ' | 'WRITE'; target?: Target; value?: Expression; }
export type Expression = NumberLiteral | StringLiteral | BooleanLiteral | Variable | ArrayAccess | UnaryExpression | BinaryExpression | CallExpression;
export interface NumberLiteral extends SourceSpan { kind: 'NumberLiteral'; value: number; }
export interface StringLiteral extends SourceSpan { kind: 'StringLiteral'; value: string; dataType?: 'CHAR' | 'STRING'; }
export interface BooleanLiteral extends SourceSpan { kind: 'BooleanLiteral'; value: boolean; }
export interface Variable extends SourceSpan { kind: 'Variable'; name: string; }
export interface ArrayAccess extends SourceSpan { kind: 'ArrayAccess'; name: string; indexes: Expression[]; }
export interface UnaryExpression extends SourceSpan { kind: 'UnaryExpression'; operator: 'NOT' | '-'; operand: Expression; }
export interface BinaryExpression extends SourceSpan { kind: 'BinaryExpression'; left: Expression; operator: string; right: Expression; }
export interface CallExpression extends SourceSpan { kind: 'CallExpression'; name: string; arguments: Expression[]; }

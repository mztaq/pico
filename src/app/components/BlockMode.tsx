import { useEffect, useMemo, useRef, useState } from 'react';
import type { Expression, Statement } from '../../language/ast';
import { compile } from '../../language';
import '../styles/block-mode.css';

type BlockKind = 'declare' | 'constant' | 'assignment' | 'input' | 'output' | 'if' | 'while' | 'for' | 'repeat' | 'raw';
export interface BlockNode { id: string; kind: BlockKind; fields: Record<string, string>; children: BlockNode[]; elseChildren?: BlockNode[]; }
interface BlockModeProps { value: string; onChange: (code: string) => void; }
const labels: Record<BlockKind, string> = { declare: 'DECLARE', constant: 'CONSTANT', assignment: 'ASSIGN', input: 'INPUT', output: 'OUTPUT', if: 'IF / ELSE', while: 'WHILE', for: 'FOR', repeat: 'REPEAT', raw: 'ADVANCED' };
const palette: BlockKind[] = ['declare','constant','assignment','input','output','if','while','for','repeat'];
const uid = () => `block-${crypto.randomUUID()}`;
const field = (node: BlockNode, key: string, fallback = '') => node.fields[key] ?? fallback;

function expressionText(expression: Expression): string {
  switch (expression.kind) {
    case 'NumberLiteral': return String(expression.value);
    case 'StringLiteral': return JSON.stringify(expression.value);
    case 'BooleanLiteral': return expression.value ? 'TRUE' : 'FALSE';
    case 'Variable': return expression.name;
    case 'ArrayAccess': return `${expression.name}[${expression.indexes.map(expressionText).join(', ')}]`;
    case 'UnaryExpression': return `${expression.operator === 'NOT' ? 'NOT ' : '-'}${expressionText(expression.operand)}`;
    case 'BinaryExpression': return `${expressionText(expression.left)} ${expression.operator} ${expressionText(expression.right)}`;
    case 'CallExpression': return `${expression.name}(${expression.arguments.map(expressionText).join(', ')})`;
  }
}
function statementToBlock(statement: Statement, sourceLines: string[]): BlockNode {
  const base = (kind: BlockKind, fields: Record<string, string>, children: BlockNode[] = [], elseChildren?: BlockNode[]): BlockNode => ({ id: uid(), kind, fields, children, ...(elseChildren ? { elseChildren } : {}) });
  const nested = (items: Statement[]) => items.map(item => statementToBlock(item, sourceLines));
  switch (statement.kind) {
    case 'Declaration': return base('declare', { name: statement.name, type: statement.dataType });
    case 'Constant': return base('constant', { name: statement.name, value: expressionText(statement.value) });
    case 'Assignment': return base('assignment', { target: statement.target.name, value: expressionText(statement.value) });
    case 'Input': return base('input', { target: statement.target.name });
    case 'Output': return base('output', { value: statement.expressions.map(expressionText).join(', ') });
    case 'IfStatement': return base('if', { condition: expressionText(statement.condition) }, nested(statement.thenBody), nested(statement.elseBody));
    case 'WhileStatement': return base('while', { condition: expressionText(statement.condition) }, nested(statement.body));
    case 'ForStatement': return base('for', { name: statement.name, start: expressionText(statement.start), end: expressionText(statement.end), step: statement.step ? expressionText(statement.step) : '' }, nested(statement.body));
    case 'RepeatStatement': return base('repeat', { condition: expressionText(statement.condition) }, nested(statement.body));
    default: return base('raw', { code: sourceLines[Math.max(0, statement.line - 1)]?.trim() || `// ${statement.kind} — edit in CODE mode` });
  }
}
function parseBlocks(source: string): BlockNode[] {
  try { const result = compile(source); return result.ast ? result.ast.statements.map(statement => statementToBlock(statement, source.split(/\r?\n/))) : []; } catch { return []; }
}
function blockCode(node: BlockNode, depth = 0): string {
  const pad = '    '.repeat(depth); const f = (key: string, fallback = '') => field(node, key, fallback); const body = node.children.map(child => blockCode(child, depth + 1)).join('\n');
  switch (node.kind) {
    case 'declare': return `${pad}DECLARE ${f('name', 'Value')} : ${f('type', 'INTEGER')}`;
    case 'constant': return `${pad}CONSTANT ${f('name', 'Value')} ← ${f('value', '0')}`;
    case 'assignment': return `${pad}${f('target', 'Value')} ← ${f('value', '0')}`;
    case 'input': return `${pad}INPUT ${f('target', 'Value')}`;
    case 'output': return `${pad}OUTPUT ${f('value', 'Value')}`;
    case 'if': { const otherwise = (node.elseChildren ?? []).map(child => blockCode(child, depth + 1)).join('\n'); return `${pad}IF ${f('condition', 'TRUE')} THEN\n${body}${otherwise ? `\n${pad}ELSE\n${otherwise}` : ''}\n${pad}ENDIF`; }
    case 'while': return `${pad}WHILE ${f('condition', 'TRUE')} DO\n${body}\n${pad}ENDWHILE`;
    case 'for': return `${pad}FOR ${f('name', 'Counter')} ← ${f('start', '1')} TO ${f('end', '10')}${f('step') ? ` STEP ${f('step')}` : ''}\n${body}\n${pad}NEXT ${f('name', 'Counter')}`;
    case 'repeat': return `${pad}REPEAT\n${body}\n${pad}UNTIL ${f('condition', 'TRUE')}`;
    case 'raw': return `${pad}${f('code', '// Advanced statement — edit in CODE mode')}`;
  }
}
function blocksCode(blocks: BlockNode[]): string { return blocks.map(block => blockCode(block)).join('\n'); }
function makeBlock(kind: BlockKind): BlockNode { const defaults: Record<BlockKind, Record<string, string>> = { declare: { name: 'Value', type: 'INTEGER' }, constant: { name: 'Limit', value: '10' }, assignment: { target: 'Value', value: '0' }, input: { target: 'Value' }, output: { value: 'Value' }, if: { condition: 'Value = 0' }, while: { condition: 'Value < 10' }, for: { name: 'Counter', start: '1', end: '10', step: '' }, repeat: { condition: 'Value = 0' }, raw: { code: '// Edit this advanced statement in CODE mode' } }; return { id: uid(), kind, fields: defaults[kind], children: kind === 'if' || kind === 'while' || kind === 'for' || kind === 'repeat' ? [{ id: uid(), kind: 'output', fields: { value: '"Inside block"' }, children: [] }] : [], ...(kind === 'if' ? { elseChildren: [] } : {}) }; }

export function BlockMode({ value, onChange }: BlockModeProps) {
  const [blocks, setBlocks] = useState<BlockNode[]>(() => parseBlocks(value));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const lastEmitted = useRef(value);
  useEffect(() => { if (value !== lastEmitted.current) { setBlocks(parseBlocks(value)); lastEmitted.current = value; } }, [value]);
  const code = useMemo(() => blocksCode(blocks), [blocks]);
  function commit(next: BlockNode[]) { setBlocks(next); const nextCode = blocksCode(next); lastEmitted.current = nextCode; onChange(nextCode); }
  function update(id: string, key: string, nextValue: string) { commit(mapBlocks(blocks, id, block => ({ ...block, fields: { ...block.fields, [key]: nextValue } }))); }
  function add(kind: BlockKind) { commit([...blocks, makeBlock(kind)]); }
  function remove(id: string) { commit(removeBlock(blocks, id)); }
  function move(id: string, destination: 'root' | string) { if (id === destination) return; const pulled = takeBlock(blocks, id); if (!pulled) return; let next = pulled.rest; if (destination === 'root') next = [...next, pulled.block]; else next = insertChild(next, destination, pulled.block); commit(next); setDraggedId(null); }
  function insert(destination: string, child: BlockNode) { commit(insertChild(blocks, destination, child)); setDraggedId(null); }
  return <div className="block-mode" data-block-code={code}>
    <aside className="block-palette"><div className="block-palette-head"><strong>Blocks</strong><small>Drag into the canvas</small></div>{palette.map(kind => <button key={kind} className={`palette-block palette-${kind}`} draggable onDragStart={() => setDraggedId(`palette:${kind}`)} onDragEnd={() => setDraggedId(null)} onClick={() => add(kind)}><span className="palette-grip">⋮⋮</span>{labels[kind]}<span className="palette-plus">+</span></button>)}<div className="block-tip">Drop a block inside a control block to nest it. Click a palette block if dragging is inconvenient.</div></aside>
    <section className="block-canvas" onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedId?.startsWith('palette:')) add(draggedId.slice(8) as BlockKind); else if (draggedId) move(draggedId, 'root'); }}><div className="block-canvas-head"><div><strong>Block workspace</strong><small>Visual pseudocode · synced with CODE mode</small></div><span>{blocks.length} top-level block{blocks.length === 1 ? '' : 's'}</span></div>{blocks.length === 0 ? <div className="block-empty"><span>+</span><strong>Drop your first block here</strong><small>Start with DECLARE, INPUT, or OUTPUT.</small></div> : <div className="block-stack">{blocks.map(block => <BlockCard key={block.id} block={block} depth={0} draggedId={draggedId} setDraggedId={setDraggedId} update={update} remove={remove} move={move} insert={insert} />)}</div>}</section>
  </div>;
}
interface BlockCardProps { block: BlockNode; depth: number; draggedId: string | null; setDraggedId: (id: string | null) => void; update: (id: string, key: string, value: string) => void; remove: (id: string) => void; move: (id: string, destination: 'root' | string) => void; insert: (destination: string, child: BlockNode) => void; }
function BlockCard({ block, depth, draggedId, setDraggedId, update, remove, move, insert }: BlockCardProps) {
  const control = ['if','while','for','repeat'].includes(block.kind); const input = (key: string, placeholder: string) => <input value={field(block, key)} placeholder={placeholder} onChange={event => update(block.id, key, event.target.value)} onClick={event => event.stopPropagation()} />;
  return <div className={`block-card block-${block.kind} ${draggedId === block.id ? 'is-dragged' : ''}`} draggable onDragStart={event => { event.stopPropagation(); setDraggedId(block.id); }} onDragEnd={() => setDraggedId(null)} onDragOver={event => { if (control) event.preventDefault(); }} onDrop={event => { event.stopPropagation(); if (draggedId?.startsWith('palette:') && control) insert(block.id, makeBlock(draggedId.slice(8) as BlockKind)); else if (draggedId) move(draggedId, block.id); }}><div className="block-card-head"><span className="block-grip">⠿</span><b>{labels[block.kind]}</b><button onClick={() => remove(block.id)} aria-label={`Delete ${labels[block.kind]} block`}>×</button></div><div className="block-fields">{block.kind === 'declare' && <>Name {input('name','Value')} type <select value={field(block,'type','INTEGER')} onChange={event => update(block.id,'type',event.target.value)}><option>INTEGER</option><option>REAL</option><option>CHAR</option><option>STRING</option><option>BOOLEAN</option></select></>}{block.kind === 'constant' && <>Name {input('name','Limit')} value {input('value','10')}</>}{block.kind === 'assignment' && <>{input('target','Value')} ← {input('value','0')}</>}{block.kind === 'input' && <>INPUT {input('target','Value')}</>}{block.kind === 'output' && <>OUTPUT {input('value','Value')}</>}{block.kind === 'if' && <>IF {input('condition','Value = 0')} THEN</>}{block.kind === 'while' && <>WHILE {input('condition','Value < 10')} DO</>}{block.kind === 'for' && <>FOR {input('name','Counter')} ← {input('start','1')} TO {input('end','10')} {input('step','step (optional)')}</>}{block.kind === 'repeat' && <>REPEAT · UNTIL {input('condition','TRUE')}</>}{block.kind === 'raw' && <>{input('code','Advanced statement')}</>}</div>{control && <div className="block-nest" onDragOver={event => event.preventDefault()}><span>drop blocks here</span>{block.children.map(child => <BlockCard key={child.id} block={child} depth={depth + 1} draggedId={draggedId} setDraggedId={setDraggedId} update={update} remove={remove} move={move} insert={insert} />)}{block.kind === 'if' && <div className="block-else"><strong>ELSE</strong>{(block.elseChildren ?? []).map(child => <BlockCard key={child.id} block={child} depth={depth + 1} draggedId={draggedId} setDraggedId={setDraggedId} update={update} remove={remove} move={move} insert={insert} />)}</div>}</div>}</div>;
}
function mapBlocks(blocks: BlockNode[], id: string, fn: (block: BlockNode) => BlockNode): BlockNode[] { return blocks.map(block => block.id === id ? fn(block) : { ...block, children: mapBlocks(block.children, id, fn), elseChildren: block.elseChildren ? mapBlocks(block.elseChildren, id, fn) : undefined }); }
function removeBlock(blocks: BlockNode[], id: string): BlockNode[] { return blocks.filter(block => block.id !== id).map(block => ({ ...block, children: removeBlock(block.children, id), elseChildren: block.elseChildren ? removeBlock(block.elseChildren, id) : undefined })); }
function takeBlock(blocks: BlockNode[], id: string): { block: BlockNode; rest: BlockNode[] } | null { for (let i = 0; i < blocks.length; i++) { if (blocks[i]!.id === id) return { block: blocks[i]!, rest: [...blocks.slice(0, i), ...blocks.slice(i + 1)] }; const nested = takeBlock(blocks[i]!.children, id); if (nested) return { block: nested.block, rest: blocks.map((item, index) => index === i ? { ...item, children: nested.rest } : item) }; const other = blocks[i]!.elseChildren ? takeBlock(blocks[i]!.elseChildren!, id) : null; if (other) return { block: other.block, rest: blocks.map((item, index) => index === i ? { ...item, elseChildren: other.rest } : item) }; } return null; }
function insertChild(blocks: BlockNode[], destination: string, child: BlockNode): BlockNode[] { return blocks.map(block => block.id === destination ? { ...block, children: [...block.children, child] } : { ...block, children: insertChild(block.children, destination, child), elseChildren: block.elseChildren ? insertChild(block.elseChildren, destination, child) : undefined }); }

/** Read-only product examples built from Pico's real visual primitives and teaching models.
 * No imitation window chrome, fabricated status bars, or independent drawing language.
 */
import { HighlightedCode } from '../HighlightedCode';
import { starterCode } from '../../../starter';
import { blockShape } from '../../../flowchart/Canvas';
import { NODE_HEIGHT, NODE_WIDTH, type NodeKind } from '../../../flowchart/model';
import { CircuitSymbol } from '../../../logic/symbols';
import { BOXES, NORMAL_LAYOUT } from '../../../cpu/diagramModel';
import { assemble, DEFAULT_PROGRAM } from '../../../cpu/assembler';
import { boot } from '../../../cpu/engine';

function CodePreview({ language, code }: { language: 'pseudocode' | 'python'; code: string }) {
  const count = code.split('\n').length;
  return <div className="home-product-code">
    <div className="home-product-gutter" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
    <pre><HighlightedCode language={language} code={code} /></pre>
  </div>;
}

export function PseudocodePreview() {
  return <CodePreview language="pseudocode" code={starterCode} />;
}

export function PythonPreview() {
  return <CodePreview language="python" code={'name = input("What is your name? ")\nprint(f"Hello, {name}!")'} />;
}

/* The exact node paths come from the Flowchart Builder's Canvas component. */
const FLOW_NODES: { kind: NodeKind; x: number; label: string }[] = [
  { kind: 'start', x: 0, label: 'Start' },
  { kind: 'output', x: 252, label: 'OUTPUT "Hello"' },
  { kind: 'end', x: 504, label: 'End' },
];
export function FlowchartPreview() {
  return <svg className="home-product-flow" viewBox="0 0 712 132" role="presentation">
    <path className="home-product-flow-wire" d="M208 66H252M460 66H504" />
    {FLOW_NODES.map(node => <g key={node.kind} transform={`translate(${node.x} 20)`}>
      <path className="home-product-flow-node" d={blockShape(node.kind)} />
      <text x={NODE_WIDTH / 2} y={NODE_HEIGHT / 2 + 5} textAnchor="middle">{node.label}</text>
    </g>)}
  </svg>;
}

/* Render the same CircuitSymbol that Logic Sim uses on its actual circuit canvas. */
export function LogicPreview() {
  return <svg className="home-product-logic" viewBox="0 0 510 216" role="presentation">
    <g className="home-product-logic-wires" fill="none" strokeWidth="3">
      <path className="is-high" d="M122 42H160V90H190" />
      <path className="is-low" d="M122 174H160V126H190" />
      <path className="is-low" d="M312 108H380" />
    </g>
    <g transform="translate(0 0)"><CircuitSymbol kind="high" height={84} signal={1} /></g>
    <g transform="translate(0 132)"><CircuitSymbol kind="low" height={84} signal={0} /></g>
    <g transform="translate(190 66)"><CircuitSymbol kind="and" height={84} signal={0} /></g>
    <g transform="translate(380 66)"><CircuitSymbol kind="lamp" height={84} signal={0} /></g>
  </svg>;
}

/* Use the same diagram geometry and boot state as CPU Studio, not made-up registers. */
const INITIAL_CPU = boot(assemble(DEFAULT_PROGRAM));
const CPU_KEYS = new Set(['ACC', 'ALU', 'CIR', 'MAR', 'MDR', 'CU']);
export function CpuPreview() {
  return <svg className="home-product-cpu" viewBox="28 168 690 375" role="presentation">
    <g className="home-product-cpu-wires">
      <path d="M285 235 C301 235 301 247 315 247" />
      <path d="M285 350 C415 350 470 351 548 351" />
      <path d="M480 247 C527 247 510 341 548 341" />
      <path d="M480 248 C520 258 510 468 548 478" />
    </g>
    {BOXES.filter(box => CPU_KEYS.has(box.key)).map(box => {
      const geometry = NORMAL_LAYOUT[box.key] ?? box;
      const { x, y, w, h } = geometry;
      return <g key={box.key} className="home-product-cpu-block">
        <rect x={x} y={y} width={w} height={h} rx="5" />
        <title>{box.label}</title>
        <text className="home-product-cpu-label" x={x + w / 2} y={y + 25} textAnchor="middle">{box.key}</text>
        <text className="home-product-cpu-value" x={x + w / 2} y={y + h - 18} textAnchor="middle">{box.value(INITIAL_CPU)}</text>
      </g>;
    })}
  </svg>;
}

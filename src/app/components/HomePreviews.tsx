import { HighlightedCode } from './HighlightedCode';
import './home-previews.css';

export function PseudocodePreview() {
  return <div className="home-preview home-preview-code">
    <div className="home-preview-source">
      <span className="home-preview-label">SOURCE / .PICO</span>
      <pre><HighlightedCode code={'DECLARE Name : STRING\nINPUT Name\nOUTPUT "Hello ", Name, "!"'} /></pre>
    </div>
    <div className="home-preview-output"><span>EXECUTION / 01</span><strong>Hello, Pico!</strong></div>
  </div>;
}

export function PythonPreview() {
  return <div className="home-preview home-preview-code home-preview-python">
    <div className="home-preview-source">
      <span className="home-preview-label">SOURCE / .PY</span>
      <pre><HighlightedCode language="python" code={'name = input("Name: ")\nprint(f"Hello, {name}!")'} /></pre>
    </div>
    <div className="home-preview-output"><span>STDOUT / 01</span><strong>Hello, Pico!</strong></div>
  </div>;
}

export function FlowchartPreview() {
  return <div className="home-preview home-preview-lab home-preview-flow">
    <span className="home-preview-lab-label">CONTROL FLOW / 03 BLOCKS</span>
    <div className="home-flow-path" aria-hidden="true" />
    <div className="home-flow-node home-flow-start">Start</div>
    <div className="home-flow-node home-flow-output">OUTPUT "Hello!"</div>
    <div className="home-flow-node home-flow-end">End</div>
  </div>;
}

export function LogicPreview() {
  return <div className="home-preview home-preview-lab home-preview-logic">
    <span className="home-preview-lab-label">CIRCUIT / LIVE SIGNAL</span>
    <svg viewBox="0 0 350 90" aria-hidden="true"><path d="M 69 35 H 132 M 69 67 H 132 M 218 51 H 282" /></svg>
    <div className="home-logic-inputs"><span>1</span><span>1</span></div>
    <div className="home-logic-gate">AND</div>
    <div className="home-logic-output">1</div>
  </div>;
}

export function CpuPreview() {
  return <div className="home-preview home-preview-lab home-preview-cpu">
    <span className="home-preview-lab-label">FETCH → DECODE → EXECUTE</span>
    <div className="home-cpu-processor"><small>CPU</small><div><span>CU</span><span>ALU</span></div><b>PC / ACC</b></div>
    <div className="home-cpu-buses"><i /><i /><i /></div>
    <div className="home-cpu-memory"><small>RAM</small><span>0000&nbsp; 10100101</span><span>0001&nbsp; 00110010</span><span>0010&nbsp; 11001101</span></div>
  </div>;
}

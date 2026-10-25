import './home-scene.css';

/** Available before WebGL loads and whenever it is unsupported or reduced. */
export function HomeSceneFallback() {
  return <div className="home-scene-fallback" aria-hidden="true">
    <div className="home-fallback-board">
      <span className="home-fallback-core"><span>PICO<span className="brand-period">.</span></span><small>WORKBENCH</small></span>
      <span className="home-fallback-module home-fallback-pseudocode">PSEUDOCODE</span>
      <span className="home-fallback-module home-fallback-python">PYTHON</span>
      <span className="home-fallback-module home-fallback-flowchart">FLOWCHART</span>
      <span className="home-fallback-module home-fallback-logic">LOGIC</span>
      <span className="home-fallback-module home-fallback-cpu">CPU</span>
    </div>
  </div>;
}

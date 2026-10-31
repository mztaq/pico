import './workspace-loading.css';

export type VisualWorkspace = 'CPU Studio' | 'Logic Sim' | 'Flowchart Builder' | 'Binary Lab';

function Placeholder({ className = '' }: { className?: string }) {
  return <div className={`pico-load-shimmer ${className}`} />;
}

function LoadingTopbar() {
  return <div className="pico-load-topbar">
    <div className="pico-load-brand" aria-hidden="true">
      <Placeholder className="pico-load-mark" />
      <Placeholder className="pico-load-wordmark" />
      <span className="pico-load-separator" />
      <Placeholder className="pico-load-workspace-name" />
    </div>
    <div className="pico-load-top-actions" aria-hidden="true">
      <Placeholder className="pico-load-action" />
      <Placeholder className="pico-load-action pico-load-action-short" />
      <Placeholder className="pico-load-square" />
    </div>
  </div>;
}

function PaletteSkeleton({ logic = false }: { logic?: boolean }) {
  return <aside className="pico-load-palette">
    <Placeholder className="pico-load-section-title" />
    <div className="pico-load-block-list">
      {Array.from({ length: logic ? 7 : 6 }, (_, index) =>
        <div className="pico-load-block-row" key={index}>
          <Placeholder className="pico-load-block-icon" />
          <Placeholder className="pico-load-block-label" />
        </div>)}
    </div>
  </aside>;
}

function InspectorSkeleton() {
  return <aside className="pico-load-inspector">
    <Placeholder className="pico-load-section-title" />
    <Placeholder className="pico-load-inspector-line" />
    <Placeholder className="pico-load-inspector-line pico-load-inspector-line-short" />
    <Placeholder className="pico-load-inspector-field" />
    <Placeholder className="pico-load-inspector-field" />
  </aside>;
}

function CanvasSkeleton({ logic = false }: { logic?: boolean }) {
  return <div className="pico-load-canvas-area">
    <div className="pico-load-canvas-toolbar">
      <Placeholder className="pico-load-toolbar-label" />
      <div className="pico-load-toolbar-actions">
        <Placeholder className="pico-load-square" />
        <Placeholder className="pico-load-square" />
        <Placeholder className="pico-load-square" />
      </div>
    </div>
    <div className={logic ? 'pico-load-canvas pico-load-logic-board' : 'pico-load-canvas pico-load-flow-board'}>
      <div className="pico-load-canvas-nodes">
        <Placeholder className={logic ? 'pico-load-logic-gate' : 'pico-load-flow-node'} />
        <span className="pico-load-node-connector" />
        <Placeholder className={logic ? 'pico-load-logic-gate' : 'pico-load-flow-node'} />
        <span className="pico-load-node-connector" />
        <Placeholder className={logic ? 'pico-load-logic-gate' : 'pico-load-flow-node'} />
      </div>
    </div>
    {!logic && <div className="pico-load-dock"><Placeholder className="pico-load-toolbar-label" /><Placeholder className="pico-load-dock-line" /></div>}
  </div>;
}

function FlowchartSkeleton() {
  return <div className="pico-load-visual-grid pico-load-flowchart-grid">
    <PaletteSkeleton />
    <CanvasSkeleton />
    <InspectorSkeleton />
  </div>;
}

function LogicSkeleton() {
  return <>
    <div className="pico-load-logic-toolbar">
      {Array.from({ length: 7 }, (_, i) => <Placeholder className="pico-load-logic-tool" key={i} />)}
    </div>
    <div className="pico-load-visual-grid pico-load-logic-grid">
      <PaletteSkeleton logic />
      <CanvasSkeleton logic />
      <InspectorSkeleton />
    </div>
  </>;
}

function CpuSkeleton() {
  return <div className="pico-load-cpu-content">
    <div className="pico-load-cpu-controls">
      {Array.from({ length: 6 }, (_, i) => <Placeholder className="pico-load-cpu-control" key={i} />)}
    </div>
    <div className="pico-load-cpu-figure">
      <div className="pico-load-cpu-registers">
        <Placeholder className="pico-load-cpu-unit pico-load-cpu-wide" />
        <div className="pico-load-cpu-unit-row">
          <Placeholder className="pico-load-cpu-unit" />
          <Placeholder className="pico-load-cpu-unit" />
        </div>
        <div className="pico-load-cpu-unit-row">
          <Placeholder className="pico-load-cpu-unit" />
          <Placeholder className="pico-load-cpu-unit" />
        </div>
        <Placeholder className="pico-load-cpu-unit pico-load-cpu-wide" />
      </div>
      <div className="pico-load-cpu-memory">
        <Placeholder className="pico-load-section-title" />
        {Array.from({ length: 7 }, (_, i) => <Placeholder className="pico-load-cpu-memory-row" key={i} />)}
      </div>
    </div>
    <div className="pico-load-cpu-info"><Placeholder className="pico-load-inspector-line" /><Placeholder className="pico-load-inspector-line pico-load-inspector-line-short" /></div>
  </div>;
}

function BinarySkeleton() {
  return <div className="pico-load-binary-content">
    <div className="pico-load-binary-intro">
      <div className="pico-load-binary-intro-text"><Placeholder className="pico-load-binary-title" /><Placeholder className="pico-load-binary-description" /></div>
      <Placeholder className="pico-load-binary-badge" />
    </div>
    <section className="pico-load-binary-panel">
      <Placeholder className="pico-load-section-title" />
      <div className="pico-load-bits">
        {Array.from({ length: 8 }, (_, i) => <div className="pico-load-bit-column" key={i}><Placeholder className="pico-load-bit-caption" /><Placeholder className="pico-load-bit" /><Placeholder className="pico-load-bit-caption" /></div>)}
      </div>
      <div className="pico-load-binary-pills">
        {Array.from({ length: 4 }, (_, i) => <Placeholder className="pico-load-binary-pill" key={i} />)}
      </div>
    </section>
    <section className="pico-load-binary-panel">
      <Placeholder className="pico-load-section-title" />
      <div className="pico-load-values">
        {Array.from({ length: 3 }, (_, i) => <div className="pico-load-value-card" key={i}><Placeholder className="pico-load-bit-caption" /><Placeholder className="pico-load-value-field" /></div>)}
      </div>
    </section>
  </div>;
}

/** Visible only while React.lazy is fetching the workspace. No artificial delay. */
export function WorkspaceLoading({ workspace }: { workspace: VisualWorkspace }) {
  return <div className="pico-load-stage" data-loading-workspace={workspace} role="status" aria-live="polite" aria-label={`Opening ${workspace}`}>
    <span className="pico-load-screenreader">Opening {workspace}…</span>
    <div className="pico-load-layout" aria-hidden="true">
      <LoadingTopbar />
      {workspace === 'Flowchart Builder' ? <FlowchartSkeleton /> :
       workspace === 'Logic Sim' ? <LogicSkeleton /> :
       workspace === 'CPU Studio' ? <CpuSkeleton /> :
       <BinarySkeleton />}
    </div>
  </div>;
}

import './workspace-loading.css';
import { readSavedTrafficAlias } from '../../traffic/traffic-alias';

export type VisualWorkspace = 'CPU Studio' | 'Logic Sim' | 'Flowchart Builder' | 'Binary Lab' | 'Traffic Storm';

function Placeholder({ className = '' }: { className?: string }) {
  return <div className={`pico-load-shimmer ${className}`} />;
}

function LoadingTopbar() {
  return <div className="pico-load-topbar">
    <div className="pico-load-brand" aria-hidden="true">
      <Placeholder className="pico-load-mark" />
      <Placeholder className="pico-load-wordmark" />
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

function TrafficStormSkeleton() {
  return <div className="pico-load-storm-content">
    <div className="pico-load-storm-entry">
      <Placeholder className="pico-load-storm-heading" />
      <Placeholder className="pico-load-storm-label" />
      <Placeholder className="pico-load-storm-input" />
      <div className="pico-load-storm-helper">
        <Placeholder className="pico-load-storm-hint" />
        <Placeholder className="pico-load-storm-counter" />
      </div>
      <Placeholder className="pico-load-storm-button" />
    </div>
  </div>;
}

/** Matches the network dashboard shown after a returning visitor's saved alias loads. */
function TrafficStormDiagramSkeleton() {
  const lanes = [88, 165, 242, 319];
  return <div className="pico-load-storm-dashboard">
    <div className="pico-load-storm-dashboard-heading">
      <Placeholder className="pico-load-storm-dashboard-title"/>
      <div className="pico-load-storm-dashboard-actions">
        <Placeholder className="pico-load-storm-dashboard-action"/>
        <Placeholder className="pico-load-storm-dashboard-action"/>
      </div>
    </div>
    <div className="pico-load-storm-dashboard-toolbar">
      <Placeholder className="pico-load-storm-dashboard-control"/>
      <Placeholder className="pico-load-storm-dashboard-control"/>
      <Placeholder className="pico-load-storm-dashboard-slider"/>
    </div>
    <div className="pico-load-storm-dashboard-metrics">
      {lanes.map((_, index) => <div key={index} className="pico-load-storm-dashboard-metric">
        <Placeholder className="pico-load-storm-dashboard-metric-label"/>
        <Placeholder className="pico-load-storm-dashboard-metric-value"/>
      </div>)}
    </div>
    <div className="pico-load-storm-dashboard-main">
      <section className="pico-load-storm-dashboard-panel pico-load-storm-dashboard-network">
        <Placeholder className="pico-load-storm-dashboard-section-title"/>
        <svg viewBox="0 0 1200 405" preserveAspectRatio="xMidYMid meet" className="pico-load-storm-dashboard-svg" aria-hidden="true">
          {lanes.map((y,index)=><g key={'lane-'+index}>
            <path d={'M 220 215 C 285 215 303 '+y+' 348 '+y} className="pico-load-storm-skeleton-route"/>
            <path d={'M 456 '+y+' C 620 '+y+' 760 206 974 206'} className="pico-load-storm-skeleton-route"/>
          </g>)}
          <rect x="67" y="153" width="150" height="124" rx="15" className="pico-load-storm-skeleton-node"/>
          <circle cx="142" cy="215" r="35" className="pico-load-storm-skeleton-node-core"/>
          {lanes.map(y => <rect key={'bot-'+y} x="348" y={y-26} width="108" height="52" rx="10" className="pico-load-storm-skeleton-node"/>)}
          <rect x="974" y="165" width="170" height="82" rx="11" className="pico-load-storm-skeleton-node"/>
          <rect x="995" y="180" width="130" height="12" rx="4" className="pico-load-storm-skeleton-node-core"/>
          <rect x="995" y="201" width="130" height="12" rx="4" className="pico-load-storm-skeleton-node-core"/>
          <rect x="995" y="222" width="130" height="12" rx="4" className="pico-load-storm-skeleton-node-core"/>
        </svg>
      </section>
      <section className="pico-load-storm-dashboard-panel pico-load-storm-dashboard-side">
        <Placeholder className="pico-load-storm-dashboard-section-title"/>
        <Placeholder className="pico-load-storm-dashboard-side-line"/>
        <Placeholder className="pico-load-storm-dashboard-side-line pico-load-storm-dashboard-side-short"/>
        <Placeholder className="pico-load-storm-dashboard-side-meter"/>
        <Placeholder className="pico-load-storm-dashboard-side-chart"/>
      </section>
    </div>
  </div>;
}

/** Visible only while React.lazy is fetching the workspace. No artificial delay. */
export function WorkspaceLoading({ workspace }: { workspace: VisualWorkspace }) {
  const returningToStorm = workspace === 'Traffic Storm' && readSavedTrafficAlias() !== null;
  return <div className="pico-load-stage" data-loading-workspace={workspace} data-storm-loading={workspace === 'Traffic Storm' ? (returningToStorm ? 'dashboard' : 'alias') : undefined} role="status" aria-live="polite" aria-label={`Opening ${workspace}`}>
    <span className="pico-load-screenreader">Opening {workspace}…</span>
    <div className="pico-load-layout" aria-hidden="true">
      <LoadingTopbar />
      {workspace === 'Flowchart Builder' ? <FlowchartSkeleton /> :
       workspace === 'Logic Sim' ? <LogicSkeleton /> :
       workspace === 'CPU Studio' ? <CpuSkeleton /> :
       workspace === 'Traffic Storm' ? (returningToStorm ? <TrafficStormDiagramSkeleton /> : <TrafficStormSkeleton />) :
       <BinarySkeleton />}
    </div>
  </div>;
}

function HomeCardSkeleton() {
  return <div className="pico-load-home-card">
    <div className="pico-load-home-card-stage">
      <Placeholder className="pico-load-home-stage-detail" />
      <Placeholder className="pico-load-home-stage-detail pico-load-home-stage-short" />
    </div>
    <div className="pico-load-home-card-info">
      <div className="pico-load-home-card-heading">
        <Placeholder className="pico-load-home-card-icon" />
        <Placeholder className="pico-load-home-card-title" />
      </div>
      <Placeholder className="pico-load-home-card-description" />
      <Placeholder className="pico-load-home-card-description pico-load-home-description-short" />
    </div>
  </div>;
}

function HomeSectionSkeleton({ kind, count }: { kind: 'code' | 'visual' | 'data'; count: number }) {
  return <section className={`pico-load-home-section pico-load-home-section--${kind}`}>
    <div className="pico-load-home-section-heading">
      <Placeholder className="pico-load-home-section-title" />
      <Placeholder className="pico-load-home-section-detail" />
    </div>
    <div className="pico-load-home-grid">
      {Array.from({ length: count }, (_, index) => <HomeCardSkeleton key={index} />)}
    </div>
  </section>;
}

/** Matches the /app workspace selector while its lazy App module is being fetched. */
export function HomeLoading() {
  return <div className="pico-load-stage pico-load-home-stage" data-loading-workspace="Home" role="status" aria-live="polite" aria-label="Opening Pico home">
    <span className="pico-load-screenreader">Opening Pico home…</span>
    <div className="pico-load-home-layout" aria-hidden="true">
      <div className="pico-load-home-nav">
        <Placeholder className="pico-load-home-nav-theme" />
        <div className="pico-load-home-nav-actions"><Placeholder className="pico-load-home-nav-action" /><Placeholder className="pico-load-home-nav-action" /><Placeholder className="pico-load-home-nav-action" /></div>
      </div>
      <div className="pico-load-home-inner">
        <div className="pico-load-home-hero">
          <div className="pico-load-home-brand"><Placeholder className="pico-load-home-logo" /><Placeholder className="pico-load-home-wordmark" /></div>
          <Placeholder className="pico-load-home-heading" />
        </div>
        <div className="pico-load-home-groups">
          <HomeSectionSkeleton kind="code" count={2} />
          <HomeSectionSkeleton kind="visual" count={4} />
          <HomeSectionSkeleton kind="data" count={1} />
        </div>
        <div className="pico-load-home-footer"><Placeholder className="pico-load-home-footer-item" /><Placeholder className="pico-load-home-footer-item" /><Placeholder className="pico-load-home-footer-item" /></div>
      </div>
    </div>
  </div>;
}

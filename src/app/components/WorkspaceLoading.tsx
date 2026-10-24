import './workspace-loading.css';

const presets = {
  'CPU Studio': { label: 'Initializing CPU Studio', steps: ['FETCH', 'DECODE', 'EXECUTE'], icon: 'CPU' },
  'Logic Sim': { label: 'Preparing Logic Sim', steps: ['INPUT', 'GATES', 'OUTPUT'], icon: 'AND' },
  'Flowchart Builder': { label: 'Opening Flowchart Builder', steps: ['START', 'PROCESS', 'END'], icon: 'FLOW' },
} as const;

/** Presentation-only. This does not pretend to report actual download progress. */
export function WorkspaceLoading({ workspace }: { workspace: keyof typeof presets }) {
  const item = presets[workspace];
  return (
    <div className="pico-load-stage" role="status" aria-live="polite" aria-label={item.label}>
      <div className="pico-load-visual" aria-hidden="true">
        <div className="pico-load-mark">{item.icon}</div>
        <div className="pico-load-rail">
          {item.steps.map((step, index) => (
            <div className="pico-load-node" key={step} style={{ animationDelay: `${index * 190}ms` }}>
              <span className="pico-load-led" />
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="pico-load-progress"><span /></div>
      </div>
      <p className="pico-load-title">{item.label}<span className="pico-load-dots" aria-hidden="true">...</span></p>
      <p className="pico-load-subtitle">Setting up your workspace</p>
    </div>
  );
}

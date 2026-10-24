import './workspace-loading.css';

const labels = {
  'CPU Studio': 'CPU Studio',
  'Logic Sim': 'Logic Sim',
  'Flowchart Builder': 'Flowchart Builder',
} as const;

/** Clean, indeterminate animation: no simulated or misleading progress percentage. */
export function WorkspaceLoading({ workspace }: { workspace: keyof typeof labels }) {
  return (
    <div className="pico-load-stage" role="status" aria-live="polite" aria-label={`Opening ${labels[workspace]}`}>
      <div className="pico-load-content">
        <div className="pico-load-icon" aria-hidden="true"><img src="/pico-logo.svg" alt="" /></div>
        <div className="pico-load-title">Pico<span>.</span></div>
        <div className="pico-load-bar" aria-hidden="true"><div /></div>
        <p className="pico-load-description">Opening {labels[workspace]}</p>
      </div>
    </div>
  );
}

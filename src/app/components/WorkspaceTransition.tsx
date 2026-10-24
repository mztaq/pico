import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { WorkspaceLoading } from './WorkspaceLoading';

const MINIMUM_DISPLAY_MS = 700;

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

/**
 * Begin downloading and mounting immediately, but keep the loading screen
 * visible for a short, intentional moment rather than flashing for one frame.
 * Never hide the loader before the workspace has actually mounted.
 */
export function WorkspaceTransition({
  workspace, children,
}: { workspace: 'CPU Studio' | 'Logic Sim' | 'Flowchart Builder'; children: ReactNode }) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), MINIMUM_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const showWorkspace = minimumElapsed && workspaceReady;
  return (
    <div className="pico-transition-shell">
      {!showWorkspace && <WorkspaceLoading workspace={workspace} />}
      <div className="pico-transition-content" style={{ visibility: showWorkspace ? 'visible' : 'hidden' }} aria-hidden={!showWorkspace}>
        <Suspense fallback={null}>
          <ReadySignal onReady={() => setWorkspaceReady(true)} />
          {children}
        </Suspense>
      </div>
    </div>
  );
}

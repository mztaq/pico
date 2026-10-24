import { Suspense, type ReactNode } from 'react';
import { WorkspaceLoading } from './WorkspaceLoading';

/**
 * Suspense displays the loader only while a workspace's lazy module is pending.
 * React.lazy caches the resolved module, so returning to an already loaded
 * workspace does not trigger another loading screen or artificial delay.
 */
export function WorkspaceTransition({
  workspace, children,
}: { workspace: 'CPU Studio' | 'Logic Sim' | 'Flowchart Builder'; children: ReactNode }) {
  return <Suspense fallback={<WorkspaceLoading workspace={workspace} />}>{children}</Suspense>;
}

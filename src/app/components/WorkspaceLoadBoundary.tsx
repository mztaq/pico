import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; workspace: string };
type State = { failed: boolean };

/** Chunk loading failures can happen on a stale tab after a deployment or offline. */
export class WorkspaceLoadBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="pico-load-error" role="main">
        <h1>Unable to load {this.props.workspace}</h1>
        <p>Check your connection or reload Pico to download the latest workspace files. Your saved projects remain in this browser.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload Pico</button>
      </main>
    );
  }
}

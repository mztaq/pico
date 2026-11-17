import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; workspace: string };
type State = { failed: boolean; message: string | null };

/** Catch both lazy-chunk failures and exceptions raised inside a loaded workspace. */
export class WorkspaceLoadBoundary extends Component<Props, State> {
  state: State = { failed: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      failed: true,
      message: error instanceof Error ? error.message.slice(0, 320) : String(error).slice(0, 320),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In DevTools this includes the actual error, stack and failing component.
    // The UI previously hid the cause and made runtime crashes impossible to diagnose.
    console.error('[Pico] ' + this.props.workspace + ' failed to render:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    const diagnosticVisible = typeof location !== 'undefined' &&
      (location.hostname === 'localhost' ||
        location.hostname.startsWith('feature-pico-learning-suite.'));
    return (
      <main className="pico-load-error" role="main">
        <h1>Unable to load {this.props.workspace}</h1>
        <p>The workspace encountered an error. Reload the page to try again.</p>
        {diagnosticVisible && this.state.message &&
          <p role="alert" className="pico-load-error-detail">
            Error: <code>{this.state.message}</code>
          </p>}
        <button type="button" onClick={() => window.location.reload()}>Reload Pico</button>
      </main>
    );
  }
}

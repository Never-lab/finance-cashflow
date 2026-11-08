/**
 * Catches render errors in lazy tabs so one broken chart/tab does not blank the shell.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", this.props.label ?? "tab", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel">
          <p className="error" role="alert">
            Errore in {this.props.label ?? "questa sezione"}.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => this.setState({ error: null })}
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

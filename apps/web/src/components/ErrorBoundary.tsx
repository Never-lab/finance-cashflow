/**
 * Catches render errors in lazy tabs so one broken chart/tab does not blank the shell.
 * After deploy, stale tabs may fail dynamic imports → one automatic reload.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadOnceForChunkError } from "../lib/lazyReload";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", this.props.label ?? "tab", error, info.componentStack);
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }

  render() {
    if (this.state.error) {
      const chunk = isChunkLoadError(this.state.error);
      return (
        <div className="panel">
          <p className="error" role="alert">
            {chunk
              ? "Aggiornamento in corso: ricarica la pagina per i nuovi file."
              : `Errore in ${this.props.label ?? "questa sezione"}.`}
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (chunk) {
                window.location.reload();
                return;
              }
              this.setState({ error: null });
            }}
          >
            {chunk ? "Ricarica" : "Riprova"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

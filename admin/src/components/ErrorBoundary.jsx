import { Component } from "react";

/* A dynamic import fails with one of these when the deployed bundle changed and
   the old hashed chunk files no longer exist (every redeploy invalidates them). */
const CHUNK_ERR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Loading chunk [\d]+ failed/i;
const RELOAD_KEY = "yn_admin_chunk_reload_at";

/** One guarded hard reload fetches the fresh index.html + chunks after a
 *  redeploy. The sessionStorage timestamp stops a broken build from looping.
 *  Returns true when a reload was triggered (caller should render nothing). */
export function recoverFromChunkError(err) {
  const msg = String((err && (err.message || err)) || "");
  if (!CHUNK_ERR.test(msg)) return false;
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  if (Date.now() - last < 60000) return false;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

/**
 * Catches render errors anywhere below it so a bug in one page shows a friendly
 * recovery card instead of unmounting the whole app (white screen). Passing a
 * `resetKey` (e.g. the route path) clears the error when the user navigates.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[admin] render error:", error, info && info.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (recoverFromChunkError(error)) return null; // reloading with fresh assets

    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 460, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h2>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>
            This page hit an unexpected error. Your saved data is safe — reload to continue.
          </p>
          <div className="mono muted" style={{ fontSize: 12, margin: "10px 0 16px", wordBreak: "break-word" }}>
            {String(error.message || error)}
          </div>
          <div className="hstack" style={{ justifyContent: "center", gap: 8 }}>
            <button className="btn primary" onClick={() => window.location.reload()}>Reload page</button>
            <button className="btn ghost" onClick={() => { window.location.href = "/"; }}>Go to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }
}

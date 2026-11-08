/**
 * Vite chunk mismatch after deploy: old index imports hashed files that no longer
 * exist. Server used to SPA-fallback those as text/html → dynamic import throws.
 * One hard reload usually picks up the new index.html.
 */
const RELOAD_KEY = "cashflow-chunk-reload";

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Failed to fetch dynamically|Loading chunk|Importing a module script failed|MIME/i.test(
    msg,
  );
}

/** Reload once per tab session; returns true if reload was triggered. */
export function reloadOnceForChunkError(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    /* private mode — still try reload */
  }
  window.location.reload();
  return true;
}

/** Clear flag after a successful boot so a future deploy can recover again. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

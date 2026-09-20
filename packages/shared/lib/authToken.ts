/**
 * Token Bearer in sessionStorage e wrapper `fetch` per API finance (dashboard → backend).
 *
 * Non tocca SQLite: solo autenticazione HTTP lato browser; logout su 401 via evento custom.
 */
const TOKEN_KEY = "finance-token";

/** @returns Token salvato o null se non autenticato */
export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Persiste o rimuove il token di sessione. @param token - JWT/null per logout */
export function setAuthToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

/** Rimuove il token (alias di setAuthToken(null)). */
export function clearAuthToken(): void {
  setAuthToken(null);
}

/**
 * fetch con Authorization Bearer e Content-Type JSON; su 401 pulisce token e emette `finance-auth-logout`.
 * @param input - URL relativo o assoluto
 * @param init - Opzioni Request standard
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && getAuthToken()) {
    clearAuthToken();
    window.dispatchEvent(new Event("finance-auth-logout"));
  }
  return res;
}

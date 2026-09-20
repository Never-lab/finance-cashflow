/**
 * Schermata di accesso quando il server richiede autenticazione: login o registrazione
 * con token JWT salvato localmente; al successo richiama il boot dell'app.
 */
import { useState } from "react";
import { api } from "../api";

type Props = {
  onSuccess: () => void;
};

type Mode = "login" | "register";

export function LoginScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirmPassword("");
  }

  /** Invia credenziali a login/register API e, se ok, riavvia il boot applicativo. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await api.login(username.trim(), password);
      } else {
        await api.register(username.trim(), password);
      }
      onSuccess();
    } catch (err) {
      if (mode === "login") {
        setError("Credenziali non valide");
      } else {
        setError(err instanceof Error ? err.message : "Registrazione fallita");
      }
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="login-screen">
      <div className="login-card panel">
        <p className="brand login-brand">Cash Flow</p>
        <p className="muted login-sub">
          {isRegister ? "Crea un nuovo account" : "Accedi al monitoring plane"}
        </p>
        <form onSubmit={(e) => void submit(e)} className="login-form">
          <label className="field">
            Username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {isRegister && (
            <label className="field">
              Conferma password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary login-submit" disabled={busy}>
            {busy ? (isRegister ? "Registrazione…" : "Accesso…") : isRegister ? "Registrati" : "Accedi"}
          </button>
        </form>
        <p className="muted login-toggle">
          {isRegister ? (
            <>
              Hai già un account?{" "}
              <button type="button" className="link-btn" onClick={() => switchMode("login")}>
                Accedi
              </button>
            </>
          ) : (
            <>
              Non hai un account?{" "}
              <button type="button" className="link-btn" onClick={() => switchMode("register")}>
                Registrati
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

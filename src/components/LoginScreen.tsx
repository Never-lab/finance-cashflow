import { useState } from "react";
import { api } from "../api";

type Props = {
  onSuccess: () => void;
};

export function LoginScreen({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login(username.trim(), password);
      onSuccess();
    } catch {
      setError("Credenziali non valide");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card panel">
        <p className="brand login-brand">Cash Flow</p>
        <p className="muted login-sub">Accedi al monitoring plane</p>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary login-submit" disabled={busy}>
            {busy ? "Accesso…" : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}

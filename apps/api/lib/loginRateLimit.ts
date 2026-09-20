/**
 * Rate limiting in-memory per tentativi login/registrazione (per IP).
 * Ruolo: auth — bucket in processo (non distribuito tra istanze).
 * Privacy: traccia solo IP/contatore, non username.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Incrementa contatore tentativi per IP; restituisce false se limite superato.
 */
export function checkLoginRateLimit(ip: string, now = Date.now()): boolean {
  const key = ip || "unknown";
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  if (bucket.count >= MAX_ATTEMPTS) return false;
  bucket.count += 1;
  return true;
}

/** Svuota bucket (test). */
export function resetLoginRateLimitForTests(): void {
  buckets.clear();
}

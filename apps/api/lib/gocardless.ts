/**
 * Minimal GoCardless Bank Account Data (AIS) client — no SDK.
 * Base: https://bankaccountdata.gocardless.com
 */
import type { OpenBankingBookedTx } from "@shared/lib/mapOpenBankingTx";

const BASE = "https://bankaccountdata.gocardless.com/api/v2";

type TokenCache = { access: string; refresh: string; accessExpiresAt: number };
let tokenCache: TokenCache | null = null;

export function isGoCardlessConfigured(): boolean {
  return Boolean(process.env.GOCARDLESS_SECRET_ID?.trim() && process.env.GOCARDLESS_SECRET_KEY?.trim());
}

function secrets(): { secretId: string; secretKey: string } {
  const secretId = process.env.GOCARDLESS_SECRET_ID?.trim() ?? "";
  const secretKey = process.env.GOCARDLESS_SECRET_KEY?.trim() ?? "";
  if (!secretId || !secretKey) {
    throw new Error("GoCardless non configurato (GOCARDLESS_SECRET_ID / GOCARDLESS_SECRET_KEY)");
  }
  return { secretId, secretKey };
}

export function getBankSyncRedirectUrl(): string {
  const url = process.env.BANK_SYNC_REDIRECT_URL?.trim();
  if (!url) {
    throw new Error("BANK_SYNC_REDIRECT_URL mancante (callback pubblico, es. https://host/api/bank-sync/callback)");
  }
  return url;
}

async function gcFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GoCardless ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function obtainTokens(): Promise<TokenCache> {
  const { secretId, secretKey } = secrets();
  const fresh = await gcFetch<{
    access: string;
    access_expires: number;
    refresh: string;
    refresh_expires: number;
  }>("/token/new/", {
    method: "POST",
    body: { secret_id: secretId, secret_key: secretKey },
  });
  tokenCache = {
    access: fresh.access,
    refresh: fresh.refresh,
    accessExpiresAt: Date.now() + Math.max(30, fresh.access_expires - 60) * 1000,
  };
  return tokenCache;
}

async function refreshAccess(refresh: string): Promise<TokenCache> {
  const fresh = await gcFetch<{ access: string; access_expires: number; refresh?: string }>(
    "/token/refresh/",
    { method: "POST", body: { refresh } },
  );
  tokenCache = {
    access: fresh.access,
    refresh: fresh.refresh || refresh,
    accessExpiresAt: Date.now() + Math.max(30, fresh.access_expires - 60) * 1000,
  };
  return tokenCache;
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.accessExpiresAt) {
    return tokenCache.access;
  }
  if (tokenCache?.refresh) {
    try {
      return (await refreshAccess(tokenCache.refresh)).access;
    } catch {
      /* fall through to new pair */
    }
  }
  return (await obtainTokens()).access;
}

type Institution = { id: string; name: string };

/** Resolve institution id: env override, else search by name (IT, then GB for Revolut). */
export async function resolveInstitutionId(
  source: "mediolanum" | "revolut",
): Promise<string> {
  const envKey =
    source === "mediolanum"
      ? process.env.GOCARDLESS_INSTITUTION_MEDIOLANUM
      : process.env.GOCARDLESS_INSTITUTION_REVOLUT;
  if (envKey?.trim()) return envKey.trim();

  const token = await getAccessToken();
  const hint = source === "mediolanum" ? /mediolanum/i : /revolut/i;
  const countries = source === "revolut" ? ["it", "gb"] : ["it"];

  for (const country of countries) {
    const list = await gcFetch<Institution[]>(`/institutions/?country=${country}`, { token });
    const hit = list.find((i) => hint.test(i.name) || hint.test(i.id));
    if (hit) return hit.id;
  }

  // Common GoCardless id when Revolut only appears under GB
  if (source === "revolut") return "REVOLUT_REVOGB21";

  throw new Error(`Istituzione GoCardless non trovata per ${source}`);
}

export type RequisitionCreated = {
  id: string;
  link: string;
  status: string;
};

export async function createRequisition(input: {
  institutionId: string;
  redirect: string;
  reference: string;
}): Promise<RequisitionCreated> {
  const token = await getAccessToken();
  return gcFetch<RequisitionCreated>("/requisitions/", {
    token,
    body: {
      redirect: input.redirect,
      institution_id: input.institutionId,
      reference: input.reference,
      user_language: "IT",
    },
  });
}

export type RequisitionStatus = {
  id: string;
  status: string;
  accounts: string[];
  reference?: string;
};

export async function getRequisition(requisitionId: string): Promise<RequisitionStatus> {
  const token = await getAccessToken();
  return gcFetch<RequisitionStatus>(`/requisitions/${requisitionId}/`, { token });
}

type TxResponse = {
  transactions?: {
    booked?: OpenBankingBookedTx[];
    pending?: OpenBankingBookedTx[];
  };
};

export async function listBookedTransactions(
  accountId: string,
  dateFrom?: string,
): Promise<OpenBankingBookedTx[]> {
  const token = await getAccessToken();
  const q = dateFrom ? `?date_from=${encodeURIComponent(dateFrom)}` : "";
  const data = await gcFetch<TxResponse>(`/accounts/${accountId}/transactions/${q}`, { token });
  return data.transactions?.booked ?? [];
}

/** Detect expired / revoked style errors from GoCardless message. */
export function isReauthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /expired|revoked|EUA|401|End User Agreement/i.test(msg);
}

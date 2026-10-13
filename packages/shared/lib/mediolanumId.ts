/**
 * Stable Mediolanum transaction identity + truncation-dup cleanup.
 * Id payload prefers CRO / id.operazione / SDD mandate / card C/O over full causale
 * so truncated CSV re-imports do not double-count.
 */
import type { Transaction } from "../types";
import { transactionId } from "./csv";

/** Raw/normalized desc embedded in `source|date|amount|…` id. */
export function descriptionKeyFromTxId(id: string): string | null {
  const parts = id.split("|");
  if (parts.length < 4) return null;
  return parts.slice(3).join("|");
}

/**
 * Fingerprint for Mediolanum dedup. Prefer bank refs over full free-text causale.
 */
export function mediolanumIdKey(rawDesc: string): string {
  const d = rawDesc.trim().toLowerCase().replace(/\s+/g, " ");
  if (!d) return d;
  if (/^(cro|op|sdd|card):/.test(d)) return d;

  const cro = d.match(/\bcro:\s*([a-z0-9]+)/);
  if (cro) return `cro:${cro[1]}`;

  const op = d.match(/\bid\.operazione:\s*([a-z0-9]+)/);
  if (op) return `op:${op[1]}`;

  const sdd = d.match(/prg\.car\.:\s*(\d+)[\s\S]*?(itco[0-9a-z]+)/);
  if (sdd) return `sdd:${sdd[1]}:${sdd[2]}`;

  const card = d.match(/\bdel\s+(\d{2}\/\d{2}\/\d{2})\b[\s\S]*?c\/o\s+(.+?)\s+carta n\./);
  if (card) return `card:${card[1]}:${card[2].replace(/\s+/g, " ").trim()}`;

  return d;
}

/** True when one causale is truncated form of the other (prefix or near-prefix). */
export function isMediolanumTruncationPair(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 12 || long.length < short.length + 30) return false;

  const sn = short.trim().toLowerCase().replace(/\s+/g, " ");
  const ln = long.trim().toLowerCase().replace(/\s+/g, " ");
  if (ln.startsWith(sn)) return true;

  if (sn.length < 80) return false;
  const words = sn.split(" ").filter((w) => w.length >= 3);
  if (words.length < 6) return false;
  let pos = 0;
  let hit = 0;
  for (const w of words) {
    const i = ln.indexOf(w, pos);
    if (i >= 0) {
      hit++;
      pos = i + w.length;
    }
  }
  return hit / words.length >= 0.85;
}

function rawOf(t: Transaction): string {
  return descriptionKeyFromTxId(t.id) ?? t.description;
}

function pickBetter(a: Transaction, b: Transaction): Transaction {
  const base = rawOf(a).length >= rawOf(b).length ? a : b;
  const other = base === a ? b : a;
  const otherDesc = other.description.trim();
  const baseRaw = rawOf(base).toLowerCase();
  // Prefer short cleaned aliases (e.g. Pocket Revolut), not truncated stubs of the causale.
  const preferAlias =
    otherDesc.length > 0 &&
    otherDesc.length < 40 &&
    !otherDesc.endsWith("…") &&
    !baseRaw.startsWith(otherDesc.toLowerCase());
  return {
    ...base,
    description: preferAlias ? otherDesc : base.description,
    internal: Boolean(base.internal || other.internal) || undefined,
    category:
      other.category && other.category !== "Altro" && (base.category === "Altro" || !base.category)
        ? other.category
        : base.category,
  };
}

export type MediolanumDedupResult = {
  transactions: Transaction[];
  /** old id → final id */
  remapped: Record<string, string>;
  removed: string[];
};

/**
 * Collapse Mediolanum truncation duplicates and re-key ids to {@link mediolanumIdKey}.
 * Non-Mediolanum rows pass through unchanged.
 */
export function dedupeMediolanumTransactions(txs: Transaction[]): MediolanumDedupResult {
  const remapped: Record<string, string> = {};
  const removed: string[] = [];
  const other = txs.filter((t) => t.source !== "mediolanum");
  const medio = txs.filter((t) => t.source === "mediolanum");

  const groups = new Map<string, Transaction[]>();
  for (const t of medio) {
    const k = `${t.date}|${t.amount}`;
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }

  const survivors: Transaction[] = [];

  for (const group of groups.values()) {
    // Union-find style: merge truncation pairs into clusters, keep best per cluster
    const parent = new Map<string, string>();
    const member = new Map<string, Transaction>();
    for (const t of group) {
      parent.set(t.id, t.id);
      member.set(t.id, t);
    }
    const find = (id: string): string => {
      let p = parent.get(id)!;
      if (p !== id) {
        p = find(p);
        parent.set(id, p);
      }
      return p;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return;
      const best = pickBetter(member.get(ra)!, member.get(rb)!);
      parent.set(ra, best.id);
      parent.set(rb, best.id);
      parent.set(best.id, best.id);
      member.set(best.id, best);
      // If best is a new object with same id as ra or rb, fine; if pickBetter kept ra's id:
      if (!member.has(best.id)) member.set(best.id, best);
    };

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (isMediolanumTruncationPair(rawOf(group[i]), rawOf(group[j]))) {
          union(group[i].id, group[j].id);
        }
      }
    }

    const clusters = new Map<string, Transaction>();
    for (const t of group) {
      const root = find(t.id);
      const cur = clusters.get(root);
      clusters.set(root, cur ? pickBetter(cur, t) : t);
    }

    const byNew = new Map<string, Transaction>();
    for (const [rootId, t] of clusters) {
      const newId = transactionId("mediolanum", t.date, t.amount, mediolanumIdKey(rawOf(t)));
      const next = { ...t, id: newId };
      const existing = byNew.get(newId);
      byNew.set(newId, existing ? pickBetter(existing, next) : next);

      for (const orig of group) {
        if (find(orig.id) !== rootId) continue;
        if (orig.id !== newId) {
          remapped[orig.id] = newId;
          if (!removed.includes(orig.id)) removed.push(orig.id);
        }
      }
    }

    survivors.push(...byNew.values());
  }

  // Don't mark survivor ids as removed
  const survivorIds = new Set(survivors.map((t) => t.id));
  const removedClean = removed.filter((id) => !survivorIds.has(id));

  return {
    transactions: [...other, ...survivors],
    remapped,
    removed: removedClean,
  };
}

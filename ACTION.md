# ACTION.md — workflow agent (Nicholas)

Regole operative brevi per Cursor / agent su questo repo.

## «Procedi» = commit + push

Quando Nicholas dice **`procedi`**, **`vai`**, **`commit e push`**, o equivalente esplicito dopo un task completato:

1. Se il task ha toccato codice: skill **`finance-code-review`** → serve `GATE: READY` (fix Critical/Important prima).
2. Verifica `npm test` e `npm run build` (se il task ha toccato codice).
3. **`git add`** solo file pertinenti (mai `.env`, PII, `data/*.db`, `.superpowers/`).
4. **`git commit`** con messaggio chiaro (why, non solo what).
5. **`git push origin master`** (autodeploy Railway).

Non fare commit/push **senza** quella parola d’ordine — salvo che Nicholas chieda esplicitamente solo commit o solo push.

## Deploy

- Railway autodeploy da `master`.
- Dopo push: smoke su `/api/health` e login se auth attiva.

## Documentazione agent

- Contesto progetto: **`CLAUDE.md`**
- Architettura finanziaria: **`docs/finance-stack-unified.md`**
- Questo file: **`ACTION.md`**

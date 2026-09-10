---
name: finance-code-review
description: >-
  Post-implementation code review for Finance / Cash Flow: bug hunt plus
  checklist (privacy, SQLite/API, CSV parsers, UI, investments, tests, git
  hygiene). Use after finishing an implementation, bugfix, or refactor,
  before declaring done, and before procedi commit+push or opening a PR.
  Enforces gate BLOCKED on Critical/Important and READY when only Minor or
  none remain.
---

# Finance code review

Run this before claiming work is done or commit+push / PR.

## Workflow

Honor repo rule **`token-thrift`** and skill **`thrifty-code-review`**: default is **inline** in this chat. Do **not** spawn Bugbot / reviewer / generalPurpose subagents for routine post-impl or “N loop” reviews.

1. **Diff scope**
   - Default: uncommitted + staged changes; if on a branch ahead of `master`, include `origin/master...HEAD` too.
   - If the user asks for dirty-only / uncommitted: review uncommitted changes only.
   - One `git diff` (or equivalent); read **changed hunks only**, not whole files.
2. **Bug hunt (inline)**
   - Inspect the diff for logic bugs, wrong signs/amounts, KPI double-counting, broken dedup, resource leaks, API breakage, missing tests on touched paths.
   - Launch `bugbot` / Security Review **only** if the user explicitly asks for that subagent by name.
3. **Finance checklist**
   - Read and apply [CHECKLIST.md](CHECKLIST.md) to the same diff.
4. **Report** then **gate** (below). Do **not** apply fixes unless the user asks after the report.
5. If `GATE: BLOCKED`, fix Critical/Important (when asked or as next step), then re-run this skill on the updated diff (loop 2+: only re-check prior Critical/Important).

## Output format

```markdown
| Severity | Location | Finding | Fix hint |
|----------|----------|---------|----------|
| Critical | path:line | … | … |
| Important | path:line | … | … |
| Minor | path:line | … | … |

GATE: BLOCKED|READY
```

- **Critical / Important** — must fix before done / commit+push / PR.
- **Minor** — report only; does not block.
- If no findings: one line `No issues. GATE: READY`.

## Gate

| Result | Condition | Agent behavior |
|--------|-----------|----------------|
| `GATE: BLOCKED` | Any Critical or Important open | Do not say done; do not commit/push or open/update PR; list open items |
| `GATE: READY` | No Critical/Important (Minor OK) | May declare done / proceed if user asked |

## Skip (do not force a full review)

- Read-only Q&A, exploration, triage with no code edits
- Docs-only under `docs/` with no runtime impact
- User explicitly skips for typo/comment-only
- Same-turn review already completed on the same diff with `GATE: READY`

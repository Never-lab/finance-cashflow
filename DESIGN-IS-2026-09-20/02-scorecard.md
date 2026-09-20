# Scorecard — Dieter Rams (0–3 each, max 30)

1. Good design is innovative — Score: **2/3**
   Evidence: Local-first CSV hub + Getquin-style Sankey/heatmap; not wholesale copy (`01-evidence` Visual/Structural).
   Justification: Refreshes personal-finance dashboard pattern with clear local privacy angle; not a new interaction paradigm.

2. Good design is useful — Score: **2/3**
   Evidence: Primary CSV→KPI path works; 10 tabs + “Carica CSV”×11 add adjacent friction (`AppShell.tsx:23-49`, Structural).
   Justification: Core task completes, but IA density and duplicate CTAs add steps.

3. Good design is aesthetic — Score: **1/3**
   Evidence: Coherent charcoal/teal/clay tokens, but ~25 type sizes + mixed radius/px gaps (`styles.css`, Visual).
   Justification: Strong palette; scale sprawl counts as 3–5 system inconsistencies.

4. Good design is understandable — Score: **1/3**
   Evidence: `monitoring plane`; dual **Margine**; Vault/Leak/P&L jargon (Copy).
   Justification: 2–3 primary labels unclear without domain knowledge.

5. Good design is unobtrusive — Score: **2/3**
   Evidence: Quiet sidebar chrome; content-led main (`AppShell`, styles).
   Justification: Chrome visible but recedes; charts compete only on Dashboard.

6. Good design is honest — Score: **1/3**
   Evidence: “Salute cash flow” score + “Top azioni” + strong payslip alignment claim (Copy).
   Justification: Two+ inflations / authority claims without clear methodology in primary UI.

7. Good design is long-lasting — Score: **2/3**
   Evidence: Serif brand + warm dark tokens; avoids purple/cream AI clichés.
   Justification: One dated marker (generic dark finance dashboard) but not fad-locked.

8. Good design is thorough down to the last detail — Score: **1/3**
   Evidence: Empty states good; focus CSS absent; Dashboard loading/error missing; modal a11y gaps (Visual + A11y).
   Justification: 2–3 critical states/details missing or rough.

9. Good design is environmentally friendly — Score: **1/3**
   Evidence: ~792 KB single JS chunk; no `prefers-reduced-motion` (Weight).
   Justification: 500KB–2MB band + ungated chart motion.

10. Good design is as little design as possible — Score: **1/3**
    Evidence: 10 nav items; duplicate upload CTAs; KPI blocks ×14 (Structural).
    Justification: 3–5 removable/duplicated affordances without breaking core task.

**Total: 14 / 30**

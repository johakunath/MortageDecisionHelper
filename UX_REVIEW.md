# UX & Structure Review — Mortgage Decision Helper

> ## ⚠️ Partly superseded
>
> This review was written **before** the product spec existed in the repo, so it inferred intent from the code. Now that [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) is available, four of its proposals are overruled or revised. The findings below are still accurate as *observations*; some of the *recommendations* are not.
>
> | Proposal here | Current status |
> |---|---|
> | **P7** — delete `ExecutiveSummary.tsx` as dead code | **Overruled.** It is the spec-mandated first screen (§7.1) and is being restored. See [DECISIONS.md D5](docs/DECISIONS.md#d5--executivesummary-is-restored-not-deleted) |
> | **P4** — first-run onboarding wizard | **Dropped.** Spec §20: the app "does not currently need additional scope", and both users know their own numbers |
> | **P6** — merge `CASE_PRESETS` with the apartment cases | **Revised.** They serve different purposes — QA test fixtures vs. real properties. Separate and relabel instead |
> | **P1** — collapse to three tabs | **Superseded** by zero tabs, one scrolling page. See [DECISIONS.md D2](docs/DECISIONS.md#d2--zero-tabs-one-scrolling-page-with-a-step-rail) |
>
> One factual retraction: §4.2 of this document is right that the right panel is context-blind, but a related claim made in conversation — that `App.tsx:77` passes the wrong argument — was **wrong**. `ScenarioResult` is a superset of `ScenarioBase`, so the call is safe. It is a typing smell, not a defect.
>
> §2 (documentation gaps) is now **resolved** — see `docs/` and `CLAUDE.md`.
>
> The open questions in §8 have been answered; see [DECISIONS.md](docs/DECISIONS.md).

Review date: 2026-05-18
Reviewed commit state: `main`, working tree with uncommitted changes (`App.tsx`, `calculations.ts`, `defaults.ts`, `styles.css`, untracked `ApartmentComparisonPanel.tsx`)
Scope: documentation, goal alignment, user flow, layout, redundancy. **No code was changed by this review.**

---

## 1. Executive summary

| Question | Short answer |
|---|---|
| Are the docs up to date and do they give enough context? | **No.** Both docs are run-instructions only. Neither states the purpose, the decision rule, or the newest feature. `CHAT_HANDOFF.md` is factually stale. |
| Does it answer what you were planning to achieve? | **Unknown — and that is itself the finding.** No goal is written down anywhere. The app has drifted from one question ("how much EK?") to four. See §3. |
| Is there a coherent user flow / UI / layout? | **Partly.** Individual components are well made. The information architecture is not: 6 sibling tabs, three different selectors bound to different state, and a right panel that shows numbers unrelated to what you are looking at. |
| Can it be simpler / more fun / immediately understood? | **Yes, substantially.** The app opens at full complexity with no on-ramp. Concrete plan in §6. |
| Can redundancy be reduced? | **Yes — 7 concrete duplications identified**, including 64 lines of dead code. See §5. |

The engineering underneath is sound: 9/9 tests pass, calculations are isolated in `src/lib/calculations.ts`, formatting is centralised, components are small. **The problem is not code quality — it is that the product grew feature-by-feature without the navigation being re-thought.**

---

## 2. Documentation

### What exists

- `README.md` (31 lines) — how to start the app. Three different start methods. Nothing else.
- `CHAT_HANDOFF.md` (18 lines) — a snapshot of project state written for a previous chat session.
- In-app `QA / Formelprüfung` tab — the only place the formulas and the decision rule are written down.

### Problems

**2.1 — No statement of purpose anywhere.** Neither doc says what decision this tool supports, for whom, or what a good outcome looks like. A reader (or a future AI session) has to reverse-engineer intent from `defaults.ts`. For a tool whose whole value is *judgement support*, this is the biggest documentation gap.

**2.2 — `CHAT_HANDOFF.md` is stale.** It lists "Current state" as: 5/10/15% Eigenkapital, Kompromiss-Finder, editable Sondertilgung, Immobilienwert/Nettovermögen. It does **not** mention the apartment comparison feature (`ApartmentComparisonPanel.tsx`), which is now the largest single view in the app. Anyone trusting this file gets a wrong mental model.

**2.3 — The decision rule is buried.** The rule that drives every status pill and the whole recommendation — *"clean" = cash after purchase ≥ reserve target AND monthly burden ≤ 40% of household net* — lives only in the QA tab and in `evaluateDecision()`. It belongs in the README, because it is the single most important assumption in the product.

**2.4 — No glossary.** The app is German and domain-heavy (Eigenkapital, Kaufnebenkosten, Sondertilgung, Anfangstilgung, Zinsbindung, Restschuld, Warmmiete, Realrendite). There is no definition list. This makes it hard to hand the tool to a partner, a parent, or an advisor.

**2.5 — Model limits are not stated in the docs.** Real caveats exist and are non-obvious: property growth is applied as a flat compound rate, no tax treatment, no maintenance reserve escalation, `waitRateShift` is a manual guess, ETF opportunity cost ignores volatility and taxes. The QA tab hints at some of this; the README says nothing.

**2.6 — No `CLAUDE.md`.** Given the project is developed with AI assistance, there is no file describing conventions, the calculation contract, or "do not touch" areas.

---

## 3. Goal alignment

**I cannot verify this properly, because the intended goal is not documented.** What follows is inferred from the code and defaults — please correct it, and then write the answer down in the README.

### What the app *says* it is

The hero copy commits to one question:

> "Wir schauen drei Wege an: *fünf, zehn, fünfzehn Prozent*." — `App.tsx:372`

That is: **how much equity should I put down?**

### What the app *actually* does now

Four separate questions, each with its own tab:

1. How much EK? — `Entscheidung`, `EK-Vergleich`
2. Which apartment? — `EK-Vergleich` (apartment panel)
3. Should I make special repayments, and how much? — `Sondertilgung`
4. Should I buy now or wait? — `Warten`

### The drift

The defaults tell a story the hero does not. `DEFAULT_APARTMENT_CASES` (`defaults.ts:45`) contains three *named apartments* at 600k / 720k / 850k with individual renovation costs and ownership costs. That is not an equity question — **that is a "which property can we actually afford" question.**

My reading: the real decision moved from *EK percentage* to *object choice under a financing constraint*, but the framing, the hero, the tab order, and the right panel all still lead with EK. If that reading is right, the app currently buries its own headline feature two clicks deep under a tab called "EK-Vergleich".

**→ Open question for you (§8, Q1): is the primary question "how much EK" or "which apartment"?** Nearly every layout proposal below depends on that answer.

---

## 4. User flow, UI, layout

### 4.1 Six sibling tabs, of unequal weight

`Entscheidung · Eingaben · EK-Vergleich · Sondertilgung · Warten · QA / Formelprüfung`

Problems:
- **They are not peers.** `Entscheidung` is the product. `QA / Formelprüfung` is a developer/validation surface. They sit at the same visual level with the same styling.
- **Labels are feature names, not questions.** "Sondertilgung" tells you a mechanism, not what you'd learn there.
- **Two tabs are inputs** (`Eingaben`, and `Warten` which mounts `InputsPanel` again with `forceGroup="wait"`), which undercuts the input/output separation you asked about.
- **`Warten` exists twice in the mental model** — as a top-level tab *and* as one of the four `INPUT_GROUPS` (`defaults.ts:132`). Same word, two different navigation levels.

### 4.2 The right panel is context-blind — this is the sharpest incoherence

`RightPanel` is always rendered with the same global props regardless of tab (`App.tsx:423-429`).

Measured on the `EK-Vergleich` tab: the right panel showed **648.000 € Darlehen / 10% EK / 720k model**, while the main column showed the apartment table whose first row was **Wohnung A at 600.000 €**. The two halves of the screen were describing different properties at the same time, with no indication that they were unrelated.

This is precisely the problem your "preview on the right side panel" wish would fix. Right now the panel is a *static global readout* wearing the visual position of a *contextual preview*.

### 4.3 Above-the-fold space is spent on decoration

On `Entscheidung`, the hero (`clamp(3rem, 5.4vw, 5.65rem)` headline + paragraph + status pill) consumes roughly the first 400px. The first actual decision control appears below it. On every other tab, `hero-compact` still repeats the same EK headline and the same "Wir schauen drei Wege an…" paragraph — copy that is no longer true for the tab you are on (e.g. the apartment table, or the QA sheet).

### 4.4 Horizontal overflow on the apartment table

Measured in a 1440px viewport: the apartment table needs **980px**, the main column provides **874px**. The table scrolls sideways inside the page. Eight columns (Wohnung, Kaufpreis, Pfad, Monatlich, Cash übrig, Zinsen, Sondertilgung, Status) cannot fit next to a 360px sticky panel. The most comparison-dense view in the app is the one with the least room.

### 4.5 Control density on `EK-Vergleich`

That single tab renders: 3 summary readouts + an 8-column × 3-row table + 3 editor cards (each: 3 EK buttons, 3 number inputs, 10 yearly Sondertilgung inputs) + the 3-card scenario chooser + 6 metric bars + 1 ETF readout.

That is **~60 interactive controls on one page**, with no progressive disclosure.

### 4.6 No first-run experience

The app boots straight into a fully-populated 720.000 € model with 145.000 € capital and 8.500 € household income (`defaults.ts:9-31`). A new user cannot tell whether those are *their* numbers, example numbers, or recommended numbers. There is no empty state, no "start here", no three-question opener.

### 4.7 Best-practice gaps (specific, not generic)

| Principle | Current state |
|---|---|
| Progressive disclosure | Everything visible at once; no collapse, no "advanced" hiding beyond one tab group |
| Recognition over recall | Switching tabs loses sight of the numbers you were reasoning about |
| One primary action per view | `Entscheidung` has a selector, `EK-Vergleich` has three separate editable selectors |
| Immediate feedback on input | Editing in `Eingaben` gives no visible before→after delta; you must navigate away to see the effect |
| Match between system and real world | Tab labels use mechanism names rather than the user's actual questions |
| Accessible status | Status is carried substantially by colour (`positive`/`negative` classes) plus a short pill |

---

## 5. Redundancy inventory

| # | Duplication | Evidence | Cost |
|---|---|---|---|
| R1 | **`ExecutiveSummary.tsx` is dead code** — defined, never imported | `grep -rn "ExecutiveSummary" src/` returns only its own definition | 64 lines maintained for nothing; will silently rot |
| R2 | **Two parallel "three cases" systems** — `CASE_PRESETS` (600k/720k/850k) and `DEFAULT_APARTMENT_CASES` (600k/720k/850k) | `defaults.ts:45` vs `defaults.ts:84` | Same three price points, two data shapes, two UIs, two mental models |
| R3 | **Three scenario selectors** bound to two different states | `CompromiseFinder` doors (`App.tsx:231`), `scenarioChooser` cards (`App.tsx:209`), per-apartment EK buttons (`ApartmentComparisonPanel.tsx:153`) | User cannot tell which one is authoritative |
| R4 | **The same numbers rendered three times** on `Entscheidung` | story prose (`App.tsx:239-256`), quiet metrics (`App.tsx:257-280`), right panel (`RightPanel.tsx:32-76`) | Monatsrate, all-in, cash left each appear 3× on one screen |
| R5 | **Two Sondertilgung editors** | `SondertilgungPanel` (global) and the per-apartment year grids | Two places to edit conceptually the same plan, no sync |
| R6 | **`InputsPanel` mounted twice** | `App.tsx:385` and `App.tsx:407` | Duplicate preset rows; `Warten` tab shows preset buttons that jump you off the tab |
| R7 | **"Warten" at two navigation levels** | `MAIN_TABS` (`defaults.ts:123`) and `INPUT_GROUPS` (`defaults.ts:132`) | Ambiguous IA |

---

## 6. Proposals

Ordered by impact-to-effort. Each is independent; you can take them in any order.

### P1 — Collapse 6 tabs → 3 *(directly serves: "less pages")*

```
BEFORE  Entscheidung · Eingaben · EK-Vergleich · Sondertilgung · Warten · QA

AFTER   Entscheidung · Wohnungen · Annahmen        (+ QA as a quiet footer link)
```

- **Entscheidung** — the answer. `CompromiseFinder` + story + trade-off matrix + the metric bars and ETF readout currently stranded on `EK-Vergleich` (they are outputs of *this* decision, not of the apartment comparison).
- **Wohnungen** — the apartment comparison, given full width (see P3).
- **Annahmen** — every editable assumption in one place: the four existing input groups **plus** `Sondertilgung` **plus** `Warten`. Both are inputs; neither deserves top-level billing.
- **QA / Formelprüfung** — demote to a small link in a page footer. It is a validation surface, not a peer of the product.

Removes R6 and R7 as a side effect.

### P2 — Turn the right panel into a live contextual preview *(directly serves: "preview on the right sidepanel")*

Make the panel answer *"what am I looking at right now, and what did my last change do?"*

1. **Bind it to context, not to global state.**
   - On `Entscheidung`: the selected EK scenario (today's behaviour — correct here).
   - On `Wohnungen`: the apartment row currently hovered or focused. Fixes §4.2.
   - On `Annahmen`: a live preview of the field being edited.
2. **Add before → after deltas.** When an input changes, show the movement on the four key metrics:
   `Monatsrate 4.205 € → 4.361 €  (+156 €)`
   This is the single highest-value addition for making the tool feel alive, and it is what makes an assumptions page *fun* rather than a form.
3. **Cut from 8 readouts to 4 + expandable detail.** Primary: All-in monatlich · Cash nach Kauf · Zinsen gesamt · Status. The other four (Darlehen, Immobilienwert, Nettovermögen, Zinsen in Zinsbindung) move behind a "Details" disclosure.

### P3 — Give the apartment comparison room to breathe

- Suppress the sticky right panel on `Wohnungen` (or make it an overlay), so the table gets the full 1400px and stops scrolling sideways. Fixes §4.4.
- Split the view in two: **compare** (read-only table, always visible) and **edit** (one apartment at a time, opened from a row). Today all three editor cards with all 48 controls are permanently expanded.
- Move the 10 yearly Sondertilgung inputs behind a "Sondertilgungsplan bearbeiten" disclosure per apartment; show only the Ø value collapsed.

### P4 — Add a first-run on-ramp *(serves: "fun to start", "understood immediately")*

On first load, before revealing the full app, ask three questions on an otherwise empty page:

```
1. Was kostet die Wohnung?          [ 720.000 € ]
2. Wie viel Eigenkapital hast du?   [ 145.000 € ]
3. Haushaltsnetto pro Monat?        [   8.500 € ]
```

Then reveal the Decision view with a single-sentence answer at the top:

> **Mit 10% EK zahlst du 4.205 € im Monat und behältst 8.200 € Reserve.**

Rationale: progressive disclosure, and it removes the current ambiguity about whose numbers are on screen (§4.6). Keep the existing presets as a "oder nimm ein Beispiel" escape hatch. Persist answers to `localStorage` so it appears once, not every visit.

### P5 — Reduce the triple-reported numbers on `Entscheidung` (R4)

Pick one role per surface:
- **Story prose** — keeps the *narrative* (what it means). Keep.
- **Quiet metrics** — delete. It is the weakest of the three: same numbers as the panel, less context than the prose.
- **Right panel** — keeps the *dashboard* (the authoritative figures). Keep.

This alone removes a full 4-tile row from the most important page.

### P6 — Unify the two "three cases" systems (R2)

`CASE_PRESETS` and `DEFAULT_APARTMENT_CASES` describe the same three scenarios at the same three prices. Make `ApartmentCase` the single source of truth and derive the presets from it, or drop `CASE_PRESETS` entirely and let "load apartment into calculator" be the only path. Removes an entire parallel concept.

### P7 — Delete `ExecutiveSummary.tsx` (R1)

Unless you intend to restore it — in which case it is arguably a better `Entscheidung` header than the current hero, since it surfaces cost-minimum / liquidity-maximum / compromise as three clickable answers. **Decide one way or the other; do not leave it dormant.**

### P8 — Documentation fixes

1. Rewrite `README.md` with: purpose, the question it answers, who it is for, **the decision rule** (reserve + 40% burden), a German-term glossary, and an explicit "what this model does not do" list.
2. Delete `CHAT_HANDOFF.md` or regenerate it — it currently misinforms.
3. Add `CLAUDE.md`: calculation contract, that `calculations.ts` is test-covered and should stay pure, styling conventions (single `styles.css`, CSS custom properties, no utility framework).
4. Move the QA formula list from the tab into a versioned `docs/ASSUMPTIONS.md`, and have the tab link to it.

### P9 — Smaller layout fixes

- Suppress the hero (or reduce it to a one-line breadcrumb) on every tab except `Entscheidung`; the poetic copy is false context elsewhere (§4.3).
- Relabel tabs as questions: `Wie viel EK?` · `Welche Wohnung?` · `Annahmen`.
- Never carry meaning by colour alone — pair `positive`/`negative` with a sign or glyph.
- Add `aria-live` to the right panel so screen-reader users hear recalculated values.

---

## 7. Proposed target structure

```
┌──────────────────────────────────────────────────────────────┐
│ haus · ein ruhiger rechner      Wie viel EK? · Welche Wohnung? · Annahmen │
└──────────────────────────────────────────────────────────────┘

  ENTSCHEIDUNG                          ┌─────────────────────┐
  ┌────────────────────────────────┐    │ VORSCHAU            │
  │ [ 5% ]  [ 10% ]  [ 15% ]       │    │ Wohnung B · 10% EK  │
  │  ← one selector, contained     │    ├─────────────────────┤
  └────────────────────────────────┘    │ All-in    4.205 €   │
                                        │           ▲ +156 €  │
  ── Was das bedeutet ──                │ Cash      8.200 €   │
                                        │ Zinsen  285.432 €   │
  Story prose (narrative)               │ Status    knapp     │
  EK Trade-off Matrix                   ├─────────────────────┤
  Balken + ETF-Kontext                  │ ▸ Details (4 more)  │
                                        └─────────────────────┘
                                          context-aware, shows
                                          deltas on every change
```

Net effect: **6 pages → 3**, ~60 controls on the heaviest page → progressive disclosure, and the right panel finally does what its position promises.

---

## 8. Open questions

**Q1 — What is the primary question?** "How much Eigenkapital?" or "Which apartment can we afford?" The tab order, the hero copy, and the right panel binding all follow from this. My reading of `DEFAULT_APARTMENT_CASES` is that it has become the second — but the UI still leads with the first.

**Q2 — Who else uses this?** Just you, or also a partner / advisor / bank? If it is shared, the glossary (P8) and the first-run on-ramp (P4) move up in priority substantially.

**Q3 — Is `ExecutiveSummary` intentional?** Dormant on purpose, or forgotten? (P7)

**Q4 — Should Sondertilgung be global or per-apartment?** Right now it is both (R5), and they do not sync. One of them should win.

**Q5 — Is the standalone `dist/mortgage-helper-standalone.html` build still a requirement?** It constrains how far the app can go on persistence (`localStorage`) and asset loading, which affects P4.

---

## 9. What I did *not* change

Per your instruction, this review is document-only. No source file, style, or config was modified while producing it.

One pre-existing note: `.claude/launch.json` exists in the repo from earlier in this session (it lets the preview tooling start the dev server). It is untracked and affects nothing at runtime — delete it if you do not want it.

---

## 10. Suggested order of work

1. **P8** — write down the goal first. Every other decision gets easier once it is on paper.
2. **P1** — collapse the tabs. Biggest visible win for "less pages".
3. **P2** — contextual right panel with deltas. Biggest win for "less clutter" and for making it fun.
4. **P5, P7, P6** — cheap deletions; do them together in one pass.
5. **P3** — apartment view rework.
6. **P4** — first-run on-ramp, once the structure underneath is stable.

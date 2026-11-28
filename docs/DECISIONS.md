# Decision Log

Short ADR-style entries. Append; don't rewrite history. If a decision is reversed, add a new entry that supersedes it rather than editing the old one.

---

## D1 — Sondertilgung break-even compares against 15% EK *without* Sondertilgung

**Date:** 2026-05-18 · **Status:** superseded by [D10](#d10--the-sondertilgung-baseline-is-chosen-not-hardwired) — the *without Sondertilgung* reasoning below still holds and is now one of two selectable modes; the fixed 15% target does not

**Context.** [PRODUCT_SPEC §7.4](PRODUCT_SPEC.md#74-sondertilgung) asks how much annual Sondertilgung a lower-EK scenario needs to match 15% EK's interest — but never says what 15% EK is itself doing. The implementation resolved this accidentally: `requiredSpecialToMatch` was passed a target computed *with* the full yearly Sondertilgung path, while its own candidates ran a flat scalar. So the headline number answered a question neither spouse was asking.

**Decision.** The comparison target is 15% EK making **no** special repayments.

**Rationale.** It states the disagreement in its cleanest form: *can discipline substitute for capital?* Comparing against a 15% that is already Sondertilgend understates the required amount and muddies the question.

**Consequence.** `requiredSpecialToMatch` takes an explicit `baseline: SpecialPlan` argument — never an implicit sentinel. The UI must label the baseline in words: *"verglichen mit 15% EK ohne Sondertilgung"*. The resulting number is larger than what the app showed before; that is the correction, not a regression.

---

## D2 — Zero tabs: one scrolling page with a step rail

**Date:** 2026-05-18 · **Status:** accepted

**Context.** The app had six parallel top-level tabs while [PRODUCT_SPEC §6](PRODUCT_SPEC.md#6-main-user-flow) describes a linear eight-step flow. The owner asked for "less pages".

**Decision.** Remove tabs entirely. One scrolling page, numbered sections, sticky step rail.

**Rationale.** Decisive factor is [§3](PRODUCT_SPEC.md#3-target-users): **two people looking at one screen together.** A scroll position is a shared referent — you can point at it. A tab requires agreeing what to open before you can point at anything. Tabs also separated the Sondertilgung and Warten what-ifs from the decision they modify.

**Rejected alternatives.** Three tabs (still buries steps 5–8 behind a click); keeping six and only decluttering (leaves the parallel-vs-linear mismatch and the duplicated Warten navigation).

**Consequence.** `MAIN_TABS` is deleted. A `SectionId` union plus an `IntersectionObserver` drives the step rail and the right panel's context. No routing library.

---

## D3 — Apartments are a context switcher, plus a read-only comparison table

**Date:** 2026-05-18 · **Status:** accepted

**Context.** The apartment comparison ([PRODUCT_SPEC A1](PRODUCT_SPEC.md#21-amendments)) had become a peer analysis surface with ~60 controls, a table overflowing its column, and a right panel showing a *different property* than the table beside it.

**Decision.** Apartment chips in a sticky bar re-base the entire app. A collapsed, **read-only** table compares all apartments. Editing an apartment's facts happens in the switcher's expand panel, not in the table.

**Rationale.** The root defect was state ownership: `loadApartmentCase` *copied* apartment fields into global `inputs`, after which the two desynced permanently on the next edit. Deriving `activeInputs` from the active apartment makes desync structurally impossible. A read-only table also drops ~5 columns of controls, letting its min-width fall from 980px to roughly 640px — which fits the available column and removes the horizontal scroll without touching the grid.

**Rejected alternatives.** Switcher only (deletes the comparison the owner explicitly asked for); full editable comparison (keeps the overload and the scroll).

**Known limitation.** The switcher cannot express "Wohnung A at 10% vs Wohnung B at 5%" — only the table can, and only at each apartment's own `selectedScenarioId`. If that cross-comparison turns out to matter, the table needs a per-row EK selector. **Raise before building it.**

---

## D4 — `waitSavingsMonthly` is net of rent

**Date:** 2026-05-18 · **Status:** accepted

**Context.** [PRODUCT_SPEC §9](PRODUCT_SPEC.md#9-definitions) defines the wait-savings input as the net amount added to Eigenkapital *after* rent, explicitly to avoid double-counting. `buildWaitScenario` nonetheless computed `availableCapital + saved − rentPaid`, and the UI labels ("vor Mietabzug", "EK + Sparen − Miete") had been written to match the code rather than the spec.

**Decision.** Rent is **displayed** as a cost of waiting and **never subtracted** from future capital.

**Rationale.** Owner confirmed the input means net savings. With defaults the double-count is a 23.640 € swing that turned an 18.000 € gain into a 5.640 € loss — making waiting look substantially worse than it is, on the tab meant to test exactly that.

**Consequence.** Drop `− rentPaid` from `adjustedAvailableCapital`; keep `rentPaid` as a display-only field; relabel the affected readouts. A regression test pins `adjustedAvailableCapital === availableCapital + 18000` under defaults.

---

## D6 — Aggressive deletion: the same comparison was rendered five times

**Date:** 2026-05-18 · **Status:** accepted · **Supersedes:** parts of D2 (section list)

**Context.** After the restructure the app still felt "too big, too complicated, too much text". The cause was not styling: the 5/10/15% comparison was rendered **five** times (CompromiseFinder doors, ScenarioCard ×3 at 12 fields each, TradeoffMatrix, MetricBars, ExecutiveSummary winner tiles), and the *selected* scenario three more times (story prose, quiet-metrics, right panel).

**Decision.** Delete rather than restyle:

| Deleted | Reason |
|---|---|
| `ScenarioCard` + its section | 36 numbers already present in the doors and the right panel |
| `MetricBar` bar grid | the same six numbers as the matrix directly above it |
| `quiet-metrics` strip | exact duplicate of the right panel |
| `ApartmentComparisonTable` + summary section | switcher chips already carry per-apartment status |
| `ExecutiveSummary` winner tiles | cost-minimum is *always* 15% EK and liquidity-maximum *always* 5% — they restate the axis, they don't inform the choice |
| `QASection` | formulas live in ASSUMPTIONS.md; the external-check form is a one-time pre-signing task. Test cases stay covered by `npm test` |
| `MiniMetric`, `MetricBar` primitives | no remaining consumers |

Sondertilgung stays (it is one spouse's core argument) but slimmed: the ten year inputs sit behind a disclosure. Warten stays behind a disclosure — it answers *when* to buy, not *how much EK*, so it must not compete with the main question.

**Result.** 8 sections → 5. `styles.css` ~1400 → ~1130 lines. Bundle 662 KB → 623 KB.

**Consequence.** Anything re-added here must earn its place against the central question. A second view of the same comparison is a regression, not a feature.

---

## D7 — Desktop is the priority viewport

**Date:** 2026-05-18 · **Status:** accepted

**Context.** The tool is used by two people sitting together at one screen ([PRODUCT_SPEC §3](PRODUCT_SPEC.md#3-target-users)), not on a phone.

**Decision.** Design and verify for desktop first. Narrow viewports get graceful fallbacks, not equal design effort.

**Consequence.** The three-column grid (rail · content · right panel) is the reference layout. The right panel spans the full viewport height and must never scroll internally — "always visible" is meaningless if content hides below an inner fold, which is why the panel is capped at four readouts.

---

## D8 — The sticky header is a fixed height, and holds nothing collapsible

**Date:** 2026-05-18 · **Status:** accepted

**Context.** Brand bar and apartment switcher were two separately-stuck elements with a hardcoded `top: 61px` between them. When that offset disagreed with the real header height, a sliver of scrolling page content showed through the seam. A first fix put the apartment-facts editor inside the header and measured the height with a `ResizeObserver` — but the header then swung between 138px and 268px depending on whether the disclosure was open.

**Decision.** One sticky container, fully opaque background, **fixed height**, containing only the brand row and the apartment chips. The collapsible apartment-facts editor moved into the page body.

**Rationale.** With nothing collapsible inside it, the header height is a constant (`--header-height`), so everything sticking below it clears it with one number that cannot drift. This removes the `ResizeObserver` entirely — fewer moving parts than measuring a height that only varies because of a decision we control.

**Consequence.** If anything of variable height is ever added to `.app-header`, `--header-height` breaks and the rail and right panel slide under it. Don't — put it in the body instead.

---

## D11 — Plain language instead of "Kein sauberes Szenario"

**Date:** 2026-05-18 · **Status:** accepted · **Amends:** [PRODUCT_SPEC §5.3](PRODUCT_SPEC.md#5-core-principles)

**Context.** The spec mandates the exact string *"Kein sauberes Szenario"*. The owner — one of the two people the tool is for — said plainly that he does not understand it. A verdict nobody understands fails the requirement it was written to satisfy.

**Decision.** Keep the *rule* from §5.3 exactly (never present the least-bad option as safe) and replace the *wording*:

| Before | After |
|---|---|
| "Kein sauberes Szenario" | "Keine der drei Varianten ist tragbar" |
| "sauber möglich" / "kein sauberes Szenario" (Wohnungs-Chip) | "tragbar" / "nicht tragbar" |
| "OK" | "Tragbar" |
| "Knapp" | "Gerade so tragbar" |
| "Kauf nicht gedeckt" | "Geld reicht nicht" |
| "Reserve verletzt" | "Reserve zu dünn" |
| "Monatlich eng" | "Rate zu hoch" |

Every status now names *what is wrong* rather than which internal constraint failed, and "tragbar" is defined inline via a tooltip.

**Consequence.** The literal spec string is gone from the UI. Tests assert `noSafeScenario` and `diagnosis.failed`, never the display string, so wording stays free to improve.

---

## D12 — Kaufnebenkosten: two presets, and 11,57% as default

**Date:** 2026-05-18 · **Status:** accepted

**Decision.** Only the two real German cases: **8% ohne Makler** and **11,57% mit Makler**, plus a free numeric field. Default is 11,57%.

**Rationale.** The intermediate 9% preset corresponded to nothing. The default is the *more expensive* case on purpose — a decision-support tool must not make the purchase look cheaper than it is likely to be.

**Consequence, and a warning.** Raising the default broke `CASE_PRESETS.case600` — the fixture whose entire job is to prove "at least one scenario is feasible" ([§17](PRODUCT_SPEC.md#17-test-cases)) — because it inherited the default. It now **pins `closingCostRate: 8` itself**. QA fixtures must specify every input that determines their expected outcome; one that tracks a default silently stops testing what it claims to test.

---

## D13 — Zinsbindung: 15 Jahre default, presets plus free entry

**Date:** 2026-05-18 · **Status:** accepted

**Context.** The field existed but was buried among eight inputs in the Finanzierung group, and nothing connected it to the three interest rates — even though in the German market the binding period is precisely what determines the rate offered.

**Decision.** Default **15 years** (was 10). Presets 10 / 15 / 20 plus a free numeric field. The three rate labels now read "Zins 10% EK · 15 J.", so changing the binding visibly invalidates the rates and prompts re-entry.

**Consequence.** `fixedRateYears` drives `interestFixed`, `remainingAfterFixed` and the `EkTradeoff` horizon, so every trade-off figure now spans 15 years rather than 10. Feasibility is unaffected — it depends only on cash and monthly burden.

---

## D10 — The Sondertilgung baseline is chosen, not hardwired

**Date:** 2026-05-18 · **Status:** accepted · **Supersedes:** [D1](#d1--sondertilgung-break-even-compares-against-15-ek-without-sondertilgung)

**Context.** D1 fixed the break-even target at "15% EK without Sondertilgung". That answers one question well and every neighbouring one not at all. The comparisons the couple actually makes — *"our 10% plan versus 5% and paying more"* — could not be expressed at all, and 15% EK is not the case they start from.

**Decision.**
1. The comparison target is user-selectable: **any EK level**, either **without Sondertilgung** or **with the current yearly plan**.
2. The default is **10% EK + Nebenkosten, without Sondertilgung** — the standard German financing case and the couple's actual starting point.
3. Every row is labelled "X% EK **+ Nebenkosten**".

**On that third point:** Kaufnebenkosten are never financed in this model — the loan is always `Kaufpreis − Anzahlung` and the Nebenkosten come out of cash (`cashNeeded`). That was already true but nowhere stated, and "10% EK" on its own is ambiguous about exactly the thing German first-time buyers most often get wrong. The label removes the ambiguity.

**Consequence.** `requiredSpecialToMatch` still takes an explicit target, so the baseline can never be implicit again. `compareSpecialScenarios` wraps it and returns one row per EK level, each with interest under both plan modes, the delta to the target, and the flat annual amount needed to reach it. Raising the baseline (or giving the baseline its own Sondertilgung) must raise every other row's required amount — both directions are pinned by tests.

---

## D9 — Capabilities restored from the original prototype

**Date:** 2026-05-18 · **Status:** accepted

**Context.** An audit against the very first prototype found capabilities lost across the rewrites, plus fields that were still computed but had no display surface after D6 deleted the scenario cards.

**Decision.** Restore, each in a form that fits the narrowed product:

| Restored | Form |
|---|---|
| Time-series charts | New `Verlauf` section: Restschuld / kumulierte Zinsen / Eigenkapital, with a dashed "ohne Sondertilgung" twin for the selected scenario and markers on Sondertilgung years |
| Save / load named datasets | `localStorage` only — named snapshots plus an autosave that survives reload. No backend, nothing transmitted |
| Tilgung ↔ Laufzeit ↔ Monatsrate | A three-way mode switch on one field. `repaymentRate` remains the single stored value; the other two are always derived |
| Arbitrary Sondertilgung years | Sparse `{year, amount}` rows instead of a fixed grid, so a one-off in year 20 is expressible |
| `cashNeeded`, `downPayment`, `rentDelta` | New `CashBlock` in §1 — answers PRODUCT_SPEC §2.1, which had become invisible |
| `runtimeYears`, `propertyValueAtPayoff`, `netWorthAtPayoff` | Readouts under the chart, where the long-horizon caveat applies to all three at once |

**Deliberately not restored:** free-form scenarios with editable names, add/delete, and EK entered as € — the product question is fixed at 5/10/15% EK, and re-adding them would restore the generic-calculator framing the spec moved away from.

**Notes.**
- The chart is hand-rolled SVG (~80 lines). A charting library would be inlined into `dist/mortgage-helper-standalone.html` in full, and that file is opened from disk.
- Every series is labelled at its right-hand end and carries its own dash pattern, so the lines stay distinguishable without colour ([spec §14](PRODUCT_SPEC.md#14-ek-trade-off-matrix)).
- Padding the Sondertilgung array uses **zeros, never the average**. Padding with the average made adding year 14 silently invent payments in years 11–13.

---

## D5 — `ExecutiveSummary` is restored, not deleted

**Date:** 2026-05-18 · **Status:** accepted · **Supersedes:** `UX_REVIEW.md` proposal P7

**Context.** `ExecutiveSummary.tsx` was never imported and an earlier review — written without access to the product spec — proposed deleting it as dead code.

**Decision.** Restore it as the first screen.

**Rationale.** It already renders almost exactly what [PRODUCT_SPEC §7.1](PRODUCT_SPEC.md#71-entscheidung) demands: Kosten-Minimum, Liquiditäts-Maximum, Kompromiss, selected scenario, and the no-clean-scenario state. It was orphaned, not obsolete. This is a direct illustration of why the spec now lives in the repo: without it, a reasonable reviewer read the product's mandated first screen as dead code.

**Consequence.** Needs `.summary-grid` and `.decision-note` styles (neither exists). Its `<div>`-inside-`<button>` nesting is an invalid content model and must be fixed. All winner tiles are gated behind `noSafeScenario` per [§5.3](PRODUCT_SPEC.md#5-core-principles).

---

## D14 — EK levels are compared at a constant *Monatsrate*, not a constant Tilgungssatz

**Date:** 2026-08-08 · **Status:** accepted

**Context.** The model held `repaymentRate` fixed across all EK levels, so more Eigenkapital produced a *smaller monthly payment* at an unchanged term. The broker's offers do the opposite: the Monatsrate stays at 1.900 € in every variant and the Tilgungssatz rises with the Eigenkapital. Checked against the real offer at 20% EK:

| | Monatsrate | Zinsen 10 J. | Restschuld nach 10 J. |
|---|---|---|---|
| Model (Tilgung 1,76% for all) | 1.656 € | 121.951 € | 283.244 € |
| Offer (Rate 1.900 € for all) | 1.900 € | 115.750 € | **247.750 €** |

**Decision.** `MortgageInputs.monthlyPayment` replaces `repaymentRate`. The Tilgungssatz is derived per scenario via the existing `repaymentRateFromMonthlyPayment`.

**Rationale.** 35.494 € of remaining debt is not a rounding difference, and the error ran in one direction: it understated what more Eigenkapital buys, i.e. it systematically favoured one spouse's position — the exact failure mode `CLAUDE.md` warns about. It is also the more honest model of the constraint: what the couple can pay per month does not change when they put more capital down. The freed-up capacity has to go somewhere, and in the bank's framing it goes into faster repayment.

**Consequence.**
- `allInMonthly` and therefore `burdenRatio` are now identical in all three scenarios, so the `burden` check no longer separates them. Only `cash`/`reserve` discriminate. Recorded in [ASSUMPTIONS §3](ASSUMPTIONS.md).
- The trade-off matrix loses its "Monat" column (it would read zero everywhere) and gains **Laufzeit**, which is what actually moves.
- The doors show "X Jahre schuldenfrei" instead of the monthly rate, for the same reason.
- A new `payment` constraint catches a rate that does not cover the interest, rather than reporting an 80-year runtime as if it were an answer.
- `TradeoffStatement` says "X Jahre früher schuldenfrei" where it used to say "Y € weniger im Monat".

---

## D15 — The EK levels are 10 / 15 / 20%

**Date:** 2026-08-08 · **Status:** accepted · **Supersedes** the "fixed at 5/10/15% EK" clause of D9

**Context.** The broker quoted 90% / 85% / 80% Finanzierung. 5% EK was never on the table.

**Decision.** `ScenarioId` becomes `ek10 | ek15 | ek20`.

**Rationale.** The app exists to decide between the options that actually exist.

**Consequence.** Everything that looked scenarios up by id or by array position now derives from the list (first, middle, last), so the next change is a change in `defaults.ts` alone. The copy "Keine der drei Varianten ist tragbar" and "Drei Wege" survives unchanged — there are still exactly three. `CompromiseFinder`'s middle door is now strictly the middle *scenario*: binding it to `decision.recommendation`, which prefers 10% EK, rendered the same door twice once 10% became the lowest level.

---

## D16 — The Sollzins is a matrix over EK level × Zinsbindung; 20 Jahre is dropped

**Date:** 2026-08-08 · **Status:** accepted · **Supersedes** D13

**Context.** The offer prices six combinations, and they do not move together: at a 15-year binding 10% and 15% EK carry the *identical* rate (4,06%), and the real drop only arrives at 80% Beleihung. A single rate per EK level cannot express that. 20 years was never quoted.

**Decision.** `InterestRates = Record<FixedPeriod, Record<ScenarioId, number>>` with `FixedPeriod = 10 | 15`. Both columns are always visible and independently editable; the active one is marked. The free-text "Zinsbindung frei" field is removed.

**Rationale.** A freely typed binding would have no rate behind it and would only pretend to compute something. Showing both columns at once is what makes the non-monotonic pricing visible instead of surprising.

**Consequence.** `rateFor(rates, fixedRateYears, id)` is the only way to read a rate, and `normaliseFixedPeriod` clamps stray values (a v1 save holding 20 years) onto a real column. Persistence goes to `version: 2`; v1 rates are **dropped rather than mapped**, because a flat v1 rate carries no record of which binding it belonged to.

---

## D17 — Sondertilgung is measured against the selected scenario, full stop

**Date:** 2026-08-08 · **Status:** accepted · **Supersedes** D10

**Context.** D10 gave the user two controls: a free "Vergleichsziel" (any EK level) and a "dabei" mode (ohne Sondertilgung / mit aktuellem Plan). That is four readings of one table, and in testing the owner could not tell which question was on screen — the section's own labels did not distinguish "10% EK needs 7.400 €/Jahr" from "we need 7.400 €/Jahr".

**Decision.** Both pickers are removed. The reference is always the EK level selected at the top of the page, running its current yearly plan. Every other level is shown *without* Sondertilgung of its own.

**Rationale.** There is one question worth asking here — what does our Sondertilgung buy, and does it close the gap to the other EK levels? Freedom to re-aim the comparison bought expressiveness nobody used at the cost of the section being unreadable.

**Consequence.** `compareSpecialScenarios(bases, selectedId, inputs, rates)`. Each non-selected row carries a `catchUp` that **names the payer**: whichever side is behind is the one that would have to pay, and the UI prints that name. Two tests pin both directions. The section now leads with three numbers (ohne ST / mit Plan / Ersparnis) and a grouped bar chart, and the "Rechnerisches Ergebnis, keine Verhaltensgarantie" disclaimer is gone — it stated the obvious; the contractual cap it also carried moved to the Jahresplan editor, where it is actionable. The editor itself has a single "Jahr hinzufügen" button that fills the first empty year, so deleting year 4 and adding again returns year 4.

---

## D18 — Assumptions live on one page, in boxes, not behind tabs

**Date:** 2026-08-08 · **Status:** accepted · **Extends** D2

**Context.** D2 removed the app's tabs but left three inside the Annahmen panel (Haushalt / Finanzierung / Erweitert). Two people reading together could see a third of their assumptions at a time and had to hold the rest in memory.

**Decision.** Five labelled boxes on one page, ordered along the decision: Eigenkapital & Kaufkosten · Haushalt · Darlehen · Sollzinsen laut Angebot · Markt.

**Consequence.** `INPUT_GROUPS` becomes `INPUT_BOXES` and the `inputGroup` state leaves `App`. The Tilgung field keeps its own three-way mode switch — that is one value seen three ways, not three groups of fields, and it stores `monthlyPayment` now.

---

## D19 — The right panel holds as many readouts as fit without scrolling; today that is five

**Date:** 2026-08-08 · **Status:** accepted · **Refines** D7

**Context.** D7's rule was written as "capped at four readouts". Four was the number that happened to fit; the guarantee was always "nothing hides below an inner fold". A fifth readout — the Darlehenssumme, the one figure a bank offer leads with — was worth the space.

**Decision.** The rule is the no-internal-scroll guarantee. The count follows from it. Adding a readout means re-checking at 1280×800, not consulting a number in a document.

**Consequence.** Readout padding and value size shrink slightly. The "x seit letzter Änderung" line is removed entirely: it replaced each readout's explanation with a delta nobody asked for, and it fired on apartment switches too, so it could report a change the user had not made.

---

## D20 — Warten is a table with metrics as rows

**Date:** 2026-08-08 · **Status:** accepted

**Context.** Three cards of up to eight readouts each — twenty-odd numbers with no shared baseline. Comparing "Cash nach Kauf" across the three options meant finding the same label three times at three different heights.

**Decision.** Metrics become rows, waiting periods become columns, in the existing dense table style.

**Rationale.** Reading across is the entire job of this section, so the layout is a row. It also drops `.wait-columns` / `.wait-column` / `.wait-column-head` and reuses a component that already exists.

---

## D21 — The sticky header carries context, not controls

**Date:** 2026-08-08 · **Status:** accepted · **Refines** [D8](#d8--the-sticky-header-is-a-fixed-height-and-holds-nothing-collapsible)

**Context.** The apartment switcher sat in the sticky header and took 92px of every screen, permanently. It is used once at the start of a session: you pick the flat you are looking at and then spend an hour on the EK question.

**Decision.** The chips move to the top of §1. The header keeps the brand row plus the active apartment's **name and price as read-only text**.

**Rationale.** Permanent screen space should go to something read continuously, not to a control used once. But the apartment must never be ambiguous — [D3](#d3--apartments-are-a-context-switcher-plus-a-read-only-comparison-table) exists because two apartments' numbers once appeared side by side — so the *identity* of the active flat stays visible while the *means of changing it* does not. Text also cannot be clicked by accident while scrolling.

**Consequence.**
- `--header-height` drops from 142px to 50px; roughly 92px of viewport goes back to content on every screen.
- `.app-header` now sets `height: var(--header-height)` explicitly with the topbar flexed inside it. Previously the header's height came from its text metrics and happened to be 43,85px against a declared constant of 50px — a 6px band in which scrolling content showed through beneath the header and above the step rail. Asserting the height makes the constant and the rendered box incapable of disagreeing, which is what D8 was actually after.
- The rule from D8 is unchanged and now easier to keep: nothing collapsible, nothing variable-height, nothing interactive in the header.

---

## D22 — "Vom Plan gedeckt" is decided on modelled interest, never on the plan's average

**Date:** 2026-08-08 · **Status:** accepted · **Refines** [D17](#d17--the-sondertilgung-comparison-has-exactly-one-reference-the-selected-ek-level-running-its-plan)

**Context.** The catch-up cell asked "does our Sondertilgung close the gap?" by comparing two numbers that are not comparable: `catchUp.amount` is a flat payment made **every year of the runtime**, while `inputs.annualSpecialRepayment` is the **average of a finite path** — ten years at 6.000 €, then nothing. On the defaults with 10% EK selected, that plan leaves 202.498 € of interest against 186.979 € for 20% EK without any Sondertilgung, yet its 6.000 € average exceeds the required 5.712 €, so the cell printed *"vom Plan gedeckt"* for a plan that is 15.519 € short. The defect favoured the low-EK side of the couple's disagreement — the same failure mode as [D14](#d14--ek-levels-are-compared-at-a-constant-monatsrate-not-a-constant-tilgungssatz).

**Decision.** `compareSpecialScenarios` publishes the answer instead of leaving the UI to infer it: `catchUp.planCovers` compares the payer's **modelled** total interest under the configured yearly path against `targetInterest`, and `catchUp.planShortfall` carries the € gap. The panel reads those fields and never touches the average.

**Rationale.** The comparison is only sound in interest space. Any € figure the UI sets against `amount` re-introduces the same class of bug, because a path and a flat payment of equal size buy different amounts of interest.

**Consequence.** With the selection behind, `planCovers` is false by construction — the row is only shown as a catch-up target *because* the selection running its plan is still more expensive — so the cell now states the shortfall (*"euer Jahresplan bleibt 15.519 € Zinsen darüber"*) instead of a false all-clear, and labels the amount *"jedes Jahr der Laufzeit"* so it cannot be read as a plan average. `CatchUpCell` no longer receives `configured`. Two tests pin both directions: the defaults must not report covered, and a plan that genuinely reaches the target must.

---

## D23 — Validation against other calculators is a test, not a screen

**Date:** 2026-08-08 · **Status:** accepted · **Amends** [PRODUCT_SPEC §7.6](PRODUCT_SPEC.md#76-qa-and-assumptions)

**Context.** `compareExternal` let the user type a second calculator's Monatsrate, fixed-period interest and Restschuld and see the differences with a tolerance band. It was complete, tested — and had no UI, so nobody could reach it. Meanwhile `offer.test.ts` pins all six variants of the real broker offer to within 8 cents on every commit.

**Decision.** The function, its types and its test are removed. §19's validation requirement is met by `offer.test.ts`.

**Rationale.** A test does this job strictly better than a panel: it runs automatically, it cannot be skipped, and it compares against the actual offer rather than whatever the user retypes. Keeping an unreachable feature alive costs render surface, engine surface and reader attention, which is the failure mode [D6](#d6--one-comparison-one-place) names.

**Consequence.** If a *new* offer needs checking, the move is to extend `offer.test.ts` with its variants — not to rebuild the panel. Recoverable from git history if that judgement turns out wrong.

---

## D24 — One number, one control: Kaufnebenkosten

**Date:** 2026-08-08 · **Status:** accepted · **Refines** [D6](#d6--one-comparison-one-place)

**Context.** "Eigenkapital & Kaufkosten" held a SegmentedChoice (8% / 11,57%) and, immediately below it, a free "Kaufnebenkosten frei" field. Both wrote `closingCostRate`, so moving one made the other jump — two controls presenting themselves as two settings while being one.

**Decision.** One `ClosingCostField`: the two presets as buttons above a single editable percentage, laid out exactly like `PaymentField`.

**Rationale.** Free entry earns its place — Grunderwerbsteuer runs 3,5%–6,5% by Bundesland, and the 11,57% default is specific to one deal. What had to go was the *second control*, not the capability. The app already had the right pattern one box below: Monatsrate / Tilgungssatz / Laufzeit is one value with three ways in.

**Consequence.** `SegmentedChoice` now has exactly one caller (Zinsbindung), where the options really are the only permitted values.

---

## D25 — The sticky header carries exactly one control: the EK choice

**Date:** 2026-08-08 · **Status:** accepted · **Amends** [D8](#d8--the-sticky-header-is-a-fixed-height-and-holds-nothing-collapsible) and [D21](#d21--the-sticky-header-carries-context-not-controls) — their *fixed height* rule is unchanged and load-bearing; their *nothing interactive* clause is not

**Context.** D21 moved the apartment chips out of the header on the grounds that permanent screen space should go to something read continuously, not to a control used once at the start of a session. That reasoning was right about the apartment and wrong by generalisation about controls as such. The EK level is the opposite case: it is the question the whole app exists to answer, and it is re-asked constantly — the trade-off matrix, the Verlauf chart, the Sondertilgung comparison and the right panel all re-render around it. Answering "and at 20%?" while reading section 5 meant scrolling back to §1, which loses the place *both* readers are holding, and then scrolling back down to find the number again.

**Decision.** Three buttons — 10 / 15 / 20% — centred in the sticky header, between the brand and the apartment context. They set the same `selectedId` as the doors in §1.

**Rationale.** The rule worth keeping from D8 is the *fixed height*, not the ban on interactivity: the failure D8 actually fixed was a header whose measured height disagreed with `--header-height`, so a band of scrolling content showed through the seam. A row of 26px buttons inside a 50px band cannot cause that. Nothing here is collapsible and nothing grows with its content, so the constant holds — which is verified at 1280, 1000, 820 and 560px, where the header measures exactly 50px in all four.

**Two controls for one value is not [D6](#d6--one-comparison-one-place) accretion here**, and the distinction matters: D6 is about the same *comparison* being rendered repeatedly. The switch renders no comparison. It carries the rate and nothing else — no status, no interest, no cash — precisely so it stays a way in rather than becoming a fourth view of the EK question. The doors keep the verdicts, where there is room to say them in words.

**Consequence.**
- `--header-height` stays 50px. Anything added to the header from here needs the same fixed-height test at all four widths.
- The topbar no longer stacks at ≤880px (it used to become a grid, which was harmless for text and is not for a control inside a fixed-height band). It drops content instead, in order of cost: the brand wordmark, then the "+ X € Nebenkosten" note, then the price. The apartment's **name** and the switch survive every width — [D3](#d3--apartments-are-a-context-switcher-plus-a-read-only-comparison-table) exists because two apartments' numbers once appeared side by side.
- The status is out of the visible chip but not out of its accessible name (`aria-label="20% Eigenkapital — Tragbar"`), so it is not lost to a screen-reader user who cannot scroll to §1 to hear it.

---

## D26 — The charts answer on hover, and by keyboard

**Date:** 2026-08-08 · **Status:** accepted · **Extends** [D9](#d9--capabilities-restored-from-the-original-prototype)

**Context.** Both charts were read-only pictures. The Verlauf chart labels each line at its right-hand end, which answers "which line is which" and not the question actually asked of it — *"what is the Restschuld in year 12, in all three?"*. The axis has to round to "250k", so even reading one line off the grid gives a number nobody would put in a decision. The Sondertilgung bars print their own values but never the gap between them, which is the one number the row exists to show.

**Decision.** Hovering the Verlauf plot reads **every series at one year at once**; hovering a Sondertilgung row reads **both its bars plus their difference**. Both panels use the exact format (`formatEur`) rather than the axis's compact one.

**Rationale.** The interaction adds no new view — it exposes numbers the charts already draw, at the precision the axes had to give up. That is the opposite of the accretion [D6](#d6--one-comparison-one-place) warns about: it makes an existing surface answer its own question instead of adding a surface that repeats it.

**A hovered value is read off the line, not looked up by exact x.** Every scenario's last point is its exact payoff moment — 19,17 / 21,67 / 24,08 years on the defaults — so several hoverable positions are fractional. At 19,17 the 20% line ends while 10% and 15% are still running and visibly cross that x, but their own points sit at 19 and 20. An `=== x` lookup dropped them, and the panel showed **one** series where the reader could see three, on the very chart whose purpose is reading all of them at once. `valueAt` interpolates linearly between the surrounding points, which invents nothing: the chart draws straight segments, so the figure reported is exactly the one on screen. Anything smoother would claim more than the picture does.

**Consequence.**
- Both charts are focusable and walk by keyboard: the Verlauf chart with ←/→ along its time axis, the Sondertilgung bars with ↑/↓ along their stacked rows (Home/End/Esc on both). Two people at one screen do not always share a mouse, and the repo already treats hover-only affordances as a defect — `InfoTip` opens on hover *and* focus for the same reason. The bar chart was pointer-only in the first draft, which left the exact figures and the derived difference unreachable in the section next door to a chart that was not.
- Each chart carries a persistent `aria-live` line rather than announcing the panel itself: a node that mounts and unmounts with the cursor is announced unreliably.
- `LineChart` gains `formatDetail` / `formatX`, `BarChart` gains `formatDetail` / `formatDelta`. All four default to existing behaviour, so a caller that wants no hover detail keeps the old output.
- The hover panel is HTML in a `position: relative` wrapper, positioned in **percentages** of the figure box. The SVGs are declared at a fixed `viewBox` and stretched to the column, so pixel offsets would drift on every resize.
- Still no charting dependency. The interaction cost ~120 lines; a library would be inlined whole into `dist/mortgage-helper-standalone.html`.

---

## D27 — "Δ zu jetzt kaufen" splits into interest, rent, and the sum

**Date:** 2026-08-08 · **Status:** accepted · **Refines** [D4](#d4--waitsavingsmonthly-is-net-of-rent)

**Context.** The Warten table's "Δ zu jetzt kaufen" row showed `deltaInterest` alone, with the rent paid while waiting sitting two rows below as a separate figure nobody was adding up. On the defaults that reads **−16.978 € besser** for waiting twelve months — while 23.640 € of rent is paid for a home the couple does not own. The row that looks like the bottom line said waiting is cheaper; including the rent, it is 6.662 € more expensive. The sign was wrong, not just the magnitude.

**Decision.** Three rows, in this order: **Δ Zinsen** (interest only) · **Miete in der Zwischenzeit** · **Δ gesamt** = the sum, ruled off and weighted as the section's bottom line. New engine field `WaitScenario.deltaTotalCost`.

**Rationale on the arithmetic.** Adding rent to an interest delta is a comparison of like with like, not a double count: over the same months the buy-now column is paying interest, and that interest is already inside its `interestTotal`. Rent is the waiting side's counterpart to it. Principal is left out of both — it becomes equity rather than cost — and the different purchase prices show up in "Kaufpreis dann" and "Darlehen dann".

**This does not reopen [D4](#d4--waitsavingsmonthly-is-net-of-rent).** D4 governs *capital*: `waitSavingsMonthly` is already net of rent, so subtracting `rentPaid` from `adjustedAvailableCapital` would count it twice. What waiting **costs** and what capital it **leaves** are different questions, and rent belongs to exactly one of them. The two rows looked contradictory side by side, so the table now says why in a footnote rather than leaving the reader to reconcile them.

**Consequence.** Both deltas stay on screen — a single combined figure would hide which half moved, and the split is what makes the reversal legible. `deltaTotalCost` collapses to the interest delta in the buy-now column, where `rentPaid` is zero; a test pins that, and another pins that the difference between the two rows is exactly the rent.

---

## D28: The verdict lists every tragbar level; there is no single recommendation

**Date:** 2026-10-08 · **Status:** accepted · **Amends** [PRODUCT_SPEC §13](PRODUCT_SPEC.md#13-decision-logic)

**Context.** `evaluateDecision` preferred "10% EK when feasible", and the verdict headline printed that recommendation ("10% EK ist tragbar"). The rule dates from the 5/10/15 grid, where 10% was the compromise in the middle. [D15](#d15--the-ek-levels-are-10--15--20) moved the grid to 10/15/20 and fixed the middle *door* for exactly this reason, but not the engine. Since then the rule named the **lowest** level, the maximum-liquidity option: one spouse's side of the argument, chosen by code, in the first sentence on screen.

**Decision.** `DecisionResult.recommendation` is removed. The headline lists the tragbar levels ("10% und 15% EK sind tragbar") and names the others with their status ("Nicht tragbar: 20% EK (Reserve zu dünn)"). When nothing is tragbar the existing "Keine der drei Varianten ist tragbar" state is unchanged.

**Rationale.** The app's job is to make the trade-off measurable, not to settle it. A rule that prefers a level would have to be argued for on the merits, and no such argument exists in the spec beyond "the middle one", which 10% no longer is.

**Consequence.** The tragbar definition in the verdict and in the glossary now states all three conditions the engine checks (Rate tilgt, Reserve, Belastung) and the 1,5× rule behind "Gerade so tragbar". Tests assert the feasible set, never a preferred level.

---

## D29: Every ETF comparison is after tax

**Date:** 2026-10-08 · **Status:** accepted · **Amends** [PRODUCT_SPEC §15](PRODUCT_SPEC.md#15-etf-opportunity-cost) and §18 ("no tax calculation")

**Context.** The trade-off statement netted pre-tax ETF growth against the mortgage interest saved. Interest an owner-occupier does not pay is not income, so that side is tax-free; ETF gains are taxed on realisation. On all three default apartments the statement read "für mehr Liquidität"; after tax it reads "für mehr Eigenkapital" (offer flat: −3.280 € → +1.945 €). K18.

**Decision.** New input `etfTaxRate`, default 18,4625% (Abgeltungsteuer + Soli on 70% of the gain, equity ETF, no Kirchensteuer), editable under Markt. `compareEkScenarios` reports `etfForegoneGross` and the after-tax `etfForegone`; the statement shows the after-tax ETF rate next to the ETF chip.

**Rationale.** Spec §15 calls this "the single most important calculation in the app". Leaving out a tax that applies to one side only is not a simplification, it is a bias.

**Consequence.** §18's "no tax calculation" now has one deliberate exception: tax on ETF gains in comparisons. Tax on ETFs sold to fund the purchase is not modelled; `availableCapital` is entered after that tax (glossary).

---

## D30: Comparisons are made on one common date, from one ledger

**Date:** 2026-10-08 · **Status:** accepted · **Supersedes** the Nettovermögen readout of [D9](#d9--capabilities-restored-from-the-original-prototype)

**Context.** Each comparison in the app had its own basis: interest alone, interest plus rent, pre-tax ETF growth, full-term totals at each scenario's own payoff date. Several defects came from exactly that (K1, K10, K15, K18). "Nettovermögen" was valued at each scenario's own payoff year, so the same flat looked 67.000 € more valuable at 10% EK because that loan runs five years longer (K19). The trade-off matrix and the Sondertilgung headline led with full-term interest, the latter with no opportunity cost (K20).

**Decision.**
1. `wealthAtHorizon()`: one monthly ledger valuing a path (EK level, Sondertilgung plan, months of waiting) on one date, by default the end of the binding: flat − Restschuld + free capital after tax. It reuses `simulateMortgage` through a read-only `onMonth` hook. Formulas in [ASSUMPTIONS §2](ASSUMPTIONS.md).
2. Verlauf: "Immobilienwert bei Abzahlung" and "Nettovermögen" (and their engine fields) are replaced by "Vermögen" and "Frei verfügbar" at the end of the binding.
3. Trade-off matrix: "Zinsen gesamt" becomes "Zinsen in N J." (the reliable figure).
4. Sondertilgung headline: paid in, Restschuld reduction (and the interest part of it), and the wealth difference against the same money kept in the ETF, all at the end of the binding. The full-term bar chart stays, labelled illustrative.
5. The household budget in the ledger is `waitSavingsMonthly + currentWarmRent` (D4 read the other way round). For rent and ownership to be comparable, `currentWarmRent` and `monthlyOwnershipCosts` are now defined on the same basis: both include heating and Nebenkosten, both exclude electricity. The ownership-cost glossary used to say "nicht umlagefähiges Hausgeld", which against a warm rent understated owning.

**Rationale.** One function at one date makes a difference between two calls a like-for-like difference by construction. Tests pin that the ledger reproduces the after-tax trade-off to the cent and that Sondertilgung is neutral when the ETF earns exactly the loan rate untaxed.

**Consequence.** **Check the Eigentumskosten per apartment** against the Exposé's Hausgeld (incl. Heizung) plus Grundsteuer: the stored 640 / 690 / 760 € were entered under the old wording. The Warten table is not yet on the ledger: its replacement waits on a layout choice (REVIEW.md U5), and ASSUMPTIONS §5 lists its bottom line as open.

---

## D31: The Restschuld gets a refinancing stress line

**Date:** 2026-10-08 · **Status:** accepted

**Context.** The Restschuld after the binding was shown as the refinancing-risk indicator, but a balance does not say what it means, and the argument for more Eigenkapital that it carries stayed implicit.

**Decision.** New input `refiStressShift` (default +2 %-Pkt., under Markt) and `refinanceStress()`: at the **same Monatsrate**, how many years longer the loan runs if the Anschlusszins is that much higher, or that the rate would no longer cover the interest. Shown as the subline of the existing "Restschuld danach" readout; the readout turns red when the rate would not cover the interest.

**Rationale.** Holding the rate keeps D14's reading (the Monatsrate is the budget) and makes the risk comparable across EK levels. A stress, not a forecast: it says what a shock does, not that it will come. A single number, not an Anschlussfinanzierung model (spec §10).

**Consequence.** No new readout: the panel stays at five and does not scroll at 1280×800 (D19). Verified at 1280 / 1000 / 820 / 560 px: the header still measures exactly 50 px. Offer flat: 10% EK +3,2 J., 20% EK +1,2 J.; Wohnung C at 10% and 15% EK: the 1.900 € rate would not cover the interest.

---

## D32: Every step of extra Eigenkapital gets a yearly return, in the matrix and as a chart

**Date:** 2026-10-08 · **Status:** accepted · **Extends** [D29](#d29-every-etf-comparison-is-after-tax)

**Context.** The headline compares only the two ends (10% vs 20%). The bank's pricing is not monotone, so the steps can point different ways: on the offer, 10→15% buys almost no rate (3,87 → 3,86%), 15→20% buys the drop to 3,76% on the whole loan. A single net figure cannot show that, and a yearly rate is the unit the couple's disagreement is actually about.

**Decision.** `ekStepReturn()`: the tax-free yearly rate at which a step's extra cash grows into the Restschuld it removes by the end of the binding, the pre-tax ETF return at which keeping the money invested would do as well, and the verdict. Shown twice, by the owner's explicit choice from the mockup (REVIEW.md U2, options B and C): a "Rendite der Mehr-EK" column in the trade-off matrix and a step chart under it.

**Rationale on showing it twice.** [D6](#d6--aggressive-deletion-the-same-comparison-was-rendered-five-times) treats a second rendering of the same comparison as a regression. This one is a deliberate exception chosen by the owner: the column gives exact figures for each pair, the chart makes the non-monotone pricing visible at a glance (offer: 4,1% and 5,0% p.a. against ≈4,2% for the ETF after tax). An invariant test pins that the step verdict never disagrees with the after-tax trade-off at any ETF assumption, so the two renderings cannot drift apart.

**Consequence.** The chart's bars start at 0%, not at the smallest value as in the mockup: a cut axis would make 4,1% against 5,0% look like a factor of three. Each bar carries its verdict in words ("EK vorn" / "ETF vorn"), never colour alone.

---

## D33: The Warten bottom line is a wealth difference on one date, plus where it flips

**Date:** 2026-10-08 · **Status:** accepted · **Supersedes** the bottom line of [D27](#d27--δ-zu-jetzt-kaufen-splits-into-interest-rent-and-the-sum)

**Context.** D27's "Δ gesamt" added a full-term interest delta to rent. It extrapolated the assumed rate shift over 25+ years and left out the buy-now path's ownership costs and principal, the return on capital while waiting, and the extra cash a later purchase leaves. On the offer flat it read "6.662 € teurer" for a year of waiting; on one date, from the ledger ([D30](#d30-comparisons-are-made-on-one-common-date-from-one-ledger)), waiting is 3.207 € ahead at the default assumptions. On Wohnung C it read 79.374 € "besser" where the ledger says 15.866 €. K22.

**Decision.** Owner's choice from the mockup (REVIEW.md U5, option A). The table keeps Kaufpreis, Zinssatz, Darlehen and Cash nach Kauf, and replaces Zinsen gesamt, Δ Zinsen, Miete and Δ gesamt with Restschuld and free capital in N years and **Δ Vermögen zu jetzt kaufen**. Every column shares one horizon. Under the table, one sentence for the entered Wartezeit: who is ahead by how much, and the value of each assumption (rate change, price rise, return on capital) at which that flips, each on its own.

**Rationale.** It answers the question [PRODUCT_SPEC §2.3](PRODUCT_SPEC.md#23-should-we-buy-now-or-wait) actually asks ("what conditions would need to occur for waiting to beat buying now") and shows how fragile the answer is: on the offer flat, a 0,3-point rate drop is assumed and the verdict flips at 0,2.

**Consequence.** `WaitScenario.deltaInterest` and `deltaTotalCost` are removed; `deltaWealth`, `wealth` and a ledger-based `cashLeftAfterPurchase` take their place. Rent stays in the model, paid out of the household budget inside the ledger, which is where D4 puts it.

---

## D34: A tragbar scenario that runs past the couple's own limit is flagged, not failed

**Date:** 2026-10-08 · **Status:** superseded by [D43](#d43-repaid-by-retirement-is-a-bank-condition-not-a-warning)

**Context.** Feasibility only failed a loan that would not be repaid inside 60 years. Wohnung C at 10% EK ran 49,5 years at 1.900 €/Monat with no warning. The owners gave their birth years; the older partner reaches the statutory retirement age of 67 about 26 years after a 2026 purchase.

**Decision.** New input `maxRuntimeYears`, default 26, under Darlehen ("Max. Laufzeit"). A scenario that is tragbar but runs longer shows the amber status "Läuft zu lange". It stays tragbar. Failed checks still name themselves first.

**Rationale.** The runtime rests on today's rate holding for the whole term (ASSUMPTIONS §1), so it can warn but must not decide. A loan into retirement is a real risk and one of the two people reading this is the one who would be retiring.

**Consequence.** The birth years are not stored anywhere in the repository, only the derived 26 years. On the defaults Wohnung B at 10% EK (29,6 years) is flagged. The QA presets pin `maxRuntimeYears: 35` so they keep testing tragbarkeit rather than the personal limit ([D12](#d12--kaufnebenkosten-two-presets-and-1157-as-default)).

---

## D35: "Eigentumskosten" becomes Hausgeld from the Exposé plus one owner's extra

**Date:** 2026-10-08 · **Status:** accepted · **Refines** [D30](#d30-comparisons-are-made-on-one-common-date-from-one-ledger)

**Context.** D30 required the apartment's monthly ownership costs to sit on the same basis as the warm rent. Asked what the stored 640 / 690 / 760 € contained, the owner could not say, and could not be expected to: the git history shows they were never taken from an Exposé. The initial commit carried the spec's 830 € placeholder for a 720k flat; a later cleanup scaled it with the purchase price. A field whose meaning cannot be reconstructed cannot be checked against a real offer.

**Research.** An Exposé's Hausgeld is the WEG's Wirtschaftsplan share: administration, building insurance, Betriebskosten, the WEG's Erhaltungsrücklage and, with central heating, heating. It does **not** contain Grundsteuer, which the municipality bills each owner directly, nor repairs inside the owner's own flat, which the WEG reserve does not cover ([Finanztip](https://www.finanztip.de/eigentumswohnung/hausgeld/), [immowelt](https://www.immowelt.de/ratgeber/wohnen/hausgeld)). The owner's own guess matched this.

**Decision.** The apartment field becomes **"Hausgeld mtl. (laut Exposé)"**, a number the couple can look up. One global input, **"Grundsteuer + eigene Rücklage"**, default 90 €/Monat, carries the rest: Grundsteuer for a flat roughly 300–500 €/Jahr after the 2025 reform (≈ 35 €/Monat; [Haus & Grund survey](https://www.hausundgrund.de/sites/default/files/downloads/grundsteuerreform-2025sonderauswertung.pdf): all residential property, median 654 €/Jahr) and an own reserve of ≈ 55 €/Monat (Peters'sche Formel puts ~30% of upkeep on the Sondereigentum). `buildApartmentInputs` sets `monthlyOwnershipCosts = hausgeld + ownerExtraMonthly`.

**Best guess for the defaults.** The three totals are kept exactly (Hausgeld 550 / 600 / 670 € + 90 €), so no figure on screen moves; the golden snapshot proves it. They are probably on the **high** side: a typical Hausgeld including heating is 3–5 €/m² a month, and 550 € would mean a large flat or an expensive building. Erring high follows [D12](#d12--kaufnebenkosten-two-presets-and-1157-as-default): a decision tool must not make the purchase look cheaper than it is likely to be. It does not tilt the EK question at all: ownership costs are identical across the three EK levels and cancel in every EK comparison. They do move the burden check, the Warten comparison and the absolute Vermögen.

**Consequence.** Saves from before D35 stored a total per apartment; they load as Hausgeld = old total − extra, so every figure the couple saw is unchanged. With a gas heater inside the flat, the heating costs belong in the Hausgeld field (the tooltip says so).

---

## D36: The Sollzinsen carry their Stand und Quelle; apartments can be named

**Date:** 2026-11-18 · **Status:** accepted

**Context.** Rates had risen since the offer of 07.08.2026. The six numbers on screen gave no hint how old they were, and a stale rate reads exactly like a current one. Apartment names were fixed at "Wohnung B/C".

**Decision.** The persisted state gains `ratesNote`, one free-text field "Stand und Quelle" under the Sollzins grid. Free text rather than a date field because one grid can mix quotes from several sources and days ("10 J.: Interhyp vom 18.11.26 · 15 J.: Hausbank …"). Typing any rate clears the shipped default note and marks the field as missing; a note the couple wrote stays. Each apartment gets an editable name and a free-text note in "Fakten bearbeiten". The model reads neither.

**Consequence.** Saves without `ratesNote` get the default note only if their rates still equal the defaults; otherwise the field is empty and marked. Storage stays at version 2: both fields are additive and revived defensively. The box is renamed "Sollzinsen", since later rates need not come from that offer.

---

## D37: Higher contrast through a dark frame; repeated explanations fold away

**Date:** 2026-11-18 · **Status:** accepted · **Refines** [D6](#d6--aggressive-deletion-the-same-comparison-was-rendered-five-times), [D19](#d19--the-right-panel-holds-as-many-readouts-as-fit-without-scrolling-today-that-is-five)

**Context.** On the owner's screen the beige, grey and white blocks were hard to tell apart (page `#f7f3ec`, cards `#fbf8f1`, rules `#e6dfce`), and the first screen was still dense.

**Decision.** Of three mockups the owner chose a dark frame: header and step rail on `--frame` (#3a3631), white cards on a tinted page, darker rules, text and accent tones. Fonts unchanged. The verdict shrinks to headline plus what is not tragbar; the definition of tragbar folds into "Was heißt tragbar?". The trade-off sentence folds to its net figure with the full text under "Details". The selected door is sage instead of black. Status pills gain a glyph (✓ / ! / ✕), so they no longer rely on colour (rule 4).

**Consequence.** Header still measures `--header-height` at 1280 / 1000 / 820 / 560px, and the right panel still does not scroll at 1280×800.

---

## D38: Export as a file and an optional, manual Google Sheet sync

**Date:** 2026-11-18 · **Status:** accepted

**Context.** Everything lived in one browser's localStorage. The owner enters assumptions on the PC and the phone and wants apartments and rates kept without retyping.

**Decision.** Two ways out of the browser, both carrying the same `Bundle` (screen state plus every named save) and both passing through `reviveState`:
1. **JSON export / import.** Works offline, including in the standalone file. Import shows what it will load and asks first.
2. **Google Sheet via Apps Script** (`docs/google-sheet-sync/`). The Sheet is in the owner's Drive; a container-bound script, deployed as a web app, stores the bundle and writes read-only overview tabs. A token in Script Properties guards it. Load and save are **manual buttons**: an automatic pull would replace numbers while someone reads them. A save is refused if the Sheet holds a state this device has not seen; the couple then chooses "Erst laden" or "Trotzdem überschreiben".

A database service (Supabase, Firebase) was rejected: a new dependency, an account and auth for two people and a few dozen records, with nothing gained over a Sheet they already own.

**Consequence.** CLAUDE.md's "no network call" rule for the standalone build still holds by default: no request is made until a device is connected and a button pressed. URL and token live in `mdh:sync` in that browser only, never in a bundle. The web app is reachable by anyone with URL and token; that is the protection, not Google sign-in. The Apps Script itself is not covered by CI; `sync.test.ts` tests the client against a fake that mirrors `Code.gs`.

---

## D39: Sheet Laden / Speichern move into the header

**Date:** 2026-11-18 · **Status:** accepted · **Refines** [D25](#d25--the-sticky-header-carries-exactly-one-control-the-ek-choice), [D38](#d38-export-as-a-file-and-an-optional-manual-google-sheet-sync)

**Context.** With the sync working, the owner asked for the save buttons at the top right, provided the Sheet holds *every* input. It does: the bundle carries inputs, rates and their note, every apartment with its Sondertilgung plan, the wait fields, the chosen EK level and every named save. Only view state (chart tab, open details) stays local. A tinted "this goes to the Sheet" area in §2, the alternative the owner offered, would therefore have marked a boundary that does not exist.

**Decision.** Two fixed-height buttons at the header's right edge: **Laden** (download icon) and **Speichern** (floppy icon). Speichern shows "● neu" when the screen or a named save differs from what was last loaded or saved, compared through a key-order-independent serialisation. Confirmations, conflicts and messages open in `SyncPopover`, rendered next to the header, because the header's clip-path would cut it and its growth would break `--header-height`. Unconnected, the header shows one "Sheet verbinden" button that opens the settings in §2. The token field gains an eye toggle, also once connected, so it can be read off and typed on the other device.

**Consequence.** Header still measures 50px at 1280 / 1000 / 820 / 560px and on an iPhone 13 (390px), with no horizontal scroll. Below 880px the buttons drop their words (the icons carry aria-labels); below 620px the topbar leaves its centred grid so the apartment name keeps its width; below 440px the brand dot goes.

---

## D40: Kaufnebenkosten and Monatsrate move onto the apartment; the two Shortlist flats ship as defaults

**Date:** 2026-11-22 · **Status:** accepted · **Refines** [D3](#d3--apartments-are-a-context-switcher-plus-a-read-only-comparison-table), [D12](#d12--kaufnebenkosten-two-presets-and-1157-as-default)

**Context.** The owner wanted the two flats marked "Vergleichen? Ja" in their Shortlist Sheet (Lindenstraße 31G, BUWOG Arbor H2 WE08) selectable without retyping. Two inputs were global and could not hold both: the Lindenstraße flat carries 3,57% Käuferprovision (11,57% KNK), BUWOG sells directly (8%), a 23.400 € difference on 655.100 €; and the one Monatsrate of 1.900 € was sized for the 405k offer loan and does not cover the interest on BUWOG's 590k loan, so BUWOG would have read "nicht tragbar" by construction.

**Decision.** `ApartmentCase` gains `closingCostRate` and `monthlyPayment`; `buildApartmentInputs` takes both from the apartment. The controls stay where they were in §2 but write to the active apartment, and their hints say "gilt nur für die gewählte Wohnung". Older saves revive each apartment with the global value they used, so no stored figure moves. The two flats are appended to the defaults with stable ids, and `reviveState` appends them to any autosave, named save or Sheet state that lacks them, matched by id, so an edited copy is never overwritten or duplicated.

Figures as in the Sheet on 22.11.2026: prices include the parking space (520.000 € = 495.000 + 25.000 TG; 655.100 € = 625.100 Aktionspreis + 30.000 Stellplatz), renovation is the 12.000 € kitchen both lack, Hausgeld 630 € (Exposé) and 331 € (BUWOG estimate). Monatsraten are estimates ([ASSUMPTIONS §4.17](ASSUMPTIONS.md)).

**Consequence.** The golden snapshots for the three existing apartments are unchanged; two new ones pin the Shortlist flats. KfW 300, Bereitstellungszinsen and rent until BUWOG's 2028 handover remain outside the model.


---

## D41: Default Sollzinsen move to the owners' current assumption; the August offer stays pinned

**Date:** 2026-11-22 · **Status:** accepted · **Refines** [D36](#d36-the-sollzinsen-carry-their-stand-und-quelle-apartments-can-be-named)

**Context.** Rates had risen since the offer of 07.08.2026. Until new quotes arrive, the owners assume 4,3 / 4,2 / 4,0 % for 10 Jahre at 10 / 15 / 20 % EK.

**Decision.** `DEFAULT_RATES` becomes that grid; the 15-year column is an estimate, +0,2 points as in the August offer. The offer's grid stays as `OFFER_RATES`: the golden master, the invariants and every test that describes the offer now name it explicitly, so they keep testing the offer rather than whatever the default happens to be. The screen's working state (autosave, the Sheet's current state) that still holds the untouched offer grid moves to the new assumption on load; named saves and grids with a note the couple wrote are left as they are.

**Consequence.** No golden snapshot changed. Wohnung C, a placeholder at the old 1.900 € rate, no longer amortises at 4,3 % and reads "nicht tragbar".

---

## D42: Two flats side by side, with KfW blend, Neubau handover and the parking space's cost

**Date:** 2026-11-22 · **Status:** accepted · **Refines** [D3](#d3--apartments-are-a-context-switcher-plus-a-read-only-comparison-table), [D40](#d40-kaufnebenkosten-and-monatsrate-move-onto-the-apartment-the-two-shortlist-flats-ship-as-defaults)

**Context.** The owners want to compare Lindenstraße 31G and BUWOG Arbor WE08, not one after the other. BUWOG has a KfW 300 loan and is handed over about 19 months after signing; the couple disagree whether to buy the parking spaces. Of two mockups the owner chose a table plus one shared Restschuld chart.

**Decision.**
- **New section 7 "Wohnungen vergleichen"**: two columns, each with its own flat and its own EK level (the "A at 10% vs B at 15%" limitation D3 recorded). Read-only, rows from `apartmentColumn`. Restschuld and interest are read on one date for both, the end of the Zinsbindung counted from signing, so rule 5 holds. The chart puts both flats on one time axis from signing; a Neubau's line starts at handover.
- **KfW per apartment** (`kfwAmount`, `kfwRate`), blended with the bank's rate per EK level by `blendedRate`. The owner proposed entering a hand-computed weighted average; the app computes it instead, because the KfW part is fixed, so the blend differs by EK level, and one average for all three would understate what extra EK saves. Bank rates stay one shared grid: they depend on the loan-to-value, not on the flat.
- **`moveInMonths` per apartment**: the binding is priced in full but the loan amortises only after handover (`bindingMonths`). Every horizon "within the binding" uses it, so the page's own figures for a Neubau cover the shorter amortising period and its Restschuld at refinancing is higher. Bauzeitzinsen are an estimate shown in the comparison, not a cash deduction ([ASSUMPTIONS §4.20](ASSUMPTIONS.md)).
- **`parkingPrice` per apartment**, a share of the price already in it, so the comparison shows what the space costs per month and at signing. The tool does not decide; it prices the question.

**Consequence.** With no KfW and no delay the engine is unchanged: the golden snapshots for the three older flats and the QA presets did not move, and the invariants hold for BUWOG with both. Only BUWOG's and Lindenstraße's own snapshots changed, because their inputs did. `LineChart` gains an optional `endLabel`, since four lines ending at zero would print their names on top of each other.

---

## D43: Repaid by retirement is a bank condition, not a warning

**Date:** 2026-11-23 · **Status:** superseded by [D44](#d44-reserve-and-retirement-deadline-warn-kfw-and-bank-run-as-two-loans) · **Supersedes** [D34](#d34-a-tragbar-scenario-that-runs-past-the-couples-own-limit-is-flagged-not-failed)

**Context.** The bank requires the loan to be repaid by the owner's retirement at 67 (born 1985, so 2052). D34 had made the runtime limit a yellow warning measured with Sondertilgung from the first repayment, on the grounds that the runtime rests on today's rate. A bank decides on the contract: the regular rate, no Sondertilgung, from signing.

**Decision.** A fifth constraint, `runtime`: at the regular rate and without Sondertilgung, the loan must be repaid within `maxRuntimeYears` of signing, and a Neubau's wait until handover counts. Failing it makes a scenario not tragbar ("Läuft zu lange", red), and the verdict names the Monatsrate still missing, in €/Monat like the payment check. The default stays 26 years (end of 2026 to 2052).

The owner expected that the bank's household calculation would need less than 2 % Tilgung. The deadline points the other way: Lindenstraße needs at least 2.494 €/Monat (≈ 2,1 %), BUWOG at least 2.976 € (≈ 2,6 % on its blended rate) because its 19 months of construction come off the 26 years. The shortlist flats ship with those minimums. The bank's own household calculation is not modelled; the 40 % burden rule stays the app's proxy for it.

**Consequence.** The August offer's 1.900 € on 405.000 € runs about 30 years and no longer passes at 10 % EK; the three older flats now read "Keine der drei Varianten ist tragbar" at the default rates. Their golden snapshots changed only in status and feasibility fields, no euro figure. The refinancing stress follow-up now keeps the original loan's Sondertilgung calendar (`monthOffset`), found by the Codex review of PR #11: with a handover delay that is not a whole number of years, the old slicing dropped or shifted a Sondertilgung.

---

## D44: Reserve and retirement deadline warn; KfW and bank run as two loans

**Date:** 2026-11-23 · **Status:** accepted · **Supersedes** [D43](#d43-repaid-by-retirement-is-a-bank-condition-not-a-warning), refines [D42](#d42-two-flats-side-by-side-with-kfw-blend-neubau-handover-and-the-parking-spaces-cost)

**Context.** The owners overruled D43 the same day: their broker says some banks accept Sondertilgung against the retirement deadline, and they plan about 6.000 €/Jahr for at least the first five years. The reserve target is their own buffer, also negotiable. They also asked for the KfW and bank loans to be modelled separately, without complicating the screen.

**Decision.**
- **Tragbar** = the rate amortises, the cash covers the purchase, the burden stays under the threshold (`BLOCKING_CONSTRAINTS`). The reserve and the deadline move to `diagnosis.warnings`. A warned scenario is amber everywhere: its status ("Reserve unter Ziel", "Läuft über die Grenze"), the apartment chip ("tragbar, mit Hinweis") and a list in the verdict that names the reserve left, the contract's end year, the deadline and the end year with the couple's Sondertilgung. CLAUDE.md rule 1 and PRODUCT_SPEC §13 are amended (A8).
- **Two loans** (`simulateSplitLoan`): the KfW part has its own rate, one repayment-free year and an annuity over the apartment's `kfwTermYears` (default 20, from the broker call of 20.05.2026; the only new field). The bank part receives the rest of the one Monatsrate and all Sondertilgung, capped at 5 % of the bank part. The result has the single-loan shape, so the ledger, the charts and the comparison read it unchanged; single loans keep the offer-pinned `simulateMortgage`. The refinancing stress reruns the two-loan schedule with both rates shifted from the end of the binding. The blended rate remains only as a display figure.

**What the split changed.** With the blend, BUWOG's 2.976 € seemed to meet 2052. As two loans the KfW's fixed ≈ 842 € leaves the bank part ≈ 1,8 % Tilgung: the contract runs to ≈ 2056, with 6.000 €/Jahr to ≈ 2051. Meeting 2052 without Sondertilgung would take ≈ 3.160 €, 42 % of net income. A 30-year KfW term would end in 2058 whatever the bank rate. This is exactly the case the owners describe: it works only if the bank accepts the Sondertilgung.

**Consequence.** Golden snapshots of the flats without KfW changed only in verdict fields; Lindenstraße and the 720k preset did not change at all; 850k still reads "Keine der drei Varianten ist tragbar". The invariant "Sondertilgung is neutral at the loan's rate" now uses the bank's rate, since that is the part Sondertilgung repays. Labels that printed the binding as a raw number now format it ("8,4 Jahre").

---

## D45: The bank offers of 24.11.2026; each apartment owns its rates and its offer's loans

**Date:** 2026-11-24 · **Status:** accepted · **Refines** [D40](#d40-kaufnebenkosten-and-monatsrate-move-onto-the-apartment-the-two-shortlist-flats-ship-as-defaults), [D41](#d41-default-sollzinsen-move-to-the-owners-current-assumption-the-august-offer-stays-pinned), [D44](#d44-reserve-and-retirement-deadline-warn-kfw-and-bank-run-as-two-loans)

**Context.** Four offers arrived (BauDarlehen24, 10 Jahre): Lindenstraße 1a HypoVereinsbank 4,11 % and 1b Commerzbank 4,06 % on 500.000 € incl. TG; BUWOG 2a Deutsche Bank 4,01 % and 2b Commerzbank 3,94 %, each with KfW 300 170.000 € at 0,78 % over 35 years with one free year. Each flat has its own banks, so one shared rate grid could no longer hold both. The offers are built on round Eigenkapital sums (112.850 €, 137.000 €, 124.000 €, 157.000 €): their "90 %" loan is 445.000 € where 90 % of the price would be 450.000 €. Computed by share, the app disagreed with the offers by thousands and flagged Lindenstraße 10 % as running past 2052, which the offer does not (last payment 01/2052).

**Decision.**
- `ApartmentCase` owns `rates` and `ratesNote`; the §2 grid edits the active apartment's. Older saves give every apartment the grid it was using.
- `offerLoans` per EK level, optional, edited in "Fakten bearbeiten"; `loanFor` is the one place a loan is computed. The down payment is price minus that loan. A later purchase in the Warten section is financed by share again.
- The Shortlist flats ship with the offers; the Monatsrate is one per flat (2.370 € / 2.669 €, the offers differ by under 1,20 €, D14). 20 % EK and the 15-year column have no offer and are estimates, named as such in the rates note. Lindenstraße's price is 500.000 € as in the offers, not the Exposé's 520.000 €.
- Saved states get untouched Shortlist flats replaced by the new data once (`shortlistRevision`, `SUPERSEDED_SHORTLIST`). "Untouched" means every field that ever shipped still matches: price, Monatsrate, KfW terms, handover months, name, Hausgeld, renovation, Kaufnebenkosten and parking; a flat the couple edited in any of them is left alone. Their own note is kept (recognised by `textHash` against the notes shipped before), and their Sondertilgung plan always is. The first version checked only price and Monatsrate; the review of PR #13 (Codex and our own) caught that this would overwrite an edited Hausgeld.
- In the stress run the KfW part gets a new annuity for its remaining term, the bank part the rest of the same Monatsrate. Holding the old 474 € KfW annuity at a 2,78 % rate had shown "+13 J. länger".
- When the KfW part sets the end date, the verdict says so instead of naming a year "mit Sondertilgung".

**What the tool says about 10 vs 15 %.** With the offers, the step from 10 to 15 % earns about 4,8 % a year tax-free on Lindenstraße (24.150 € more EK, 38.453 € less debt after ten years) and 4,7 % on BUWOG (33.000 €, 48.374 € over 8,4 years), against about 4,2 % for a 5 % ETF after tax: about +1.900 € and +1.700 € over the binding. With 145.000 € available and the 12.000 € kitchen, 15 % does not fit either flat; whether it does depends on the couple's actual capital.

**Consequence.** `offer2026-11.test.ts` pins the four offers (largest deviation 10 cents, the KfW annuity's rounding). Golden snapshots changed only for the two Shortlist flats.


---

## D46: The 15-year offers of 25.11.2026

**Date:** 2026-11-25 · **Status:** accepted · **Refines** [D45](#d45-the-bank-offers-of-24112026-each-apartment-owns-its-rates-and-its-offers-loans)

**Context.** The broker recalculated both 85 % variants with 15 Jahre Sollzinsbindung at the same Monatsrate (lower Tilgung): Lindenstraße Commerzbank 4,27 % (+0,21 Pkt.), BUWOG Mischzins 3,11 % (+0,15 Pkt.), the KfW part unchanged at 0,78 % with 10 years' binding.

**Decision.** The 15-year column takes 4,27 % for Lindenstraße and ≈ 4,15 % for BUWOG's bank part, derived from the blended rate ((550.508 × 3,11 % − 170.000 × 0,78 %) / 380.508 = 4,151 %; the engine's blend gives back 3,109 %). 10 % and 20 % EK at 15 years have no offer and take the observed +0,21 points. Saved flats still holding the grid of 24.11. get the new grid and note (`SHORTLIST_REVISION` 2, rates only); any other edit is kept. The KfW's shorter binding stays as recorded in ASSUMPTIONS §4.19.


---

## D47: The Henriette-Lustig flat replaces the "Wohnung C" placeholder

**Date:** 2026-11-28 · **Status:** accepted · **Refines** [D40](#d40-kaufnebenkosten-and-monatsrate-move-onto-the-apartment-the-two-shortlist-flats-ship-as-defaults), [D45](#d45-the-bank-offers-of-24112026-each-apartment-owns-its-rates-and-its-offers-loans)

**Context.** Four more offers arrived (BauDarlehen24, 27.11.2026) for a Denkmal-Maisonette
at Henriette-Lustig-Straße 13 in Spindlersfeld: 499.000 €, two loan amounts (444.000 € at
ca. 10 % EK, 394.000 € at ca. 20 %) × two Sollzinsbindungen, four banks — Lloyds 4,17 %
and PSD Nürnberg 4,35 % on the larger loan, Commerzbank 4,02 % and OLB 4,16 % on the
smaller. Commerzbank 2a is the preferred variant. The third default apartment was still
"Wohnung C", a round-number placeholder (600.000 €, Hausgeld 670 €, the global 1.900 €
Monatsrate) left over from before any flat was real.

**Decision.** `flat-c` keeps its id and its position and becomes the real flat.

- Price 499.000 € including the Außenstellplatz P6, which is a Sondernutzungsrecht with no
  separate price in the offer, so `parkingPrice` stays 0 (ASSUMPTIONS §4.21). Kaufnebenkosten
  11,57 %, Hausgeld 428 € from the Wirtschaftsplan 2026, Renovierung 15.000 € as a plan value
  (12.000 € kitchen + 3.000 € parquet).
- One Monatsrate per flat as always (D14): 2.570,85 €, Variante 2a's. The 10 %-Angebote run
  2.571,50 €, 0,65 € higher — recorded rather than averaged away.
- `offerLoans` holds the two quoted amounts. 15 % EK was not quoted: no entry, and the rate
  is the rounded midpoint of its neighbours, named as an assumption in the rates note
  (ASSUMPTIONS §4.22). The app's "10 %" and "20 %" are really 11,02 % and 21,04 %.
- `annualSpecialRepayments` is all zeros. The offers are the thing to read the screen
  against, and the bank's own Sondertilgungstermin (30.06.) is not the app's (year end), so
  a plan here would make the two disagree for a reason that has nothing to do with the
  decision. The bank's five-times-10.000 € plan is recorded in the apartment's note and in
  ASSUMPTIONS §6 as a reference figure.

**Saved states.** `shortlistRevision` gains a third step: an untouched `flat-c` is replaced
by the new flat. "Untouched" is stricter here than in D45, because this swaps one property
for a different one rather than refreshing a figure — every shipped field must still match,
the rate grid (either grid that ever shipped for it) and the shipped Sondertilgung plan
included. One edited field anywhere and the couple's flat is left exactly as it is. The
persisted field keeps its name although it no longer governs only Shortlist flats; renaming
it would break every existing save for a comment's worth of clarity.

**Consequence.** `offer2026-11-27.test.ts` pins all four offers, each 15-year one twice —
mid-binding and at the end, since the offers print both. Largest deviation 6 cents against
the figures printed to the cent; the two printed as whole euros land inside their rounding.
The Anfangstilgung of all four (2,78 / 2,60 / 3,81 / 3,67 %) comes out exact, which is the
real check that loan, rate and Rate belong together. Three tests had been reading the placeholder
as if it were a fixture: the refinancing-stress case that needed a payment too small to cover
interest now pins its own 600.000 € / 1.900 € inputs (D12) instead of borrowing a shipped
apartment, the D35 ownership-cost guard now covers only the two flats that are still
placeholders, and the Sondertilgung-neutrality invariant supplies a plan for a flat that
ships without one. The golden snapshot for the flat was rewritten.

**What the tool says.** At the shipped 145.000 € Eigenkapital only 10 % EK is feasible on
this flat, with the reserve under target; 15 % and 20 % fail on cash by 2.584 € and 32.734 €.
Whether that holds depends on the couple's actual capital, which is theirs to enter. On the
offers themselves the step from 10 % to 20 % buys 50.000 € more EK against 81.570 € less debt
after ten years (291.173 € → 209.603 €) and ends the loan 4,1 years sooner (22,1 → 18,0).
On screen the 10 % column shows 291.270 €, 97 € above the offer: the app runs one Monatsrate
for all three levels, and the 10 %-Angebote carry 0,65 €/Monat more.
---

## D48: The apartment chip says what is true at the EK level on screen

**Date:** 2026-11-28 · **Status:** accepted · **Refines** [D44](#d44-reserve-and-retirement-deadline-warn-kfw-and-bank-run-as-two-loans), [D3](#d3--apartments-are-a-context-switcher-plus-a-read-only-comparison-table)

**Context.** The chip over each apartment picked its pill from `decision.noSafeScenario` first, then from the warning list, with green *"tragbar"* as the fallback branch. That fallback also caught the case nobody had named: the EK level actually selected fails, while some other level passes, so `noSafeScenario` is false. With the shipped defaults this is not an edge case — at 20 % EK four of the five flats land there, each showing a green *"tragbar"* chip above a right panel reading *"Geld reicht nicht"*; at 15 % EK two of them do. That is CLAUDE.md rule 1 (never present the least-bad option as safe) broken by the one verdict that is visible for a flat the couple has not opened.

A second, quieter drift sat in the same chain: a scenario whose own status reads *"Gerade so tragbar"* in amber got a green chip, because the chain re-derived the verdict from the diagnosis instead of reading the status the rest of the app already renders.

**Decision.**
- The failing-selected-level case is **amber, and the label names the escape**: *"nur bei 10% tragbar"*, *"nur bei 10/15% tragbar"*. It is the same thing the verdict already says in longhand (*"Nicht tragbar: 15% EK (Geld reicht nicht)"*), compressed to pill width.
- **Red stays reserved for a flat that works at no level at all.** Spending red on "fails at the level on screen" would make a flat that is tragbar at 10 % EK indistinguishable from one that is tragbar nowhere — the same defect as the green fallback, pointed the other way. The chip's word, not its colour, carries this (rule 4): every state reads correctly in greyscale.
- **The tone of a tragbar chip is the scenario's own `statusTone`**, not a second reading of the diagnosis. *"Gerade so tragbar"* therefore reads amber on the chip too, and gets its own label rather than borrowing *"tragbar, mit Hinweis"*, which would point at a warning list that is empty.
- The whole decision moves into `apartmentChipStatus` in `src/lib/calculations.ts`, beside `status`/`statusTone`, so it is covered by the model tests rather than living in an inline ternary chain in a component. `ApartmentComparison.tsx` already rendered `statusTone`/`status` directly; the chip was the only second derivation.

**Consequence.** Five chip states: red *"nicht tragbar"*, amber *"nur bei … tragbar"*, amber *"tragbar, mit Hinweis"*, amber *"gerade so tragbar"*, green *"tragbar"*. With the shipped defaults no flat is plain green at any EK level — each either carries a warning, sits close to the reserve, or fails at that level. That is the honest reading; the previous screen showed four green chips for flats whose selected level does not work. `calculations.test.ts` adds a sweep asserting that no flat at any level can be green while `selectedScenario.feasible` is false, and that a tragbar chip's tone always equals the scenario's `statusTone`. Widths were checked at 560 px: the longest label, *"nur bei 10/15% tragbar"*, is 22 characters against *"tragbar, mit Hinweis"* at 20, and the chip row already wraps.


---

## D49: The flat-c refresh checked fields the placeholder never owned, so it fired for nobody

**Date:** 2026-11-28 · **Status:** accepted · **Corrects** [D47](#d47-the-henriette-lustig-flat-replaces-the-wohnung-c-placeholder)

**Context.** D47 replaced the "Wohnung C" placeholder with the real flat in saved states,
but only where it was "untouched", and defined untouched as *every* shipped field still
matching — Monatsrate, Kaufnebenkostensatz, Zinsraster and Zins-Notiz included. The
placeholder never owned any of those. It displayed the global ones, and `reviveApartment`
still fills them from an older save's globals ([D40](#d40-kaufnebenkosten-and-monatsrate-move-onto-the-apartment-the-two-shortlist-flats-ship-as-defaults), [D45](#d45-the-bank-offers-of-24112026-each-apartment-owns-its-rates-and-its-offers-loans)). So the check was really asking "has any
global setting ever been changed anywhere in the app", which has nothing to do with
whether this flat was touched — and is true of every save that has been used at all.

The owner reported the flat had not appeared. Reproduced: with the shipped defaults the
step fires, and with any one of a changed Monatsrate, a changed Kaufnebenkostensatz, an
edited rate grid, an own rates note, an empty Sondertilgung plan or the global default
plan, it does not. Six ways to miss, all of them normal use.

**Decision.** The check reads only fields the couple could have set *on this flat*: the
name, price, Hausgeld, Renovierung, parking, the KfW fields, the handover months, the
absence of a note and of offer loans, and a Sondertilgung plan that is one of the three
meaning "never set one here" (the shipped plan, the empty one an older save revives with,
the global default). Monatsrate, Kaufnebenkostensatz, rate grid and rates note are gone
from it. What remains is a fingerprint nobody types by accident: *"Wohnung C"* beside
600.000 €, 670 € Hausgeld and 5.000 € Renovierung.

`SHORTLIST_REVISION` goes to 4 rather than reusing 3. `reviveState` stamps the current
revision on every load whether or not a step did anything, so a state that was opened once
after D47 shipped already reads 3 and would skip a corrected step at `revision < 3`. Those
are exactly the states that need it.

**Consequence.** The refresh is looser than D45's, deliberately: D45 moved a figure to a
newer figure on a flat that stayed the same flat, where a wrongly-kept edit costs the
couple one re-entry. Here it swaps one property for a different one, so being wrong in the
other direction would silently delete a flat they had entered. The fingerprint is what
keeps that from happening — four values that only the placeholder ever had together.
`storage.test.ts` pins all six inherited-field cases, the stamped-revision-3 case, and
seven real edits that must keep the couple's flat.

A save where the couple did put their own data into `flat-c` is still left alone, by
design. Nothing short of the JSON export and import under "Annahmen" will move the new
flat into such a state, and that is the right trade.


---

## D50: flat-c is overwritten once, whatever it holds

**Date:** 2026-11-28 · **Status:** accepted · **Supersedes** the refresh condition in [D47](#d47-the-henriette-lustig-flat-replaces-the-wohnung-c-placeholder) and [D49](#d49-the-flat-c-refresh-checked-fields-the-placeholder-never-owned-so-it-fired-for-nobody)

**Context.** D47 and D49 both replaced `flat-c` only where it still looked like the
untouched placeholder, so that data the couple had entered there could not be lost. After
D49 shipped, the owner asked for it to be overwritten anyway, their own edits included:
*"nee, bitte überschreibe einfach wohnung C, auch meine!"*

The protection was aimed at the wrong thing. The slot had only ever held a placeholder
nobody wanted — "Wohnung C", 600.000 €, round numbers invented before any flat was real.
Whatever had been typed into it was worth less to them than seeing the Maisonette, and
they are the only two people who use this app.

**Decision.** For a state below revision 5, `flat-c` is set to the shipped flat, whatever
it currently holds. No fingerprint, no field comparison. `SUPERSEDED_PLACEHOLDER_FLAT_C`
and the comparison it fed are deleted rather than left unused.

**It is a one-shot migration, not a rule.** It runs once per state and never again, so an
edit made to this flat from now on survives every later load. A standing "always reset"
would quietly undo their work each time the app opened, which is not what was asked and
would be worse than the problem.

**Consequence.** It applies wherever a state is revived, named saves included: a save
holding the old "Wohnung C" shows the Maisonette after this. That follows from the ask and
from `loadNamed` sharing one migration path with the autosave; splitting them so a named
save could keep a flat that is being deleted everywhere else would preserve a snapshot
nobody asked to keep.

`storage.test.ts` pins thirty cases — five revisions below 5 × six things the slot might
hold, from the pristine placeholder to a completely different flat — and, separately, that
a state already at revision 5 keeps an edited `flat-c` untouched. That second test is the
one that matters: it is what makes this a migration rather than a reset.

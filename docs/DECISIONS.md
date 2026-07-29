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

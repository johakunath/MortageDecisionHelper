# Review 2026-10-07: calculation integrity, decision logic, Denkmal

Scope: engine (`src/lib/calculations.ts`), decision logic, tests, architecture, UI where it changes a decision, and a researched design for denkmalgeschützte Immobilien (§§ 7i, 10f, 11b EStG). No code was changed by this review.

How the numbers below were produced: the engine itself, run on the default state (apartment "Angebot 450k", 10 J. Zinsbindung, 1.900 €/Monat, Sondertilgung 6.000 €/Jahr for ten years), plus a short cash-flow script for the common-horizon checks (assumptions stated where used). `npm test` was green before and after (57/57).

---

## 0. Bottom line

| # | Finding | Why it matters |
|---|---|---|
| 1 | **The headline ETF comparison ignores Abgeltungsteuer and flips sign once it is included.** On all three default apartments the statement says "für mehr Liquidität"; after tax it says "für mehr Eigenkapital". | This is the number spec §15 calls "the single most important calculation in the app". Untaxed, it favours the liquidity side. |
| 2 | **The recommendation rule "prefer 10% EK" is stale since D15.** It was written when 10% was the *middle* of 5/10/15. It now picks the *lowest* EK level, and the verdict headline names it. | A hard-coded tilt toward one spouse's position, in the first sentence on screen. |
| 3 | **The Warten bottom line is driven by an illustrative full-term figure and omits half the cash flows.** On "Wohnung C" it reports waiting 12 months as **79.374 € better**; a common-horizon check gives roughly +2.500 to +14.700 €. | Overstates by 5 to 30x. The spec's actual ask ("what would have to happen for waiting to win") is not answered. |
| 4 | **"Nettovermögen" rewards a longer loan.** It is evaluated at each scenario's own payoff year, so 10% EK shows 46.000 € more "net worth" than 20% EK purely because its loan runs five years longer. | Misleading signal for the low-EK side on every EK switch. The docs already warn about it; the UI still shows it. |
| 5 | **On the real offer, the money difference between 10% and 20% EK is close to zero after tax** (about ±3.000 € over ten years, depending on ETF return and embedded gains). Per step it is not close: **15% EK is dominated** (10→15 earns 4,06% p.a., 15→20 earns 4,97% p.a.). | The honest framing for the couple: the 10-vs-20 choice is a liquidity-vs-refinancing-risk preference, not a money question. If you go above 10%, go to 20%. |
| 6 | **Denkmal (§10f) is a property of the apartment and barely touches the EK question.** The relief depends on certified renovation costs, not on the loan, so it is identical across 10/15/20%. It belongs in the apartment comparison and in liquidity timing. | Keeps the integration small and stops it from distorting the central EK comparison. |

**Scope challenge.** Buy-vs-rent and §7i (rented Denkmal) are listed as non-goals in [PRODUCT_SPEC §18](PRODUCT_SPEC.md#18-non-goals), and §4 names the Gerd Kommer calculator and Immocation for them. My recommendation: fix P0 first (about a day, two sign errors), build the common-horizon engine (P1), and get "weiter mieten" as one column almost for free from that engine *if* you amend §18 deliberately. Do not build §7i here. Implement Denkmal only if a listed property is actually on your shortlist; otherwise §5 of this document is enough for now.

---

## 1. Most important findings, with evidence

All figures: defaults, 10% vs 20% EK, horizon = Zinsbindung (10 J.).

| Finding | Evidence | Direction of bias |
|---|---|---|
| ETF foregone growth is pre-tax (`calculations.ts:868`) | Extra EK 45.000 €. Interest saved 25.021 €. ETF growth at 5%: 28.300 € → **net −3.280 € "für mehr Liquidität"**. With 18,46% tax on gains (Abgeltungsteuer + Soli, 30% Teilfreistellung for equity ETFs): 23.075 € → **net +1.945 € "für mehr Eigenkapital"**. Same flip on Wohnung B (−3.424 → +2.381) and C (−3.587 → +3.380). | Favours liquidity side. Interest saved on an owner-occupied loan is tax-free; ETF gains are not. |
| Missing cash flow: tax on ETFs sold to fund the purchase | `availableCapital` is entered at market value ("ETFs, die ihr verkaufen würdet"). Selling realises embedded gains now. | Overstates `cashLeft`, more at 20% EK (more ETFs sold). Over the horizon the effect on the 10-vs-20 comparison is smaller (it is a deferral), but the reserve check at purchase is real. |
| Stale "prefer 10%" rule (`calculations.ts:834`, `ExecutiveSummary.tsx:94`) | Spec §13 "prefer 10% EK as the default compromise" dates from the 5/10/15 grid. D15 fixed the middle *door* for this; `evaluateDecision` was not fixed. Default verdict: "10% EK ist tragbar". | Favours liquidity side. |
| Nettovermögen across different horizons (`calculations.ts:608`, `ProgressSection.tsx:132`) | 10% EK 425.429 € · 15% 401.733 € · 20% 379.037 €. Property values 724.992 / 691.114 / 657.732 € at runtimes 24,1 / 21,7 / 19,2 J. The formula also subtracts the down payment but not the loan principal, so it is neither net worth nor net gain. | Favours liquidity side. |
| Marginal return per EK step is invisible | 10→15: +22.500 € EK saves 10.992 € in 10 J. = **4,06% p.a.** · 15→20: saves 14.029 € = **4,97% p.a.** · 10→20: 4,52% p.a. After-tax ETF at 5% pre-tax ≈ 4,23% p.a. Break-even pre-tax ETF return: 4,81% / 5,84% / 5,34%. | Neutral, but it is the clearest single statement of the disagreement and the app cannot show it. |
| The trade-off identity holds exactly | Restschuld difference after 10 J. = extra EK + interest saved (70.021 = 45.000 + 25.021). | Good news: at equal Monatsrate, `netAdvantageFixed` is a correct terminal-wealth difference, apart from tax. Worth pinning as a test. |

---

## 2. Calculation and decision-logic problems to fix

| ID | Problem | Where | Effect | Fix | Prio |
|---|---|---|---|---|---|
| C1 | ETF opportunity cost untaxed | `compareEkScenarios`, `TradeoffStatement` | Sign flip on defaults (§1) | Input `etfTaxRate` (default 18,46%, editable; covers Kirchensteuer, Sparerpauschbetrag use). Apply to foregone gains at the horizon. Show after-tax return in the chip. | P0 |
| C2 | Recommendation prefers lowest EK | `evaluateDecision` | Headline names 10% EK by rule | Drop the single recommendation. Headline lists which levels are tragbar ("10% und 15% EK sind tragbar, 20% reißt die Reserve"). If one must be named, use the middle scenario, derived from the list. Update spec §13 + DECISIONS. | P0 |
| C3 | Nettovermögen readout | `buildScenario`, `ProgressSection` | Rewards longer runtime by ~46.000 € | Remove now. Replace later with wealth at a common horizon (C5). | P0 |
| C4 | Full-term interest given equal weight | `TradeoffMatrix` "Zinsen gesamt", `SondertilgungPanel` headline, `evaluateDecision.costMinimum` | ASSUMPTIONS §1 says never present full-term with the same weight as fixed-period. 10 vs 20: 65.867 € full-term vs 25.021 € in Bindung. | Matrix column → "Zinsen in Bindung"; full-term as small secondary text. Sondertilgung headline → "Restschuld-Senkung nach Bindung" (reliable), full-term interest secondary. | P0 |
| C5 | Warten bottom line mixes bases | `buildWaitScenario` | `deltaTotalCost` = full-term interest delta (rate shift assumed for 25 to 50 years) + rent. Omits: buy-now ownership costs in the waiting months, return on capital while waiting, principal repaid by buy-now, savings of the buy-now path, the extra cash the wait path ends with. | Replace with wealth difference at a common date (C6). Add the break-even spec §2.3 asks for: required rate drop or maximum price rise for waiting to win. **Do not patch D27 by adding one more term**: adding only ownership costs flips the 450k case to "waiting 1.018 € cheaper", while the common-horizon check says waiting is 3.500 to 8.000 € *worse* unless liquid capital earns ~4%. | P1 |
| C6 | No common-horizon wealth metric | engine | Every comparison uses a different base (interest only, interest + rent, untaxed ETF, full-term). K1, K10, K15 and D22 were all this class of bug. | One pure function: `wealthAt(strategy, horizonMonths)` = property value − debt + liquid side-portfolio (with return and tax), driven by one monthly cash-flow ledger (payment, ownership costs, rent, Sondertilgung, tax refunds). Keep `simulateMortgage` underneath unchanged (offer-pinned). | P1 |
| C7 | Sondertilgung shown without opportunity cost | `SondertilgungPanel` | "Das bringt der Plan: 78.750 € gespart" (full-term, constant rate) for 60.000 € paid in. Section 1 charges EK an ETF opportunity cost; section 5 charges Sondertilgung none. Two frames, both lean toward the liquidity argument. | Measure the plan with C6 (same horizon, same ETF assumption) or at least show the reliable Restschuld effect. | P1 |
| C8 | Refinancing risk only as a raw Restschuld | Right panel | More EK lowers refi risk; the app shows the balance but not what it means. | One stress readout: "Bei X% Anschlusszins: Rate für gleiche Restlaufzeit Y €". A single number, not an Anschlussfinanzierung model (spec §10). | P1 |
| C9 | Very long runtimes pass silently | `buildScenario` | Wohnung C at 10% EK runs 49,5 J. at 1.900 €/Monat; only >60 J. fails. The Monatsrate is global, so a 600k flat gets the 450k offer's rate. | Amber warning above a target (e.g. "schuldenfrei bis Rente", needs your ages). Consider Monatsrate per apartment. | P1 |
| C10 | Burden ignores the Sondertilgung plan | `burdenRatio` | 29,9% shown; 35,8% including the planned 500 €/Monat. | Secondary line "inkl. Sondertilgungsplan". Keep feasibility on the contractual rate. | P2 |
| C11 | Rent basis ambiguous | glossary, spec §9 | Warmmiete includes heating; "Eigentumskosten" are defined as costs "vs. renting". Comparisons mix bases. | Define both on the same basis (both incl. or both excl. heating/electricity). One glossary sentence each. | P2 |
| C12 | Hidden heuristic | `calculations.ts:683` | "Gerade so tragbar" = cashLeft < 1,5 × Reserve. Not in ASSUMPTIONS §3. | Document it (or make it explicit in the tooltip). | P0 (doc) |
| C13 | Doc drift | spec §8, §17, glossary `cleanScenario` | Spec defaults (720k, 9%, 2,4% Tilgung) and §17 expectations no longer match `defaults.ts`; `cleanScenario` names two conditions, the engine checks three (Rate tilgt, Reserve, Belastung). | Update text; tests already assert behaviour. | P0 (doc) |

---

## 3. Architecture and refactoring

Only what pays for itself. The engine is in good shape: pure, offer-validated to 8 ct, decisions recorded.

| # | Proposal | Value | When |
|---|---|---|---|
| A1 | `wealthAt()` ledger (C6) as the single comparison primitive. EK trade-off, Sondertilgung, Warten, Denkmal and an optional "weiter mieten" column become differences of one function at one horizon. | Removes the bug class behind K1/K10/K15/D22. | P1 |
| A2 | Split `calculations.ts` (1.167 lines) when A1 and Denkmal land: `mortgage.ts` (simulate + conversions, offer-pinned), `scenario.ts` (build + decision), `compare.ts` (EK/ST/wait), `tax.ts` (ETF tax, Denkmal). Re-export from `calculations.ts` to avoid churn. | Navigability; keeps tax rules isolated and testable. | With A1, not standalone |
| A3 | Move UI copy out of the engine: `status`/`statusTone` are German strings in `buildScenario`. Return a `statusKind`; map to text in the UI. | Honours the repo's own "no formatting in calculations" rule. | P2 |
| A4 | Move derived math out of components: `TradeoffMatrix` deltas + `interpret()`, `ProgressSection` equity series. | Testable; one formula per number. | P2 |
| A5 | Persisted state v3 with migration for new inputs (ETF tax, Denkmal, Grenzsteuersatz). Follow the K16 lesson: derive from the active apartment, never from stale globals. | Required by C1 and §5. | With C1 |
| A6 | Drop `annualSpecialRepayment` (the plan average) from `MortgageInputs`; compute it at the edge. | Removes the field D22 had to fence off. | P2 |

**Tests**

| # | Test | Value |
|---|---|---|
| T1 | Golden snapshot of headline outputs (3 apartments × 3 EK + 3 presets). Any change to a displayed number becomes an explicit diff. | Highest value per line. Add **before** the P0 fixes, then update it deliberately with each fix. |
| T2 | Invariants: Restschuld difference = extra EK + interest saved (equal Monatsrate); interest non-increasing in Sondertilgung; `waitMonths = 0` equals buy-now; `wealthAt` reproduces `netAdvantageFixed` with liquid return = ETF return and tax = 0. | Pins the maths, independent of defaults. |
| T3 | One regression test per fix: C1 sign on defaults, C2 headline neutrality, C5 common-horizon result. | Same discipline as K1 to K17. |
| T4 | Denkmal: 10 × 9% = 90%; completion-year offset; grants reduce base; Altbausubstanz never in base; refunds never in feasibility. | §5. |

---

## 4. UI/UX improvements worth doing

No redesign. Each item swaps or removes something; none adds a new view (D6).

| # | Change | Why |
|---|---|---|
| U1 | Verdict headline lists tragbare levels instead of naming one (C2). | Neutral first sentence. |
| U2 | Trade-off statement: show the marginal return per EK step and the break-even ETF return. Example: "Die nächsten 22.500 € EK bringen 4,1% p.a. (10→15) bzw. 5,0% p.a. (15→20), steuerfrei und sicher. ETF lohnt sich mehr ab 4,8% bzw. 5,8% p.a. vor Steuer." | States the disagreement in one comparable unit; exposes that 15% is dominated on this offer. |
| U3 | Matrix: replace "Zinsen gesamt" with "Zinsen in Bindung" and/or "Rendite der Mehr-EK" (C4). | Reliable figure first. |
| U4 | Remove "Nettovermögen" (C3). | Misleading. |
| U5 | Warten: bottom line = wealth difference at a common date plus "Warten gewinnt, wenn der Zins um mehr als X Pkt. fällt" (C5). | What spec §2.3 actually asks. |
| U6 | ETF chip: "5% vor Steuer ≈ 4,2% nach Steuer". | Makes C1 visible. |
| U7 | Glossary: `availableCapital` "Wert nach Steuern"; `cleanScenario` all three conditions; rent/ownership-cost basis (C11, C13). | Cheap, prevents wrong inputs. |
| U8 | Denkmal block in the apartment facts (§5.5), **SVG mockup first** per your rule. | Lets you model a listed flat without knowing tax law. |

U2, U5 and U8 change the form of a visual: mockup before implementation.

---

## 5. Denkmalschutz: research and proposed integration

Sources were checked on 2026-10-07: the current EStG text on gesetze-im-internet.de, the NRW Bescheinigungsrichtlinien of 28.11.2025, the OFD NRW instruction of 19.02.2026, and recent BFH rulings. The Bescheinigungsrichtlinien are **set by each Bundesland** and differ in detail (Bayern issued new ones on 30.09.2025). The NRW version is used below as the reference. Have a Steuerberater check the treatment before relying on it for a purchase.

### 5.1 Confirmed rules (law text)

| Rule | Content | Source |
|---|---|---|
| §10f Abs. 1 (owner-occupied, Herstellungs-/Anschaffungskosten) | Up to **9% p.a. "wie Sonderausgaben"** in the year the measure is completed and the 9 following years (max. 90%), if the §7i conditions are met. Only for years of own residential use. Not for periods already claimed under §7i. | EStG §10f(1) |
| §10f Abs. 2 (owner-occupied, Erhaltungsaufwand) | Also 9% × 10 years, **only if** the §11b conditions are met (measure necessary for preservation as a Denkmal or its sensible use, coordinated with the authority) and certified per §7i(2). If the property switches to income use during the period, the remainder is deducted in the year of the switch. | EStG §10f(2) |
| Object limit | One building per person; jointly assessed spouses two in total. BFH: this is a **lifetime** limit, with no successor object for unused years. | EStG §10f(3); BFH X R 22/20 (24.05.2023) |
| Flats | Applies to Eigentumswohnungen. | EStG §10f(5) |
| §7i (rented) | 9% × 8 years + 7% × 4 years = **100%** of Herstellungskosten for necessary measures. For buyers: Anschaffungskosten only for measures carried out **after the binding purchase contract**. Measures must be coordinated with the authority. Public grants reduce the base. | EStG §7i(1) |
| Certificate | Required: a "nicht offensichtlich rechtswidrige Bescheinigung" of the Land authority, stating the amounts. | EStG §7i(2) |
| Normal AfA (rented only) | Building share of acquisition cost: 2,5% (completed before 1925), 2% (1925 to 2022), 3% (from 2023). Land is never depreciable. | EStG §7(4) |
| §11b (rented, Erhaltungsaufwand) | Certified Denkmal maintenance can be spread over 2 to 5 years. | EStG §11b |
| Anschaffungsnahe HK (rented) | Renovation within 3 years of purchase above 15% of the building's acquisition cost (net of VAT) counts as Herstellungskosten. | EStG §6(1) Nr. 1a |
| No double relief | No §35c (energy renovation credit) for measures claimed under §10f. No §35a (craftsmen credit) for amounts deducted as Sonderausgaben. | EStG §35c(3), §35a(5) |
| Monthly instead of annual | §10f amounts can be entered as a Lohnsteuer-Freibetrag, so the relief arrives monthly instead of as a refund the following year. | EStG §39a(1) Nr. 5a |

### 5.2 Administrative practice and case law

| Point | Content | Source |
|---|---|---|
| Prior coordination is mandatory | Measures must be coordinated with the Denkmalbehörde **before they start** (and before any change of plan). A missing prior coordination cannot be repaired afterwards; a later building permit does not replace it. | NRW BeschR 2.3.1.1, 2.3.2.2; OFD NRW IV.4 |
| What the certificate binds | Only the monument-law facts (listed status, necessity, coordination, amount). The Finanzamt decides the tax classification (Herstellungskosten vs. Erhaltungsaufwand vs. Anschaffungskosten), the year, subsidies and own use. | OFD NRW II.1, III.1; NRW BeschR 6.1.1 |
| Purchase price | Acquisition costs of the **Altbausubstanz are never eligible**. Buying an already-renovated Denkmal gives the buyer nothing for the seller's renovation. | OFD NRW III.3.3 |
| Bauträger case | The renovation share of the price (incl. developer margin, and the Grunderwerbsteuer and other Nebenkosten attributable to it) can be certified. Each flat gets its own certificate. | NRW BeschR 1.1, 3.3.4 |
| Timing | First deduction in the year the **whole** measure is completed, even if it ran over several years. | OFD NRW III.3.4 (§9a EStDV, BFH 27.06.1995) |
| Not certifiable | Movable furnishings and Einbaumöbel (as a rule), Außenanlagen, new parking/garages, new parts adding space (balconies, conservatories), full rebuilding, owner's own labour, photovoltaics, fees, **recurring maintenance**, luxury items unless they define the monument. | NRW BeschR 3.10.2, 3.11.2, 3.9.1, 3.8.1, 3.6, 3.2.1, 3.13, 8.2, 2.2.6.2, 3.10.1 |
| Usual modernisation | "Übliche Modernisierungs- und Instandsetzungsarbeiten" are Erhaltungsaufwand even when very large. This matters for §7i (rented), where Erhaltungsaufwand is not §7i-eligible. | OFD NRW III.3.2 |
| Heirs | Unused §10f amounts do not pass to heirs. There is a narrow exception for jointly assessed spouses. | BFH X R 23/24 (25.03.2026) |
| Year of a change of use | No pro-rata reduction in the year of a change of use. | FG Niedersachsen 9 K 279/12 (2013). Lower-court ruling, BFH outcome not verified |

### 5.3 Owner-occupied: when renovation or maintenance is actually deductible under §10f

**All** of the following must hold. Ordinary maintenance does not qualify automatically.

1. The building or flat is a listed Baudenkmal under Land law. For an ensemble (Gesamtanlage) only measures for the external appearance qualify.
2. The measure is **necessary by type and scope** to preserve it as a monument or for its sensible use. Repainting by choice, a new kitchen, upgraded flooring or garden work generally do not qualify. Heating, bathroom or electrics *can* qualify as "sinnvolle Nutzung" in the individual case.
3. It was **coordinated with the Denkmalbehörde before work started**, in writing.
4. It is **certified** with the amount.
5. It was carried out **after the binding purchase contract** (for buyers). The price of the existing substance never counts.
6. You **live in it** in each deduction year.
7. Grants are deducted. The amount is not also claimed under §35a or §35c.
8. Your object allowance is unused (one per person, two per couple, for life).

Recurring maintenance and Hausgeld are not certifiable. Whether a specific WEG measure on common property qualifies pro rata depends on the certificate for your unit. I did not verify this further.

### 5.4 Owner-occupied vs. rented

| | Owner-occupied (§10f) | Rented (§7i + §7(4)) |
|---|---|---|
| Eligible renovation | 90% over 10 years | 100% over 12 years |
| Price of existing building | Nothing | Normal AfA 2–2,5% p.a. on the building share |
| Land | Nothing | Nothing |
| Loan interest, running costs | Not deductible | Werbungskosten |
| Can it create a loss? | No: it is a deduction like Sonderausgaben. A year with too little income loses the excess (my inference, not explicitly confirmed) | Yes, offsets other income and carries forward |
| Erhaltungsaufwand | Only if certified (§10f(2)) | Immediately deductible, or §11b over 2–5 years if certified |
| Tax on sale | Tax-free if you lived in it in the year of sale and the two years before | Tax-free after 10 years |
| Switching use | Possible. The switch from §10f to §7i is not seamless; check before doing it | |

### 5.5 Proposed model (owner-occupied only)

**Principle 1.** The relief depends on certified costs, not on the loan, so it is **identical for 10/15/20% EK**. It belongs to the apartment, and it affects the EK decision only through liquidity timing (refunds can fund Sondertilgung).

**Principle 2.** Refunds **never enter the tragbar check**: they arrive later, depend on a certificate, and are conditional on how you use the property. The verdict must not rest on them (Hard rule 1). They enter the common-horizon wealth comparison (A1) and are shown as their own line.

**Inputs** (optional block on `ApartmentCase`, collapsed unless "Denkmal" is ticked):

| Field | German label | Default | Note |
|---|---|---|---|
| `listed` | Denkmalgeschützt? | nein | |
| `eligibleInPrice` | Sanierungsanteil im Kaufpreis (laut Bauträgervertrag) | 0 € | 0 for an already-renovated flat |
| `ownMeasures` | Eigene Maßnahmen nach dem Kauf, vorher mit dem Denkmalamt abgestimmt | 0 € | Also a cash outflow (adds to renovation) |
| `includeAttributableNebenkosten` | Anteilige Kaufnebenkosten einrechnen | aus | Conservative default (NRW 3.3.4 allows it) |
| `grants` | Zuschüsse | 0 € | Reduce the base |
| `completionYear` | Sanierung fertig im Jahr | 1 | First deduction year |
| `constructionMonths` | Bauzeit bis Einzug | 0 | Bauträger: rent continues, interest and Bereitstellungszinsen accrue (ASSUMPTIONS §4.10 currently ignores this) |
| `marginalTaxRate` (household) | Grenzsteuersatz inkl. Soli/KiSt | none, must be entered | Read it from the last Steuerbescheid |
| `refundTiming` (household) | Erstattung: Folgejahr / Freibetrag laufend | Folgejahr | §39a |

**Engine** (`tax.ts`, pure): `denkmalBase = eligibleInPrice + ownMeasures (+ attributable NK) − grants`; schedule = 10 × 9% × base × marginal rate, starting in `completionYear` (+1 year lag unless Freibetrag). Example: base 200.000 € at 42% → 7.560 €/Jahr, 75.600 € over ten years.

**Outputs** (no new section): one readout in the apartment facts ("Steuerersparnis ~7.560 €/Jahr, Jahre 2 bis 11, nur mit Bescheinigung") with an InfoTip linking the §5.3 checklist (text in `glossary.ts`), a "Denkmal" marker on the apartment chip, and refunds as a line in the wealth comparisons. Optional: a "Erstattung als Sondertilgung" toggle, capped by the 5% contract limit.

**Simplifications to record in ASSUMPTIONS:** a constant marginal rate (large deductions can push you into a lower bracket, so the true saving is slightly lower); certificate assumed granted in the "mit" view; no partial own use; no object-limit check (explained only); no §35a/§35c alternative computed (rule of thumb: §10f beats §35c when the marginal rate is above 22%, since 0,9 × rate > 20%); no §7i rental mode.

**Denkmal-specific costs the current model misses:** Bauträger construction period (rent overlap + Bereitstellungszinsen), typically higher maintenance and energy costs (restrictions on windows and insulation), and the Sonderumlage risk in an old WEG. These are ordinary inputs (`monthlyOwnershipCosts`, `constructionMonths`), not tax logic.

### 5.6 Open questions for a Steuerberater

- Treatment of a later move-out and rental for the remaining years (§10f → §7i).
- Pro-rata WEG measures on common property after purchase.
- Whether a KfW/BEG grant counts as "Zuschuss aus öffentlichen Kassen" for your specific programme.
- Your Land's Bescheinigungsrichtlinie and the Bauträger's certificate (amount per unit, completion year).

---

## 6. Prioritised roadmap

| Step | Content | Size | Gate |
|---|---|---|---|
| **P0.0** | T1 golden snapshot + T2 invariants | S | None. Do first |
| **P0.1** | C1 ETF tax (+ state v3, A5) | S | Test: sign on defaults |
| **P0.2** | C2 neutral verdict (+ spec §13, DECISIONS) | S | Test |
| **P0.3** | C3 remove Nettovermögen; C4 reliable-first columns | XS | Snapshot diff reviewed |
| **P0.4** | Doc fixes C12, C13, U7 | XS | None |
| **P1.1** | A1 `wealthAt()` ledger + T2 equivalence test | M | Must reproduce `netAdvantageFixed` exactly at tax 0 |
| **P1.2** | C5/U5 Warten on the ledger + break-even | M | **Mockup first** |
| **P1.3** | U2 marginal EK return + break-even ETF | S | **Mockup first** |
| **P1.4** | C7 Sondertilgung on the same basis; C8 refi stress line; C9 runtime warning | S | Right panel re-check at 1280×800 if a readout moves |
| **P2.1** | ASSUMPTIONS "Denkmal" section from §5 (text only) | XS | None |
| **P2.2** | `tax.ts` Denkmal engine + inputs + tests (T4) | M | Only if a listed property is on the shortlist |
| **P2.3** | Denkmal UI block | M | **Mockup first** |
| **P3** | "Weiter mieten" column from the ledger | S | Requires a deliberate spec §18 amendment |
| | A2 module split | | Together with P1.1/P2.2, not standalone |
| Not recommended | §7i rental mode, full Anschlussfinanzierung model, a §32a tariff engine | | Non-goals; a marginal-rate input is enough |

---

## 7. Questions for you

1. Is a listed property actually on the shortlist? If yes: a Bauträger renovation or already renovated, and which Bundesland?
2. Buy vs. rent: amend spec §18 for one "weiter mieten" column, or keep using the Kommer calculator?
3. Your marginal tax rate and Kirchensteuer (for C1 and §10f).
4. Roughly what share of the ETFs you would sell is unrealised gain, and is your Sparerpauschbetrag already used elsewhere?
5. Your ages and target "schuldenfrei by" age (for C9).

---

## Sources

- EStG, current text: [§10f](https://www.gesetze-im-internet.de/estg/__10f.html), [§7i](https://www.gesetze-im-internet.de/estg/__7i.html), [§11b](https://www.gesetze-im-internet.de/estg/__11b.html), [§7h](https://www.gesetze-im-internet.de/estg/__7h.html), [§7](https://www.gesetze-im-internet.de/estg/__7.html), [§6](https://www.gesetze-im-internet.de/estg/__6.html), [§35a](https://www.gesetze-im-internet.de/estg/__35a.html), [§35c](https://www.gesetze-im-internet.de/estg/__35c.html), [§39a](https://www.gesetze-im-internet.de/estg/__39a.html), [§10g](https://www.gesetze-im-internet.de/estg/__10g.html)
- [NRW Bescheinigungsrichtlinien §§ 7i, 10f, 11b EStG vom 28.11.2025 (MB.NRW 2025 Nr. 181)](https://recht.nrw.de/mbnrw/2025-181)
- [OFD NRW, Verfügung vom 19.02.2026, S 2198b-2015-0000557-St 231](https://intern.altbayerischer.de/wp-content/uploads/2026/05/FI_26_04_Anlage-1-Behandlung-von-Baudenkmaelern-OFD-NRW-19.2.26.pdf)
- [Bayern, Bescheinigungsrichtlinie (BayMBl. 2025 Nr. 424)](https://www.verkuendung-bayern.de/baymbl/2025-424/)
- BFH X R 23/24 (25.03.2026), no transfer to heirs: [DATEV Magazin](https://www.datev-magazin.de/nachrichten-steuern-recht/steuern/bfh-kein-uebergang-der-abzugsbetraege-nach-%C2%A7-10f-estg-auf-den-erben-147420), [NWB Experten-Blog](https://www.nwb-experten-blog.de/erbe-darf-die-%C2%A7-10f-foerderung-fuer-ein-baudenkmal-nicht-fortfuehren/)
- BFH X R 22/20 (24.05.2023), lifetime object limit: [Rechtslupe](https://www.rechtslupe.de/steuerrecht/einkommensteuer/einkommensteuer-privat/steuerbeguenstigung-fuer-selbstbewohnte-baudenkmaeler-und-der-objektverbrauch-3241889)
- FG Niedersachsen 9 K 279/12, no pro-rata reduction: [Otto Schmidt](https://www.otto-schmidt.de/news/steuerrecht/denkmalgeschutzte-gebaude-keine-zeitanteilige-kurzung-der-steuerbegunstigung-gem-10f-abs-1-s-1-estg-im-jahr-des-nutzungswechsels-2013-07-12.html)
- BFH X R 8/08 (24.06.2009), certificate as Grundlagenbescheid: [lexetius](https://lexetius.com/2009,2178)

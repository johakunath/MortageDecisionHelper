# Model, Formulas and Limitations

Everything the calculation makes up, assumes, or simplifies. The in-app QA section should link here rather than restating it.

All logic lives in `src/lib/calculations.ts`. It is pure, has no React imports, and is the only place model changes belong.

---

## 1. Reliable vs. illustrative

The most important distinction in the model. Two interest figures are produced and they do **not** carry equal weight:

| Figure | Field | Trust |
|---|---|---|
| Interest during the fixed-rate period | `mortgage.interestFixed` | **Reliable.** The rate is contractually fixed for this span |
| Interest over the full term | `mortgage.interestTotal` | **Illustrative only.** Assumes today's rate holds for the entire repayment period — 20+ years. Nobody knows the refinancing rate |

Anything derived from `interestTotal` inherits the caveat, above all `runtimeYears`. Wealth is never compared at each scenario's own payoff date any more: `wealthAtHorizon` values every path on one date, the end of the binding (§2, [D30](DECISIONS.md)).

**Rule for the UI:** never present a full-term figure with the same visual weight as a fixed-period one, and never compare a fixed-period figure against a full-term one in the same subtraction.

The primary refinancing-risk indicator is `mortgage.remainingAfterFixed` — the debt still outstanding when the fixed rate ends.

---

## 2. Core formulas

### Monthly annuity
```
regularMonthlyPayment = loan × (interestRate% + repaymentRate%) ÷ 12
```
German convention: the payment is derived from the *initial* repayment rate, not from a target term.

**But the direction of entry is reversed.** `monthlyPayment` is the stored input and the
Tilgungssatz is derived per EK level:
```
repaymentRate(scenario) = monthlyPayment × 1200 ÷ loan(scenario) − interestRate(scenario)
```
The monthly rate is therefore identical in every EK scenario, and more Eigenkapital
shows up as a higher Tilgungssatz and a shorter term rather than as a smaller payment.
This mirrors the broker's own offers and corrects a real distortion — see
[DECISIONS.md D14](DECISIONS.md).

### Sollzins
```
interestRate = rates[nearest(10 | 15) of fixedRateYears][scenarioId]
```
Two axes, not one: EK level **and** Sollzinsbindung. Both are entered by hand and both
are always visible. **The rates do not fall monotonically with Eigenkapital** — in the
offer below, 10% and 15% EK carry the identical rate at a 15-year binding. Nothing in
the model may assume otherwise.

### Monthly simulation
Per month, in order:
1. `interest = balance × (interestRate ÷ 100 ÷ 12)`
2. `principalPart = regularMonthlyPayment − interest`
3. `balance −= principalPart`
4. every 12th month: apply that year's Sondertilgung, capped
5. repeat until `balance ≤ 0.01` or the simulation limit

### Cash
```
downPayment  = purchasePrice × ekRate%
closingCosts = purchasePrice × closingCostRate%
cashNeeded   = downPayment + closingCosts + renovation + moving
cashLeft     = availableCapital − cashNeeded
reserveGap   = cashLeft − reserveTarget          negative ⇒ reserve violated
```

### Monthly burden
```
allInMonthly = regularMonthlyPayment + monthlyOwnershipCosts
rentDelta    = allInMonthly − currentWarmRent     cash-flow only; NOT rent-vs-buy
burdenRatio  = allInMonthly ÷ householdNetIncome
```

### Wealth on a common date (`wealthAtHorizon`)
Every like-for-like comparison runs through one monthly ledger ([D30](DECISIONS.md)):
```
H        = horizon in months; default fixedRateYears × 12 (every rate in play is known)
budget   = waitSavingsMonthly + currentWarmRent       per month, for housing plus saving
r_m      = (1 + etfReturnRate%)^(1/12) − 1

liquid₀  = availableCapital
renting months:  liquid = liquid × (1 + r_m) + budget − currentWarmRent
purchase month:  liquid −= cashNeeded (at the price after waiting)
owning months:   liquid = liquid × (1 + r_m) + budget − monthlyOwnershipCosts
                          − (interest + principal paid) − Sondertilgung paid
liquidTax = (liquid_H − net contributions) × etfTaxRate%   linear, may be negative
propertyValue = purchasePrice × (1 + propertyGrowthRate%)^(H/12)   same for every path
wealth   = propertyValue − debt_H + liquid_H − liquidTax
```
The amortisation is `simulateMortgage` itself, observed through its read-only `onMonth` hook, so the offer-pinned schedule is reused.

`budget` is D4 read the other way round: the net savings rate is what is left *after* rent, so rent plus savings is what the household has for housing at all. This only works if `currentWarmRent` and `monthlyOwnershipCosts` sit on the same basis (both including heating and Nebenkosten, both without electricity); the glossary says so ([D30](DECISIONS.md)).

Properties pinned by tests: the wealth gap between two EK levels equals the after-tax `netAdvantageFixed` to the cent; Sondertilgung is neutral when the ETF earns exactly the loan's effective rate untaxed; the ledger's debt equals the simulated Restschuld.

### Sondertilgung plan effect (`specialPlanEffect`)
```
paid           = Sondertilgung paid inside the binding (after the cap)
debtReduction  = debt_H(no plan) − debt_H(plan)            reliable
interestSaved  = debtReduction − paid
wealthDelta    = wealth_H(plan) − wealth_H(no plan)         same money in the ETF, after tax
```

### Refinancing stress (`refinanceStress`)
```
stressRate     = interestRate + refiStressShift
coversInterest = monthlyPayment > Restschuld × stressRate ÷ 1200
follow-up      = simulate(Restschuld, stressRate, same monthlyPayment, remaining plan years)
extraYears     = runtime(stressRate) − runtime(interestRate)     both computed the same way
```
A stress test, not a forecast. It turns the Restschuld into one comparable number per EK level ([D31](DECISIONS.md)).

### Waiting
```
years        = waitMonths ÷ 12
futurePrice  = purchasePrice × (1 + waitPropertyGrowthRate%)^years
saved        = waitSavingsMonthly × waitMonths
rentPaid     = currentWarmRent × waitMonths        never subtracted from capital
adjustedCapital = availableCapital + saved
adjustedRate    = max(0.1, baseRate + waitRateShift)

deltaInterest  = interestTotal(wait) − interestTotal(now)
deltaTotalCost = deltaInterest + rentPaid          what waiting costs, in full
```
`waitSavingsMonthly` is **net of rent** by definition — see [DECISIONS.md D4](DECISIONS.md#d4--waitsavingsmonthly-is-net-of-rent). Subtracting `rentPaid` from *capital* as well would double-count it.

**Rent is a cost, but not a capital deduction.** Those are two different questions and rent belongs to exactly one of them, which is why it appears in `deltaTotalCost` and not in `adjustedCapital`. Adding it to an interest delta is a comparison of like with like: over the same months, the buy-now column pays interest, and that interest already sits inside its `interestTotal`. Rent is the waiting side's counterpart. Principal is excluded from both — it becomes equity, not cost.

What the sum still does **not** capture: the two paths reach debt-free at different calendar dates, and waiting buys a more expensive property with a larger loan. Both are visible in the same table (`futurePrice`, `futureLoan`, `runtimeYears`), neither is folded into the delta. See [DECISIONS.md D27](DECISIONS.md).

### ETF opportunity cost
```
etfForegoneGross = extraCapital × ((1 + etfReturnPct%)^years − 1)
etfForegone      = etfForegoneGross × (1 − etfTaxRate%)
netAdvantage     = interestSavedFixed − etfForegone
```
Must be paired with the mortgage interest saved **over the same horizon** (`fixedRateYears`), and the difference reported. A foregone-growth number shown alone tells the reader nothing.

**After tax, because the other side is tax-free.** The interest an owner-occupier does not pay is not income; ETF gains are taxed on realisation. Default `etfTaxRate` 18,4625% = 25% Abgeltungsteuer + 5,5% Soli on it, on 70% of the gain (Teilfreistellung for equity ETFs). Kirchensteuer raises it, an unused Sparerpauschbetrag lowers it. `afterTaxAnnualReturn` converts the ETF assumption into the after-tax rate per year that is comparable with a mortgage rate (5% → ≈4,23% over ten years). See K18.

At one Monatsrate, `remainingAfterFixed(less EK) − remainingAfterFixed(more EK) = extraCapital + interestSavedFixed` exactly (pinned in `invariants.test.ts`). That identity is why `netAdvantage` is a true terminal-wealth difference.

---

### Tilgung ↔ Laufzeit ↔ Monatsrate

Three expressions of one contract. Closed-form, and they deliberately **ignore Sondertilgung** — they describe the contract, not the plan. The real payoff date, which extra repayments pull forward, comes from `simulateMortgage`.

```
runtime  = −ln(1 − zins/(zins+tilgung)) / ln(1 + zins/1200) / 12
tilgung  = (monthlyFactor × 12 − zins/100) × 100      where monthlyFactor is the annuity factor
tilgung  = monatsrate × 1200 / darlehen − zins
```

At zero interest all three degrade to linear amortisation (`runtime = 100 / tilgung`). Only `repaymentRate` is stored; the other two are always derived, so they cannot drift apart.

The reference loan for the Monatsrate view is 10% EK on the active apartment — the rate is a property of the contract, so it must not shift when a different EK door is selected.

## 3. Thresholds

| Threshold | Default | Nature |
|---|---|---|
| Safety reserve | 20.000 € | Personal preference. **Not** a bank requirement |
| Max household burden | 40% | Adjustable heuristic. **Not** a universal bank rule |
| Max annual Sondertilgung | 5% of original loan | Contract-dependent — verify against a real offer |

**Feasible ("sauber") requires all three:** the monthly rate amortises the loan (covers
the interest and clears it inside 60 years), `cashLeft ≥ reserveTarget`, **and**
`burdenRatio ≤ threshold`.

**The burden check no longer separates the EK levels.** With one monthly rate for all
of them, `allInMonthly` is identical across scenarios, so `burden` passes or fails for
all three at once and only `cash`/`reserve` discriminate. That is a consequence of
D14, and it is the honest reading: the rate is the couple's decision, not a result of
the EK choice.

**No single recommendation.** The verdict lists every tragbar level and names the others with their status ([D28](DECISIONS.md)). The old precedence ("prefer 10% EK") dated from the 5/10/15 grid, where 10% was the middle; since D15 it named the lowest level.

**"Gerade so tragbar"** = tragbar, but `cashLeft < 1,5 × reserveTarget`. A heuristic, amber, never a failed constraint.

**Kaufnebenkosten are never financed.** The loan is always `Kaufpreis − Anzahlung`; closing costs, renovation and moving are paid from cash and appear in `cashNeeded`. Every scenario is therefore "X% EK **+ Nebenkosten**", and the UI labels it that way — "10% EK" alone is ambiguous about precisely the point German first-time buyers most often misjudge.

**Sondertilgung reference** is the EK level selected at the top of the page, running its
current yearly plan. Every other level is measured against it **without** Sondertilgung
of its own, and the app always names which side would have to pay to close the gap.
The required figure is a **flat annual amount**, not an increment on top of the existing
plan. See [DECISIONS.md D17](DECISIONS.md).

Winners (cost minimum, liquidity maximum, lowest monthly, compromise) are only ever drawn from **feasible** scenarios. When nothing is feasible there is no winner — see [PRODUCT_SPEC §5.3](PRODUCT_SPEC.md#5-core-principles).

---

## 4. Simplifications

1. **Constant interest rate for the full term.** No Anschlussfinanzierung model. See §1.
2. **Sondertilgung once per year**, at the year boundary, capped against the *original* loan. Real contracts vary in timing, cap basis and carry-over rules.
3. **Tax only on ETF gains** (`etfTaxRate`), applied linearly at the horizon. No property tax effects, no §10f, no tax on ETFs sold to fund the purchase: `availableCapital` is entered after that tax.
4. **Monthly ownership costs are flat** — no escalation, no inflation, no maintenance-reserve growth.
5. **Property growth is a flat compound rate.** No cycles, no regional variation, no bear/base/bull triple (spec §16 allows one but it is not implemented).
6. **`rentDelta` is a cash-flow comparison only.** Because `allInMonthly` includes Tilgung, a positive `rentDelta` is partly saving, not cost. It is not a rent-vs-buy analysis — no imputed rent, no equity build, no transaction costs on exit. Use the Gerd Kommer calculator for that.
7. **Closing costs are a single percentage.** No split into Grunderwerbsteuer / Notar / Makler. The 11,57% default is the offer's own split (2% Notar/Grundbuch + 6% Grunderwerbsteuer + 3,57% Maklercourtage) collapsed into one number.
8. **The six Sollzinsen are user assumptions**, entered by hand. Nothing is fetched.
9. **The model uses the Sollzins, not the Effektivzins.** Nominal rate, compounded monthly: 3,87% nominal is 3,94% effective, while the offer states 3,97% under PAngV (which also carries fees and disbursement timing). The app therefore understates the true cost very slightly. It never displays an Effektivzins, so it never claims otherwise.
10. **Bereitstellungszinsen are not modelled.** The offer allows 6 free months, then 0,20%/month. For a Bestandsimmobilie disbursed on the completion date this is zero; for a Neubau drawn in stages it would not be.
11. **Loan amounts are exact percentages of the purchase price.** Banks round: the offer quotes 382.000 € and 359.000 € where 85% and 80% of 450.000 € would be 382.500 € and 360.000 €. A difference of up to ~1.000 €, not modelled.
12. **The runtime is reported in fractional months.** A bank's Tilgungsplan counts the final part-payment as a whole month, so "30,09 Jahre" here and "30 Jahre 2 Monate" on the offer are the same result.

---

13. **The ledger invests all free capital at the ETF assumption**, the safety reserve included. A reserve held in Tagesgeld earns less; the effect is identical across EK levels only while their free capital is similar.
14. **ETF tax in the ledger is linear** in the net gain and charged once, at the horizon. It may turn negative where withdrawals exceed growth; that is the after-tax growth those withdrawals gave up. No Vorabpauschale, no Sparerpauschbetrag.
15. **The household budget is constant** (`waitSavingsMonthly + currentWarmRent`) for the whole horizon: no pay rises, no inflation.

## 5. Defect log

K1 to K21 are resolved. Kept as history: each of these skewed a number the couple was arguing
over, and four of them happened to favour the same side.

| # | Defect | Effect | Resolved by |
|---|---|---|---|
| K1 | `buildWaitScenario` subtracts `rentPaid` from future capital | Double-counts rent. An 18.000 € gain read as a 5.640 € loss — made waiting look worse than it is | [D4](DECISIONS.md) |
| K2 | Sondertilgung path falls back to the scalar for years beyond the entered array | A 10-year plan kept paying into years 11+. **Inflated the Sondertilgung strategy** | `SpecialPlan` union; `plan.years[i] ?? 0` |
| K3 | `requiredSpecialToMatch` compares flat-scalar candidates against a target that runs the full path | The headline break-even answered the wrong question | Explicit target argument; [D1](DECISIONS.md) |
| K4 | `costMinimum` / `liquidityMaximum` reduce over all scenarios, not feasible ones | Could name a winner while `noSafeScenario` is true — violates [§5.3](PRODUCT_SPEC.md#5-core-principles) | `pickBest(feasibleScenarios, …)` |
| K5 | Several `reduce` calls have no seed value | Threw on an empty array | Seeded reducers |
| K6 | ETF opportunity cost computes foregone growth only | The interest-saved comparison — [spec §15](PRODUCT_SPEC.md#15-etf-opportunity-cost) — was absent | `netAdvantageFixed` |
| K7 | 40% burden threshold hardcoded in logic and duplicated in four display strings | Spec calls it adjustable; it wasn't | `maxBurdenRate` input |
| K8 | `annualSpecialRepayment` is both an editable input and a value overwritten with the path average | A field the user typed into got silently replaced | Readout only; the Jahresplan is the single source |
| K9 | EK levels compared at a constant Tilgungssatz while the bank compares at a constant Monatsrate | Understated what more Eigenkapital buys by **35.494 €** of remaining debt after 10 years, systematically against the "more EK" side | [D14](DECISIONS.md) |
| K10 | `SondertilgungPanel` calls a plan "vom Plan gedeckt" by comparing the yearly path's **average** against the required **flat, whole-runtime** amount | Claimed the defaults' ten-year 6.000 €/Jahr plan had caught 20% EK while it was 15.519 € of interest short. **Favoured the low-EK side** | [D22](DECISIONS.md) |
| K11 | The Warten table is hardcoded to `[0, 12, 24]` while "Wartezeit" sits above it as a highlighted input | The field was stored, persisted and read by nothing — editing it changed no number on screen | `waitPeriodsFor()` |
| K12 | `narrowestMiss.gap` printed as "es fehlen X €" for every constraint | The `payment` gap is €/**Monat**; a monthly shortfall read as a one-off amount | `describeMiss()` |
| K13 | "ihr spart \|interestSavedFixed\| Zinsen" in the trade-off statement | The Sollzinsen are hand-entered and not monotone in EK, so the sentence could state the exact opposite of its own number | Sign read, not assumed |
| K14 | A Monatsrate below the interest-only floor is silently simulated as a higher one (the Tilgungssatz is clamped to 0,01%) | Laufzeit, Zinsen and Restschuld described a payment nobody entered, with only a red status pill to hint at it | `paymentSubstituted` + a named note |
| K15 | "Δ zu jetzt kaufen" carried the interest delta alone, with the rent paid while waiting two rows below and never added in | On the defaults, twelve months of waiting read **−16.978 € besser** on the row that looks like the bottom line, while 23.640 € of rent went uncounted. Including it, waiting is 6.662 € *more* expensive — the **sign** was wrong, not just the size. Favoured the "warten und weiter sparen" side | [D27](DECISIONS.md) |
| K16 | `migrateV1` derives the replacement Monatsrate from the stale global `inputs.purchasePrice`, a hardcoded 90% loan and today's default Sollzins | A v1 save whose active flat was 600k at the old 5% EK level loaded at 3.390 €/Monat instead of 3.111 € — **+279 €/Monat** of silently added burden, moving every affordability and interest figure | Rebuilt from the active apartment, its EK level and the stored legacy rate |
| K17 | The `payment` check reports its shortfall against the interest-only payment while failing on the 60-year horizon | A rate that clears the interest but needs 80 years produced a **positive** gap, which the UI printed as "es fehlen 6 €" — the loan does amortise, and the real shortfall was 137 € | `required` is the 60-year annuity, derived under the running Sondertilgung plan (`minimumPaymentForLifetime`) — a bar computed without the plan overstated 41 € as 99 € |
| K18 | The ETF opportunity cost netted **pre-tax** ETF growth against tax-free interest saved | On all three default apartments the headline read "für mehr Liquidität"; after Abgeltungsteuer it reads "für mehr Eigenkapital" (offer flat: −3.280 € → +1.945 €). **Favoured the liquidity side** | `etfTaxRate`; [D29](DECISIONS.md) |
| K19 | "Nettovermögen" and "Immobilienwert bei Abzahlung" were valued at each scenario's **own** payoff year | The same flat was worth 67.000 € more at 10% EK than at 20% because that loan runs five years longer; Nettovermögen showed 46.000 € more. **Favoured the liquidity side** | Fields removed; `wealthAtHorizon` on one date; [D30](DECISIONS.md) |
| K20 | The trade-off matrix and the Sondertilgung headline led with **full-term** interest, the latter without any opportunity cost | 65.867 € "Zinsen gesamt" where the reliable figure is 25.021 €; "78.750 € gespart" for 60.000 € paid in, while §1 charged extra EK an ETF opportunity cost | Binding interest in the matrix; `specialPlanEffect`; [D30](DECISIONS.md) |
| K21 | `evaluateDecision` preferred "10% EK", a rule from the 5/10/15 grid | Since D15 it named the **lowest** level in the verdict headline: one spouse's side, chosen by code | Recommendation removed; [D28](DECISIONS.md) |

**Open:** the Warten table's bottom line (`deltaTotalCost`) still adds a full-term interest delta to rent and omits ownership costs, return on capital and principal. On the offer flat it reads "6.662 € teurer" for a year of waiting, while `wealthAtHorizon` puts waiting **3.207 € ahead** at the default ETF assumption (and 8.028 € behind at 0%). The replacement waits on a layout choice (REVIEW.md U5).

---

## 6. Validation status

**There is no in-app comparison panel.** [Spec §7.6](PRODUCT_SPEC.md#76-qa-and-assumptions) once
asked for fields to type another calculator's figures into. It was built, tested and
never given a screen, and `offer.test.ts` supersedes it: the same check, against the
real offer, run automatically on every commit rather than by hand. See
[D23](DECISIONS.md).

**Validated against a real broker offer.** Source: Finanzierungsangebot vom 07.08.2026,
Varianten 1A–3B — 90% / 85% / 80% Finanzierung × 10 / 15 Jahre Sollzinsbindung on a
450.000 € Eigentumswohnung. (Only the financial parameters are recorded here and in the
tests; no personal data from that document is in this repository.)

Pinned as a regression test in `src/lib/offer.test.ts`. Result:

| Variante | Darlehen | Sollzins | Bindung | Zinsen (Modell / Angebot) | Restschuld (Modell / Angebot) |
|---|---|---|---|---|---|
| 1A | 405.000 € | 3,87% | 10 J | 141.148,81 / 141.148,78 | 318.148,81 / 318.148,78 |
| 1B | 405.000 € | 4,06% | 15 J | 210.992,10 / 210.992,07 | 273.992,10 / 273.992,07 |
| 2A | 382.000 € | 3,86% | 10 J | 130.791,81 / 130.791,89 | 288.940,21 / 288.940,29 |
| 2B | 382.000 € | 4,06% | 15 J | 191.747,93 / 191.747,95 | 231.747,93 / 231.747,95 |
| 3A | 359.000 € | 3,76% | 10 J | 115.294,48 / 115.294,48 | 246.294,48 / 246.294,48 |
| 3B | 359.000 € | 3,96% | 15 J | 166.545,93 / 166.545,94 | 183.545,93 / 183.545,94 |

Largest deviation: **8 cents** over fifteen years. The month-by-month Tilgungsplan also
matches (first month 1.306,12 vs 1.306,13 € interest; balance after 16 months
395.264,67 vs 395.264,68 €), as does the term (362 months = 30 Jahre 2 Monate) and the
cost structure (Nebenkosten 52.065 € = 11,57%; Eigenkapital = Anzahlung + Nebenkosten;
Sondertilgung 5% = 20.250 €/Jahr).

Still outstanding from [PRODUCT_SPEC §19](PRODUCT_SPEC.md#19-validation-before-real-use):
the owner's Google Sheet and an independent German mortgage calculator. Neither is
load-bearing now that a real offer agrees to the cent, but a second offer with a
different structure (Neubau with Bereitstellungszinsen, or a split Teildarlehen) would
test parts of the model this one does not touch.

Automated coverage lives in `src/lib/calculations.test.ts`. Run with:

```bash
npm test
```

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

Anything derived from `interestTotal` inherits the caveat: `runtimeYears`, `netWorthAtPayoff`, `propertyValueAtPayoff`.

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

### Property and net worth
```
propertyValueAtPayoff   = purchasePrice × (1 + propertyGrowthRate%)^runtimeYears
realPropertyReturnRate  = propertyGrowthRate − inflationRate
netWorthAtPayoff        = propertyValueAtPayoff − cashNeeded − interestTotal
```

> ⚠️ `netWorthAtPayoff` is evaluated at **each scenario's own payoff year**, and those years differ. Subtracting it between two scenarios therefore silently rewards whichever runs longest. Do not build cross-scenario comparisons on this field without first pinning a common horizon.

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
etfForegone = extraCapital × ((1 + etfReturnPct%)^years − 1)
```
Must be paired with the mortgage interest saved **over the same horizon** (`fixedRateYears`), and the difference reported. A foregone-growth number shown alone tells the reader nothing.

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

**Recommendation precedence:** prefer 10% EK when feasible → otherwise the feasible scenario with the lowest total interest → otherwise none, and say so.

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
3. **No tax.** Not on ETF sales, not on the property, not on anything.
4. **Monthly ownership costs are flat** — no escalation, no inflation, no maintenance-reserve growth.
5. **Property growth is a flat compound rate.** No cycles, no regional variation, no bear/base/bull triple (spec §16 allows one but it is not implemented).
6. **`rentDelta` is a cash-flow comparison only.** It is not a rent-vs-buy analysis — no imputed rent, no equity build, no transaction costs on exit. Use the Gerd Kommer calculator for that.
7. **Closing costs are a single percentage.** No split into Grunderwerbsteuer / Notar / Makler. The 11,57% default is the offer's own split (2% Notar/Grundbuch + 6% Grunderwerbsteuer + 3,57% Maklercourtage) collapsed into one number.
8. **The six Sollzinsen are user assumptions**, entered by hand. Nothing is fetched.
9. **The model uses the Sollzins, not the Effektivzins.** Nominal rate, compounded monthly: 3,87% nominal is 3,94% effective, while the offer states 3,97% under PAngV (which also carries fees and disbursement timing). The app therefore understates the true cost very slightly. It never displays an Effektivzins, so it never claims otherwise.
10. **Bereitstellungszinsen are not modelled.** The offer allows 6 free months, then 0,20%/month. For a Bestandsimmobilie disbursed on the completion date this is zero; for a Neubau drawn in stages it would not be.
11. **Loan amounts are exact percentages of the purchase price.** Banks round: the offer quotes 382.000 € and 359.000 € where 85% and 80% of 450.000 € would be 382.500 € and 360.000 €. A difference of up to ~1.000 €, not modelled.
12. **The runtime is reported in fractional months.** A bank's Tilgungsplan counts the final part-payment as a whole month, so "30,09 Jahre" here and "30 Jahre 2 Monate" on the offer are the same result.

---

## 5. Defect log

All resolved. Kept as history — each of these skewed a number the couple was arguing
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

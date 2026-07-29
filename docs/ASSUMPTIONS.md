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
rentPaid     = currentWarmRent × waitMonths        DISPLAY ONLY — never subtracted
adjustedCapital = availableCapital + saved
adjustedRate    = max(0.1, baseRate + waitRateShift)
```
`waitSavingsMonthly` is **net of rent** by definition — see [DECISIONS.md D4](DECISIONS.md#d4--waitsavingsmonthly-is-net-of-rent). Subtracting `rentPaid` as well would double-count it.

### ETF opportunity cost
```
etfForegone = extraCapital × ((1 + etfReturnPct%)^years − 1)
```
Must be paired with the mortgage interest saved **over the same horizon** (`fixedRateYears`), and the difference reported. A foregone-growth number shown alone tells the reader nothing.

---

## 3. Thresholds

| Threshold | Default | Nature |
|---|---|---|
| Safety reserve | 20.000 € | Personal preference. **Not** a bank requirement |
| Max household burden | 40% | Adjustable heuristic. **Not** a universal bank rule |
| Max annual Sondertilgung | 5% of original loan | Contract-dependent — verify against a real offer |

**Feasible ("sauber") requires both:** `cashLeft ≥ reserveTarget` **and** `burdenRatio ≤ threshold`.

**Recommendation precedence:** prefer 10% EK when feasible → otherwise the feasible scenario with the lowest total interest → otherwise none, and say so.

Winners (cost minimum, liquidity maximum, lowest monthly, compromise) are only ever drawn from **feasible** scenarios. When nothing is feasible there is no winner — see [PRODUCT_SPEC §5.3](PRODUCT_SPEC.md#5-core-principles).

---

## 4. Simplifications

1. **Constant interest rate for the full term.** No Anschlussfinanzierung model. See §1.
2. **Sondertilgung once per year**, at the year boundary, capped against the *original* loan. Real contracts vary in timing, cap basis and carry-over rules.
3. **No tax.** Not on ETF sales, not on the property, not on anything.
4. **Monthly ownership costs are flat** — no escalation, no inflation, no maintenance-reserve growth.
5. **Property growth is a flat compound rate.** No cycles, no regional variation, no bear/base/bull triple (spec §16 allows one but it is not implemented).
6. **`rentDelta` is a cash-flow comparison only.** It is not a rent-vs-buy analysis — no imputed rent, no equity build, no transaction costs on exit. Use the Gerd Kommer calculator for that.
7. **Closing costs are a single percentage.** No split into Grunderwerbsteuer / Notar / Makler.
8. **The three EK interest rates are user assumptions**, entered by hand. Nothing is fetched.

---

## 5. Known defects

Tracked, not yet fixed. Update this section as they are resolved.

| # | Defect | Effect |
|---|---|---|
| K1 | `buildWaitScenario` subtracts `rentPaid` from future capital | Double-counts rent. With defaults an 18.000 € gain reads as a 5.640 € loss — makes waiting look worse than it is |
| K2 | Sondertilgung path falls back to the scalar for years beyond the entered array | A 10-year plan keeps paying into years 11+. **Inflates the Sondertilgung strategy** — one side of the couple's disagreement |
| K3 | `requiredSpecialToMatch` compares flat-scalar candidates against a target that runs the full path | The headline break-even answers the wrong question. See [D1](DECISIONS.md#d1--sondertilgung-break-even-compares-against-15-ek-without-sondertilgung) |
| K4 | `costMinimum` / `liquidityMaximum` reduce over all scenarios, not feasible ones | Can name a winner while `noSafeScenario` is true — violates [§5.3](PRODUCT_SPEC.md#5-core-principles) |
| K5 | Several `reduce` calls have no seed value | Throw on an empty array |
| K6 | ETF opportunity cost computes foregone growth only | The interest-saved comparison — [spec §15](PRODUCT_SPEC.md#15-etf-opportunity-cost), the numerical core of the disagreement — is absent |
| K7 | 40% burden threshold hardcoded in logic and duplicated in four display strings | Spec calls it adjustable; it isn't |
| K8 | `annualSpecialRepayment` is both an editable input and a value overwritten with the path average | A field the user types into gets silently replaced |

---

## 6. Validation status

**Not yet validated against any external source.** [PRODUCT_SPEC §19](PRODUCT_SPEC.md#19-validation-before-real-use) requires, before this tool informs a real purchase:

1. the owner's existing Google Sheet
2. at least one independent German mortgage calculator
3. ideally a real bank or broker offer

Compare: loan amount · monthly payment · remaining debt after 10 years · fixed-period interest · total interest under the same constant-rate assumption · Sondertilgung effect.

Automated coverage lives in `src/lib/calculations.test.ts`. Run with:

```bash
npm test
```

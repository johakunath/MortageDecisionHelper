# Product Spec — Mortgage Decision Helper

> **Status:** canonical intent document. If code and this file disagree, this file wins — or this file gets updated deliberately. Do not let the code silently redefine the product.
>
> **Provenance:** authored by the owner (with ChatGPT) before the React implementation existed. Amended since — see [§21 Amendments](#21-amendments) and [DECISIONS.md](DECISIONS.md).

---

## 1. Product purpose

A personal decision-support tool for a German first-time **owner-occupied** property purchase.

Its purpose is to help a married couple make a fact-based decision between Eigenkapital strategies: **5%, 10% or 15% down payment.**

**The couple disagrees.** That disagreement is the product's reason to exist:

| Position A prioritises | Position B prioritises |
|---|---|
| Lower mortgage interest rate | Preserving liquidity |
| Lower total interest cost | Avoiding or limiting ETF sales |
| Lower monthly payment | Buying sooner |
| Lower remaining debt | Retaining flexibility |
| | Using Sondertilgung later to compensate for less EK upfront |

The central product question:

> **What do we gain and what do we give up when we use more Eigenkapital?**

The tool must reduce reliance on intuition, fear, optimism and rules of thumb. It translates a disagreement into measurable financial consequences.

**Design consequence:** any defect that distorts one side of this trade-off is not a cosmetic bug — it biases a real decision between two real people. Treat calculation correctness as a product-integrity issue, not a code-quality issue.

---

## 2. Primary decisions supported

### 2.1 How much cash do we need upfront?
Down payment · purchase costs · immediate renovation · moving and furniture · total cash required · cash remaining after purchase · difference vs. the desired safety reserve.

### 2.2 Is a lower down payment acceptable?
Compare 5% / 10% / 15% on: loan amount, interest rate, initial repayment rate, monthly payment, all-in monthly ownership cost, total interest, interest during the fixed-rate period, remaining debt after the fixed-rate period, liquidity after purchase, reserve gap, household burden.

Must **explicitly quantify**: interest saved by more EK · liquidity lost by more EK · monthly payment difference · remaining debt difference · **opportunity cost of selling more ETFs**.

### 2.3 Should we buy now or wait?
Not a forecast. A break-even and sensitivity view on user-defined assumptions: additional savings while waiting, rent paid while waiting, property-price change, mortgage-rate change → future price, future capital, future loan, future monthly payment, future total interest.

Output must show **what conditions would need to occur** for waiting to beat buying now.

---

## 3. Target users

The owner and his wife. Not a commercial product.

Must work when:
- one person operates the app
- **both people look at the results together on one screen**
- the discussion is about a concrete property or price range
- neither user is a mortgage expert
- users need clear explanations, not only tables

**Tone:** calm, neutral, family-oriented. Explicitly *not*: a bank sales tool, an investment-bro marketing product, an accounting application, a generic financial-advice chatbot.

---

## 4. Positioning — what this tool does NOT duplicate

Other tools already in use: a Gerd Kommer rent-vs-buy calculator, an Eigenkapital tracker in Google Sheets, a property-allocation simulator, separate ETF and property appreciation estimators, the Immocation investment-property calculator.

This app consumes **headline assumptions** from those tools rather than reimplementing them. Available capital comes from the EK tracker; appreciation assumptions come from the property estimator; ETF returns are entered manually. No full rent-vs-buy model. No investment-property ROI model.

---

## 5. Core principles

1. **Decision clarity before calculation depth.** Lead with conclusions: best for total cost, best for liquidity, best compromise, whether *any* scenario is comfortable, and the main reason a scenario is risky. Detail stays accessible but must not dominate the first screen.
2. **Inputs and outputs must be visually unmistakable.** Editable assumptions look like compact financial-calculator controls. Calculated outputs are read-only and structurally distinct — never confusable with a field.
3. **No false recommendation.** If every scenario violates a threshold, say **"Kein sauberes Szenario"**. Never present the least-bad option as though it were safe.
4. **Transparent assumptions.** Formulas and thresholds visible. Clearly separate: mathematical outputs · user assumptions · heuristic thresholds · uncertain future scenarios.
5. **Avoid unnecessary detail.** Big-picture decision tool. Not household accounting.

---

## 6. Main user flow

The intended flow is **linear**, not a set of parallel tabs:

1. Enter property and financing assumptions
2. Review the 5/10/15% scenarios
3. Select one scenario
4. See the cost-versus-liquidity trade-off
5. Test whether Sondertilgung compensates for lower EK
6. Test whether waiting improves the position
7. Review a decision summary
8. Validate against an external calculator or spreadsheet

---

## 7. Main sections

### 7.1 Entscheidung
Kosten-Minimum · Liquiditäts-Maximum · best compromise · selected scenario · whether a clean scenario exists at all · main risk/limiting factor · **a central trade-off statement**, e.g.:

> 15% Eigenkapital saves ~X € in interest compared with 5%, but requires Y € more cash upfront.

### 7.2 Eingaben
- **Kauf** — purchase price, closing-cost %, available capital, safety reserve, renovation, moving/furniture, current warm rent, monthly ownership costs
- **Finanzierung** — household net income, initial repayment rate, fixed-rate period, annual Sondertilgung, max Sondertilgung %, interest rate per EK level
- **Warten** — wait months, net monthly savings, property-price change, rate change
- **Advanced** — expected ETF return, **adjustable affordability threshold**, further scenario assumptions

### 7.3 EK-Vergleich
Clickable cards per scenario showing: down payment, loan, interest rate, monthly payment, all-in cost, total interest, fixed-period interest, remaining debt, cash needed, cash remaining, reserve gap, affordability status.

### 7.4 Sondertilgung
Answers: *how much annual Sondertilgung would a lower-EK scenario need to match the total interest of 15% EK?* — for 5%→15% and 10%→15%.

Shows: required annual amount · configured amount · maximum contractually permitted · whether break-even is mathematically feasible · whether the required amount looks realistic.

**The mathematical result is not a behavioural guarantee.** The open question — whether they will actually make the payment every year — must stay visible.

### 7.5 Warten
Compare **buy now / wait 12 months / wait 24 months** broken into: additional capital saved, rent paid while waiting, assumed price change, assumed rate change, resulting future loan, resulting total interest, cash remaining after the later purchase, difference vs. buying now.

### 7.6 QA and assumptions
Formula descriptions · assumptions · thresholds · validation status · known limitations · test scenarios · **comparison fields for an external mortgage calculator**.

---

## 8. Defaults

| Input | Default |
|---|---:|
| Purchase price | 720.000 € |
| Closing costs | 9% |
| Available capital | 145.000 € |
| Safety reserve target | 20.000 € |
| Renovation | 0 € |
| Moving and furniture | 0 € |
| Monthly ownership costs | 830 € |
| Current warm rent | 1.970 € |
| Household net income | 8.500 € |
| Initial repayment rate | 2,4% |
| Fixed-rate period | 10 years |
| Annual Sondertilgung | 6.000 € |
| Max annual Sondertilgung | 5% of original loan |
| Wait period | 12 months |
| Net monthly savings while waiting | 1.500 € |
| Property-price change | 2% p.a. |
| Interest-rate change while waiting | −0,3 pp |
| Expected ETF return | 5% p.a. |

**Interest rates by EK level** (user assumptions, *not* live market rates): 5% EK → 4,15% · 10% EK → 3,85% · 15% EK → 3,65%

---

## 9. Definitions

- **Eigenkapital %** — applies to the purchase price. 720.000 € at 10% → 72.000 € down payment. Purchase costs are *additional*.
- **Available capital** — total liquid or liquidatable capital: cash, savings, sellable ETFs. Composition is tracked in the external EK tracker, not here.
- **Safety reserve** — what must remain after down payment, purchase costs, renovation, moving and furniture. A personal threshold, **not** a bank requirement.
- **Monthly ownership costs** — deliberately rough: non-recoverable Hausgeld, maintenance reserve, property tax, building insurance, utility differences vs. renting. Not a service-charge statement.
- **Monthly savings while waiting** — **net**: what actually lands in Eigenkapital each month *after* rent and normal household expenses. **Therefore rent must NOT also be subtracted from future capital.** Rent is still displayed separately as a cost of waiting. This definition exists specifically to prevent double-counting.

---

## 10. Mortgage model

German annuity mortgage.

- **Monthly payment** = `loan × (interest rate + initial repayment rate) ÷ 12`
- **Monthly simulation** — interest on remaining balance → deduct interest from payment → remainder reduces principal → apply annual Sondertilgung at the yearly interval → continue until repaid.
- **Sondertilgung timing** — applied once per year, capped at a configured % of the **original** loan. A modelling simplification; real contracts differ.
- **Fixed-rate period** — compute interest paid during the period and remaining debt at its end. Remaining debt is the primary refinancing-risk indicator. No full Anschlussfinanzierung model.
- **Full-term interest** — assumes the entered rate holds for the entire repayment period. **This is a simplification.** Output must distinguish the *reliable* fixed-period figure from the *illustrative* full-term estimate. A future refinancing rate is unknowable.

---

## 11–12. Cash and monthly cost

```
cash required   = down payment + closing costs + renovation + moving
cash remaining  = available capital − cash required
reserve gap     = cash remaining − safety reserve target      (negative = violated)

all-in monthly  = mortgage payment + monthly ownership costs
vs rent         = all-in monthly − current warm rent           (cash-flow only, not rent-vs-buy)
burden ratio    = all-in monthly ÷ household net income        (default threshold 40%)
```

The 40% threshold is an **adjustable heuristic**, not a universal bank rule.

---

## 13. Decision logic

A scenario is **clean/feasible** only when **both** hold:
1. cash remaining ≥ safety reserve target
2. burden ratio ≤ the configured threshold (default 40%)

**If none qualify** → say "Kein sauberes Szenario", and explain whether the problem is insufficient upfront cash, a reserve violation, an excessive monthly burden, or a combination.

**If several qualify** → prefer 10% EK as the default compromise; if 10% is not feasible, take the feasible scenario with the lowest total interest.

Always show separate winners for: **lowest cost · highest liquidity · lowest monthly payment · best compromise.**

---

## 14. EK trade-off matrix

Compare 5-vs-10, 15-vs-10, 15-vs-5. For each: difference in cash remaining, total interest, monthly cost, **remaining debt**, plus a plain-language interpretation.

> Using 15% instead of 10% reduces total interest by X €, but leaves Y € less cash after purchase.

**Signs must be unambiguous. The UI must not rely on colour alone.**

---

## 15. ETF opportunity cost

Selling more ETFs to raise the down payment has a cost. Show **all four**:
1. additional capital put into the property
2. estimated foregone ETF growth
3. **mortgage interest saved**
4. **the difference between 2 and 3**

Values 2 and 3 must be measured over the **same horizon** or the difference is meaningless. The assumed ETF return is never treated as guaranteed. ETF sale taxes are out of scope unless entered manually.

This is the single most important calculation in the app — it is the numerical form of the couple's disagreement.

---

## 16. Property appreciation

Optionally three manual annual assumptions (bear / base / bull), ideally sourced from the separate property tool. This app must not build its own price model. Appreciation is **supplementary** and must not dominate the EK decision.

---

## 17. Test cases

| Case | Inputs | Expected |
|---|---|---|
| **600k machbar** | 600.000 € · capital 145.000 € · reserve 25.000 € · costs 760 € · rates 4,05/3,80/3,55 | At least one feasible scenario; 10% EK a plausible compromise; remaining buffer clearly shown |
| **720k Base** | defaults | Borderline. Warnings visible. Reserve and burden understandable. Trade-offs **not** hidden behind a generic recommendation |
| **850k Stress** | 850.000 € · capital 145.000 € · reserve 30.000 € · costs 950 € · rates 4,30/4,05/3,85 | **"Kein sauberes Szenario"**. Must NOT recommend 5% merely because it is the only one with positive cash. Must explain what would need to change |

---

## 18. Non-goals

No full rent-vs-buy model · no household budgeting · no tax calculation · no cross-bank offer comparison · no automatic rate feeds · no account connections · no ETF portfolio management · no maintenance schedules · no investment-property ROI · no rental income · no auth · no database · no advisor chatbot · **no opaque AI-generated recommendations**.

---

## 19. Validation before real use

Before this tool informs an actual purchase, validate the preferred scenario against: (1) the existing Google Sheet, (2) at least one independent German mortgage calculator, (3) ideally a real bank or broker offer.

Compare: loan amount · monthly payment · remaining debt after 10 years · fixed-period interest · total interest under the same constant-rate assumption · Sondertilgung effect.

**Investigate any discrepancy before adding more features.**

---

## 20. Priority order

1. Reliable calculation outputs
2. Clear distinction between editable inputs and calculated results
3. A strong first-screen decision summary
4. Understandable 5/10/15% trade-offs
5. A trustworthy "no clean scenario" state
6. Clear Sondertilgung break-even results
7. Reduced visual overload
8. Couple-friendly explanatory language

> **The app does not currently need additional scope.** The priority is to make the existing decision flow accurate, understandable and trustworthy.

---

## 21. Amendments

**A1 — Apartment comparison (added after the original spec).** The owner requested: *"make sure i can compare different apartments, with different prices and different Sondertilgungs-paths."*

This is a legitimate extension but must stay **subordinate** to the EK question. An apartment is the *context* the EK decision is made in, not a competing analysis. See [DECISIONS.md](DECISIONS.md) D3.

**A2 — Four implementation decisions** were locked with the owner covering the Sondertilgung baseline, navigation model, apartment role, and the wait-savings definition. See [DECISIONS.md](DECISIONS.md).

**A3 — Sections deleted, not restyled.** §7.3 (EK-Vergleich scenario cards) and §7.6 (QA section) are **no longer implemented as screens**. Their content was either duplicated elsewhere or moved to documentation:

- The twelve per-scenario fields of §7.3 live in the doors, the trade-off matrix and the right panel
- §7.6's formulas and limitations live in [ASSUMPTIONS.md](ASSUMPTIONS.md); its test cases are executed by `npm test`, not eyeballed in the UI
- §7.5 (Warten) is retained but collapsed — it answers *when* to buy, not *how much Eigenkapital*

Rationale in [DECISIONS.md D6](DECISIONS.md). This is a deliberate narrowing toward §1's central question, consistent with §20's instruction that the app needs no additional scope.

**A4 — Desktop is the priority viewport.** See [DECISIONS.md D7](DECISIONS.md).

**A5 — Default apartments are 600.000 € / 500.000 € / 450.000 €**, replacing the earlier 600/720/850k set, which mirrored the QA stress fixtures and left every scenario infeasible on first load.

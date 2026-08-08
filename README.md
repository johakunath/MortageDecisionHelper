# Mortgage Decision Helper

*haus · ein ruhiger rechner*

A private decision-support tool for one German couple buying their first owner-occupied home. It answers a single question:

> **What do we gain, and what do we give up, when we use more Eigenkapital?**

It compares three down-payment strategies — **10%, 15% and 20%**, the variants the broker actually quoted — and makes the trade-off between *cheaper financing* and *keeping cash* explicit enough to discuss. All three are compared at the same monthly rate, so more Eigenkapital shows up as a shorter term rather than a smaller payment.

It is not a bank tool, not a public calculator, and it deliberately gives no advice. It computes consequences; the couple decides.

---

## Who it's for

The owner and his wife, usually reading one screen together. Neither is a mortgage expert. The tone is intentionally calm and neutral.

They disagree, which is the point:

| One side wants | The other wants |
|---|---|
| Lower interest rate and total interest | To keep liquidity |
| Lower monthly payment | To avoid selling ETFs |
| Lower remaining debt | To buy sooner, stay flexible, and use Sondertilgung later |

---

## The decision rule

A scenario counts as **clean** ("sauber") only when **both** conditions hold:

1. **Cash remaining ≥ safety reserve target** — what's left after down payment, closing costs, renovation and moving
2. **Monthly burden ≤ 40% of household net income** — all-in monthly cost (mortgage + ownership costs) against income

If several scenarios are clean, the app prefers **10% EK** as the compromise, falling back to the clean scenario with the lowest total interest.

**If no scenario is clean, the app says so — "Kein sauberes Szenario" — and names the failing constraint.** It will never present the least-bad option as though it were safe.

Both thresholds are personal heuristics, not bank rules.

---

## Glossary

| German | Meaning |
|---|---|
| **Eigenkapital (EK)** | Equity / down payment, as a % of the purchase price. Closing costs come on top |
| **Kaufnebenkosten** | Closing costs — transfer tax, notary, agent. Modelled as one % of price |
| **Sondertilgung** | Optional annual extra repayment, contractually capped (default 5% of the original loan) |
| **Anfangstilgung** | Initial repayment rate. With the interest rate, it sets the monthly annuity |
| **Zinsbindung** | Fixed-rate period (default 10 years). The rate is only guaranteed this long |
| **Restschuld** | Debt still outstanding when the fixed-rate period ends — the refinancing-risk number |
| **Warmmiete** | Current rent including utilities, used for the monthly cash-flow comparison |
| **Realrendite** | Real return: property growth minus inflation |
| **Reserve-Gap** | Cash remaining minus the safety reserve target. Negative means the reserve is breached |

---

## Saving your work

Everything stays **in this browser** — there is no server and nothing is transmitted.

- The current state is saved automatically and survives a reload
- Named snapshots ("Immowelt 600k 04/2026") can be saved and loaded from the **Annahmen** section
- Clearing browser data, or opening the app in a different browser or profile, loses the saves

## What this model does *not* do

- **No refinancing model.** Interest during the fixed-rate period is reliable; the full-term total assumes today's rate holds forever and is **illustrative only**
- **No tax** — not on ETF sales, not on the property
- **No rent-vs-buy analysis.** The rent comparison is pure monthly cash flow
- **No live rates.** The six Sollzinsen (three EK levels × two Zinsbindungen) are assumptions you type in
- **No budgeting, no bank-offer comparison, no account connections, no portfolio management**

Full list of simplifications and known defects: [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md).

⚠️ **Not yet validated against an external calculator.** Before this informs a real purchase, check the preferred scenario against an independent German mortgage calculator and ideally a real bank offer — see [PRODUCT_SPEC §19](docs/PRODUCT_SPEC.md#19-validation-before-real-use).

---

## Running it

**Windows, simplest:** double-click `START_MORTGAGE_HELPER.cmd`, wait for "ready", browser opens at `http://127.0.0.1:5173`.

**Manually:**

```bash
npm install
```
```bash
npm run dev
```

**Offline single file:** `npm run build`, then open `dist/mortgage-helper-standalone.html` directly. It's a snapshot — rebuild after changes.

**Tests:**

```bash
npm test
```

---

## Documentation

| File | Contents |
|---|---|
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Canonical intent: purpose, users, flow, sections, defaults, test cases, non-goals. **Read §21 first** — several spec sections are deliberately no longer implemented |
| [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) | Every formula, threshold, simplification and known defect |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log — what was chosen and why |
| [`CLAUDE.md`](CLAUDE.md) | Conventions for AI agents working in this repo |
| [`UX_REVIEW.md`](UX_REVIEW.md) | UX audit (partly superseded — see its header) |

---

## Stack

React 19 · TypeScript · Vite · Vitest. No UI framework, no CSS framework, no state library — all styling is hand-written in a single `src/styles.css`.

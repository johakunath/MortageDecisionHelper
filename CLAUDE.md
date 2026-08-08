# CLAUDE.md — working notes for AI agents

Read [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) before changing behaviour. It is the canonical intent document; this file only covers *how* to work in the repo.

## What this is

A personal decision-support tool for one German couple deciding how much Eigenkapital (10/15/20%) to put into their first home. **They disagree with each other** — one side favours lower interest, the other favours keeping liquidity and using Sondertilgung later. The app exists to make that trade-off measurable.

**This means calculation defects are not cosmetic.** A wrong number here doesn't just look bad — it tilts a real decision between two people. Several past defects happened to favour one spouse's position — most recently by 35.494 € ([D14](docs/DECISIONS.md)). Treat `src/lib/calculations.ts` with corresponding care.

**The engine is validated against a real broker offer** (Finanzierungsangebot 07.08.2026, Varianten 1A–3B), pinned in `src/lib/offer.test.ts`: six variants, largest deviation 8 cents. If a change breaks that file, the change is wrong until proven otherwise. Do not relax its tolerances.

## Orientation

| Path | Role |
|---|---|
| `src/lib/calculations.ts` | All model logic. Pure, no React. The only place behaviour changes belong |
| `src/lib/calculations.test.ts` | Vitest coverage for the above |
| `src/lib/offer.test.ts` | The engine pinned to a real broker offer. Do not weaken |
| `src/lib/defaults.ts` | Default inputs, EK scenarios, apartment cases, QA test presets |
| `src/lib/format.ts` | All money/percent/year rendering. Never format inline |
| `src/components/ui.tsx` | Shared primitives — `Section`, `Button`, `Readout`, `StatusPill`, `InputField`, `SegmentedChoice`, `MiniMetric`, `MetricBar` |
| `src/styles.css` | Every style. Single file, CSS custom properties, no utility framework |
| `docs/` | Spec, model assumptions, decision log |

## Conventions

- **Calculations stay pure.** No React imports, no formatting, no side effects in `calculations.ts`. If you need a number for display, compute it there and format at the edge.
- **Add a test with every model change.** `npm test` must stay green.
- **All formatting goes through `format.ts`.** No inline `toLocaleString`.
- **Reuse the primitives in `ui.tsx`** rather than hand-rolling a card or a field.
- **German UI copy.** Calm, neutral, family-oriented. Never bank-sales voice, never investment-bro voice. Code identifiers stay English.
- **No new dependencies** without asking. Current runtime deps: React, Vite, TypeScript. That is deliberate.

## Layout rules

- **Desktop is the priority viewport** ([DECISIONS.md D7](docs/DECISIONS.md)). Two people read this on one screen together. Reference layout is the three-column grid: step rail · content · right panel. Narrow viewports get graceful fallbacks, not equal design effort.
- **The right panel never scrolls internally.** It spans the viewport height, and that guarantee — not any particular count — is the rule ([D19](docs/DECISIONS.md)). It currently holds five readouts. Adding one means re-checking at 1280×800 that nothing hides below an inner fold.
- **`.app-header` must stay a fixed height.** It sets `height: var(--header-height)` explicitly, and every sticky element below clears it with that same constant — if the two disagree, a band of scrolling content shows through the seam. Never put anything collapsible, variable-height or interactive inside it; it carries context (brand, active apartment, price), not controls ([D8](docs/DECISIONS.md), [D21](docs/DECISIONS.md)).
- **Step-rail labels are always visible.** A bare number tells two people nothing about where they are in the decision.

## Before adding anything

This app's failure mode is accretion: it once rendered the same EK comparison five times ([D6](docs/DECISIONS.md)). Before adding a view, ask what it shows that the doors, the trade-off matrix and the right panel do not. A second rendering of the same comparison is a regression.

## Hard rules from the spec

1. **Never present the least-bad option as safe.** If no scenario satisfies the reserve target, the burden threshold and an amortising monthly rate, the app says so and names the failing constraint. Winner tiles must be suppressed in that state. The wording is *"Keine der drei Varianten ist tragbar"* — the spec's original *"Kein sauberes Szenario"* was replaced because the owner did not understand it ([D11](docs/DECISIONS.md)). Status labels say what is wrong ("Rate zu hoch"), never which internal constraint failed.
2. **Explain domain terms in place.** German mortgage vocabulary gets an `InfoTip`; the text lives in `src/lib/glossary.ts`, never inline, so a term is never explained two different ways.
3. **Inputs and outputs must be visually unmistakable.** A `Readout` must never be confusable with an `InputField`.
4. **Never carry meaning by colour alone.** Every signed value needs a glyph or word alongside the colour. Two people read this screen together, one may be colour-blind, and the sign convention is inverted between columns (lower interest is good, lower cash is bad).
5. **Never compare a fixed-period figure against a full-term figure.** See [`docs/ASSUMPTIONS.md §1`](docs/ASSUMPTIONS.md).
6. **Respect the non-goals** in [PRODUCT_SPEC §18](docs/PRODUCT_SPEC.md#18-non-goals). The spec explicitly states the app does not need more scope. Prefer fixing what exists.
7. **QA fixtures pin their own inputs.** `CASE_PRESETS` must specify every value that determines their expected outcome. One that inherits a default silently stops testing what it claims to ([D12](docs/DECISIONS.md)).

## Commands

```bash
npm run dev
```
```bash
npm test
```
```bash
npm run build
```

`npm run build` also regenerates `dist/mortgage-helper-standalone.html`, a single-file offline copy the owner opens directly in a browser. Anything requiring a server, an external asset or a network call breaks it — verify the build after structural changes.

## Before you finish

- `npm test` green
- `npm run build` succeeds and the standalone file still opens
- The three QA presets behave: **600k** feasible · **720k** borderline with visible warnings · **850k** yields "Keine der drei Varianten ist tragbar". They pin every input that decides their outcome, now including `monthlyPayment` and `fixedRateYears` ([D12](docs/DECISIONS.md))
- `src/lib/offer.test.ts` still reproduces all six offer variants
- New model assumptions or simplifications recorded in `docs/ASSUMPTIONS.md`
- Product-shaping choices recorded in `docs/DECISIONS.md`

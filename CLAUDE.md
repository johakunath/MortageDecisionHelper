# CLAUDE.md — working notes for AI agents

Read [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) before changing behaviour. It is the canonical intent document; this file only covers *how* to work in the repo.

## What this is

A personal decision-support tool for one German couple deciding how much Eigenkapital (5/10/15%) to put into their first home. **They disagree with each other** — one side favours lower interest, the other favours keeping liquidity and using Sondertilgung later. The app exists to make that trade-off measurable.

**This means calculation defects are not cosmetic.** A wrong number here doesn't just look bad — it tilts a real decision between two people. Several past defects happened to favour one spouse's position. Treat `src/lib/calculations.ts` with corresponding care.

## Orientation

| Path | Role |
|---|---|
| `src/lib/calculations.ts` | All model logic. Pure, no React. The only place behaviour changes belong |
| `src/lib/calculations.test.ts` | Vitest coverage for the above |
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
- **The right panel never scrolls internally.** It spans the viewport height and is capped at four readouts so everything stays visible. Adding a fifth breaks the guarantee.
- **`.app-header` must stay a fixed height.** `--header-height` is a constant that every sticky element below depends on. Never put anything collapsible or variable-height inside it — that's why the apartment-facts editor lives in the page body ([D8](docs/DECISIONS.md)).
- **Step-rail labels are always visible.** A bare number tells two people nothing about where they are in the decision.

## Before adding anything

This app's failure mode is accretion: it once rendered the same EK comparison five times ([D6](docs/DECISIONS.md)). Before adding a view, ask what it shows that the doors, the trade-off matrix and the right panel do not. A second rendering of the same comparison is a regression.

## Hard rules from the spec

1. **Never present the least-bad option as safe.** If no scenario satisfies both the reserve target and the burden threshold, the app says *"Kein sauberes Szenario"* and names the failing constraint. Winner tiles must be suppressed in that state.
2. **Inputs and outputs must be visually unmistakable.** A `Readout` must never be confusable with an `InputField`.
3. **Never carry meaning by colour alone.** Every signed value needs a glyph or word alongside the colour. Two people read this screen together, one may be colour-blind, and the sign convention is inverted between columns (lower interest is good, lower cash is bad).
4. **Never compare a fixed-period figure against a full-term figure.** See [`docs/ASSUMPTIONS.md §1`](docs/ASSUMPTIONS.md).
5. **Respect the non-goals** in [PRODUCT_SPEC §18](docs/PRODUCT_SPEC.md#18-non-goals). The spec explicitly states the app does not need more scope. Prefer fixing what exists.

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
- The three QA presets behave: **600k** feasible · **720k** borderline with visible warnings · **850k** yields "Kein sauberes Szenario"
- New model assumptions or simplifications recorded in `docs/ASSUMPTIONS.md`
- Product-shaping choices recorded in `docs/DECISIONS.md`

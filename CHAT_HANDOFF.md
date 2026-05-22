# Mortgage Decision Helper - Chat Handoff

Project recovered from a truncated React prototype into a Vite + React + TypeScript app.

Current state:
- German decision helper for 5%, 10%, and 15% Eigenkapital.
- Kompromiss-Finder design direction.
- Editable yearly Sondertilgung inputs.
- Immobilienwert, Realrendite, and Nettovermögen included in scenarios.
- Calculation logic lives in `src/lib/calculations.ts`.
- Defaults and presets live in `src/lib/defaults.ts`.

How to run:
1. Double-click `START_MORTGAGE_HELPER.cmd`, or
2. Run `npm install`, then `npm run dev`, then open `http://127.0.0.1:5173/`.

Generated folders such as `node_modules`, `dist`, `.npm-cache`, and `.tmp-tests` do not need to be copied.

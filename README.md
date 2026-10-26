# Financije

Personal finance desktop app for Windows — Electron + React + TypeScript, SQLite, Recharts.

See [docs/PLAN.md](docs/PLAN.md) for the database design, screens and the step-by-step build plan.

## Development

```bash
npm install      # install dependencies (rebuilds native modules for Electron)
npm run dev      # start the app with hot reload
npm run lint     # ESLint
npm run format   # Prettier
npm run typecheck
npm test         # Vitest
```

`npm run dev` uses its own database, `finance-dev.db`, next to the real `finance.db` in the
app's data folder. Its **UI kit** page (sidebar, development only) has **Seed demo data**,
which replaces that database with about a year of realistic accounts, transactions,
subscriptions, an installment plan, a savings goal and a loan, and **Reset dev database**,
which empties it so the app starts as on its first run. Neither exists in a production build.

## Build the Windows installer

```bash
npm run build:win   # output in release/<version>/
```

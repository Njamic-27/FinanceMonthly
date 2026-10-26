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
```

## Build the Windows installer

```bash
npm run build:win   # output in release/<version>/
```

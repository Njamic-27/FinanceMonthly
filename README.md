# FinanceMonthly

A personal finance desktop app for Windows, built around one **month sheet**: income, bills,
subscriptions, everyday spending, loans and savings for the month on a single screen, like a
spreadsheet, but with balances, reminders and projections worked out for you.

<!-- Screenshots: add docs/screenshots/month.png, calendar.png, projections.png and uncomment.
<p align="center">
  <img src="docs/screenshots/month.png" width="800" alt="Month sheet">
</p>
-->

## Features

- **Month sheet as the home screen.** Type amounts straight into rows like in Excel, or record
  individual transactions. "+" per section adds income, expenses, subscriptions, installment
  purchases, loan payments or savings, one-time or recurring.
- **Accounts:** debit accounts, cash and credit cards. Card spending counts in the month the card
  bill is actually paid, with each card's statement and due day.
- **Two views of money out:** by category group (Subscriptions, Bills, Everyday, Loans, Savings)
  or by payment method (which account or card paid for what).
- **Installment purchases** on credit cards, shown as "PlayStation 3/6" everywhere.
- **Loans:** money lent and borrowed, and bank loans with an automatically calculated repayment
  schedule and optional auto-pay.
- **Savings goals** with monthly deposits and an estimated completion date.
- **Projections** up to 24 months ahead: projected balance, inflows and outflows, and milestones
  such as a loan paid off or the balance dropping below zero.
- **Calendar, Overview and History:** spending by day, week, month and year, with charts.
- **Windows notifications** for due bills, card statements and loan installments. The app keeps
  running in the tray and can start with Windows.
- **English and Croatian** interface, light and dark theme.
- **All data stays local** in a SQLite database on your computer.

## Tech stack

| Area | Technologies |
|---|---|
| Desktop shell | Electron, electron-vite, electron-builder (NSIS installer) |
| UI | React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, React Router, Recharts |
| Data | SQLite via better-sqlite3 (main process), versioned migrations with `PRAGMA user_version` |
| Validation | zod |
| Tests | Vitest: 50+ test files for the ledger, migrations, card billing, installments, loan schedules, projections, reminders and translations |

The renderer has no direct access to Node or the database. It talks to the main process through a
typed `contextBridge` API, with one IPC handler per domain.

## Project structure

```
src/
  main/       Electron main process: database, migrations, repositories, services, IPC, tray, scheduler
  preload/    Typed bridge between main and renderer
  renderer/   React app: routes (screens), features, UI components
  shared/     Code used by both sides: money and date logic, settings, i18n (en, hr)
docs/
  PLAN.md     Database design, screens and the step-by-step build plan
  DESIGN.md   Design system: colours, type, components
```

## Development

```bash
npm install      # install dependencies (rebuilds native modules for Electron)
npm run dev      # start the app with hot reload
npm test         # Vitest
npm run lint     # ESLint
npm run typecheck
```

`npm run dev` uses its own database, `finance-dev.db`, next to the real `finance.db` in the app's
data folder. The **UI kit** page (development only) can **seed demo data**, about a year of
realistic accounts, transactions, subscriptions, an installment plan, a savings goal and a loan, or
**reset** the dev database to a first-run state.

## Build the Windows installer

```bash
npm run build:win   # output in release/<version>/
```

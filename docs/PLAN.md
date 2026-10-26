# Personal Finance Desktop App — Architecture, Database, Screens, Build Plan

## Context

Greenfield project in `C:\Users\User\Documents\code\financije` (folder is empty). Goal: a Windows desktop
personal-finance app (Electron + React + TypeScript, SQLite, Recharts, electron-builder) covering accounts
(debit / credit / cash), income, expenses, subscriptions, savings goals, loans, weekly/monthly views,
history and 2-year projections. The user asked for **no code yet**: only the DB structure, the screens
and a step-by-step build plan in small steps.

---

## 1. Technical foundation (recommended choices)

| Concern                | Choice                                                                         | Why                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Scaffolding / bundling | **electron-vite** (React + TS template)                                        | One Vite config for main, preload and renderer; fast HMR                                 |
| SQLite driver          | **better-sqlite3** (main process only)                                         | Synchronous, fast, reliable; rebuilt for Electron by electron-builder `install-app-deps` |
| Migrations             | Plain SQL migrations in TS + `PRAGMA user_version`                             | No extra tooling to bundle; easy to reason about                                         |
| IPC                    | `contextBridge` → typed `window.api`, `ipcMain.handle` per domain              | `contextIsolation: true`, `nodeIntegration: false`                                       |
| Renderer data          | **TanStack Query** over IPC                                                    | Caching + invalidation after mutations                                                   |
| Routing                | React Router (`HashRouter`)                                                    | Works with `file://` in production                                                       |
| UI                     | **Tailwind CSS** + Radix primitives (shadcn/ui-style components), lucide icons | Modern, clean, friendly; light/dark themes                                               |
| Forms                  | react-hook-form + zod                                                          | Shared validation schemas                                                                |
| Dates                  | date-fns (week starts Monday by default, configurable)                         |                                                                                          |
| Charts                 | Recharts                                                                       | As requested                                                                             |
| Tests                  | Vitest for pure logic (money, recurrence, amortization, projections)           |                                                                                          |
| Installer              | electron-builder, NSIS target                                                  |                                                                                          |

**Conventions**

- Money stored as **INTEGER minor units** (cents) — never floats. Formatting via `Intl.NumberFormat(locale, {style:'currency', currency})`.
- Dates stored as `TEXT 'YYYY-MM-DD'`; timestamps as ISO `TEXT`.
- Amounts in `transactions` are always **positive**; the sign comes from `type`.
- One app-wide currency. Changing it in Settings changes formatting only (no conversion) — shown as a warning in Settings.
- DB file: `%APPDATA%/<AppName>/finance.db`; WAL mode; foreign keys ON.

**Folder layout**

```
src/
  main/        index.ts, db/ (connection, migrations/, repositories/), ipc/ (one file per domain), services/ (reminders, posting, backup)
  preload/     index.ts (exposes typed window.api)
  shared/      types.ts, ipc-contract.ts, money.ts, dates.ts, recurrence.ts, amortization.ts, projection.ts  (pure, unit-tested)
  renderer/    app shell, routes/, components/ui, components/charts, features/<domain>/, hooks/
```

---

## 2. Database structure

### settings

| column | type    | notes                                                                                                                                                                                                                            |
| ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| key    | TEXT PK | `currency` (EUR), `locale` (en-GB), `week_start` (1=Mon), `theme` (system/light/dark), `onboarding_done`, `notifications_enabled`, `projection_include_variable`, `projection_variable_months` (3), `projection_include_savings` |
| value  | TEXT    | JSON-encoded                                                                                                                                                                                                                     |

### accounts — payment methods

| column          | type          | notes                                         |
| --------------- | ------------- | --------------------------------------------- |
| id              | INTEGER PK    |                                               |
| name            | TEXT          | "Visa Debit", "Wallet"                        |
| type            | TEXT          | `debit` \| `credit` \| `cash`                 |
| opening_balance | INTEGER       | cents; for credit = starting debt as negative |
| opening_date    | TEXT          |                                               |
| credit_limit    | INTEGER NULL  | credit only                                   |
| statement_day   | INTEGER NULL  | credit only, 1–31                             |
| payment_due_day | INTEGER NULL  | credit only, 1–31                             |
| color, icon     | TEXT          |                                               |
| is_archived     | INTEGER (0/1) |                                               |
| sort_order      | INTEGER       |                                               |
| created_at      | TEXT          |                                               |

Balance = `opening_balance + Σ(incoming) − Σ(outgoing)` (computed by query, not stored).
Credit card: balance ≤ 0 means debt; **available = limit + balance − remaining unbilled installments**.

### categories — user-defined

| column      | type       | notes                               |
| ----------- | ---------- | ----------------------------------- |
| id          | INTEGER PK |                                     |
| name        | TEXT       | unique per type                     |
| type        | TEXT       | `income` \| `expense`               |
| color, icon | TEXT       |                                     |
| is_archived | INTEGER    | archive instead of delete when used |
| sort_order  | INTEGER    |                                     |

Seeded defaults: Salary, Bonus, Other income / Groceries, Rent, Utilities, Transport, Eating out, Health, Shopping, Entertainment, Subscriptions, Other.

### transactions — the single ledger (every money movement lives here)

| column                 | type                         | notes                                                                                           |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| id                     | INTEGER PK                   |                                                                                                 |
| date                   | TEXT                         |                                                                                                 |
| title                  | TEXT                         | user-named ("Lidl weekly shop")                                                                 |
| amount                 | INTEGER                      | positive cents                                                                                  |
| type                   | TEXT                         | `income`, `expense`, `transfer`, `savings_deposit`, `savings_withdrawal`, `loan_out`, `loan_in` |
| account_id             | INTEGER FK → accounts        | the account affected (source for transfers)                                                     |
| to_account_id          | INTEGER NULL FK → accounts   | transfers only (ATM debit→cash, debit→credit card payment)                                      |
| category_id            | INTEGER NULL FK → categories | required for income/expense                                                                     |
| recurring_item_id      | INTEGER NULL FK              | posted from a recurring item / subscription                                                     |
| savings_goal_id        | INTEGER NULL FK              | savings_* types                                                                                 |
| loan_id                | INTEGER NULL FK              | loan_* types                                                                                    |
| loan_installment_id    | INTEGER NULL FK              | when paying a scheduled installment                                                             |
| installment_plan_id    | INTEGER NULL FK              | credit-card installment payment                                                                 |
| planned_date           | TEXT NULL                    | due date of the planned item this transaction settles (may differ from `date` if paid late)     |
| note                   | TEXT NULL                    |                                                                                                 |
| created_at, updated_at | TEXT                         |                                                                                                 |

Sign rules: `+` income, savings_withdrawal, loan_in · `−` expense, savings_deposit, loan_out · transfer: `−` account_id, `+` to_account_id.
Statistics: "Income" = income; "Expenses" = expense; savings and loan movements are reported separately (not counted as spending/income); cash flow includes all.
Indexes: `(date)`, `(account_id, date)`, `(category_id, date)`, `(type, date)`, `(recurring_item_id, planned_date)`.
A planned occurrence counts as settled when a transaction links to its source with the same `planned_date`.

### recurring_items — monthly income, recurring expenses and subscriptions

| column               | type         | notes                                                             |
| -------------------- | ------------ | ----------------------------------------------------------------- |
| id                   | INTEGER PK   |                                                                   |
| kind                 | TEXT         | `income` \| `expense` \| `subscription`                           |
| title                | TEXT         | "Salary", "Rent", "Netflix"                                       |
| amount               | INTEGER      |                                                                   |
| account_id           | INTEGER FK   | account it is paid from / to                                      |
| category_id          | INTEGER FK   |                                                                   |
| frequency            | TEXT         | `weekly` \| `monthly` \| `yearly`                                 |
| interval             | INTEGER      | every N periods (default 1)                                       |
| anchor_date          | TEXT         | first occurrence; defines billing day                             |
| end_date             | TEXT NULL    |                                                                   |
| next_due_date        | TEXT         | maintained by posting service                                     |
| auto_post            | INTEGER      | 1 = create transaction automatically when due; 0 = ask to confirm |
| reminder_days_before | INTEGER NULL | subscriptions / bills                                             |
| url, note            | TEXT NULL    |                                                                   |
| is_active            | INTEGER      | paused/cancelled subscriptions                                    |

### savings_goals

| column          | type         | notes                              |
| --------------- | ------------ | ---------------------------------- |
| id              | INTEGER PK   |                                    |
| name            | TEXT         | "Emergency fund", "Summer holiday" |
| target_amount   | INTEGER      |                                    |
| target_date     | TEXT NULL    |                                    |
| starting_amount | INTEGER      | already saved before using the app |
| planned_monthly | INTEGER NULL | used by projections & ETA          |
| color, icon     | TEXT         |                                    |
| is_archived     | INTEGER      |                                    |

Current balance = `starting_amount + Σ savings_deposit − Σ savings_withdrawal`.

### loans — lent, borrowed, bank loans

| column                 | type            | notes                                                               |
| ---------------------- | --------------- | ------------------------------------------------------------------- |
| id                     | INTEGER PK      |                                                                     |
| kind                   | TEXT            | `lent` (I gave money) \| `borrowed` (I owe a person) \| `bank_loan` |
| title                  | TEXT            |                                                                     |
| counterparty           | TEXT            | person or bank name                                                 |
| principal              | INTEGER         |                                                                     |
| interest_rate          | REAL NULL       | annual %, bank loans                                                |
| start_date             | TEXT            |                                                                     |
| due_date               | TEXT NULL       | personal loans (expected repayment)                                 |
| installments_count     | INTEGER NULL    | bank loans (or personal with plan)                                  |
| payment_day            | INTEGER NULL    |                                                                     |
| account_id             | INTEGER NULL FK | default account for payments                                        |
| create_disbursement_tx | INTEGER         | whether the start created a loan_in/loan_out transaction            |
| status                 | TEXT            | `active` \| `paid_off` \| `written_off`                             |
| note                   | TEXT NULL       |                                                                     |

### loan_installments — schedule (generated for bank loans; optional for personal)

| column                        | type                 | notes                     |
| ----------------------------- | -------------------- | ------------------------- |
| id                            | INTEGER PK           |                           |
| loan_id                       | INTEGER FK (cascade) |                           |
| seq                           | INTEGER              | 1..N                      |
| due_date                      | TEXT                 |                           |
| amount                        | INTEGER              |                           |
| principal_part, interest_part | INTEGER              | from annuity amortization |
| paid_transaction_id           | INTEGER NULL FK      | set when paid             |

Outstanding: personal = principal − Σ repayments; bank = Σ principal_part of unpaid rows.

### installment_plans — credit-card purchases split into N rates

| column             | type                     | notes        |
| ------------------ | ------------------------ | ------------ |
| id                 | INTEGER PK               |              |
| account_id         | INTEGER FK (credit card) |              |
| title              | TEXT                     | "New laptop" |
| category_id        | INTEGER FK               |              |
| total_amount       | INTEGER                  |              |
| installments_count | INTEGER                  |              |
| first_date         | TEXT                     |              |
| fee_amount         | INTEGER NULL             |              |

Each installment is posted as an `expense` transaction on its date (linked by `installment_plan_id`), so monthly stats show the rate, not the full price; the unbilled remainder reserves the card limit.
Plans are usually created straight from the Add transaction dialog ("Pay in installments" on a credit card). Splitting is done in whole cents: every installment is `floor(total / N)` and the last one absorbs the remainder (1,000.00 € / 3 = 333.33, 333.33, 333.34).

### notification_log — prevents duplicate reminders

| column      | type       | notes                                                                 |
| ----------- | ---------- | --------------------------------------------------------------------- |
| id          | INTEGER PK |                                                                       |
| source_type | TEXT       | `recurring` \| `loan_installment` \| `card_due` \| `installment_plan` |
| source_id   | INTEGER    |                                                                       |
| due_date    | TEXT       |                                                                       |
| notified_at | TEXT       | UNIQUE(source_type, source_id, due_date)                              |

**Computed, not stored:** account balances, period aggregates, upcoming bills list, projections.

---

## 3. Screens

Left sidebar navigation (collapsible), top bar with period navigator where relevant, global "+ Add transaction" button (Ctrl+N).

**Add transaction dialog** (global, also opened from Transactions, Calendar and account pages) — type (expense / income / transfer), title, amount, date, account, category, note.

- When the selected account is a **credit card** and the type is expense, a **"Pay in installments"** toggle appears with a number-of-installments field (2–60). The monthly amount is shown live in the form, e.g. **2,000.00 € / 5 = 400.00 €/month** (with "last installment 333.34 €" when it doesn't divide evenly). Saving creates an installment plan (first installment on the chosen date) instead of a single expense.

1. **Onboarding (first run)** — pick currency & week start → add accounts with opening balances (debit/credit/cash) → review default categories → optional: add salary as recurring income.
2. **Dashboard** — KPI cards (total balance, this month income / expenses / net, total savings, total debt); income vs expenses bars (last 6 months); spending by category donut (this month); balance trend line; upcoming bills & reminders (next 14 days, with "mark paid"); savings goals progress; credit card utilization; 12-month projection teaser.
3. **Transactions** — searchable, filterable list (date range, account, category, type), grouped by day, inline totals; add/edit/delete modal; duplicate transaction.
4. **Overview (Weekly / Monthly)** — Week | Month toggle, ‹ › navigation to any past period, summary cards with % change vs previous period, daily spending bars, category breakdown, top expenses, transaction list for the period.
5. **Calendar** — month grid starting on the `week_start` day; ‹ › to the previous/next month and a "Today" button; works for any past month and up to 24 months ahead.
   - Month summary at the top: income, expenses, net, ending balance (actual for past months; for the current and future months, current balance + planned items up to month end).
   - Each day cell: that day's income and expense totals, plus small dots coloured by type (income, expense, savings, loan).
   - Planned items (subscriptions, recurring income/expenses, loan installments, credit-card installments) appear on their due days in a lighter "planned" style; unsettled planned items before today are marked overdue.
   - Clicking a day opens a side panel with that day's transactions and planned items, and an "Add transaction" button prefilled with that date.
   - Clicking a planned item opens "Confirm as paid" (amount, account and date editable), which creates the linked transaction.
6. **History** — year selector; grid of 12 months (or 52 weeks) showing income/expense/net with heat colouring; yearly bar chart; click a period → Overview for that period.
7. **Accounts** — account cards with balances. **Account detail**: transactions for that account, balance chart; for credit cards: limit / used / available bar, statement & due dates, installment plans list, "Pay card" (transfer) action.
8. **Recurring & Subscriptions** — tabs: Subscriptions (next billing date, monthly & yearly cost, reminder, pause/cancel) · Recurring income · Recurring expenses; "Due now" queue to confirm postings.
   - Add subscription offers **quick presets** — Netflix, Spotify, Claude, YouTube Premium, Disney+, HBO Max, Apple Music, Amazon Prime, iCloud+, Google One, Microsoft 365, ChatGPT, Xbox Game Pass, PlayStation Plus, Adobe Creative Cloud — plus "Custom". A preset fills in only the name (and defaults the category to Subscriptions); the amount, billing date and account are always entered by you.
9. **Savings** — goal cards (progress ring, saved/target, ETA from planned monthly), deposit/withdraw dialog, goal detail with history chart.
10. **Loans** — tabs: Lent · Borrowed · Bank loans; cards with outstanding amount & progress; detail: schedule table (bank), repayments history, "Record payment", payoff date.
11. **Projections** — horizon (3 / 6 / 12 / 24 months), granularity (weekly / monthly), projected balance line, stacked inflow/outflow bars, milestones (loan paid off, goal reached, balance below zero warning), assumptions panel (include average variable spending, include planned savings), detail table.
12. **Categories** — manage income & expense categories (name, colour, icon, archive, merge).
13. **Settings** — currency, locale/number format, week start, theme, notifications, start with Windows / minimize to tray, backup & restore DB, export CSV, reset data.

---

## 4. Key logic modules (pure, in `src/shared`, unit-tested)

- `money.ts` — parse/format cents, currency formatting.
- `dates.ts` — week/month boundaries respecting week_start, period iteration.
- `recurrence.ts` — `occurrences(item, from, to)` handling month-end (31st → last day), weekly/yearly, interval, end_date.
- `installments.ts` — split a card purchase into N installments in whole cents (last one takes the remainder) and list their dates.
- `amortization.ts` — annuity schedule (principal/interest split, rounding remainder on last row).
- `projection.ts` — inputs: current liquid balance, recurring items, unpaid loan installments, open installment plans, planned savings, average variable spending (last N months of non-recurring expenses); output per week/month: inflows, outflows by group, net, running balance, milestones.

Main-process service built on these: **planned items** (`src/main/services/planned.ts`) — `plannedItems(from, to)` expands active recurring items and subscriptions (later also credit-card installment plans and unpaid loan installments) into dated entries, and drops those already settled. Calendar, reminders and projections all use it, so they always agree.

---

## 5. Step-by-step build plan (each step ends runnable)

**Phase 0 — Foundation**

1. Scaffold with electron-vite (react-ts), `git init`, ESLint + Prettier; window opens with "Hello".
2. Tailwind, fonts bundled locally, theme tokens (light/dark), base UI components (Button, Input, Select, Dialog, Card, Tabs, Toast).
3. App shell: sidebar + routes with placeholder pages for every screen (Dashboard, Transactions, Overview, Calendar, History, Accounts, Recurring & Subscriptions, Savings, Loans, Projections, Categories, Settings).
4. SQLite: better-sqlite3 in main, DB in userData, WAL + FK pragmas, migration runner, migration 001 = full schema above; `install-app-deps` postinstall.
5. Typed IPC bridge (preload `window.api`, shared contract, error wrapping) + TanStack Query; prove it with settings get/set.
6. `money.ts` + `dates.ts` with Vitest tests; `useCurrency()` formatting hook.

**Phase 1 — Core ledger**

7. Settings v1: currency, locale, week start, theme.
8. Categories CRUD + seeded defaults.
9. Accounts CRUD (debit / credit / cash, opening balance, credit limit) + balance query.
10. Add transaction dialog (add/edit/delete; income / expense) with validation; layout leaves room for card-only options that step 24 fills in.
11. Transactions list: grouping by day, filters, search, paging.
12. Transfers (debit → cash, debit → credit card payment).
13. Onboarding wizard on first run.

**Phase 2 — Views & history**

14. Aggregation queries: totals by period, by category, by day.
15. Overview screen (week/month toggle, navigation, summary, charts, list).
16. History screen (year grid, drill-down).
17. Dashboard v1 (KPI cards, income vs expenses, category donut, balance trend).

**Phase 3 — Recurring, subscriptions, calendar, reminders**

18. `recurrence.ts` + tests.
19. Recurring income/expenses CRUD; posting service on app start (auto-post or "Due now" confirmation queue).
20. Subscriptions tab (billing date, reminder, monthly/yearly cost, pause/cancel); Add subscription with quick presets (`src/shared/subscription-presets.ts`) that pre-fill the name only.
21. Calendar: `plannedItems(from, to)` service + "confirm as paid" action (creates the linked transaction with `planned_date`); month grid with day totals, type dots, planned/overdue styles, month summary with ending balance, day side panel with "Add transaction" on that date; navigation from past months to 24 months ahead.
22. Reminder service on top of `plannedItems`: upcoming list + Windows notifications (on launch + hourly while running), notification_log; tray & start-with-Windows option.

**Phase 4 — Credit cards**

23. Credit card detail: used / available / utilization, statement & due-date reminders.
24. Installment plans: `installments.ts` split + tests; extend the Add transaction dialog with "Pay in installments" (credit card only) showing the live monthly amount; create plan, auto-post rates, reserve limit, show on card; add them to `plannedItems` so they appear in the Calendar.

**Phase 5 — Savings**

25. Savings goals CRUD, deposit/withdraw, progress & ETA, goal detail chart.

**Phase 6 — Loans**

26. Personal loans (lent / borrowed): create (optional disbursement tx), record repayments, outstanding, mark paid off.
27. `amortization.ts` + tests; bank loans with generated schedule, pay installment, payoff date; add unpaid installments to `plannedItems` so they appear in the Calendar.

**Phase 7 — Projections**

28. `projection.ts` + tests (month-end edges, loan ending mid-horizon, paused subscriptions), fed by `plannedItems`.
29. Projections screen (horizon, granularity, charts, milestones, assumptions, table).
30. Dashboard v2: upcoming bills, savings, debt, card utilization, projection teaser.

**Phase 8 — Polish & ship**

31. Backup/restore (copy DB file, auto-backup on start, keep last N), CSV export.
32. UX polish: empty states, loading/error states, keyboard shortcuts, accessibility, dark mode pass.
33. electron-builder NSIS installer, app icon & metadata, test install/uninstall on Windows; data survives upgrade.

---

## 6. Verification (per step and at the end)

- `npm run dev` after every step — the new screen/feature works by hand with sample data.
- `npm test` (Vitest) for money, dates, recurrence, amortization and projection modules.
- Dev-only "seed demo data" command to fill ~12 months of realistic transactions for checking charts, history and projections.
- Before release: `npm run build && npm run dist`, install the generated `.exe`, create data, upgrade to a newer build, confirm data and migrations persist.

## Assumptions (easy to change)

- Single currency for the whole app; switching currency does not convert amounts.
- Savings goals are "envelopes" funded from accounts (no separate savings-account type); can add a `savings` account type later if wanted.
- Credit-card installment purchases count toward expenses month by month (per rate), not as one big expense.
- Reminders fire while the app (or its tray icon) is running.

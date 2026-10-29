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

| column               | type         | notes                                                                                                |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| id                   | INTEGER PK   |                                                                                                      |
| kind                 | TEXT         | `income` \| `expense` \| `subscription`                                                              |
| title                | TEXT         | "Salary", "Rent", "Netflix"                                                                          |
| amount               | INTEGER      |                                                                                                      |
| account_id           | INTEGER FK   | account it is paid from / to                                                                         |
| category_id          | INTEGER FK   |                                                                                                      |
| frequency            | TEXT         | `weekly` \| `monthly` \| `yearly`                                                                    |
| interval             | INTEGER      | every N periods (default 1)                                                                          |
| anchor_date          | TEXT         | defines the billing day; may precede next_due_date (31 Oct for a payday on the 31st next due 30 Nov) |
| end_date             | TEXT NULL    |                                                                                                      |
| next_due_date        | TEXT         | first occurrence not posted yet; maintained by posting service                                       |
| auto_post            | INTEGER      | 1 = create transaction automatically when due; 0 = ask to confirm                                    |
| reminder_days_before | INTEGER NULL | subscriptions / bills                                                                                |
| url, note            | TEXT NULL    |                                                                                                      |
| is_active            | INTEGER      | paused/cancelled subscriptions                                                                       |

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

An installment is paid when a transaction links to it via `transactions.loan_installment_id` (unique), so paid status has a single source of truth.
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

### Month sheet and bank loan additions (migration 003, steps 32–33)

- `loans.auto_pay INTEGER NOT NULL DEFAULT 1` — bank loan installments are paid automatically on their due date from the loan's account; when off, a reminder comes 3 days before.
- `transactions.is_month_total INTEGER NOT NULL DEFAULT 0` — marks the one **monthly summary transaction** per Month-sheet row and month, created or updated by typing an amount on the sheet. The repository keeps it to one per row and month.
- `month_rows` — the line items you added to the Month sheet:

| column             | type          | notes                                     |
| ------------------ | ------------- | ----------------------------------------- |
| id                 | INTEGER PK    |                                           |
| section            | TEXT          | `income` \| `expense`                     |
| category_id        | INTEGER FK    | unique; the row is this category          |
| default_account_id | INTEGER FK    | the account new summaries use; changeable |
| sort_order         | INTEGER       |                                           |
| is_hidden          | INTEGER (0/1) |                                           |

A category with transactions in a month always shows on that month's sheet, added as a row or not, so nothing is missing from the totals.

### Balance adjustments (migration 005, step 39)

- `transactions.type` gains `adjustment_in` and `adjustment_out`: the difference between an account's balance in the app and the real one you typed, dated the day you typed it. No category, never counted as income or spending (like transfers), but part of every balance. SQLite can't change a CHECK constraint, so the migration rebuilds `transactions` (copy, drop, rename, recreate indexes) inside one transaction.

### Card spending counts when the card is paid (migration 006, step 42)

Finances are month-based on actual cash: spending counts in the month the money leaves, which for a credit card is the month its bill is paid.

- `transactions.counts_on TEXT NOT NULL` — the day a transaction counts as income or spending. Usually its `date`. For income and expenses on a credit card it's the **due date of the bill that includes it**: the first statement day on or after the purchase date (a purchase on the statement day is on that statement), then the first payment due day after that statement. Purchase 20 Oct, statement 25 Oct, due 15 Nov → counts on 15 Nov; purchase 26 Oct → statement 25 Nov, due 15 Dec. Installment rates follow the same rule from their own dates.
- Stays the `date`: transfers (paying the card is moving money, so nothing counts twice), savings, loans, balance adjustments, Month-sheet summaries (an amount typed for a month counts in that month), cards without both a statement day and a due day, and everything when the setting is "the month of purchase".
- Kept up to date by triggers, with a registered SQL function (the same pure `billDueDate` the app uses, in `src/shared/cards.ts`): on insert and on changes to a transaction's date, type, account or summary flag; when a card's statement or due day changes; and when the setting changes. Indexed like `date`.
- Setting `cardSpendingMonth`: `payment` (default) or `purchase`.
- Balances, balance series and the total balance keep using `date`: they show real debt.

**Computed, not stored:** account balances, period aggregates, upcoming bills list, projections.

---

## 3. Screens

Left sidebar navigation (collapsible), top bar with period navigator where relevant, global "+ Add transaction" button (Ctrl+N). From step 36 the sidebar is: **Month** (the home screen), Dashboard, Calendar, Projections, then a collapsible **More** group (Transactions, Overview, History, Accounts, Recurring, Savings, Loans); Categories and Settings stay in the footer.

**From step 38 (one-screen app):** the sidebar shows only **Month**, **Projections** and **Calendar**. Every other screen (Transactions, Overview, History, Accounts, Recurring, Savings, Loans, Categories) sits in a small **More** group at the bottom, closed by default, next to Settings; their code stays, but nothing done every day needs them. The Dashboard is removed. Everyday use happens on the Month screen (0 below).

**Add transaction dialog** (global, also opened from Transactions, Calendar and account pages) — type (expense / income / transfer), title, amount, date, account, category, note.

- When the selected account is a **credit card** and the type is expense, a **"Pay in installments"** toggle appears with a number-of-installments field (2–60). The monthly amount is shown live in the form, e.g. **2,000.00 € / 5 = 400.00 €/month** (with "last installment 333.34 €" when it doesn't divide evenly). Saving creates an installment plan (first installment on the chosen date) instead of a single expense.

0. **Month, the one main screen (steps 33–36, simplified in steps 38–47)**
   - Header: ‹ › arrows, a **month picker** (year ‹ ›, a grid of 12 months; any month with data, up to 24 months ahead) and "Today".
   - Top, side by side: **Money in accounts** (debit and cash, from step 43; the total balance before it) with **Owed on cards** beside it — today, whatever month is shown. Clicking it opens **Your accounts**: each account with its balance (cards as what's owed); type the real balance and saving adds a **balance adjustment** for the difference, not counted as income or spending. **This month's net** — income − expenses, with an explicit + or − and an up/down arrow (not colour alone), and income and expenses underneath.
   - **Waiting for you** strip (only when there is something): payments due that ask first and overdue loan installments, each confirmed right there.
   - **Income** — a clear list of what came in this month and from what: income categories (Bonus, Other) and recurring income (Salary), each with its amount and account. Section total.
   - A clear divider, then **Expenses** in one column, in groups with subtotals: **Everyday** (expense categories), **Bills & subscriptions** (recurring expenses and subscriptions), **Credit cards** (card payments and installment rates), **Loans** (installments and repayments; money borrowed shows as +), **Savings** (deposits − withdrawals per goal). Groups without rows this month are left out. Section total.
   - Amounts under Income and Expenses read as plain amounts (the heading says which way they go); only Loans and Savings rows, which can go either way, carry a sign.
   - Typing an amount on a row works as before (monthly summary transaction, planned style, keyboard).
   - Expenses can also be shown **by payment method** (step 46): debit cards, cash and credit cards, each account's spending this month, adding up to the same total.
   - Card purchases count in the month their card bill is paid (step 42): October's groceries on the card show in November's Groceries row, each with its real date and "counts in November" in its details.
   - **"+" on each section** opens a dropdown: pick an existing category (or recurring item), or type a new name to create a category. Then amount, account, date and **One-time / Recurring** (how often: every week, every month, every N months, every year; from which date). One-time adds a transaction; Recurring adds a recurring item. The Expenses dropdown also lists **Subscription** (with presets), **Buy in installments**, **Pay a credit card**, **Loan** (bank loan, money borrowed, money lent, a repayment), **Savings** (put in, take out, new goal) and **Add an account or card** — each opens its dialog in place.
   - **Clicking any row** opens its details in a side panel: what it is (category, recurring item and its schedule, card with what's owed and its installment plans, loan with what's left and the next installment, goal with its progress), the month's transactions, and the actions — edit or delete each transaction, edit / pause / delete the recurring item, pay the card or an installment, put in or take out, edit or delete the loan, goal or installment purchase. Everything happens in dialogs on the Month screen; a small "Open full page" link is only extra.
   - **As built in steps 33–36** (still true unless the points above replace it): the main way to use the app, like a monthly Excel sheet: one month at a time, so you don't have to enter every purchase.
     - ‹ › to change month, "Today", and **"Copy from last month"** (fills empty rows only, never overwrites).
     - Summary at the top: income, expenses, net, balance at month end — the same numbers as the Calendar's month summary (actual for past months, with planned items for the current and later months).
     - Two columns: **Money in** (Income) and **Money out** (the other sections), side by side when there's room. Amounts are signed: + money in, − money out (loans as they move the balance).
     - Sections, each with its rows, a section total and a **"+"** to add a row:
       - **Income** — income categories (Bonus, Other income) and recurring income items (Salary).
       - **Expenses** — expense categories (Groceries, Fuel) and recurring expense items (Rent).
       - **Subscriptions** — one row per subscription active in the month.
       - **Credit cards** — per card, its payment for the month (transfers into the card, pre-filled with what the statement leaves to pay; moving money, shown but not counted in net), and per installment plan that month's rate (an expense). Card purchases stay in their category rows, so nothing counts twice.
       - **Loans** — bank loan installments (paid or planned) and personal loan repayments in the month; like loans everywhere, in the ending balance, not in income or expenses.
       - **Savings** — one row per active goal: deposits minus withdrawals, the planned monthly amount pre-filled.
     - Under the hood every cell is real transactions, so Calendar, Overview, History and Projections keep working. A category row shows that category's transactions in the month (except those posted by recurring items, installment plans or loans, which have their own rows). Typing an amount creates or updates the row's one **monthly summary transaction**, holding whatever the individual transactions don't: typing 400 where purchases add up to 120 makes the summary 280; less than the purchases is refused; 0 removes it. A summary is dated today in the current month, otherwise the month's last day.
     - Pre-filled amounts not yet posted (subscriptions, recurring items that ask first, unpaid installments, planned savings) show in the lighter planned style; Enter confirms one, with the amount if changed.
     - Keyboard: click a cell or press Enter to type; Enter/Tab saves and moves to the next row, Shift+Tab back, Esc cancels, arrows move between rows; amounts are read in your number format.
     - A row with several transactions shows their count; clicking its name opens a panel listing them (each editable) with "Add transaction".
     - Each row has a default account, set when it's added and changeable in the Account column; new summaries use it.
     - "+" per section opens what fits: Income/Expenses — name, amount and account (an existing category is reused by name, otherwise one is created; "Every month" makes it a recurring item instead); Subscriptions — the subscription dialog with presets; Credit cards — "Buy in installments" or "Add a card"; Loans — Bank loan (all parameters, "Pay automatically" and the account it's paid from), Money borrowed or Money lent; Savings — the goal dialog.
1. **Onboarding (first run)** — pick currency & week start → add accounts with opening balances (debit/credit/cash) → review default categories → optional: add salary as recurring income.
2. **Dashboard** — _removed in step 38_ (its address goes to Month). Was: (at `/dashboard` from step 36) — KPI cards (total balance, this month income / expenses / net, total savings, total debt); income vs expenses bars (last 6 months); spending by category donut (this month); balance trend line; upcoming bills & reminders (next 14 days, with "mark paid"); savings goals progress; credit card utilization; 12-month projection teaser.
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

Month sheet service (`src/main/services/monthSheet.ts`, step 33): `monthSheet(month)` builds the sections, rows, cells (actual, planned, transaction count), totals and the summary (reusing `calendarMonth`); `setMonthCell(...)` sets a category row's summary to typed − individual transactions, confirms or updates a recurring/subscription occurrence (`postOccurrence`), pays a loan installment (`payInstallment`), records a card payment as a summary transfer and a savings row as a summary deposit; `copyFromLastMonth(month)`. In a future month with typed amounts, projections use those instead of average everyday spending, so nothing counts twice.

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
10. Add transaction dialog (add/edit/delete; income / expense) with validation; layout leaves room for card-only options that step 25 fills in. Includes a date field that shows dates in the app’s locale (the native date input follows the Windows language instead); the account form switches to it too.
11. Transactions list: grouping by day, filters, search, paging.
12. Transfers (debit → cash, debit → credit card payment).
13. **Dev only — seed demo data.** Two buttons on the UI kit page (`/dev/ui`):
    - **Seed demo data** fills `finance-dev.db` with ~12 months of realistic data ending today: monthly salary, rent, weekly groceries, eating out, ATM transfers debit → cash, subscriptions (Netflix, Spotify, Claude) as recurring items with their past charges, a credit-card purchase in 5 installments (installment plan + posted rates), a savings goal with monthly deposits and a personal loan (lent) with a partial repayment. Deterministic (fixed random seed); marks onboarding done.
    - **Reset dev database** empties `finance-dev.db` and re-runs migrations, back to a first run.
    - The seeder (`src/main/dev/seed.ts`) writes rows straight against the schema, so later steps update it whenever they add rules for that data.
    - Never in production: the dev IPC handlers are registered only behind `import.meta.env.DEV` (so the code is dropped from the production bundle), they refuse to run unless the open database is `finance-dev.db`, and the UI kit route exists only in dev builds.
14. Onboarding wizard on first run.

**Phase 2 — Views & history**

15. Aggregation queries: totals by period, by category, by day.
16. Overview screen (week/month toggle, navigation, summary, charts, list).
17. History screen (year grid, drill-down).
18. Dashboard v1 (KPI cards, income vs expenses, category donut, balance trend).

**Phase 3 — Recurring, subscriptions, calendar, reminders**

19. `recurrence.ts` + tests.
20. Recurring income/expenses CRUD; posting service on app start (auto-post or "Due now" confirmation queue).
21. Subscriptions tab (billing date, reminder, monthly/yearly cost, pause/cancel); Add subscription with quick presets (`src/shared/subscription-presets.ts`) that pre-fill the name only.
22. Calendar: `plannedItems(from, to)` service + "confirm as paid" action (creates the linked transaction with `planned_date`); month grid with day totals, type dots, planned/overdue styles, month summary with ending balance, day side panel with "Add transaction" on that date; navigation from past months to 24 months ahead.
23. Reminder service on top of `plannedItems`: upcoming list + Windows notifications (on launch + hourly while running), notification_log; tray & start-with-Windows option.

**Phase 4 — Credit cards**

24. Credit card detail: used / available / utilization, statement & due-date reminders.
25. Installment plans: `installments.ts` split + tests; extend the Add transaction dialog with "Pay in installments" (credit card only) showing the live monthly amount; create plan, auto-post rates, reserve limit, show on card; add them to `plannedItems` so they appear in the Calendar.

**Phase 5 — Savings**

26. Savings goals CRUD, deposit/withdraw, progress & ETA, goal detail chart.

**Phase 6 — Loans**

27. Personal loans (lent / borrowed): create (optional disbursement tx), record repayments, outstanding, mark paid off.
28. `amortization.ts` + tests; bank loans with generated schedule, pay installment, payoff date; add unpaid installments to `plannedItems` so they appear in the Calendar.

**Phase 7 — Projections**

29. `projection.ts` + tests (month-end edges, loan ending mid-horizon, paused subscriptions), fed by `plannedItems`.
30. Projections screen (horizon, granularity, charts, milestones, assumptions, table).
31. Dashboard v2: upcoming bills, savings, debt, card utilization, projection teaser.

**Phase 8 — Month sheet**

32. **Bank loan fixes.** Migration 003 adds `loans.auto_pay` (on by default, existing loans too): the posting service pays due installments of auto-pay loans on launch and hourly, linked like a manual payment. Manual loans get a reminder 3 days before each unpaid installment (`loan_installment` in notification_log; clicking opens the loan). "Pay automatically" switch in the bank loan dialog. Overdue unpaid installments listed first in Dashboard "Coming up" with "Pay…".
33. **Month sheet data layer.** Migration adds `transactions.is_month_total` and `month_rows`; `monthSheet` / `setMonthCell` / `copyFromLastMonth`; projections skip average spending in months with typed amounts. Tests: the top-up rule (refused below the individual transactions, 0 removes), the summary date, no double counting between category, recurring, installment and loan rows, the sheet's totals equal the Calendar's and Overview's, copy fills empty rows only.
34. **Month screen.** `/month?month=YYYY-MM`: summary, sections and totals, planned style, keyboard editing (Enter/Tab/Shift+Tab/Esc/arrows), row transaction panel, account per row, ‹ › and Today, "Copy from last month".
35. **Adding rows.** "+" under each section opens the right dialog (see §3, Month); hide and rename rows; drag to reorder within a section.
36. **Navigation.** Month becomes the home route `/`, Dashboard moves to `/dashboard` (redirects, the onboarding finish and links updated); new sidebar order with the collapsible "More" group (remembers open or closed; the "due now" badge shows on More while it's closed).

**Phase 9 — Links**

37. **Linking audit.** Go through every screen and make every reference to something clickable, opening it:
    - a day (in lists, charts, the Calendar, Overview, Dashboard) → that day in the Calendar with the day panel open
    - a week or month → Overview for that period
    - an account or card → its account page
    - a category → Transactions filtered to that category (and period, if there is one)
    - a transaction → its edit dialog
    - a subscription or recurring item → its edit dialog on the Recurring screen
    - a savings goal → its goal page
    - a loan or bank loan → its loan page
    - a milestone in Projections → what it refers to

    The Month sheet's rows are included. Use the same hover style everywhere so it's obvious what's clickable. Add a Back button (and Alt+Left / mouse back button) to return to where you were. Finish with a list of every link added or fixed.

**Phase 10 — One screen for everyday use (see §3, Month)**

38. **Simpler navigation.** Sidebar: Month, Projections, Calendar. "More" moves to the bottom beside Settings, closed by default, and holds Transactions, Overview, History, Accounts, Recurring, Savings, Loans and Categories (routes and code unchanged; the "due now" badge moves to Month). Remove the Dashboard: `/dashboard` redirects to `/`, its page and the components only it uses are deleted (anything Month reuses, like the due-now list, moves to `features/month`), and every link, reminder notification and tray menu entry that opened Dashboard or Recurring opens Month instead.
39. **Balance adjustments (data).** Migration 005 rebuilds `transactions` with `adjustment_in` / `adjustment_out` (§2). Balances, balance series, the Calendar's ending balance and the projection's starting balance include them; income, spending, category totals, History and Overview leave them out. `adjustBalances([{ accountId, balance }])` adds one adjustment per account for the difference (none when it matches), dated today. They show in transaction lists as "Balance adjustment" and can be edited or deleted. Tests: a balance after adjusting equals what was typed, credit cards included; month totals unchanged; the migration keeps every existing row.
40. **Month header.** Month picker popover beside ‹ › and Today. Replace the four summary tiles with **Total balance** (opens **Your accounts**: type real balances, add an account or card there) and **This month's net** (+/− with arrow, income and expenses below, expected month-end balance in small print). The Calendar keeps its own summary.
41. **One-column layout.** Income, a divider, then Expenses with its groups and subtotals (§3, Month); recurring expense rows move from the expenses section to "Bills & subscriptions" in the data layer, and the sheet's totals still equal the Calendar's. "Waiting for you" strip with confirm / pay in place. Keyboard order follows the single column. Tests for the grouping and totals.
42. **Card spending by bill (data).** `billDueDate(date, statementDay, dueDay)` in `src/shared/cards.ts`, tested on month ends (statement day 31 in February, due day before or after the statement day), purchases on and after the statement day, and installments. Migration 006 adds `transactions.counts_on`, fills it for existing rows and keeps it current with triggers (§2); the `cardSpendingMonth` setting (default `payment`) recomputes every row when it changes. Everything that counts income or spending moves to `counts_on`: period totals, series, category totals and largest expenses (Overview, History), the Calendar's month summary, the Month sheet's rows, totals and net (a category row's transactions are those counted in the month; top-ups and typed amounts as before), the transaction list's period filter and its totals, and Projections (average everyday spending from counted history). Planned payments charged to a card (subscriptions, installment rates) get a counted date too, so a month's planned spending follows the same rule. Balances stay on `date`. Tests: the example above, a purchase after the statement day, an installment on the following bill, a typed amount staying in its month, the card payment never counted, totals equal across Month, Calendar, Overview and History, and "month of purchase" giving today's numbers.
43. **Card spending by bill (screens).** Setting in Settings: "Count credit card spending in: the month I pay the card (default) / the month of purchase", with a line on what it changes. Adding a credit card asks for its statement day and payment due day (required while the setting is "the month I pay the card", with an example of what they mean); a card without them shows a notice on Month ("Set Mastercard's statement and due days so its spending counts in the month you pay it") that opens the card's dialog. The transaction dialog says where a card purchase will count ("Counts in November — Mastercard bill due 15 Nov"); transaction lists show "counts in November" on rows counted in another month. Calendar day cells and the day panel keep each purchase on the day it happened; the card's due day already shows its bill. The Credit cards group on Month shows, per card, how much of this month's spending is on its bill. The Month header's balance tile shows **Money in accounts** (debit and cash) as the main number and **Owed on cards** beside it, so a card purchase this month doesn't look as if it already left your accounts; clicking it still opens Your accounts, unchanged.
44. **One "+" per section.** The dropdown (search, pick or create a category; Expenses also lists subscriptions, installments, card payment, loans, savings, accounts). The add dialog gets One-time / Recurring with how often (week, month, every N months, year) and a start date; one-time adds a dated transaction, recurring adds a recurring item. Replaces the per-section "+" buttons of step 35. Tests: creating a category by name, reusing one by name, the recurring item's schedule.
45. **Row details panel.** A side panel for every row kind with its details, the month's transactions (edit, delete with a confirm) and its actions in place (§3, Month): recurring item edit / pause / delete, card payment and installment plans, loan payment and edit / delete, savings put in / take out and edit / delete, category rename / hide / remove this month's amounts. No navigation needed; "Open full page" stays as a secondary link.
46. **Expenses by payment method.** A toggle on the Month sheet's Expenses section: **By category** (the groups so far) / **By payment method**, remembered between visits. By payment method groups the month's counted spending (the same transactions and typed amounts that make up the Expenses total) by account, under **Debit cards**, **Cash** and **Credit cards**, each with its total and each account's (Credit cards €380 → Mastercard €300, Visa €80). For a card that's the spending on this month's bill, for debit and cash what was spent this month: everything counted in this month, as on the rest of the sheet, so the groups add up to the month's expenses. Clicking a group expands or collapses it; clicking an account opens a popup with its transactions counted in the month (date of purchase, title, category, amount, each editable) and the total at the bottom. Data: a `month:spendingByAccount` query with the per-account totals and the planned charges still to come. Tests: the totals equal the month's expenses with card purchases from last month's cycle, debit, cash, installments and typed amounts on different accounts.
47. **Everyday-task check.** Walk through each everyday task from Month only and fix any gap: add income or an expense (one-time and recurring), type a month's amounts, confirm a due payment, pay a card, buy in installments, pay a loan installment or record a repayment, put money into savings, add a subscription, correct a balance, edit or delete anything added, move between months. Reminders open Month with the right row's panel (`/?month=…&row=…`). Update §3 and DESIGN.md.

**Phase 11 — Ship**

48. Backup/restore (copy DB file, auto-backup on start, keep last N), CSV export.
49. UX polish: empty states, loading/error states, keyboard shortcuts, accessibility, dark mode pass.
50. electron-builder NSIS installer, app icon & metadata, test install/uninstall on Windows; data survives upgrade.

---

## 6. Verification (per step and at the end)

- `npm run dev` after every step — the new screen/feature works by hand with sample data.
- `npm test` (Vitest) for money, dates, recurrence, amortization and projection modules.
- Dev-only "Seed demo data" button (step 13) to fill ~12 months of realistic data for checking charts, history and projections.
- Before release: `npm run build && npm run dist`, install the generated `.exe`, create data, upgrade to a newer build, confirm data and migrations persist.

## Assumptions (easy to change)

- Single currency for the whole app; switching currency does not convert amounts.
- Savings goals are "envelopes" funded from accounts (no separate savings-account type); can add a `savings` account type later if wanted.
- Credit-card installment purchases count toward expenses month by month (per rate), not as one big expense.
- Reminders fire while the app (or its tray icon) is running.

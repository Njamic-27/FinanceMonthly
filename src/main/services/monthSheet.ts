import type { Database } from 'better-sqlite3'
import { addMonths, type IsoDate } from '@shared/dates'
import { formatMoney, type Cents } from '@shared/money'
import {
  monthCellInputSchema,
  monthKeyOf,
  monthRange,
  monthRowAccountInputSchema,
  monthRowQuerySchema,
  monthSheetQuerySchema,
  summaryDate,
  type MonthCellInput,
  type MonthKey,
  type MonthRowAccountInput,
  type MonthRowQuery,
  type MonthRowKind,
  type MonthSectionKey,
  type MonthSheet,
  type MonthSheetQuery,
  type MonthSheetRow
} from '@shared/month'
import type { PlannedItem } from '@shared/planned'
import type { Account } from '@shared/accounts'
import type { Transaction, TransactionInput } from '@shared/transactions'
import { AppError } from '../errors'
import { incomingTypes } from '../db/ledger'
import { getAccount, listAccounts } from '../db/repositories/accounts'
import { payInstallment, unpayInstallment } from '../db/repositories/bankLoans'
import { getCategory, listCategories } from '../db/repositories/categories'
import { listInstallmentPlans } from '../db/repositories/installments'
import { getLoan, listLoanInstallments, listLoans } from '../db/repositories/loans'
import { listMonthRows, setMonthRowAccount as setRowAccount } from '../db/repositories/monthRows'
import { getRecurringItem, listRecurringItems } from '../db/repositories/recurring'
import {
  addSavingsMovement,
  deleteSavingsMovement,
  getSavingsGoal,
  listSavingsGoals,
  updateSavingsMovement
} from '../db/repositories/savings'
import { getSettings } from '../db/repositories/settings'
import {
  createTransaction,
  deleteTransaction,
  toTransaction,
  updateTransaction,
  type TransactionRow
} from '../db/repositories/transactions'
import { calendarMonth, plannedCountedIn } from './planned'
import { postOccurrence, skipOccurrence } from './posting'

// The Month sheet (PLAN.md §3–4): a month as sections of rows, each row backed by real
// transactions. Every income and expense transaction counted in the month lands in exactly one row
// (a category's own, or the recurring item's, installment plan's or loan's that posted it),
// so the sheet adds up to the same totals as the Calendar and Overview.

const sum = (values: number[]): number => values.reduce((total, v) => total + v, 0)

/**
 * Transactions that count in the month: card spending when its bill is due (`counts_on`,
 * PLAN.md step 42), everything else on its date.
 */
function transactionsIn(
  db: Database,
  month: MonthKey,
  where: string,
  ...params: unknown[]
): Transaction[] {
  const { start, end } = monthRange(month)
  const rows = db
    .prepare(
      `SELECT * FROM transactions WHERE counts_on BETWEEN ? AND ? AND (${where})
       ORDER BY date, id`
    )
    .all(start, end, ...params) as TransactionRow[]
  return rows.map(toTransaction)
}

/** The account of the latest transaction matching `where`, or null. */
function latestAccount(db: Database, where: string, ...params: unknown[]): number | null {
  const row = db
    .prepare(
      `SELECT account_id FROM transactions WHERE ${where} ORDER BY date DESC, id DESC LIMIT 1`
    )
    .get(...params) as { account_id: number } | undefined
  return row?.account_id ?? null
}

/** A row's recorded amounts: `value` gives each transaction's amount with the row's sign. */
function recorded(
  posted: Transaction[],
  value: (t: Transaction) => number = (t) => t.amount
): Pick<MonthSheetRow, 'actual' | 'summary' | 'count'> {
  return {
    actual: sum(posted.map(value)),
    summary: sum(posted.filter((t) => t.isMonthTotal).map(value)),
    count: posted.length
  }
}

const expected = (
  planned: PlannedItem[],
  sign = 1
): Pick<MonthSheetRow, 'planned' | 'overdue'> => ({
  planned: sum(planned.map((p) => sign * p.amount)),
  overdue: planned.some((p) => p.overdue)
})

const signedLoanAmount = (t: Transaction): number =>
  (incomingTypes as readonly string[]).includes(t.type) ? t.amount : -t.amount

/** What a transaction adds to spending: expenses, less refunds (income on the account). */
const spending = (t: Transaction): number =>
  t.type === 'expense' ? t.amount : t.type === 'income' ? -t.amount : 0
const plannedSpending = (p: PlannedItem): number =>
  p.group === 'expense' ? p.amount : p.group === 'income' ? -p.amount : 0

const savedAmount = (t: Transaction): number =>
  t.type === 'savings_deposit' ? t.amount : -t.amount

/** Transactions of a category that are its own: not posted by a recurring item or a plan. */
const ownOfCategory =
  'category_id = ? AND recurring_item_id IS NULL AND installment_plan_id IS NULL'

interface AccountPicker {
  accounts: Account[]
  /** The first of `ids` that's an active account, else the first everyday account. */
  pick: (...ids: (number | null)[]) => number | null
  /** A category row's: the row's own, else the one its latest transaction used. */
  category: (categoryId: number, rowAccountId: number | null) => number | null
}

/** Chooses the accounts rows use: only active ones, else where money usually comes from. */
function accountPicker(db: Database, today: IsoDate): AccountPicker {
  const accounts = listAccounts(db, today)
  const usable = (id: number | null): number | null =>
    id !== null && accounts.some((a) => a.id === id && !a.isArchived) ? id : null
  const fallback =
    accounts.find((a) => !a.isArchived && a.type !== 'credit')?.id ??
    accounts.find((a) => !a.isArchived)?.id ??
    null
  const pick = (...ids: (number | null)[]): number | null =>
    ids.map(usable).find((id) => id !== null) ?? fallback
  return {
    accounts,
    pick,
    category: (categoryId, rowAccountId) =>
      pick(rowAccountId, latestAccount(db, ownOfCategory, categoryId))
  }
}

/** The account a category's row uses: its own, else its latest transaction's, else a default. */
export function categoryRowAccount(
  db: Database,
  categoryId: number,
  today: IsoDate
): number | null {
  const row = listMonthRows(db).find((r) => r.categoryId === categoryId)
  return accountPicker(db, today).category(categoryId, row?.defaultAccountId ?? null)
}

/** Everything the Month sheet shows for one month. */
export function monthSheet(db: Database, input: MonthSheetQuery, today: IsoDate): MonthSheet {
  const { month } = monthSheetQuerySchema.parse(input)
  const range = monthRange(month)
  // Also checks the month is within the Calendar's reach.
  const calendar = calendarMonth(db, { month: range.start }, today)
  const planned = plannedCountedIn(db, range, today)
  const txs = transactionsIn(db, month, '1')

  const { accounts, pick, category: categoryAccount } = accountPicker(db, today)

  const sections: Record<MonthSectionKey, MonthSheetRow[]> = {
    income: [],
    expenses: [],
    bills: [],
    cards: [],
    loans: [],
    savings: []
  }
  const base = {
    rowId: null,
    accountId: null,
    categoryId: null,
    actual: 0,
    summary: 0,
    planned: 0,
    count: 0,
    overdue: false,
    editable: false
  }

  // Categories: those added to the sheet, then any other with transactions of its own.
  const own = new Map<number, Transaction[]>()
  for (const t of txs) {
    if (t.categoryId === null || t.recurringItemId !== null || t.installmentPlanId !== null)
      continue
    own.set(t.categoryId, [...(own.get(t.categoryId) ?? []), t])
  }
  const categories = listCategories(db)
  const monthRows = listMonthRows(db)
  const added = new Set(monthRows.map((r) => r.categoryId))
  const categoryLines = [
    ...monthRows.map((r) => ({ row: r, category: categories.find((c) => c.id === r.categoryId) })),
    ...categories
      .filter((c) => !added.has(c.id) && own.has(c.id))
      .map((c) => ({ row: null, category: c }))
  ]
  for (const { row, category } of categoryLines) {
    if (!category) continue
    const posted = own.get(category.id) ?? []
    if ((row?.isHidden || category.isArchived) && posted.length === 0) continue
    sections[category.type === 'income' ? 'income' : 'expenses'].push({
      ...base,
      kind: 'category',
      sourceId: category.id,
      rowId: row?.id ?? null,
      title: category.name,
      accountId: categoryAccount(category.id, row?.defaultAccountId ?? null),
      categoryId: category.id,
      ...recorded(posted),
      editable: true
    })
  }

  // Recurring income, bills and subscriptions due or posted in the month. Recurring expenses
  // sit with the subscriptions, apart from everyday spending.
  for (const item of listRecurringItems(db)) {
    const posted = txs.filter((t) => t.recurringItemId === item.id)
    const due = planned.filter((p) => p.source === 'recurring' && p.sourceId === item.id)
    if (posted.length === 0 && due.length === 0) continue
    const section = {
      income: 'income',
      expense: 'bills',
      subscription: 'bills'
    } as const
    sections[section[item.kind]].push({
      ...base,
      kind: 'recurring',
      sourceId: item.id,
      title: item.title,
      accountId: pick(item.accountId),
      categoryId: item.categoryId,
      ...recorded(posted),
      ...expected(due),
      // A weekly item has several payments a month: those are changed one by one.
      editable: posted.length + due.length === 1
    })
  }

  // Credit cards: each card's payment, then its purchases in installments.
  const plans = listInstallmentPlans(db).reverse()
  for (const card of accounts.filter((a) => a.type === 'credit')) {
    const payments = txs.filter((t) => t.type === 'transfer' && t.toAccountId === card.id)
    const statement = calendar.cardDues.filter(
      (d) => d.accountId === card.id && d.date >= range.start && d.date <= range.end
    )
    if (!card.isArchived || payments.length > 0) {
      sections.cards.push({
        ...base,
        kind: 'card_payment',
        sourceId: card.id,
        title: card.name,
        accountId: pick(latestAccount(db, 'to_account_id = ?', card.id)),
        ...recorded(payments),
        planned: sum(statement.map((d) => d.amount ?? 0)),
        editable: true,
        onBill:
          sum(txs.filter((t) => t.accountId === card.id).map(spending)) +
          sum(planned.filter((p) => p.accountId === card.id).map(plannedSpending))
      })
    }
    for (const plan of plans.filter((p) => p.accountId === card.id)) {
      const posted = txs.filter((t) => t.installmentPlanId === plan.id)
      const due = planned.filter((p) => p.source === 'installment_plan' && p.sourceId === plan.id)
      if (posted.length === 0 && due.length === 0) continue
      sections.cards.push({
        ...base,
        kind: 'installment_plan',
        sourceId: plan.id,
        title: plan.title,
        accountId: card.id,
        categoryId: plan.categoryId,
        ...recorded(posted),
        ...expected(due)
      })
    }
  }

  // Loans: every movement in the month, and bank loan installments still to pay.
  for (const loan of listLoans(db)) {
    const posted = txs.filter((t) => t.loanId === loan.id)
    const due = planned.filter((p) => p.source === 'loan_installment' && p.loanId === loan.id)
    if (posted.length === 0 && due.length === 0) continue
    const installments =
      loan.kind === 'bank_loan'
        ? listLoanInstallments(db, loan.id).filter(
            (i) => i.dueDate >= range.start && i.dueDate <= range.end
          ).length
        : 0
    sections.loans.push({
      ...base,
      kind: 'loan',
      sourceId: loan.id,
      title: loan.title,
      accountId: pick(loan.accountId),
      ...recorded(posted, signedLoanAmount),
      ...expected(due, -1),
      editable: installments === 1
    })
  }

  // Savings: each goal's deposits less withdrawals, with its monthly plan until something's in.
  const current = monthKeyOf(today)
  for (const goal of listSavingsGoals(db)) {
    const posted = txs.filter((t) => t.savingsGoalId === goal.id)
    if (goal.isArchived && posted.length === 0) continue
    const left = Math.max(0, goal.targetAmount - goal.saved)
    sections.savings.push({
      ...base,
      kind: 'savings',
      sourceId: goal.id,
      title: goal.name,
      accountId: pick(latestAccount(db, 'savings_goal_id = ?', goal.id)),
      ...recorded(posted, savedAmount),
      planned:
        posted.length === 0 && month >= current && !goal.isArchived
          ? Math.min(goal.plannedMonthly ?? 0, left)
          : 0,
      editable: !goal.isArchived || posted.length > 0
    })
  }

  return {
    month,
    range,
    sections: (Object.keys(sections) as MonthSectionKey[]).map((key) => ({
      key,
      rows: sections[key],
      actual: sum(sections[key].map((r) => r.actual)),
      planned: sum(sections[key].map((r) => r.planned))
    })),
    summary: calendar.summary
  }
}

const money = (db: Database, cents: Cents): string => formatMoney(cents, getSettings(db))

/**
 * What the summary has to hold so the row adds up to `amount`: the amount less what the
 * individual transactions hold. 0 removes the summary; less than those transactions is refused.
 */
function topUp(db: Database, amount: Cents, individual: Cents, title: string): Cents {
  if (amount === 0) return 0
  if (amount < individual) {
    throw new AppError(
      'validation',
      `“${title}” already has ${money(db, individual)} in transactions this month. Enter at least that, or change those transactions.`
    )
  }
  return amount - individual
}

const markSummary = (db: Database, id: number): void => {
  db.prepare('UPDATE transactions SET is_month_total = 1 WHERE id = ?').run(id)
}

/** A transaction input before its account is chosen. */
type WithoutAccount<T> = T extends unknown ? Omit<T, 'accountId'> : never

/** The account a summary uses: the one asked for, else the one it uses already, else the row's. */
function summaryAccount(cell: Cell, summary: Transaction | undefined): number {
  const accountId = cell.accountId ?? summary?.accountId ?? cell.rowAccountId
  if (accountId === null) throw new AppError('validation', 'Choose an account for this row first.')
  return accountId
}

/**
 * Sets a category's or a card payment's summary transaction to `input`, or deletes it when
 * there's nothing left for it to hold.
 */
function writeSummary(
  db: Database,
  cell: Cell,
  summary: Transaction | undefined,
  input: WithoutAccount<TransactionInput>
): void {
  if (input.amount === 0) {
    if (summary) deleteTransaction(db, summary.id)
    return
  }
  const accountId = summaryAccount(cell, summary)
  const tx = { ...input, accountId } as TransactionInput
  if (summary) updateTransaction(db, summary.id, { ...tx, note: summary.note })
  else markSummary(db, createTransaction(db, tx).id)
}

interface Cell {
  month: MonthKey
  sourceId: number
  amount: Cents
  /** The account asked for. */
  accountId: number | null
  /** The row's account, for anything new when none is asked for. */
  rowAccountId: number | null
  today: IsoDate
}

function setCategoryCell(db: Database, cell: Cell): void {
  const category = getCategory(db, cell.sourceId)
  const posted = transactionsIn(db, cell.month, ownOfCategory, category.id)
  const summary = posted.find((t) => t.isMonthTotal)
  const individual = sum(posted.filter((t) => !t.isMonthTotal).map((t) => t.amount))
  writeSummary(db, cell, summary, {
    type: category.type,
    title: category.name,
    amount: topUp(db, cell.amount, individual, category.name),
    date: summaryDate(cell.month, cell.today),
    categoryId: category.id,
    note: null
  })
}

function setCardPaymentCell(db: Database, cell: Cell): void {
  const card = listAccounts(db, cell.today).find((a) => a.id === cell.sourceId)
  if (card?.type !== 'credit') throw new AppError('not_found', 'That card no longer exists.')
  const posted = transactionsIn(db, cell.month, "type = 'transfer' AND to_account_id = ?", card.id)
  const summary = posted.find((t) => t.isMonthTotal)
  const individual = sum(posted.filter((t) => !t.isMonthTotal).map((t) => t.amount))
  writeSummary(db, cell, summary, {
    type: 'transfer',
    title: '',
    amount: topUp(db, cell.amount, individual, `${card.name} payment`),
    date: summaryDate(cell.month, cell.today),
    toAccountId: card.id,
    note: null
  })
}

function setSavingsCell(db: Database, cell: Cell): void {
  const goal = getSavingsGoal(db, cell.sourceId)
  const posted = transactionsIn(db, cell.month, 'savings_goal_id = ?', goal.id)
  const summary = posted.find((t) => t.isMonthTotal)
  const individual = sum(posted.filter((t) => !t.isMonthTotal).map(savedAmount))
  const rest = topUp(db, cell.amount, individual, goal.name)
  if (rest === 0) {
    if (summary) deleteSavingsMovement(db, summary.id)
    return
  }
  const movement = {
    goalId: goal.id,
    type: 'deposit' as const,
    amount: rest,
    accountId: summaryAccount(cell, summary),
    date: summaryDate(cell.month, cell.today),
    note: summary?.note ?? null
  }
  if (summary) updateSavingsMovement(db, summary.id, movement)
  else markSummary(db, addSavingsMovement(db, movement).id)
}

/** A payment confirmed before it falls due in the current month was paid today. */
const paidOn = (due: IsoDate, cell: Cell): IsoDate =>
  due > cell.today && monthKeyOf(cell.today) === cell.month ? cell.today : due

function setRecurringCell(db: Database, cell: Cell): void {
  const item = getRecurringItem(db, cell.sourceId)
  const { start, end } = monthRange(cell.month)
  const posted = transactionsIn(db, cell.month, 'recurring_item_id = ?', item.id)
  const due = plannedCountedIn(db, { start, end }, cell.today).filter(
    (p) => p.source === 'recurring' && p.sourceId === item.id
  )
  if (posted.length + due.length !== 1) {
    throw new AppError(
      'validation',
      posted.length + due.length === 0
        ? `“${item.title}” isn’t due this month.`
        : `“${item.title}” falls due more than once this month. Change each payment in its list.`
    )
  }

  const [occurrence] = due
  const [payment] = posted
  if (occurrence) {
    if (cell.amount === 0) skipOccurrence(db, item.id, occurrence.date)
    else
      postOccurrence(db, {
        itemId: item.id,
        plannedDate: occurrence.date,
        date: paidOn(occurrence.date, cell),
        amount: cell.amount,
        accountId: cell.accountId ?? cell.rowAccountId ?? item.accountId
      })
  } else if (cell.amount === 0) {
    // Its next due date is past it already, so it stays skipped.
    deleteTransaction(db, payment.id)
  } else {
    updateTransaction(db, payment.id, {
      type: payment.type as 'income' | 'expense',
      title: payment.title,
      amount: cell.amount,
      date: payment.date,
      accountId: cell.accountId ?? payment.accountId,
      categoryId: payment.categoryId as number,
      note: payment.note
    })
  }
}

function setLoanCell(db: Database, cell: Cell): void {
  const loan = getLoan(db, cell.sourceId)
  if (loan.kind !== 'bank_loan') {
    throw new AppError('validation', 'Record repayments of this loan on its page.')
  }
  const { start, end } = monthRange(cell.month)
  const due = listLoanInstallments(db, loan.id).filter(
    (i) => i.dueDate >= start && i.dueDate <= end
  )
  if (due.length !== 1) {
    throw new AppError('validation', `No installment of “${loan.title}” is due this month.`)
  }
  const [installment] = due
  if (cell.amount === 0) {
    unpayInstallment(db, installment.id)
    return
  }
  if (cell.amount !== installment.amount) {
    throw new AppError(
      'validation',
      `Installment ${installment.seq} is ${money(db, installment.amount)}, paid in full. Enter that amount to mark it paid, or 0 to undo the payment.`
    )
  }
  if (installment.transactionId !== null) return
  const accountId = cell.accountId ?? cell.rowAccountId
  if (accountId === null) throw new AppError('validation', 'Choose an account for this row first.')
  payInstallment(db, installment.id, { accountId, date: paidOn(installment.dueDate, cell) })
}

const setters: Record<MonthRowKind, (db: Database, cell: Cell) => void> = {
  category: setCategoryCell,
  card_payment: setCardPaymentCell,
  savings: setSavingsCell,
  recurring: setRecurringCell,
  loan: setLoanCell,
  installment_plan: () => {
    throw new AppError('validation', 'Card installments are charged by themselves on their dates.')
  }
}

/**
 * Typing an amount into a row. Categories, card payments and savings set the row's monthly
 * summary (the amount less the individual transactions); a recurring payment or a bank loan
 * installment is confirmed, changed, skipped or unpaid.
 */
export function setMonthCell(db: Database, input: MonthCellInput, today: IsoDate): void {
  const { month, kind, sourceId, amount, accountId } = monthCellInputSchema.parse(input)
  const row = monthSheet(db, { month }, today)
    .sections.flatMap((s) => s.rows)
    .find((r) => r.kind === kind && r.sourceId === sourceId)
  // A category can be typed into before it shows on the month's sheet.
  const rowAccountId =
    row?.accountId ?? (kind === 'category' ? categoryRowAccount(db, sourceId, today) : null)
  db.transaction(() =>
    setters[kind](db, {
      month,
      sourceId,
      amount,
      accountId: accountId ?? null,
      rowAccountId,
      today
    })
  )()
}

/** The transactions behind each kind of row, as in `monthSheet`. */
const rowTransactions: Record<MonthRowKind, string> = {
  category: ownOfCategory,
  recurring: 'recurring_item_id = ?',
  card_payment: "type = 'transfer' AND to_account_id = ?",
  installment_plan: 'installment_plan_id = ?',
  loan: 'loan_id = ?',
  savings: 'savings_goal_id = ?'
}

/** The transactions behind one row of the month (its count and amount), newest first. */
export function monthRowTransactions(db: Database, input: MonthRowQuery): Transaction[] {
  const { month, kind, sourceId } = monthRowQuerySchema.parse(input)
  return transactionsIn(db, month, rowTransactions[kind], sourceId).reverse()
}

/**
 * Chooses a row's account. A category remembers it for its new summaries (and is added to the
 * sheet if it wasn't); on any row, the month's summary, or its one recurring payment, moves to
 * it. Payments still to confirm take the account when they're typed into.
 */
export function setMonthRowAccount(
  db: Database,
  input: MonthRowAccountInput,
  today: IsoDate
): void {
  const { month, kind, sourceId, accountId } = monthRowAccountInputSchema.parse(input)
  const account = getAccount(db, accountId)
  if (account.isArchived) {
    throw new AppError('validation', `“${account.name}” is archived. Restore it to use it again.`)
  }
  const row = monthSheet(db, { month }, today)
    .sections.flatMap((s) => s.rows)
    .find((r) => r.kind === kind && r.sourceId === sourceId)
  const moves =
    row?.editable === true &&
    row.actual >= 0 &&
    (kind === 'recurring' ? row.count === 1 && row.planned === 0 : row.summary !== 0)
  db.transaction(() => {
    if (kind === 'category')
      setRowAccount(db, { categoryId: getCategory(db, sourceId).id, accountId })
    if (moves) setMonthCell(db, { month, kind, sourceId, amount: row.actual, accountId }, today)
  })()
}

/** Rows "Copy from last month" fills: those holding amounts you type. */
const copied: readonly MonthRowKind[] = ['category', 'card_payment', 'savings']

/**
 * Fills this month's empty rows with what last month's held: nothing recorded and nothing
 * planned. Rows with anything in them are left as they are, and a row that can't take the
 * amount (its category is archived, say) is skipped. Returns how many rows were filled.
 */
export function copyFromLastMonth(db: Database, input: MonthSheetQuery, today: IsoDate): number {
  const { month } = monthSheetQuerySchema.parse(input)
  const previous = monthKeyOf(addMonths(monthRange(month).start, -1))
  const rowsOf = (sheet: MonthSheet): MonthSheetRow[] => sheet.sections.flatMap((s) => s.rows)
  const before = rowsOf(monthSheet(db, { month: previous }, today))
  const now = rowsOf(monthSheet(db, { month }, today))

  let filled = 0
  db.transaction(() => {
    for (const last of before) {
      if (!copied.includes(last.kind) || last.actual <= 0) continue
      const row = now.find((r) => r.kind === last.kind && r.sourceId === last.sourceId)
      if (row && (row.count > 0 || row.planned !== 0)) continue
      try {
        setMonthCell(
          db,
          {
            month,
            kind: last.kind,
            sourceId: last.sourceId,
            amount: last.actual,
            accountId: (row ?? last).accountId ?? undefined
          },
          today
        )
        filled++
      } catch (error) {
        if (!(error instanceof AppError)) throw error
      }
    }
  })()
  return filled
}

/**
 * Months from this one on with spending typed on the Month sheet: projections count those
 * amounts instead of average everyday spending.
 */
export function monthsWithTypedSpending(db: Database, today: IsoDate): MonthKey[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions
       WHERE is_month_total = 1 AND type = 'expense' AND date >= ? ORDER BY month`
    )
    .all(monthRange(monthKeyOf(today)).start) as { month: MonthKey }[]
  return rows.map((r) => r.month)
}

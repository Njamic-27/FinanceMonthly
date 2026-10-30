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
  type MonthSheetRow,
  type MonthSheetSection,
  type MonthTotals,
  moneyOutQuerySchema,
  type MoneyOutGroup,
  type MoneyOutItems,
  type MoneyOutLine,
  type MoneyOutPlanned,
  type MoneyOutQuery
} from '@shared/month'
import { countedDate } from '@shared/cards'
import { installmentSchedule, installmentsTitle } from '@shared/installments'
import type { PlannedItem } from '@shared/planned'
import type { Account } from '@shared/accounts'
import type { Category, ExpenseGroup } from '@shared/categories'
import type { RecurringItem } from '@shared/recurring'
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
import { t } from '@shared/i18n'

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
    subscriptions: [],
    bills: [],
    everyday: [],
    loans: [],
    savings: [],
    cards: []
  }
  const categories = listCategories(db)
  const recurringItems = listRecurringItems(db)
  /** An expense category's group; Everyday if it has none. */
  const groupOf = (categoryId: number | null): ExpenseGroup =>
    categories.find((c) => c.id === categoryId)?.group ?? 'everyday'
  // What's on credit cards, by card, so rows can say so (card purchases count on the bill).
  const cardIds = new Set(accounts.filter((a) => a.type === 'credit').map((a) => a.id))
  const byCard = (
    posted: Transaction[],
    due: PlannedItem[] = []
  ): Pick<MonthSheetRow, 'byCard'> => {
    const amounts = new Map<number, number>()
    for (const t of posted) {
      if (cardIds.has(t.accountId))
        amounts.set(t.accountId, (amounts.get(t.accountId) ?? 0) + t.amount)
    }
    for (const p of due) {
      if (cardIds.has(p.accountId))
        amounts.set(p.accountId, (amounts.get(p.accountId) ?? 0) + p.amount)
    }
    return amounts.size === 0
      ? {}
      : { byCard: [...amounts].map(([accountId, amount]) => ({ accountId, amount })) }
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
    sections[category.type === 'income' ? 'income' : groupOf(category.id)].push({
      ...base,
      kind: 'category',
      sourceId: category.id,
      rowId: row?.id ?? null,
      title: category.name,
      accountId: categoryAccount(category.id, row?.defaultAccountId ?? null),
      categoryId: category.id,
      ...recorded(posted),
      ...byCard(posted),
      editable: true
    })
  }

  // Recurring income, bills and subscriptions due or posted in the month: a subscription is
  // always a subscription, a recurring expense goes with its category's group.
  for (const item of recurringItems) {
    const posted = txs.filter((t) => t.recurringItemId === item.id)
    const due = planned.filter((p) => p.source === 'recurring' && p.sourceId === item.id)
    if (posted.length === 0 && due.length === 0) continue
    const section: MonthSectionKey =
      item.kind === 'income'
        ? 'income'
        : item.kind === 'subscription'
          ? 'subscriptions'
          : item.categoryId === null
            ? 'bills'
            : groupOf(item.categoryId)
    sections[section].push({
      ...base,
      kind: 'recurring',
      sourceId: item.id,
      title: item.title,
      accountId: pick(item.accountId),
      categoryId: item.categoryId,
      ...recorded(posted),
      ...expected(due),
      ...(item.kind !== 'income' && byCard(posted, due)),
      // A weekly item has several payments a month: those are changed one by one.
      editable: posted.length + due.length === 1
    })
  }

  const inRange = (date: IsoDate): boolean => date >= range.start && date <= range.end

  // Credit cards: each card's bill this month, for information (its purchases are in their
  // groups), and its purchases in installments, with their category's group.
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
      // The installments on this month's bill: "PlayStation 1/6".
      const seqs = installmentSchedule(plan.totalAmount, plan.count, plan.firstDate)
        .filter((i) => inRange(countedDate(i.date, card)))
        .map((i) => i.seq)
      sections[groupOf(plan.categoryId)].push({
        ...base,
        kind: 'installment_plan',
        sourceId: plan.id,
        title: installmentsTitle(plan.title, seqs, plan.count),
        accountId: card.id,
        categoryId: plan.categoryId,
        ...recorded(posted),
        ...expected(due),
        ...byCard(posted, due)
      })
    }
  }

  // Loans: every movement in the month, and bank loan installments still to pay.
  for (const loan of listLoans(db)) {
    const posted = txs.filter((t) => t.loanId === loan.id)
    const due = planned.filter((p) => p.source === 'loan_installment' && p.loanId === loan.id)
    if (posted.length === 0 && due.length === 0) continue
    const seqs =
      loan.kind === 'bank_loan'
        ? listLoanInstallments(db, loan.id)
            .filter((i) => inRange(i.dueDate))
            .map((i) => i.seq)
        : []
    const installments = seqs.length
    sections.loans.push({
      ...base,
      kind: 'loan',
      sourceId: loan.id,
      title: installmentsTitle(loan.title, seqs, loan.installmentsCount ?? Math.max(0, ...seqs)),
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

  const sheetSections = (Object.keys(sections) as MonthSectionKey[]).map((key) => ({
    key,
    rows: sections[key],
    actual: sum(sections[key].map((r) => r.actual)),
    planned: sum(sections[key].map((r) => r.planned))
  }))
  const projected = range.end >= today
  return {
    month,
    range,
    sections: sheetSections,
    summary: calendar.summary,
    totals: monthTotals(sheetSections, projected),
    byAccount: moneyOutByAccount({
      txs,
      planned,
      savingsPlanned: sections.savings,
      accounts,
      categories,
      recurringItems,
      projected
    })
  }
}

/**
 * The month's totals from its sections (PLAN.md step 49): money in, and money out made of
 * spending, loans (payments less money borrowed; loan rows carry + in, − out) and savings
 * (deposits less withdrawals). The Credit cards section isn't counted: its purchases are in
 * their groups. Planned amounts count when `projected` (the current and later months).
 */
export function monthTotals(sections: MonthSheetSection[], projected: boolean): MonthTotals {
  const part = (keys: MonthSectionKey[], withPlanned = projected): number =>
    sum(
      sections
        .filter((s) => keys.includes(s.key))
        .map((s) => s.actual + (withPlanned ? s.planned : 0))
    )
  const totals = (
    withPlanned: boolean
  ): { moneyIn: number; spending: number; loans: number; savings: number } => ({
    moneyIn: part(['income'], withPlanned),
    spending: part(['subscriptions', 'bills', 'everyday'], withPlanned),
    loans: -part(['loans'], withPlanned),
    savings: part(['savings'], withPlanned)
  })
  const all = totals(projected)
  const recorded = totals(false)
  const moneyOut = all.spending + all.loans + all.savings
  const planned = sections.some((s) => s.planned !== 0)
  return {
    moneyIn: all.moneyIn,
    moneyOut,
    net: all.moneyIn - moneyOut,
    spending: all.spending,
    loans: all.loans,
    savings: all.savings,
    recordedNet: recorded.moneyIn - (recorded.spending + recorded.loans + recorded.savings),
    withPlanned: projected && planned
  }
}

/** One piece of money out: a transaction or a planned payment, and the line it belongs to. */
interface MoneyOutEntry {
  line: Pick<MoneyOutLine, 'accountId' | 'group' | 'cardId'>
  kind: 'recorded' | 'planned'
  /** + money out, − money back (a withdrawal, money borrowed). */
  amount: number
  transaction?: Transaction
  planned?: MoneyOutPlanned
}

interface MoneyOutInput {
  txs: Transaction[]
  planned: PlannedItem[]
  savingsPlanned: MonthSheetRow[]
  accounts: Account[]
  categories: Category[]
  recurringItems: RecurringItem[]
  projected: boolean
}

/**
 * Every piece of money out in the month (PLAN.md step 49), each on its line: for a debit
 * account or cash, the group it's in; for a card, one line under the account its bill is paid
 * from. Built from the same transactions and planned payments as the sheet's rows.
 */
function moneyOutEntries(input: MoneyOutInput): MoneyOutEntry[] {
  const { txs, planned, accounts, categories, recurringItems, projected } = input
  const firstDebit =
    accounts.find((a) => a.type === 'debit' && !a.isArchived) ??
    accounts.find((a) => a.type !== 'credit')
  const lineOf = (
    accountId: number,
    group: Exclude<MoneyOutGroup, 'card'>
  ): MoneyOutEntry['line'] => {
    const account = accounts.find((a) => a.id === accountId)
    // A card's spending goes to the account its bill is paid from, as one line.
    if (account?.type !== 'credit') return { accountId, group, cardId: null }
    const owner = account.payFromAccountId ?? firstDebit?.id ?? accountId
    return { accountId: owner, group: 'card', cardId: accountId }
  }
  const groupOf = (categoryId: number | null, recurringItemId: number | null): ExpenseGroup => {
    const item = recurringItems.find((i) => i.id === recurringItemId)
    if (item?.kind === 'subscription') return 'subscriptions'
    if (item && item.categoryId === null) return 'bills'
    return categories.find((c) => c.id === (item?.categoryId ?? categoryId))?.group ?? 'everyday'
  }

  const entries: MoneyOutEntry[] = []
  const recorded = (t: Transaction, group: Exclude<MoneyOutGroup, 'card'>, sign: 1 | -1): void => {
    entries.push({
      line: lineOf(t.accountId, group),
      kind: 'recorded',
      amount: sign * t.amount,
      transaction: t
    })
  }
  for (const t of txs) {
    if (t.type === 'expense') recorded(t, groupOf(t.categoryId, t.recurringItemId), 1)
    else if (t.type === 'loan_out') recorded(t, 'loans', 1)
    else if (t.type === 'loan_in') recorded(t, 'loans', -1)
    else if (t.type === 'savings_deposit') recorded(t, 'savings', 1)
    else if (t.type === 'savings_withdrawal') recorded(t, 'savings', -1)
  }
  if (projected) {
    const plannedEntry = (
      accountId: number,
      group: Exclude<MoneyOutGroup, 'card'>,
      item: MoneyOutPlanned
    ): void => {
      entries.push({
        line: lineOf(accountId, group),
        kind: 'planned',
        amount: item.amount,
        planned: item
      })
    }
    for (const p of planned) {
      const item = { title: p.title, date: p.date, amount: p.amount }
      if (p.group === 'expense') {
        const recurringItemId = p.source === 'recurring' ? p.sourceId : null
        plannedEntry(p.accountId, groupOf(p.categoryId, recurringItemId), item)
      } else if (p.group === 'loan') plannedEntry(p.accountId, 'loans', item)
    }
    for (const row of input.savingsPlanned) {
      if (row.planned !== 0 && row.accountId !== null) {
        plannedEntry(row.accountId, 'savings', {
          title: row.title,
          date: null,
          amount: row.planned
        })
      }
    }
  }
  return entries
}

const sameLine = (
  a: Pick<MoneyOutLine, 'accountId' | 'group' | 'cardId'>,
  b: Pick<MoneyOutLine, 'accountId' | 'group' | 'cardId'>
): boolean => a.accountId === b.accountId && a.group === b.group && a.cardId === b.cardId

/** Money out by line; the lines add up to money out. */
function moneyOutByAccount(input: MoneyOutInput): MoneyOutLine[] {
  const lines: MoneyOutLine[] = []
  for (const entry of moneyOutEntries(input)) {
    let line = lines.find((l) => sameLine(l, entry.line))
    if (!line) {
      line = { ...entry.line, recorded: 0, planned: 0, count: 0 }
      lines.push(line)
    }
    line[entry.kind] += entry.amount
    if (entry.kind === 'recorded') line.count += 1
  }
  return lines
}

/**
 * What one money-out line is made of (PLAN.md step 50): its transactions counted in the month,
 * newest first, and what's still planned.
 */
export function moneyOutItems(db: Database, input: MoneyOutQuery, today: IsoDate): MoneyOutItems {
  const query = moneyOutQuerySchema.parse(input)
  const range = monthRange(query.month)
  const sheet = monthSheet(db, { month: query.month }, today)
  const entries = moneyOutEntries({
    txs: transactionsIn(db, query.month, '1'),
    planned: plannedCountedIn(db, range, today),
    savingsPlanned: sheet.sections.find((s) => s.key === 'savings')?.rows ?? [],
    accounts: listAccounts(db, today),
    categories: listCategories(db),
    recurringItems: listRecurringItems(db),
    projected: range.end >= today
  }).filter((e) => sameLine(e.line, query))
  return {
    transactions: entries.flatMap((e) => e.transaction ?? []).reverse(),
    planned: entries.flatMap((e) => e.planned ?? [])
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
      t('errors.rowHasMore', { title, amount: money(db, individual) })
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
  if (accountId === null) throw new AppError('validation', t('errors.chooseRowAccount'))
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
  if (card?.type !== 'credit') throw new AppError('not_found', t('errors.cardGone'))
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
        ? t('errors.notDueThisMonth', { title: item.title })
        : t('errors.dueTwice', { title: item.title })
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
    throw new AppError('validation', t('errors.repaymentsOnPage'))
  }
  const { start, end } = monthRange(cell.month)
  const due = listLoanInstallments(db, loan.id).filter(
    (i) => i.dueDate >= start && i.dueDate <= end
  )
  if (due.length !== 1) {
    throw new AppError('validation', t('errors.noInstallmentDue', { title: loan.title }))
  }
  const [installment] = due
  if (cell.amount === 0) {
    unpayInstallment(db, installment.id)
    return
  }
  if (cell.amount !== installment.amount) {
    throw new AppError(
      'validation',
      t('errors.installmentInFull', {
        seq: installment.seq,
        amount: money(db, installment.amount)
      })
    )
  }
  if (installment.transactionId !== null) return
  const accountId = cell.accountId ?? cell.rowAccountId
  if (accountId === null) throw new AppError('validation', t('errors.chooseRowAccount'))
  payInstallment(db, installment.id, { accountId, date: paidOn(installment.dueDate, cell) })
}

const setters: Record<MonthRowKind, (db: Database, cell: Cell) => void> = {
  category: setCategoryCell,
  card_payment: setCardPaymentCell,
  savings: setSavingsCell,
  recurring: setRecurringCell,
  loan: setLoanCell,
  installment_plan: () => {
    throw new AppError('validation', t('month.locked.installment'))
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
 * Removes what a category row holds in the month: its own transactions counted then and its
 * typed summary. The row stays; payments posted by recurring items or plans have their own
 * rows. Returns how many were removed.
 */
export function clearMonthRow(db: Database, input: MonthRowQuery): number {
  const { month, kind, sourceId } = monthRowQuerySchema.parse(input)
  if (kind !== 'category') {
    throw new AppError('validation', t('errors.onlyCategoryRow'))
  }
  const ids = transactionsIn(db, month, ownOfCategory, sourceId).map((t) => t.id)
  const remove = db.prepare('DELETE FROM transactions WHERE id = ?')
  db.transaction(() => ids.forEach((id) => remove.run(id)))()
  return ids.length
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
    throw new AppError('validation', t('errors.archived', { name: account.name }))
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

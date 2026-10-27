import type { Account, AccountInput } from './accounts'
import type { AccountSeriesQuery, BalancePoint, CardStatus } from './cards'
import type { Category, CategoryCreate, CategoryUpdate } from './categories'
import type { IsoDate } from './dates'
import type { InstallmentPlan, InstallmentPlanInput } from './installments'
import type { CalendarMonth, CalendarQuery, UpcomingPayment } from './planned'
import type { SeedSummary } from './dev'
import type { SerializedError } from './errors'
import type {
  DueOccurrence,
  PostOccurrenceInput,
  RecurringItem,
  RecurringItemInput
} from './recurring'
import type { SavingsGoal, SavingsGoalInput, SavingsMovementInput } from './savings'
import type { Settings, SettingsPatch } from './settings'
import type {
  CategoryTotal,
  CategoryTotalsQuery,
  LargestQuery,
  PeriodTotals,
  StatsRange,
  StatsSeriesQuery,
  Totals
} from './stats'
import type {
  Transaction,
  TransactionInput,
  TransactionPage,
  TransactionQuery
} from './transactions'

/**
 * Every call the renderer can make to the main process. Main registers a handler per
 * channel (src/main/ipc), the preload only forwards these channels, and the renderer
 * calls them through `invoke` (src/renderer/src/lib/api.ts).
 */
export interface IpcContract {
  'settings:get': () => Settings
  'settings:update': (patch: SettingsPatch) => Settings

  'categories:list': () => Category[]
  'categories:create': (input: CategoryCreate) => Category
  'categories:update': (id: number, patch: CategoryUpdate) => Category
  'categories:delete': (id: number) => void
  /** Moves everything in the source category to the target and deletes the source. */
  'categories:merge': (sourceId: number, targetId: number) => Category

  /** Balances are as of today. */
  'accounts:list': () => Account[]
  'accounts:create': (input: AccountInput) => Account
  'accounts:update': (id: number, input: AccountInput) => Account
  'accounts:archive': (id: number, archived: boolean) => Account
  'accounts:delete': (id: number) => void
  /** A credit card's usage, statement cycle and what to pay next. */
  'accounts:card': (id: number) => CardStatus
  /** One account's balance at the end of each day. */
  'accounts:series': (query: AccountSeriesQuery) => BalancePoint[]

  /** Newest first, one page at a time. */
  'transactions:list': (query: TransactionQuery) => TransactionPage
  'transactions:get': (id: number) => Transaction
  'transactions:create': (input: TransactionInput) => Transaction
  'transactions:update': (id: number, input: TransactionInput) => Transaction
  'transactions:delete': (id: number) => void

  /** Installment plans on one card, or on every card; the newest first. */
  'installments:list': (accountId?: number) => InstallmentPlan[]
  /** Buys something on a card in installments; installments already due are charged now. */
  'installments:create': (input: InstallmentPlanInput) => InstallmentPlan
  /** Deletes the purchase and every installment charged for it. */
  'installments:delete': (id: number) => void

  'recurring:list': () => RecurringItem[]
  /** Creating or editing an item also posts what is already due, if it posts automatically. */
  'recurring:create': (input: RecurringItemInput) => RecurringItem
  'recurring:update': (id: number, input: RecurringItemInput) => RecurringItem
  /** Pauses or resumes; resuming leaves out payments that fell due while paused. */
  'recurring:setActive': (id: number, active: boolean) => RecurringItem
  /** Ends it today: nothing after today is posted. */
  'recurring:cancel': (id: number) => RecurringItem
  /** Transactions it posted stay, as ordinary transactions. */
  'recurring:delete': (id: number) => void
  /** Occurrences due by today that wait to be confirmed or skipped, oldest first. */
  'recurring:due': () => DueOccurrence[]
  /** Confirms an occurrence as paid: creates the linked transaction. */
  'recurring:post': (input: PostOccurrenceInput) => Transaction
  /** Skips an item's next due occurrence without posting it. */
  'recurring:skip': (itemId: number, plannedDate: IsoDate) => RecurringItem

  /** Every savings goal, archived ones included, with what each holds. */
  'savings:list': () => SavingsGoal[]
  'savings:create': (input: SavingsGoalInput) => SavingsGoal
  'savings:update': (id: number, input: SavingsGoalInput) => SavingsGoal
  'savings:archive': (id: number, archived: boolean) => SavingsGoal
  /** Only goals without deposits or withdrawals; archive the others. */
  'savings:delete': (id: number) => void
  /** A goal's deposits and withdrawals, newest first. */
  'savings:movements': (goalId: number) => Transaction[]
  'savings:addMovement': (input: SavingsMovementInput) => Transaction
  'savings:updateMovement': (id: number, input: SavingsMovementInput) => Transaction
  'savings:deleteMovement': (id: number) => void
  /** What a goal held at the end of each day, up to today. */
  'savings:series': (goalId: number) => BalancePoint[]

  /** Income, expenses, savings and loan movements over a date range. */
  'stats:totals': (range: StatsRange) => Totals
  /** The same per day, week or month, with the total balance at the end of each. */
  'stats:series': (query: StatsSeriesQuery) => PeriodTotals[]
  /** Income or expenses per category, largest first. */
  'stats:categories': (query: CategoryTotalsQuery) => CategoryTotal[]
  /** The largest income or expense transactions, largest first. */
  'stats:largest': (query: LargestQuery) => Transaction[]
  /** The earliest transaction or account opening date; null with no data. */
  'stats:firstDate': () => IsoDate | null

  /** Planned payments in the next 14 days, with their reminders. */
  'reminders:upcoming': () => UpcomingPayment[]

  /** A month of the Calendar: day totals, planned payments and the month's summary. */
  'calendar:month': (query: CalendarQuery) => CalendarMonth

  /** Development builds only: empties finance-dev.db and fills it with demo data. */
  'dev:seed': () => SeedSummary
  /** Development builds only: empties finance-dev.db, back to a first run. */
  'dev:reset': () => void
}

export type IpcChannel = keyof IpcContract
export type IpcArgs<C extends IpcChannel> = Parameters<IpcContract[C]>
export type IpcResult<C extends IpcChannel> = ReturnType<IpcContract[C]>

/** Handlers never throw across IPC; they resolve to one of these. */
export type IpcResponse<T> = { ok: true; data: T } | { ok: false; error: SerializedError }

/** Runtime allowlist for the preload. Typed as a Record so a missing channel fails to compile. */
const channels: Record<IpcChannel, true> = {
  'settings:get': true,
  'settings:update': true,
  'categories:list': true,
  'categories:create': true,
  'categories:update': true,
  'categories:delete': true,
  'categories:merge': true,
  'accounts:list': true,
  'accounts:create': true,
  'accounts:update': true,
  'accounts:archive': true,
  'accounts:delete': true,
  'accounts:card': true,
  'accounts:series': true,
  'transactions:list': true,
  'transactions:get': true,
  'transactions:create': true,
  'transactions:update': true,
  'transactions:delete': true,
  'installments:list': true,
  'installments:create': true,
  'installments:delete': true,
  'recurring:list': true,
  'recurring:create': true,
  'recurring:update': true,
  'recurring:setActive': true,
  'recurring:cancel': true,
  'recurring:delete': true,
  'recurring:due': true,
  'recurring:post': true,
  'recurring:skip': true,
  'savings:list': true,
  'savings:create': true,
  'savings:update': true,
  'savings:archive': true,
  'savings:delete': true,
  'savings:movements': true,
  'savings:addMovement': true,
  'savings:updateMovement': true,
  'savings:deleteMovement': true,
  'savings:series': true,
  'stats:totals': true,
  'stats:series': true,
  'stats:categories': true,
  'stats:largest': true,
  'stats:firstDate': true,
  'reminders:upcoming': true,
  'calendar:month': true,
  'dev:seed': true,
  'dev:reset': true
}

export function isIpcChannel(value: unknown): value is IpcChannel {
  if (typeof value !== 'string' || !Object.hasOwn(channels, value)) return false
  // Development tools never get through the preload of a production build.
  return import.meta.env.DEV || !value.startsWith('dev:')
}

/** Messages main sends to the renderer on its own, not in reply to a call. */
export interface IpcEvents {
  /** Main changed data by itself (posted due payments on its timer): refetch everything. */
  'data:changed': () => void
  /** Open a screen, e.g. after a reminder notification is clicked. `path` is a route. */
  'app:navigate': (path: string) => void
}

export type IpcEvent = keyof IpcEvents

const events: Record<IpcEvent, true> = { 'data:changed': true, 'app:navigate': true }

export function isIpcEvent(value: unknown): value is IpcEvent {
  return typeof value === 'string' && Object.hasOwn(events, value)
}

/** The API the preload exposes as `window.api`. */
export interface PreloadApi {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResponse<IpcResult<C>>>
  /** Listens for a main-process event; returns a function that stops listening. */
  on<E extends IpcEvent>(
    event: E,
    listener: (...args: Parameters<IpcEvents[E]>) => void
  ): () => void
}

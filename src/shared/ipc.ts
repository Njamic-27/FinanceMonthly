import type { Account, AccountInput } from './accounts'
import type { Category, CategoryCreate, CategoryUpdate } from './categories'
import type { SeedSummary } from './dev'
import type { SerializedError } from './errors'
import type { RecurringItem, RecurringItemInput } from './recurring'
import type { Settings, SettingsPatch } from './settings'
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

  /** Newest first, one page at a time. */
  'transactions:list': (query: TransactionQuery) => TransactionPage
  'transactions:get': (id: number) => Transaction
  'transactions:create': (input: TransactionInput) => Transaction
  'transactions:update': (id: number, input: TransactionInput) => Transaction
  'transactions:delete': (id: number) => void

  'recurring:list': () => RecurringItem[]
  'recurring:create': (input: RecurringItemInput) => RecurringItem

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
  'transactions:list': true,
  'transactions:get': true,
  'transactions:create': true,
  'transactions:update': true,
  'transactions:delete': true,
  'recurring:list': true,
  'recurring:create': true,
  'dev:seed': true,
  'dev:reset': true
}

export function isIpcChannel(value: unknown): value is IpcChannel {
  if (typeof value !== 'string' || !Object.hasOwn(channels, value)) return false
  // Development tools never get through the preload of a production build.
  return import.meta.env.DEV || !value.startsWith('dev:')
}

/** The API the preload exposes as `window.api`. */
export interface PreloadApi {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResponse<IpcResult<C>>>
}

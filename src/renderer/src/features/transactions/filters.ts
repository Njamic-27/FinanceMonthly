import { addMonths, endOfMonth, isIsoDate, startOfMonth, type IsoDate } from '@shared/dates'
import { transactionKinds, type TransactionKind } from '@shared/transactions'

/** The Transactions screen's filters. They live in the URL so other screens can link to them. */
export interface TransactionFilters {
  search: string
  from?: IsoDate
  to?: IsoDate
  accountId?: number
  categoryId?: number
  kind?: TransactionKind
}

const id = (value: string | null): number | undefined => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}
const date = (value: string | null): IsoDate | undefined =>
  value && isIsoDate(value) ? value : undefined

/** Reads `?q=&from=&to=&account=&category=&type=`; anything malformed is ignored. */
export function readFilters(params: URLSearchParams): TransactionFilters {
  const kind = params.get('type')
  return {
    search: params.get('q') ?? '',
    from: date(params.get('from')),
    to: date(params.get('to')),
    accountId: id(params.get('account')),
    categoryId: id(params.get('category')),
    kind: (transactionKinds as readonly (string | null)[]).includes(kind)
      ? (kind as TransactionKind)
      : undefined
  }
}

export function writeFilters(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('q', filters.search)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.accountId) params.set('account', String(filters.accountId))
  if (filters.categoryId) params.set('category', String(filters.categoryId))
  if (filters.kind) params.set('type', filters.kind)
  return params
}

export function hasFilters(filters: TransactionFilters): boolean {
  return writeFilters(filters).size > 0
}

export interface PeriodPreset {
  id: string
  label: string
  from?: IsoDate
  to?: IsoDate
}

/** Date ranges offered in the period filter, relative to `today`. */
export function periodPresets(today: IsoDate): PeriodPreset[] {
  const year = today.slice(0, 4)
  const lastYear = String(Number(year) - 1)
  const lastMonth = addMonths(startOfMonth(today), -1)
  return [
    { id: 'all', label: 'All time' },
    { id: 'this-month', label: 'This month', from: startOfMonth(today), to: endOfMonth(today) },
    { id: 'last-month', label: 'Last month', from: lastMonth, to: endOfMonth(lastMonth) },
    {
      id: 'last-3-months',
      label: 'Last 3 months',
      from: addMonths(startOfMonth(today), -2),
      to: endOfMonth(today)
    },
    { id: 'this-year', label: 'This year', from: `${year}-01-01`, to: `${year}-12-31` },
    { id: 'last-year', label: 'Last year', from: `${lastYear}-01-01`, to: `${lastYear}-12-31` }
  ]
}

/** The preset matching a range, or 'custom'. */
export function presetFor(
  from: IsoDate | undefined,
  to: IsoDate | undefined,
  today: IsoDate
): string {
  return periodPresets(today).find((p) => p.from === from && p.to === to)?.id ?? 'custom'
}

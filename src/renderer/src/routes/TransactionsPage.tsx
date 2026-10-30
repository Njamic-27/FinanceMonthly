import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus, Receipt, Search, X } from 'lucide-react'
import { endOfMonth, startOfMonth, today, type IsoDate } from '@shared/dates'
import { transactionKinds, type DayTotal, type TransactionKind } from '@shared/transactions'
import { DatePicker } from '@renderer/components/DatePicker'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import {
  hasFilters,
  periodPresets,
  presetFor,
  readFilters,
  writeFilters,
  type TransactionFilters
} from '@renderer/features/transactions/filters'
import { useTransactionList } from '@renderer/features/transactions/queries'
import { TransactionList } from '@renderer/features/transactions/TransactionList'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t, tNode } from '@renderer/lib/i18n'

const ALL = 'all'
const kindLabel = (kind: TransactionKind): string =>
  ({
    income: t('group.income'),
    expense: t('transactions.expenses'),
    transfer: t('transactions.transfers')
  })[kind]

/** Waits until typing pauses before searching. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

export function TransactionsPage(): React.JSX.Element {
  const money = useCurrency()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const accounts = useAccounts()
  const categories = useCategories()
  const now = today()

  const update = (patch: Partial<TransactionFilters>): void =>
    setParams(writeFilters({ ...readFilters(params), ...patch }), { replace: true })

  // The search box updates the URL once typing pauses.
  const [searchText, setSearchText] = useState(filters.search)
  const debouncedSearch = useDebounced(searchText, 250)
  useEffect(() => {
    if (debouncedSearch !== readFilters(params).search) update({ search: debouncedSearch })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed text settles
  }, [debouncedSearch])

  const query = useMemo(() => {
    const search = filters.search.trim()
    const amount = search ? money.parse(search) : null
    return {
      search: search || undefined,
      amount: amount !== null && amount > 0 ? amount : undefined,
      from: filters.from,
      to: filters.to,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      kind: filters.kind
    }
  }, [
    filters.search,
    filters.from,
    filters.to,
    filters.accountId,
    filters.categoryId,
    filters.kind,
    money
  ])
  const list = useTransactionList(query)

  const pages = list.data?.pages ?? []
  const transactions = pages.flatMap((p) => p.items)
  const dayTotals = new Map<IsoDate, DayTotal>(
    pages.flatMap((p) => p.dayTotals).map((d) => [d.date, d])
  )
  const summary = pages[0]?.summary
  const remaining = summary ? summary.count - transactions.length : 0

  // "Custom dates" stays chosen even when the picked range happens to match a preset.
  const [customDates, setCustomDates] = useState(false)
  const period = customDates ? 'custom' : presetFor(filters.from, filters.to, now)
  const filtered = hasFilters(filters)
  const allAccounts = accounts.data ?? []
  const allCategories = categories.data ?? []
  const filterAccount = allAccounts.find((a) => a.id === filters.accountId)

  const clearAll = (): void => {
    setSearchText('')
    setCustomDates(false)
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <>
      <PageHeader
        title={t('screen.transactions')}
        description={t('transactions.everyPaymentIncomeAnd')}
        actions={
          <Button
            onClick={() =>
              openTransactionDialog({
                kind: 'new',
                prefill: {
                  accountId: filters.accountId,
                  type: filters.kind === 'income' ? 'income' : undefined
                }
              })
            }
          >
            <Plus />
            {t('shell.addTransaction')}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2" role="search">
        <div className="relative w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            type="search"
            aria-label={t('transactions.searchTransactions')}
            placeholder={t('add.search')}
            title={t('transactions.searchTitleNoteCategory')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={period}
          onValueChange={(id) => {
            setCustomDates(id === 'custom')
            if (id === 'custom') {
              update({ from: filters.from ?? startOfMonth(now), to: filters.to ?? endOfMonth(now) })
            } else {
              const preset = periodPresets(now).find((p) => p.id === id)
              update({ from: preset?.from, to: preset?.to })
            }
          }}
        >
          <SelectTrigger aria-label={t('overview.period')} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodPresets(now).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">{t('transactions.customDates')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.accountId ? String(filters.accountId) : ALL}
          onValueChange={(value) =>
            update({ accountId: value === ALL ? undefined : Number(value) })
          }
        >
          <SelectTrigger aria-label={t('common.account')} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('transactions.allAccounts')}</SelectItem>
            {allAccounts.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
                {a.isArchived ? ' (archived)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.categoryId ? String(filters.categoryId) : ALL}
          onValueChange={(value) =>
            update({ categoryId: value === ALL ? undefined : Number(value) })
          }
        >
          <SelectTrigger aria-label={t('common.category')} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('transactions.allCategories')}</SelectItem>
            {(['expense', 'income'] as const).map((type) => (
              <SelectGroup key={type}>
                <SelectLabel>
                  {type === 'expense' ? t('transactions.expenses') : t('group.income')}
                </SelectLabel>
                {allCategories
                  .filter((c) => c.type === type)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.isArchived ? ' (archived)' : ''}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.kind ?? ALL}
          onValueChange={(value) =>
            update({ kind: value === ALL ? undefined : (value as TransactionKind) })
          }
        >
          <SelectTrigger aria-label={t('accounts.type')} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('transactions.allTypes')}</SelectItem>
            {transactionKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kindLabel(kind)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtered && (
          <Button variant="ghost" onClick={clearAll}>
            <X />
            {t('transactions.clearFilters')}
          </Button>
        )}
      </div>

      {period === 'custom' && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="grid w-52 gap-1.5">
            <Label htmlFor="filter-from">{t('loans.from')}</Label>
            <DatePicker
              id="filter-from"
              value={filters.from ?? startOfMonth(now)}
              onChange={(from) =>
                update({ from, to: filters.to && filters.to < from ? from : filters.to })
              }
            />
          </div>
          <div className="grid w-52 gap-1.5">
            <Label htmlFor="filter-to">{t('loans.to')}</Label>
            <DatePicker
              id="filter-to"
              value={filters.to ?? now}
              min={filters.from}
              onChange={(to) => update({ to })}
            />
          </div>
        </div>
      )}

      {summary && summary.count > 0 && (
        <p
          className="mb-6 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-ink-muted"
          aria-live="polite"
        >
          <span>{t('month.transactions', { count: summary.count })}</span>
          {summary.income > 0 && (
            <span>
              {tNode('transactions.summaryIncome', {
                amount: <span className="amount text-income">{money.format(summary.income)}</span>
              })}
            </span>
          )}
          {summary.expenses > 0 && (
            <span>
              {tNode('transactions.summaryExpenses', {
                amount: <span className="amount text-ink">{money.format(summary.expenses)}</span>
              })}
            </span>
          )}
        </p>
      )}

      {list.isError && (
        <Card className="max-w-3xl">
          <CardTitle>{t('transactions.transactionsCouldNotBe')}</CardTitle>
          <CardDescription className="mt-1">{list.error.message}</CardDescription>
        </Card>
      )}

      {list.isSuccess && summary?.count === 0 && (
        <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Receipt className="size-6" />
          </span>
          {filtered ? (
            <>
              <div>
                <h2 className="text-lg font-semibold">
                  {t('transactions.nothingMatchesTheseFilters')}
                </h2>
                <p className="mt-1 text-ink-muted">{t('transactions.tryALongerPeriod')}</p>
              </div>
              <Button variant="outline" onClick={clearAll}>
                {t('transactions.clearFilters')}
              </Button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{t('transactions.noTransactionsYet')}</h2>
                <p className="mt-1 text-ink-muted">{t('transactions.addWhatYouSpend')}</p>
              </div>
              <Button onClick={() => openTransactionDialog()}>
                <Plus />
                {t('transactions.addYourFirstTransaction')}
              </Button>
            </>
          )}
        </section>
      )}

      {transactions.length > 0 && (
        <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          <TransactionList
            transactions={transactions}
            dayTotals={dayTotals}
            accounts={allAccounts}
            categories={allCategories}
            accountFilter={filterAccount?.id}
          />
          {list.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                disabled={list.isFetchingNextPage}
                onClick={() => list.fetchNextPage()}
              >
                {list.isFetchingNextPage
                  ? t('overview.loading')
                  : t('common.showMoreLeft', { count: remaining })}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

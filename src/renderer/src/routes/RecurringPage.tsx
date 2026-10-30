import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BellRing, ChevronRight, Plus } from 'lucide-react'
import { formatDate } from '@shared/dates'
import {
  hasEnded,
  monthlyCost,
  yearlyCost,
  type RecurringItem,
  type RecurringKind
} from '@shared/recurring'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import { ComingUp } from '@renderer/features/recurring/ComingUp'
import { DueNow } from '@renderer/features/recurring/DueNow'
import { useDueOccurrences, useRecurringItems } from '@renderer/features/recurring/queries'
import { kindText, reminderLabel } from '@renderer/features/recurring/appearance'
import {
  RecurringDialog,
  type RecurringDialogTarget
} from '@renderer/features/recurring/RecurringDialog'
import { describeSchedule } from '@renderer/features/recurring/schedule'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, dayPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'

const tabs: {
  kind: RecurringKind
  label: string
  empty: string
  total: string
  /** What the summary counts: one, many. */
  nouns: [string, string]
}[] = [
  {
    kind: 'subscription',
    label: 'Subscriptions',
    total: 'Your subscriptions cost',
    nouns: ['subscription', 'subscriptions'],
    empty:
      'No subscriptions yet. Add the services you pay for regularly, like streaming or software.'
  },
  {
    kind: 'income',
    label: 'Income',
    total: 'Your recurring income brings in',
    nouns: ['source of income', 'sources of income'],
    empty: 'No recurring income yet. Add your salary so it’s added on payday.'
  },
  {
    kind: 'expense',
    label: 'Expenses',
    total: 'Your recurring expenses cost',
    nouns: ['bill', 'bills'],
    empty: 'No recurring expenses yet. Add rent, utilities or other regular bills.'
  }
]

function ItemRow({ item, onOpen }: { item: RecurringItem; onOpen: () => void }): React.JSX.Element {
  const money = useCurrency()
  const category = useCategories().data?.find((c) => c.id === item.categoryId)
  const account = useAccounts().data?.find((a) => a.id === item.accountId)
  const ended = hasEnded(item)
  const isIncome = item.kind === 'income'
  const paused = !ended && !item.isActive
  const reminder =
    !ended && item.isActive && item.reminderDaysBefore !== null
      ? `Reminder ${reminderLabel(item.reminderDaysBefore).toLowerCase()}`
      : null

  const short = (date: string): string =>
    formatDate(date, money.locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const status = ended ? (
    `Ended ${formatDate(item.endDate ?? item.nextDueDate, money.locale)}`
  ) : !item.isActive ? (
    'Paused'
  ) : (
    <>
      Next{' '}
      <Link to={dayPath(item.nextDueDate)} className="link">
        {short(item.nextDueDate)}
      </Link>
    </>
  )

  return (
    <li className="py-1.5 first:pt-0 last:pb-0">
      <div className="group link-row relative flex items-center gap-3 px-2 py-2">
        {category && <CategoryChip color={category.color} icon={category.icon} />}
        <span className={cn('min-w-0 flex-1', paused && 'opacity-60')}>
          <button
            type="button"
            onClick={onOpen}
            className="link-cover block w-full truncate text-left font-semibold"
          >
            {item.title}
          </button>
          <span className="block truncate text-sm text-ink-muted">
            {describeSchedule(item, money.locale)}
            {account && (
              <>
                {' · '}
                <Link to={accountPath(account.id)} className="link">
                  {account.name}
                </Link>
              </>
            )}
            {item.kind === 'subscription' && ` · ${money.format(yearlyCost(item))} a year`}
          </span>
        </span>
        <span className="text-right">
          <span
            className={cn(
              'amount block text-lg',
              isIncome && !ended && !paused && 'text-income',
              paused && 'opacity-60'
            )}
          >
            {isIncome ? '+' : ''}
            {money.format(item.amount)}
          </span>
          <span className="flex items-center justify-end gap-1.5 text-sm text-ink-muted">
            {reminder && <BellRing className="size-3.5" aria-label={reminder} />}
            <span>{status}</span>
            {!ended && item.isActive && !item.autoPost && ' · asks first'}
          </span>
        </span>
        <ChevronRight
          className="size-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden
        />
      </div>
    </li>
  )
}

/** What the running items in a tab add up to, per month and per year. */
function CostSummary({
  items,
  label,
  nouns,
  income
}: {
  items: RecurringItem[]
  label: string
  nouns: [string, string]
  income: boolean
}): React.JSX.Element {
  const money = useCurrency()
  const perMonth = items.reduce((sum, item) => sum + monthlyCost(item), 0)
  const perYear = items.reduce((sum, item) => sum + yearlyCost(item), 0)
  return (
    <Card className="flex flex-wrap items-end gap-x-10 gap-y-3">
      <div>
        <p className="text-sm text-ink-muted">{label}</p>
        <p className={cn('amount text-amount', income && 'text-income')}>
          {money.format(perMonth)}
          <span className="ml-1.5 font-sans text-body font-normal text-ink-muted">a month</span>
        </p>
      </div>
      <div className="pb-1.5">
        <p className="amount text-title">
          {money.format(perYear)}
          <span className="ml-1.5 font-sans text-body font-normal text-ink-muted">a year</span>
        </p>
      </div>
      <p className="w-full text-sm text-ink-muted">
        Averaged over the year, from {items.length} {items.length === 1 ? nouns[0] : nouns[1]}.
        Paused and ended ones aren’t counted.
      </p>
    </Card>
  )
}

export function RecurringPage(): React.JSX.Element {
  const items = useRecurringItems()
  const due = useDueOccurrences()
  const [tab, setTab] = useState<RecurringKind>('subscription')
  const [dialog, setDialog] = useState<RecurringDialogTarget | null>(null)
  const all = items.data ?? []
  const add = (): void => setDialog({ kind: 'new', itemKind: tab })

  // Other screens open an item for editing with `?edit=<id>`, on its tab.
  const [params, setParams] = useSearchParams()
  const linked = all.find((i) => String(i.id) === params.get('edit'))
  const [shownTab, setShownTab] = useState<number | null>(null)
  if (linked && shownTab !== linked.id) {
    setShownTab(linked.id)
    setTab(linked.kind)
  }
  const target: RecurringDialogTarget | null =
    dialog ?? (linked ? { kind: 'edit', item: linked } : null)
  const closeDialog = (): void => {
    setDialog(null)
    if (params.has('edit')) setParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Subscriptions, regular bills and regular income, added when they’re due."
        actions={
          <Button onClick={add}>
            <Plus />
            {kindText(tab, 'add')}
          </Button>
        }
      />

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,48rem)_minmax(16rem,1fr)]">
        <div className="min-w-0">
          <DueNow due={due.data ?? []} />

          {items.isError ? (
            <Card className="max-w-3xl">
              <CardTitle>Recurring items could not be loaded</CardTitle>
              <CardDescription className="mt-1">
                {items.error.message} Restart Financije to try again.
              </CardDescription>
            </Card>
          ) : (
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as RecurringKind)}
              className="max-w-3xl"
            >
              <TabsList aria-label="Kind">
                {tabs.map(({ kind, label }) => (
                  <TabsTrigger key={kind} value={kind}>
                    {label}
                    <span className="text-ink-muted tabular-nums">
                      {all.filter((i) => i.kind === kind && !hasEnded(i)).length || ''}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabs.map(({ kind, empty, total, nouns }) => {
                // Running ones first, then paused ones.
                const current = all
                  .filter((i) => i.kind === kind && !hasEnded(i))
                  .sort((a, b) => Number(b.isActive) - Number(a.isActive))
                const running = current.filter((i) => i.isActive)
                const ended = all.filter((i) => i.kind === kind && hasEnded(i))
                return (
                  <TabsContent key={kind} value={kind} className="grid gap-6">
                    {running.length > 0 && (
                      <CostSummary
                        items={running}
                        label={total}
                        nouns={nouns}
                        income={kind === 'income'}
                      />
                    )}
                    {current.length > 0 ? (
                      <Card className="p-3">
                        <ul className="divide-y divide-line">
                          {current.map((item) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              onOpen={() => setDialog({ kind: 'edit', item })}
                            />
                          ))}
                        </ul>
                      </Card>
                    ) : (
                      items.isSuccess && (
                        <section className="flex flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
                          <p className="text-ink-muted">{empty}</p>
                          <Button onClick={add}>
                            <Plus />
                            {kindText(kind, 'add')}
                          </Button>
                        </section>
                      )
                    )}

                    {ended.length > 0 && (
                      <section>
                        <h2 className="mb-1 text-lg font-semibold">Ended</h2>
                        <p className="mb-3 text-sm text-ink-muted">
                          Past their end date. What they added stays in your transactions.
                        </p>
                        <Card className="p-3">
                          <ul className="divide-y divide-line">
                            {ended.map((item) => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                onOpen={() => setDialog({ kind: 'edit', item })}
                              />
                            ))}
                          </ul>
                        </Card>
                      </section>
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </div>
        <ComingUp className="xl:sticky xl:top-6" />
      </div>

      <RecurringDialog target={target} onClose={closeDialog} />
    </>
  )
}

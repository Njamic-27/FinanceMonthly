import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { formatDate } from '@shared/dates'
import { hasEnded, type RecurringItem, type RecurringKind } from '@shared/recurring'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import { DueNow } from '@renderer/features/recurring/DueNow'
import { useDueOccurrences, useRecurringItems } from '@renderer/features/recurring/queries'
import { kindLabels } from '@renderer/features/recurring/appearance'
import {
  RecurringDialog,
  type RecurringDialogTarget
} from '@renderer/features/recurring/RecurringDialog'
import { describeSchedule } from '@renderer/features/recurring/schedule'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

const tabs: { kind: RecurringKind; label: string; empty: string }[] = [
  {
    kind: 'subscription',
    label: 'Subscriptions',
    empty:
      'No subscriptions yet. Add the services you pay for regularly, like streaming or software.'
  },
  {
    kind: 'income',
    label: 'Income',
    empty: 'No recurring income yet. Add your salary so it’s added on payday.'
  },
  {
    kind: 'expense',
    label: 'Expenses',
    empty: 'No recurring expenses yet. Add rent, utilities or other regular bills.'
  }
]

function ItemRow({ item, onOpen }: { item: RecurringItem; onOpen: () => void }): React.JSX.Element {
  const money = useCurrency()
  const category = useCategories().data?.find((c) => c.id === item.categoryId)
  const account = useAccounts().data?.find((a) => a.id === item.accountId)
  const ended = hasEnded(item)
  const isIncome = item.kind === 'income'

  const status = ended
    ? `Ended ${formatDate(item.endDate ?? item.nextDueDate, money.locale)}`
    : !item.isActive
      ? 'Paused'
      : `Next ${formatDate(item.nextDueDate, money.locale, { weekday: 'short', day: 'numeric', month: 'short' })}`

  return (
    <li className="py-1.5 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {category && <CategoryChip color={category.color} icon={category.icon} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{item.title}</span>
          <span className="block truncate text-sm text-ink-muted">
            {describeSchedule(item, money.locale)}
            {account && ` · ${account.name}`}
          </span>
        </span>
        <span className="text-right">
          <span className={cn('amount block text-lg', isIncome && !ended && 'text-income')}>
            {isIncome ? '+' : ''}
            {money.format(item.amount)}
          </span>
          <span className="block text-sm text-ink-muted">
            {status}
            {!ended && item.isActive && !item.autoPost && ' · asks first'}
          </span>
        </span>
        <ChevronRight
          className="size-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </button>
    </li>
  )
}

export function RecurringPage(): React.JSX.Element {
  const items = useRecurringItems()
  const due = useDueOccurrences()
  const [tab, setTab] = useState<RecurringKind>('subscription')
  const [dialog, setDialog] = useState<RecurringDialogTarget | null>(null)
  const all = items.data ?? []
  const add = (): void => setDialog({ kind: 'new', itemKind: tab })

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Subscriptions, regular bills and regular income, added when they’re due."
        actions={
          <Button onClick={add}>
            <Plus />
            Add {kindLabels[tab].noun}
          </Button>
        }
      />

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

          {tabs.map(({ kind, empty }) => {
            const current = all.filter((i) => i.kind === kind && !hasEnded(i))
            const ended = all.filter((i) => i.kind === kind && hasEnded(i))
            return (
              <TabsContent key={kind} value={kind} className="grid gap-6">
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
                        Add {kindLabels[kind].noun}
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

      <RecurringDialog target={dialog} onClose={() => setDialog(null)} />
    </>
  )
}

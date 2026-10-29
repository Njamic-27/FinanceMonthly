import { useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert } from 'lucide-react'
import { formatDate, today } from '@shared/dates'
import type { DueOccurrence } from '@shared/recurring'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, dayPath, recurringPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { ConfirmPaymentDialog, type ConfirmPaymentTarget } from './ConfirmPaymentDialog'
import { useSkipOccurrence } from './queries'

/**
 * Payments that have fallen due and wait for the user: items that ask first, and automatic
 * ones that could not be added as they stand. Renders nothing when the queue is empty.
 */
export function DueNow({ due }: { due: DueOccurrence[] }): React.JSX.Element | null {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const categories = useCategories().data ?? []
  const skip = useSkipOccurrence()
  const [confirming, setConfirming] = useState<ConfirmPaymentTarget | null>(null)
  const now = today()

  if (due.length === 0) return null

  const skipOne = ({ item, plannedDate }: DueOccurrence): void =>
    skip.mutate(
      { itemId: item.id, plannedDate },
      {
        onSuccess: () =>
          toast({
            title: `${item.title} skipped`,
            description: `Nothing was added for ${formatDate(plannedDate, money.locale)}.`,
            variant: 'success'
          }),
        onError: (error) =>
          toast({ title: 'Not skipped', description: error.message, variant: 'error' })
      }
    )

  return (
    <Card className="mb-8 max-w-3xl border-primary/40">
      <CardHeader className="mb-2">
        <div>
          <CardTitle>Due now</CardTitle>
          <CardDescription>
            Confirm each payment to add it to your transactions, or skip it if it didn’t happen.
          </CardDescription>
        </div>
      </CardHeader>
      <ul className="divide-y divide-line">
        {due.map((occurrence) => {
          const { item, plannedDate, problem } = occurrence
          const category = categories.find((c) => c.id === item.categoryId)
          const account = accounts.find((a) => a.id === item.accountId)
          const isIncome = item.kind === 'income'
          // Only the earliest open payment of an item can be skipped.
          const canSkip = plannedDate === item.nextDueDate
          return (
            <li
              key={`${item.id}-${plannedDate}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 last:pb-0"
            >
              {category && <CategoryChip color={category.color} icon={category.icon} />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  <Link to={recurringPath(item.id)} className="link">
                    {item.title}
                  </Link>
                </p>
                <p className="text-sm text-ink-muted">
                  Due{' '}
                  <Link to={dayPath(plannedDate)} className="link">
                    {plannedDate === now
                      ? 'today'
                      : formatDate(plannedDate, money.locale, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                  </Link>
                  {account && (
                    <>
                      {' · '}
                      <Link to={accountPath(account.id)} className="link">
                        {account.name}
                      </Link>
                    </>
                  )}
                </p>
                {problem && (
                  <p className="mt-1 flex gap-1.5 text-sm text-expense">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>Couldn’t be added automatically: {problem}</span>
                  </p>
                )}
              </div>
              <span className={cn('amount text-lg', isIncome && 'text-income')}>
                {isIncome ? '+' : ''}
                {money.format(item.amount)}
              </span>
              <div className="flex gap-1">
                {/* Hidden rather than left out, so amounts stay in one column. */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(!canSkip && 'invisible')}
                  aria-hidden={!canSkip || undefined}
                  disabled={skip.isPending || !canSkip}
                  onClick={() => skipOne(occurrence)}
                >
                  Skip
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirming({ item, plannedDate })}
                >
                  {isIncome ? 'Mark received…' : 'Mark paid…'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmPaymentDialog target={confirming} onClose={() => setConfirming(null)} />
    </Card>
  )
}

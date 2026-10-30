import { useState } from 'react'
import { Link } from 'react-router'
import { CircleAlert } from 'lucide-react'
import { formatDate, today, type IsoDate } from '@shared/dates'
import type { Cents } from '@shared/money'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { useAccounts, useCardBillsDue } from '@renderer/features/accounts/queries'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import {
  PayInstallmentDialog,
  type PayInstallmentTarget
} from '@renderer/features/loans/PayInstallmentDialog'
import {
  ConfirmPaymentDialog,
  type ConfirmPaymentTarget
} from '@renderer/features/recurring/ConfirmPaymentDialog'
import {
  useDueOccurrences,
  useSkipOccurrence,
  useUpcomingPayments
} from '@renderer/features/recurring/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath, dayPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

interface Waiting {
  key: string
  title: string
  date: IsoDate
  amount: Cents
  income: boolean
  accountId: number
  categoryId: number | null
  problem: string | null
  /** What the buttons do. */
  confirm: () => void
  confirmLabel: string
  skip?: () => void
}

/**
 * What's waiting for you, whatever month is shown: payments due that ask first (or couldn't
 * post by themselves) and overdue loan installments, each settled right here. Renders nothing
 * when there's nothing to do.
 */
export function WaitingStrip(): React.JSX.Element | null {
  const money = useCurrency()
  const now = today()
  const due = useDueOccurrences().data ?? []
  const upcoming = useUpcomingPayments().data ?? []
  const accounts = useAccounts().data ?? []
  const bills = useCardBillsDue().data ?? []
  const categories = useCategories().data ?? []
  const skip = useSkipOccurrence()
  const [confirming, setConfirming] = useState<ConfirmPaymentTarget | null>(null)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)

  const items: Waiting[] = [
    ...due.map(({ item, plannedDate, problem }) => ({
      key: `recurring-${item.id}-${plannedDate}`,
      title: item.title,
      date: plannedDate,
      amount: item.amount,
      income: item.kind === 'income',
      accountId: item.accountId,
      categoryId: item.categoryId,
      problem,
      confirm: () => setConfirming({ item, plannedDate }),
      confirmLabel: t(item.kind === 'income' ? 'month.markReceived' : 'month.markPaid'),
      // Only the earliest open payment of an item can be skipped.
      skip:
        plannedDate === item.nextDueDate
          ? () =>
              skip.mutate(
                { itemId: item.id, plannedDate },
                {
                  onSuccess: () =>
                    toast({
                      title: t('month.skipped', { title: item.title }),
                      description: t('month.skippedHint', {
                        date: formatDate(plannedDate, money.locale)
                      }),
                      variant: 'success'
                    }),
                  onError: (error) =>
                    toast({
                      title: t('month.notSkipped'),
                      description: error.message,
                      variant: 'error'
                    })
                }
              )
          : undefined
    })),
    ...upcoming
      .filter((u) => u.planned.source === 'loan_installment' && u.planned.overdue)
      .map(({ planned }) => ({
        key: `loan-${planned.sourceId}`,
        title: planned.title,
        date: planned.date,
        amount: planned.amount,
        income: false,
        accountId: planned.accountId,
        categoryId: planned.categoryId,
        problem: null,
        confirm: () =>
          setPaying({
            installmentId: planned.sourceId,
            title: planned.title,
            amount: planned.amount,
            dueDate: planned.date,
            accountId: planned.accountId
          }),
        confirmLabel: t('month.pay')
      })),
    // Card bills: paid from the card's Paid from account, which isn't counted again.
    ...bills.map((bill) => {
      const from =
        bill.payFromAccountId ?? accounts.find((a) => a.type === 'debit' && !a.isArchived)?.id
      return {
        key: `card-${bill.accountId}`,
        title: t('month.cardBill', { card: bill.name }),
        date: bill.dueDate,
        amount: bill.amount,
        income: false,
        accountId: from ?? bill.accountId,
        categoryId: null,
        problem: null,
        confirm: () =>
          openTransactionDialog({
            kind: 'new',
            prefill: {
              type: 'transfer',
              accountId: from,
              toAccountId: bill.accountId,
              amount: bill.amount,
              date: today()
            }
          }),
        confirmLabel: t('month.payBill')
      }
    })
  ].sort((a, b) => a.date.localeCompare(b.date))

  if (items.length === 0) return null

  return (
    <Card aria-labelledby="month-waiting" className="mb-8 border-primary/40">
      <h2 id="month-waiting" className="text-lg font-semibold">
        {t('month.waiting')}
      </h2>
      <p className="text-sm text-ink-muted">{t('month.waitingHint')}</p>
      <ul className="mt-2 divide-y divide-line">
        {items.map((w) => {
          const account = accounts.find((a) => a.id === w.accountId)
          const category = categories.find((c) => c.id === w.categoryId)
          return (
            <li key={w.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 last:pb-0">
              {category ? (
                <CategoryChip color={category.color} icon={category.icon} size="sm" />
              ) : (
                <span className="size-7 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{w.title}</p>
                <p className={cn('text-sm text-ink-muted', w.date < now && 'text-expense')}>
                  {t('month.due')}{' '}
                  <Link to={dayPath(w.date)} className="link">
                    {w.date === now
                      ? t('common.today')
                      : formatDate(w.date, money.locale, {
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
                {w.problem && (
                  <p className="mt-1 flex gap-1.5 text-sm text-expense">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{t('month.couldntAdd', { problem: w.problem })}</span>
                  </p>
                )}
              </div>
              <span className={cn('amount text-lg', w.income && 'text-income')}>
                {money.format(w.amount)}
              </span>
              <div className="flex gap-1">
                {/* Hidden rather than left out, so amounts stay in one column. */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(!w.skip && 'invisible')}
                  aria-hidden={!w.skip || undefined}
                  disabled={skip.isPending || !w.skip}
                  onClick={w.skip}
                >
                  {t('common.skip')}
                </Button>
                <Button variant="secondary" size="sm" onClick={w.confirm}>
                  {w.confirmLabel}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmPaymentDialog target={confirming} onClose={() => setConfirming(null)} />
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
    </Card>
  )
}

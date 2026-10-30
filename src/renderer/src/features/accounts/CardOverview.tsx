import { Link } from 'react-router'
import { BellRing, CalendarClock } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { CARD_DUE_REMINDER_DAYS, type CardStatus } from '@shared/cards'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { useSettings } from '@renderer/features/settings/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { ordinal } from '@renderer/features/recurring/schedule'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { dayPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { CreditUsage } from './CreditUsage'
import { t, tNode } from '@renderer/lib/i18n'

const percent = (share: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(share)

function Row({
  label,
  hint,
  children
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

/**
 * A credit card: what's owed against the limit, and where it is in its statement cycle with
 * what to pay by when.
 */
export function CardOverview({
  account,
  status,
  payFrom,
  onEdit,
  className
}: {
  account: Account
  status: CardStatus
  /** The account a card payment comes from by default. */
  payFrom?: Account
  onEdit: () => void
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const remindersOn = useSettings().data?.notificationsEnabled ?? true
  const now = today()
  const { cycle } = status
  // Each date opens its day in the Calendar.
  const longDate = (date: IsoDate): React.ReactNode => (
    <Link to={dayPath(date)} className="link">
      {formatDate(date, money.locale, { weekday: 'short', day: 'numeric', month: 'long' })}
    </Link>
  )
  const pay = (amount: number): void =>
    openTransactionDialog({
      kind: 'new',
      prefill: { type: 'transfer', accountId: payFrom?.id, toAccountId: account.id, amount }
    })
  const hasCycle = account.statementDay !== null || account.paymentDueDay !== null
  const statementClosed = cycle.dueStatement !== null && cycle.dueStatement <= now

  return (
    <Card className={cn('grid content-start gap-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">
            {account.balance > 0 ? t('accounts.inCredit') : t('accounts.owed')}
          </p>
          <p className="amount text-amount">
            {money.format(account.balance > 0 ? account.balance : status.owed)}
          </p>
        </div>
        {status.owed > 0 && (
          <Button variant="secondary" onClick={() => pay(status.owed)}>
            {t('accounts.payCard')}
          </Button>
        )}
      </div>

      <div>
        <CreditUsage
          owed={status.owed}
          reserved={status.reserved}
          limit={status.limit}
          available={status.available}
        />
        {status.reserved > 0 && (
          <p className="mt-1 text-sm text-ink-muted">
            {t('accounts.heldForInstallments', { amount: money.format(status.reserved) })}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-4 border-y border-line py-4">
        <div>
          <dt className="text-sm text-ink-muted">{t('accounts.creditLimit')}</dt>
          <dd className="amount text-lg">{money.format(status.limit)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{t('accounts.available')}</dt>
          <dd className="amount text-lg">{money.format(Math.max(0, status.available))}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{t('accounts.used')}</dt>
          <dd className={cn('amount text-lg', status.utilization > 1 && 'text-expense')}>
            {percent(status.utilization, money.locale)}
          </dd>
        </div>
      </dl>

      {hasCycle ? (
        <section aria-labelledby="card-cycle">
          <h2 id="card-cycle" className="flex items-center gap-2 font-semibold">
            <CalendarClock className="size-4 text-ink-muted" aria-hidden />
            {t('accounts.statementAndPayment')}
          </h2>
          <dl className="divide-y divide-line">
            {cycle.lastStatement && statementClosed && status.statementBalance !== null && (
              <Row
                label={t('accounts.lastStatement')}
                hint={tNode('accounts.closedOn', {
                  date: longDate(cycle.dueStatement ?? cycle.lastStatement)
                })}
              >
                <span className="amount">{money.format(status.statementBalance)}</span>
                {(status.paidSinceStatement ?? 0) > 0 && (
                  <span className="block text-sm text-ink-muted">
                    {t('accounts.paidSince', {
                      amount: money.format(status.paidSinceStatement ?? 0)
                    })}
                  </span>
                )}
              </Row>
            )}
            {cycle.dueDate && (
              <Row
                label={t('accounts.paymentDue')}
                hint={
                  account.paymentDueDay
                    ? t('accounts.dueEachMonth', { day: ordinal(account.paymentDueDay) })
                    : undefined
                }
              >
                <span className="block">{longDate(cycle.dueDate)}</span>
                {status.leftToPay !== null ? (
                  status.leftToPay > 0 ? (
                    <span className="flex items-center justify-end gap-2">
                      <span className="amount">
                        {t('accounts.toPay', { amount: money.format(status.leftToPay) })}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => pay(status.leftToPay ?? 0)}>
                        {t('recurring.pay')}
                      </Button>
                    </span>
                  ) : (
                    <span className="block text-sm text-income">{t('accounts.paid')}</span>
                  )
                ) : (
                  <span className="block text-sm text-ink-muted">
                    {tNode('accounts.forStatement', {
                      date: longDate(cycle.dueStatement ?? cycle.dueDate)
                    })}
                  </span>
                )}
              </Row>
            )}
            {cycle.nextStatement && (
              <Row
                label={t('accounts.nextStatement')}
                hint={
                  account.statementDay
                    ? t('accounts.closesEachMonth', { day: ordinal(account.statementDay) })
                    : undefined
                }
              >
                {longDate(cycle.nextStatement)}
              </Row>
            )}
          </dl>
          <p className="mt-2 flex gap-2 text-sm text-ink-muted">
            <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
            {remindersOn
              ? t('accounts.remindersOn', { days: CARD_DUE_REMINDER_DAYS })
              : t('accounts.paymentRemindersAreOff')}
          </p>
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-sm text-ink-muted">{t('accounts.addDaysHint')}</p>
          <Button variant="outline" size="sm" onClick={onEdit}>
            {t('accounts.addStatementDays')}
          </Button>
        </section>
      )}
    </Card>
  )
}

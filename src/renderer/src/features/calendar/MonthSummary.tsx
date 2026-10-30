import { CircleAlert } from 'lucide-react'
import type { MonthTotals } from '@shared/month'
import type { CalendarSummary } from '@shared/planned'
import { Card } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

function Tile({
  label,
  value,
  caption,
  className
}: {
  label: string
  value: string
  caption?: string
  className?: string
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn('amount text-title', className)}>{value}</p>
      {caption && <p className="mt-0.5 text-sm text-ink-muted">{caption}</p>}
    </Card>
  )
}

/**
 * Money in, money out and the balance at the end of the month: the same numbers as Month's
 * (PLAN.md step 49). Past months show what was recorded; the current and later months add what
 * is still planned.
 */
export function MonthSummary({
  summary,
  totals
}: {
  summary: CalendarSummary
  /** Month's totals; while they load, the tiles show what's known so far. */
  totals: MonthTotals | undefined
}): React.JSX.Element {
  const money = useCurrency()
  const { projected } = summary
  const withPlanned = totals?.withPlanned ?? false

  return (
    <section aria-label={t('calendar.monthSummary')} className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={withPlanned ? t('calendar.incomeWithPlanned') : t('group.income')}
          value={totals ? money.format(totals.moneyIn) : '…'}
          className="text-income"
        />
        <Tile
          label={withPlanned ? t('calendar.moneyOutWithPlanned') : t('month.moneyOut')}
          value={totals ? money.format(totals.moneyOut) : '…'}
          caption={t('calendar.moneyOutCaption')}
        />
        <Tile
          label={t('calendar.net')}
          value={totals ? money.format(totals.net, 'exceptZero') : '…'}
          caption={
            totals && withPlanned
              ? t('month.recordedSoFar', { amount: money.format(totals.recordedNet, 'exceptZero') })
              : undefined
          }
        />
        <Tile
          label={projected ? t('month.expectedBalanceEnd') : t('month.balanceEnd')}
          value={money.format(summary.endingBalance)}
          caption={projected ? t('calendar.todaysBalanceWithEverything') : undefined}
          className={cn(summary.endingBalance < 0 && 'text-expense')}
        />
      </div>
      {summary.overdue > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-expense">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {t('calendar.overdue', { count: summary.overdue })} {t('calendar.openItsDayTo')}
        </p>
      )}
    </section>
  )
}

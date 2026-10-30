import { ChevronLeft, ChevronRight } from 'lucide-react'
import { startOfMonth, today, type IsoDate } from '@shared/dates'
import { Button } from '@renderer/components/ui/button'
import { lastCalendarMonth, stepMonth } from './month'
import { MonthPicker } from './MonthPicker'
import { t } from '@renderer/lib/i18n'

/**
 * ‹ › to the previous or next month (up to 24 months ahead), its name, which opens a month
 * picker, and "Today".
 */
export function MonthNav({
  month,
  onChange,
  children
}: {
  /** The month's first day. */
  month: IsoDate
  onChange: (month: IsoDate) => void
  /** Actions shown at the far end. */
  children?: React.ReactNode
}): React.JSX.Element {
  const now = today()
  const isLast = month === lastCalendarMonth(now)

  return (
    <nav aria-label={t('screen.month')} className="mb-6 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label={t('calendar.previousMonth')}
        title={t('calendar.previousMonth')}
        onClick={() => onChange(stepMonth(month, -1, now))}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t('calendar.nextMonth')}
        title={isLast ? t('calendar.youCanPlanUp') : t('calendar.nextMonth')}
        disabled={isLast}
        onClick={() => onChange(stepMonth(month, 1, now))}
      >
        <ChevronRight />
      </Button>
      <h2 className="ml-1 text-title font-bold" aria-live="polite">
        <MonthPicker month={month} onChange={onChange} />
      </h2>
      {month !== startOfMonth(now) && (
        <Button variant="ghost" className="ml-2" onClick={() => onChange(startOfMonth(now))}>
          {t('transactions.today')}
        </Button>
      )}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </nav>
  )
}

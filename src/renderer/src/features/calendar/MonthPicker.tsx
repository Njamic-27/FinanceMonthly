import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, startOfMonth, today, type IsoDate } from '@shared/dates'
import { Button } from '@renderer/components/ui/button'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@renderer/components/ui/popover'
import { useFirstDate } from '@renderer/features/stats/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { pickableMonths } from './month'
import { t } from '@renderer/lib/i18n'

const monthOf = (year: number, index: number): IsoDate =>
  `${year}-${String(index + 1).padStart(2, '0')}-01`

/**
 * The month's name, which opens a picker: a year with ‹ › and its twelve months. Months from
 * before your data starts or past the last one the Calendar shows can't be picked.
 */
export function MonthPicker({
  month,
  onChange
}: {
  /** The month's first day. */
  month: IsoDate
  onChange: (month: IsoDate) => void
}): React.JSX.Element {
  const money = useCurrency()
  const now = today()
  const { first, last } = pickableMonths(useFirstDate().data ?? null, now)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const thisMonth = startOfMonth(now)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Each time it opens, it starts on the year of the month shown.
        if (next) setYear(Number(month.slice(0, 4)))
        setOpen(next)
      }}
    >
      <PopoverTrigger
        title={t('calendar.chooseAMonth')}
        className="group inline-flex cursor-pointer items-center gap-1.5 rounded-control px-1 underline-offset-[0.2em] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary data-[state=open]:text-primary"
      >
        <span className="group-hover:underline">
          {formatDate(month, money.locale, { month: 'long', year: 'numeric' })}
        </span>
        <ChevronDown className="size-5 text-ink-muted group-hover:text-primary" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72" aria-label={t('calendar.chooseAMonth')}>
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('calendar.previousYear')}
            disabled={year <= Number(first.slice(0, 4))}
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="font-display text-lg font-bold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('calendar.nextYear')}
            disabled={year >= Number(last.slice(0, 4))}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 12 }, (_, i) => {
            const value = monthOf(year, i)
            const selected = value === month
            return (
              <PopoverClose
                key={value}
                disabled={value < first || value > last}
                aria-current={selected ? 'date' : undefined}
                aria-label={formatDate(value, money.locale, { month: 'long', year: 'numeric' })}
                onClick={() => onChange(value)}
                className={cn(
                  'h-10 cursor-pointer rounded-control text-body transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-35',
                  selected
                    ? 'bg-primary font-semibold text-on-primary'
                    : 'hover:bg-surface-2 disabled:hover:bg-transparent',
                  !selected && value === thisMonth && 'font-semibold text-primary'
                )}
              >
                {formatDate(value, money.locale, { month: 'short' })}
              </PopoverClose>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

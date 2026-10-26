import { formatDate, today, type IsoDate, type WeekStart } from '@shared/dates'
import type { CalendarDay, CalendarMonth, PlannedItem } from '@shared/planned'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { weekdayLabels } from './month'

/** Planned items shown in a cell before "+N more". */
const PILLS = 2

const dotKinds = [
  { key: 'income', label: 'income', className: 'bg-income' },
  { key: 'expenses', label: 'spending', className: 'bg-expense' },
  { key: 'savings', label: 'savings', className: 'bg-savings' },
  { key: 'loans', label: 'loans', className: 'bg-loan' }
] as const

function PlannedPill({
  item,
  onOpen
}: {
  item: PlannedItem
  onOpen: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const label = `${item.title}, ${money.format(item.amount)}${item.overdue ? ', overdue' : ', planned'}`
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onOpen}
      className={cn(
        'relative z-10 block w-full cursor-pointer truncate rounded-full border px-2 text-left text-xs leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-primary',
        item.overdue
          ? 'border-expense/40 bg-expense-soft font-semibold text-expense hover:border-expense'
          : item.group === 'income'
            ? 'border-dashed border-income/50 text-income hover:bg-income-soft'
            : 'border-dashed border-ink-muted/40 text-ink-muted hover:bg-surface-2 hover:text-ink'
      )}
    >
      {item.title}
    </button>
  )
}

function DayCell({
  day,
  planned,
  inMonth,
  selected,
  onSelect,
  onPlanned
}: {
  day: CalendarDay
  planned: PlannedItem[]
  inMonth: boolean
  selected: boolean
  onSelect: () => void
  onPlanned: (item: PlannedItem) => void
}): React.JSX.Element {
  const money = useCurrency()
  const isToday = day.date === today()
  const dots = dotKinds.filter((d) => day[d.key] > 0)

  const parts = [
    formatDate(day.date, money.locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    day.income > 0 && `income ${money.format(day.income)}`,
    day.expenses > 0 && `spent ${money.format(day.expenses)}`,
    planned.length > 0 && `${planned.length} planned`
  ].filter(Boolean)

  return (
    <div
      className={cn(
        'relative flex min-h-26 min-w-0 flex-col gap-1 border-line p-1.5 transition-colors',
        inMonth ? 'bg-surface hover:bg-surface-2/60' : 'bg-canvas',
        selected && 'z-10 rounded-control outline-2 -outline-offset-2 outline-primary'
      )}
    >
      {/* The day button covers the whole cell; planned pills sit above it. */}
      <button
        type="button"
        aria-label={parts.join(', ')}
        aria-pressed={selected}
        onClick={onSelect}
        className="flex items-center justify-between gap-1 after:absolute after:inset-0 after:cursor-pointer after:content-[''] focus-visible:outline-none focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
      >
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full text-sm tabular-nums',
            isToday ? 'bg-primary font-bold text-on-primary' : !inMonth && 'text-ink-muted/60'
          )}
        >
          {Number(day.date.slice(8))}
        </span>
        {dots.length > 0 && (
          <span className="flex gap-0.5 pr-0.5" aria-hidden>
            {dots.map((d) => (
              <span key={d.key} className={cn('size-1.5 rounded-full', d.className)} />
            ))}
          </span>
        )}
      </button>

      <div className={cn('grid text-xs leading-4', !inMonth && 'opacity-60')} aria-hidden>
        {day.income > 0 && (
          <span className="amount truncate text-income">{money.format(day.income, 'always')}</span>
        )}
        {day.expenses > 0 && <span className="amount truncate">{money.format(-day.expenses)}</span>}
      </div>

      {planned.length > 0 && (
        <div className={cn('mt-auto grid gap-0.5', !inMonth && 'opacity-60')}>
          {planned.slice(0, PILLS).map((item) => (
            <PlannedPill
              key={`${item.source}-${item.sourceId}`}
              item={item}
              onOpen={() => onPlanned(item)}
            />
          ))}
          {planned.length > PILLS && (
            <span className="px-2 text-xs text-ink-muted" aria-hidden>
              +{planned.length - PILLS} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** The month as weeks of day cells, with recorded totals, type dots and planned payments. */
export function CalendarGrid({
  data,
  weekStart,
  selected,
  onSelect,
  onPlanned
}: {
  data: CalendarMonth
  weekStart: WeekStart
  selected: IsoDate
  onSelect: (date: IsoDate) => void
  onPlanned: (item: PlannedItem) => void
}): React.JSX.Element {
  const money = useCurrency()
  const plannedByDay = new Map<IsoDate, PlannedItem[]>()
  for (const item of data.planned) {
    plannedByDay.set(item.date, [...(plannedByDay.get(item.date) ?? []), item])
  }

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-line">
      {/* Each day button names its weekday, so the header is only for the eye. */}
      <div className="grid grid-cols-7 gap-px" aria-hidden>
        {weekdayLabels(weekStart, money.locale).map((label) => (
          <div key={label} className="bg-surface px-2 py-2 text-xs font-semibold text-ink-muted">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-px grid grid-cols-7 gap-px">
        {data.days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            planned={plannedByDay.get(day.date) ?? []}
            inMonth={day.date >= data.month.start && day.date <= data.month.end}
            selected={day.date === selected}
            onSelect={() => onSelect(day.date)}
            onPlanned={onPlanned}
          />
        ))}
      </div>
    </div>
  )
}

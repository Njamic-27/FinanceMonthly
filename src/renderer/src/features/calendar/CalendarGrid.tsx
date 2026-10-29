import { formatDate, today, type IsoDate, type WeekStart } from '@shared/dates'
import { useNavigate } from 'react-router'
import { CreditCard } from 'lucide-react'
import type { CalendarDay, CalendarMonth, CardDueMarker, PlannedItem } from '@shared/planned'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { cardDueLabel } from './cardDue'
import { weekdayLabels } from './month'

/** Card payments and planned items shown in a cell before "+N more". */
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
            : item.group === 'loan'
              ? 'border-dashed border-loan/50 text-loan hover:bg-loan-soft'
              : 'border-dashed border-ink-muted/40 text-ink-muted hover:bg-surface-2 hover:text-ink'
      )}
    >
      {item.title}
    </button>
  )
}

/**
 * A card's payment due date. Neutral and solid, unlike planned payments: paying a card only
 * moves money between your own accounts. Opens the card.
 */
function CardDuePill({ marker }: { marker: CardDueMarker }): React.JSX.Element {
  const money = useCurrency()
  const navigate = useNavigate()
  const label = cardDueLabel(marker, money)
  return (
    <button
      type="button"
      title={label}
      aria-label={`${label}, card payment`}
      onClick={() => navigate(accountPath(marker.accountId))}
      className="relative z-10 flex w-full min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-full border border-line bg-surface-2 px-2 text-left text-xs leading-5 text-ink transition-colors hover:border-ink-muted/40 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <CreditCard className="size-3 shrink-0 text-ink-muted" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  )
}

function DayCell({
  day,
  cardDues,
  planned,
  inMonth,
  selected,
  onSelect,
  onPlanned
}: {
  day: CalendarDay
  cardDues: CardDueMarker[]
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
    ...cardDues.map((m) => cardDueLabel(m, money)),
    planned.length > 0 && `${planned.length} planned`
  ].filter(Boolean)
  const pills = cardDues.length + planned.length
  const plannedShown = Math.max(0, PILLS - cardDues.length)

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

      {pills > 0 && (
        <div
          className={cn('mt-auto grid grid-cols-[minmax(0,1fr)] gap-0.5', !inMonth && 'opacity-60')}
        >
          {cardDues.slice(0, PILLS).map((marker) => (
            <CardDuePill key={`card-${marker.accountId}`} marker={marker} />
          ))}
          {planned.slice(0, plannedShown).map((item) => (
            <PlannedPill
              key={`${item.source}-${item.sourceId}`}
              item={item}
              onOpen={() => onPlanned(item)}
            />
          ))}
          {pills > PILLS && (
            <span className="px-2 text-xs text-ink-muted" aria-hidden>
              +{pills - PILLS} more
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
    // On the day it counts: a charge on a card on its bill's due day.
    plannedByDay.set(item.countsOn, [...(plannedByDay.get(item.countsOn) ?? []), item])
  }
  const cardDuesByDay = new Map<IsoDate, CardDueMarker[]>()
  for (const marker of data.cardDues) {
    cardDuesByDay.set(marker.date, [...(cardDuesByDay.get(marker.date) ?? []), marker])
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
            cardDues={cardDuesByDay.get(day.date) ?? []}
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

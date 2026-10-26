import { Link } from 'react-router'
import { formatDate, parseIsoDate, type IsoDate, type PeriodKind } from '@shared/dates'
import type { PeriodTotals } from '@shared/stats'
import { overviewParams } from '@renderer/features/overview/period'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { HEAT_STEPS, heatLevel } from './year'

/**
 * Spending heat: one hue (the expense colour) mixed into the surface, light to strong.
 * The strongest step still keeps ink text above 4.5:1 in both themes.
 */
const heatMix = [0, 12, 24, 38, 54]
const heatStyle = (level: number): React.CSSProperties | undefined =>
  level === 0
    ? undefined
    : { background: `color-mix(in oklab, var(--expense) ${heatMix[level]}%, var(--surface))` }

export function HeatLegend(): React.JSX.Element {
  return (
    <p className="flex items-center gap-2 text-sm text-ink-muted">
      Less spending
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: HEAT_STEPS + 1 }, (_, level) => (
          <span
            key={level}
            style={heatStyle(level)}
            className="size-4 rounded-[4px] border border-line bg-surface"
          />
        ))}
      </span>
      More
    </p>
  )
}

/**
 * One tile per month or week of the year, shaded by how much was spent. Each opens that
 * period in Overview; periods that haven't started yet are shown but can't be opened.
 */
export function PeriodGrid({
  periods,
  view,
  today
}: {
  periods: PeriodTotals[]
  view: PeriodKind
  today: IsoDate
}): React.JSX.Element {
  const money = useCurrency()
  const spent = periods.filter((p) => p.expenses > 0).map((p) => p.expenses)
  const [min, max] = [Math.min(...spent), Math.max(...spent)]
  const range = new Intl.DateTimeFormat(money.locale, { day: 'numeric', month: 'short' })

  return (
    <ol
      className={cn(
        'grid gap-2',
        view === 'month'
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          : 'grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]'
      )}
    >
      {periods.map((p) => {
        const name =
          view === 'month'
            ? formatDate(p.start, money.locale, { month: 'long' })
            : range.formatRange(parseIsoDate(p.start), parseIsoDate(p.end))
        const future = p.start > today
        const summary = `${name}: spent ${money.format(p.expenses)}, income ${money.format(p.income)}, net ${money.format(p.net, 'exceptZero')}`
        const tileClass = cn(
          'block h-full border border-line bg-surface text-ink',
          view === 'month' ? 'rounded-panel p-4' : 'rounded-control px-3 py-2'
        )

        if (future) {
          return (
            <li key={p.start}>
              <div className={cn(tileClass, 'border-dashed bg-transparent text-ink-muted')}>
                <p className={cn('font-semibold', view === 'week' && 'text-sm')}>{name}</p>
                <p className="text-sm">Not yet</p>
              </div>
            </li>
          )
        }
        return (
          <li key={p.start}>
            <Link
              to={`/overview?${overviewParams(view, p.start)}`}
              aria-label={summary}
              title={view === 'week' ? summary : undefined}
              style={heatStyle(heatLevel(p.expenses, min, max))}
              className={cn(
                tileClass,
                'transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:brightness-110'
              )}
            >
              {view === 'month' ? (
                <>
                  <p className="font-semibold">{name}</p>
                  <p className="amount mt-1 text-title">{money.format(p.expenses)}</p>
                  <p className="mt-2 text-sm text-ink-muted">
                    In <span className="amount text-ink">{money.format(p.income)}</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    Net <span className="amount text-ink">{money.format(p.net, 'exceptZero')}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="amount">{money.format(p.expenses)}</p>
                </>
              )}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

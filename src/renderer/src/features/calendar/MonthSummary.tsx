import { CircleAlert } from 'lucide-react'
import type { CalendarSummary } from '@shared/planned'
import { Card } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

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
 * Income, spending and the balance at the end of the month. Past months show what was
 * recorded; the current and later months add what is still planned.
 */
export function MonthSummary({ summary }: { summary: CalendarSummary }): React.JSX.Element {
  const money = useCurrency()
  const { projected } = summary
  const income = summary.income + (projected ? summary.plannedIncome : 0)
  const expenses = summary.expenses + (projected ? summary.plannedExpenses : 0)
  const split = (recorded: number, planned: number): string | undefined =>
    projected && planned > 0 && recorded > 0
      ? `${money.format(recorded)} recorded · ${money.format(planned)} planned`
      : undefined

  return (
    <section aria-label="Month summary" className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={projected ? 'Income, with planned' : 'Income'}
          value={money.format(income)}
          caption={split(summary.income, summary.plannedIncome)}
          className="text-income"
        />
        <Tile
          label={projected ? 'Spending, with planned' : 'Spent'}
          value={money.format(expenses)}
          caption={split(summary.expenses, summary.plannedExpenses)}
        />
        <Tile label="Income minus spending" value={money.format(income - expenses, 'exceptZero')} />
        <Tile
          label={projected ? 'Expected balance at month end' : 'Balance at month end'}
          value={money.format(summary.endingBalance)}
          caption={projected ? 'Today’s balance with everything planned until then' : undefined}
          className={cn(summary.endingBalance < 0 && 'text-expense')}
        />
      </div>
      {summary.overdue > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-expense">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {summary.overdue === 1
            ? '1 planned payment this month is overdue.'
            : `${summary.overdue} planned payments this month are overdue.`}{' '}
          Open its day to mark it paid.
        </p>
      )}
    </section>
  )
}

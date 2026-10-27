import { Link, useSearchParams } from 'react-router'
import { ChartLine } from 'lucide-react'
import { formatDate, type PeriodKind } from '@shared/dates'
import { projectionHorizons, type ProjectionHorizon } from '@shared/projection'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { useAccounts } from '@renderer/features/accounts/queries'
import { Assumptions } from '@renderer/features/projections/Assumptions'
import { BalanceChart } from '@renderer/features/projections/BalanceChart'
import { DetailTable } from '@renderer/features/projections/DetailTable'
import { FlowChart } from '@renderer/features/projections/FlowChart'
import { readProjectionParams } from '@renderer/features/projections/labels'
import { Milestones } from '@renderer/features/projections/Milestones'
import { useProjection } from '@renderer/features/projections/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

const horizonLabels: Record<ProjectionHorizon, string> = {
  3: '3 months',
  6: '6 months',
  12: '1 year',
  24: '2 years'
}
const horizonOptions = projectionHorizons.map((m) => ({
  value: String(m) as `${ProjectionHorizon}`,
  label: horizonLabels[m]
}))
const granularityOptions: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' }
]

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

/** Where the total balance is heading over the next 3 months to 2 years. */
export function ProjectionsPage(): React.JSX.Element {
  const money = useCurrency()
  const [params, setParams] = useSearchParams()
  const { months, granularity } = readProjectionParams(params)
  const accounts = useAccounts()
  const projection = useProjection({ months, granularity })
  const data = projection.data
  const set = (next: { months?: ProjectionHorizon; granularity?: PeriodKind }): void =>
    setParams(
      new URLSearchParams({
        months: String(next.months ?? months),
        by: next.granularity ?? granularity
      }),
      { replace: true }
    )

  const hasAccounts = (accounts.data ?? []).some((a) => !a.isArchived)
  const longDate = (date: string): string =>
    formatDate(date, money.locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <PageHeader
        title="Projections"
        description="Where your balance is heading, if things go as planned."
        actions={
          <>
            <SegmentedControl
              name="projection-horizon"
              aria-label="How far ahead"
              value={String(months) as `${ProjectionHorizon}`}
              options={horizonOptions}
              onValueChange={(value) => set({ months: Number(value) as ProjectionHorizon })}
            />
            <SegmentedControl
              name="projection-granularity"
              aria-label="Weeks or months"
              value={granularity}
              options={granularityOptions}
              onValueChange={(value) => set({ granularity: value })}
            />
          </>
        }
      />

      {accounts.isSuccess && !hasAccounts && (
        <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ChartLine className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Add your accounts first</h2>
            <p className="mt-1 text-ink-muted">
              A projection starts from what’s in your accounts today, then adds your income, bills
              and loans as they come.
            </p>
          </div>
          <Button asChild>
            <Link to="/accounts">Go to accounts</Link>
          </Button>
        </section>
      )}

      {projection.isError && (
        <Card className="max-w-3xl">
          <CardTitle>The projection could not be made</CardTitle>
          <CardDescription className="mt-1">{projection.error.message}</CardDescription>
        </Card>
      )}

      {hasAccounts && data && (
        <div
          className={cn(
            'grid gap-4 transition-opacity',
            projection.isPlaceholderData && 'opacity-60'
          )}
        >
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Today" value={money.format(data.startBalance)} caption="Total balance" />
            <Tile
              label={`In ${horizonLabels[months]}`}
              value={money.format(data.endBalance)}
              caption={`${money.format(data.endBalance - data.startBalance, 'exceptZero')} from today`}
              className={cn(data.endBalance < 0 && 'text-expense')}
            />
            <Tile
              label="Lowest point"
              value={money.format(data.lowest.balance)}
              caption={longDate(data.lowest.date)}
              className={cn(data.lowest.balance < 0 && 'text-expense')}
            />
            <Tile
              label="A month on average"
              value={money.format(
                Math.round((data.endBalance - data.startBalance) / months),
                'exceptZero'
              )}
              caption="How the balance changes"
            />
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <BalanceChart projection={data} className="lg:col-span-2" />
            <Milestones milestones={data.milestones} />
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <FlowChart projection={data} className="lg:col-span-2" />
            <Assumptions projection={data} />
          </div>
          <DetailTable projection={data} />
        </div>
      )}
    </>
  )
}

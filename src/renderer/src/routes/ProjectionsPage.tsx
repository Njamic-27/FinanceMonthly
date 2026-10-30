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
import { dayPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { t } from '@renderer/lib/i18n'

const horizonLabel = (months: ProjectionHorizon): string => t(`projections.horizon${months}`)
const horizonOptions = (): { value: `${ProjectionHorizon}`; label: string }[] =>
  projectionHorizons.map((m) => ({
    value: String(m) as `${ProjectionHorizon}`,
    label: horizonLabel(m)
  }))
const granularityOptions = (): { value: PeriodKind; label: string }[] => [
  { value: 'week', label: t('projections.weekly') },
  { value: 'month', label: t('projections.monthly') }
]

function Tile({
  label,
  value,
  caption,
  className
}: {
  label: string
  value: string
  caption?: React.ReactNode
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
        title={t('screen.projections')}
        description={t('projections.whereYourBalanceIs')}
        actions={
          <>
            <SegmentedControl
              name="projection-horizon"
              aria-label={t('projections.howFarAhead')}
              value={String(months) as `${ProjectionHorizon}`}
              options={horizonOptions()}
              onValueChange={(value) => set({ months: Number(value) as ProjectionHorizon })}
            />
            <SegmentedControl
              name="projection-granularity"
              aria-label={t('projections.weeksOrMonths')}
              value={granularity}
              options={granularityOptions()}
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
            <h2 className="text-lg font-semibold">{t('projections.addYourAccountsFirst')}</h2>
            <p className="mt-1 text-ink-muted">{t('projections.aProjectionStartsFrom')}</p>
          </div>
          <Button asChild>
            <Link to="/accounts">{t('transactions.goToAccounts')}</Link>
          </Button>
        </section>
      )}

      {projection.isError && (
        <Card className="max-w-3xl">
          <CardTitle>{t('projections.theProjectionCouldNot')}</CardTitle>
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
          <section
            aria-label={t('projections.summary')}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Tile
              label={t('transactions.today')}
              value={money.format(data.startBalance)}
              caption={t('projections.totalBalance')}
            />
            <Tile
              label={t('projections.inHorizon', { horizon: horizonLabel(months) })}
              value={money.format(data.endBalance)}
              caption={t('projections.fromToday', {
                amount: money.format(data.endBalance - data.startBalance, 'exceptZero')
              })}
              className={cn(data.endBalance < 0 && 'text-expense')}
            />
            <Tile
              label={t('projections.lowestPoint')}
              value={money.format(data.lowest.balance)}
              caption={
                <Link to={dayPath(data.lowest.date)} className="link">
                  {longDate(data.lowest.date)}
                </Link>
              }
              className={cn(data.lowest.balance < 0 && 'text-expense')}
            />
            <Tile
              label={t('projections.aMonthOnAverage')}
              value={money.format(
                Math.round((data.endBalance - data.startBalance) / months),
                'exceptZero'
              )}
              caption={t('projections.howBalanceChanges')}
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

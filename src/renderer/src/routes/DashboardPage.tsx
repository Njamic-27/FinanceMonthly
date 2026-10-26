import { Link } from 'react-router'
import { ChartColumn, Plus, Wallet } from 'lucide-react'
import { addMonths, formatDate, formatPeriod, startOfMonth, today } from '@shared/dates'
import { defaultSettings } from '@shared/settings'
import { IncomeSpendingChart } from '@renderer/components/charts/IncomeSpendingChart'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { BalanceBanner } from '@renderer/features/accounts/BalanceBanner'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { BalanceTrend } from '@renderer/features/dashboard/BalanceTrend'
import { CategoryDonut } from '@renderer/features/dashboard/CategoryDonut'
import {
  comparisonFor,
  comparisonLabel,
  overviewParams,
  readOverviewPeriod
} from '@renderer/features/overview/period'
import { SummaryCards } from '@renderer/features/overview/SummaryCards'
import { useSettings } from '@renderer/features/settings/queries'
import {
  useCategoryTotals,
  useFirstDate,
  useSeries,
  useTotals
} from '@renderer/features/stats/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'

/** Months in the income and spending chart and the balance line, this one included. */
const TREND_MONTHS = 6

function Invite({
  icon: Icon,
  title,
  text,
  action
}: {
  icon: typeof Wallet
  title: string
  text: string
  action: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-ink-muted">{text}</p>
      </div>
      {action}
    </section>
  )
}

/** Your money at a glance: balance, this month, and the last six months. */
export function DashboardPage(): React.JSX.Element {
  const money = useCurrency()
  const weekStart = useSettings().data?.weekStart ?? defaultSettings.weekStart
  const now = today()
  const month = readOverviewPeriod(new URLSearchParams(), now, weekStart)
  const comparison = comparisonFor(month, now, weekStart)
  const trendFrom = addMonths(startOfMonth(now), -(TREND_MONTHS - 1))

  const accounts = useAccounts()
  const categories = useCategories().data ?? []
  const firstDate = useFirstDate().data
  const totals = useTotals({ from: month.range.start, to: month.range.end })
  const previous = useTotals({ from: comparison.range.start, to: comparison.range.end })
  const months = useSeries({ from: trendFrom, to: now, by: 'month' })
  const days = useSeries({ from: trendFrom, to: now, by: 'day' })
  const byCategory = useCategoryTotals({
    from: month.range.start,
    to: month.range.end,
    type: 'expense'
  })

  const active = (accounts.data ?? []).filter((a) => !a.isArchived)
  const comparable = !!firstDate && firstDate <= comparison.range.start
  const hasActivity = (months.data ?? []).some((m) => m.count > 0)
  const monthName = formatPeriod('month', month.range, money.locale)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={formatDate(now, money.locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      />

      {accounts.isSuccess && active.length === 0 ? (
        <Invite
          icon={Wallet}
          title="Add your accounts to get started"
          text="Your cards and cash, with what’s on each of them today. Everything here is worked out from them."
          action={
            <Button asChild>
              <Link to="/accounts">
                <Plus />
                Add an account
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <BalanceBanner accounts={active} />

          <section aria-labelledby="this-month" className="mt-8">
            <header className="mb-4 flex items-baseline justify-between gap-4 px-1">
              <h2 id="this-month" className="text-lg font-semibold">
                {monthName} so far
              </h2>
              <Link
                to={`/overview?${overviewParams('month', now)}`}
                className="rounded-control text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Open in Overview
              </Link>
            </header>
            {totals.data && (
              <SummaryCards
                totals={totals.data}
                previous={comparable ? previous.data : undefined}
                against={comparisonLabel(month, comparison, money.locale)}
              />
            )}
          </section>

          {months.isSuccess && !hasActivity ? (
            <div className="mt-8">
              <Invite
                icon={ChartColumn}
                title="Your charts start with your first transaction"
                text="Add what you spend and earn, and you’ll see where it goes and how your balance moves."
                action={
                  <Button onClick={() => openTransactionDialog()}>
                    <Plus />
                    Add transaction
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                <CategoryDonut
                  title={`Spending in ${formatDate(now, money.locale, { month: 'long' })}`}
                  totals={byCategory.data ?? []}
                  categories={categories}
                  range={month.range}
                />
                <IncomeSpendingChart
                  className="lg:col-span-2"
                  title={`Income and spending, last ${TREND_MONTHS} months`}
                  months={months.data ?? []}
                />
              </div>
              <BalanceTrend className="mt-4" days={days.data ?? []} />
            </>
          )}
        </>
      )}
    </>
  )
}

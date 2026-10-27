import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, startOfMonth, today, type IsoDate } from '@shared/dates'
import type { PlannedItem } from '@shared/planned'
import { defaultSettings } from '@shared/settings'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { CalendarGrid } from '@renderer/features/calendar/CalendarGrid'
import { DayPanel } from '@renderer/features/calendar/DayPanel'
import {
  calendarParams,
  lastCalendarMonth,
  readCalendarMonth,
  stepMonth
} from '@renderer/features/calendar/month'
import { MonthSummary } from '@renderer/features/calendar/MonthSummary'
import { useCalendarMonth } from '@renderer/features/calendar/queries'
import {
  ConfirmPaymentDialog,
  type ConfirmPaymentTarget
} from '@renderer/features/recurring/ConfirmPaymentDialog'
import { useRecurringItems } from '@renderer/features/recurring/queries'
import { useSettings } from '@renderer/features/settings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

/** Any past month and up to 24 months ahead: recorded days, planned payments, the balance. */
export function CalendarPage(): React.JSX.Element {
  const money = useCurrency()
  const weekStart = useSettings().data?.weekStart ?? defaultSettings.weekStart
  const [params, setParams] = useSearchParams()
  const now = today()
  const month = readCalendarMonth(params, now)
  const isCurrent = month === startOfMonth(now)
  const calendar = useCalendarMonth(month)
  const recurring = useRecurringItems().data ?? []

  // The picked day belongs to its month; elsewhere the panel opens on today or the 1st.
  const [picked, setPicked] = useState<{ month: IsoDate; date: IsoDate } | null>(null)
  const selected = picked?.month === month ? picked.date : isCurrent ? now : month
  const [confirming, setConfirming] = useState<ConfirmPaymentTarget | null>(null)

  const go = (next: IsoDate): void => setParams(calendarParams(next), { replace: true })
  const navigate = useNavigate()
  // A recurring payment is confirmed here; an installment charges itself, so it opens its card.
  const confirm = (planned: PlannedItem): void => {
    if (planned.source === 'installment_plan') {
      navigate(`/accounts/${planned.accountId}`)
      return
    }
    const item = recurring.find((r) => r.id === planned.sourceId)
    if (item) setConfirming({ item, plannedDate: planned.date })
  }

  const data = calendar.data
  const label = formatDate(month, money.locale, { month: 'long', year: 'numeric' })

  return (
    <>
      <PageHeader title="Calendar" description="What happened and what’s coming, day by day." />

      <nav aria-label="Month" className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous month"
          title="Previous month"
          onClick={() => go(stepMonth(month, -1, now))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          title={
            month === lastCalendarMonth(now) ? 'The calendar goes 24 months ahead' : 'Next month'
          }
          disabled={month === lastCalendarMonth(now)}
          onClick={() => go(stepMonth(month, 1, now))}
        >
          <ChevronRight />
        </Button>
        <h2 className="ml-2 text-title font-bold" aria-live="polite">
          {label}
        </h2>
        {!isCurrent && (
          <Button variant="ghost" className="ml-2" onClick={() => go(startOfMonth(now))}>
            Today
          </Button>
        )}
      </nav>

      {calendar.isError && (
        <Card className="max-w-3xl">
          <CardTitle>The calendar could not be loaded</CardTitle>
          <CardDescription className="mt-1">{calendar.error.message}</CardDescription>
        </Card>
      )}

      {data && (
        <div className={cn('transition-opacity', calendar.isPlaceholderData && 'opacity-60')}>
          <MonthSummary summary={data.summary} />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <CalendarGrid
              data={data}
              weekStart={weekStart}
              selected={selected}
              onSelect={(date) => setPicked({ month, date })}
              onPlanned={(item) => {
                setPicked({ month, date: item.date })
                confirm(item)
              }}
            />
            <DayPanel
              date={selected}
              cardDues={data.cardDues.filter((m) => m.date === selected)}
              planned={data.planned.filter((p) => p.date === selected)}
              onConfirm={confirm}
            />
          </div>
        </div>
      )}

      <ConfirmPaymentDialog target={confirming} onClose={() => setConfirming(null)} />
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { startOfMonth, today, type IsoDate } from '@shared/dates'
import { monthKeyOf } from '@shared/month'
import type { PlannedItem } from '@shared/planned'
import { defaultSettings } from '@shared/settings'
import { PageHeader } from '@renderer/components/PageHeader'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { CalendarGrid } from '@renderer/features/calendar/CalendarGrid'
import { DayPanel } from '@renderer/features/calendar/DayPanel'
import {
  calendarParams,
  readCalendarDay,
  readCalendarMonth
} from '@renderer/features/calendar/month'
import { MonthNav } from '@renderer/features/calendar/MonthNav'
import { MonthSummary } from '@renderer/features/calendar/MonthSummary'
import { useCalendarMonth } from '@renderer/features/calendar/queries'
import { useMonthSheet } from '@renderer/features/month/queries'
import {
  ConfirmPaymentDialog,
  type ConfirmPaymentTarget
} from '@renderer/features/recurring/ConfirmPaymentDialog'
import {
  PayInstallmentDialog,
  type PayInstallmentTarget
} from '@renderer/features/loans/PayInstallmentDialog'
import { useRecurringItems } from '@renderer/features/recurring/queries'
import { useSettings } from '@renderer/features/settings/queries'
import { plannedPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'

/** Any past month and up to 24 months ahead: recorded days, planned payments, the balance. */
export function CalendarPage(): React.JSX.Element {
  const weekStart = useSettings().data?.weekStart ?? defaultSettings.weekStart
  const [params, setParams] = useSearchParams()
  const now = today()
  const month = readCalendarMonth(params, now)
  const isCurrent = month === startOfMonth(now)
  const calendar = useCalendarMonth(month)
  // Money in, money out and net as Month counts them.
  const sheet = useMonthSheet(monthKeyOf(month))
  const recurring = useRecurringItems().data ?? []

  // The open day is in the URL (`?day=`), so other screens can link to it; without one the
  // panel shows today or the 1st.
  const selected = readCalendarDay(params, month) ?? (isCurrent ? now : month)
  const [confirming, setConfirming] = useState<ConfirmPaymentTarget | null>(null)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)

  const go = (next: IsoDate): void => setParams(calendarParams(next), { replace: true })
  const pick = (date: IsoDate): void => setParams(calendarParams(month, date), { replace: true })

  // Arriving at a day from a link: bring its panel into view when it's below the grid.
  const panel = useRef<HTMLElement>(null)
  const linkedDay = useRef(readCalendarDay(params, month))
  useEffect(() => {
    if (linkedDay.current && calendar.data) {
      linkedDay.current = null
      panel.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [calendar.data])
  const navigate = useNavigate()
  // A recurring payment is confirmed here; an installment charges itself, so it opens its card.
  const confirm = (planned: PlannedItem): void => {
    if (planned.source === 'installment_plan') {
      void navigate(plannedPath(planned))
      return
    }
    if (planned.source === 'loan_installment') {
      setPaying({
        installmentId: planned.sourceId,
        title: planned.title,
        amount: planned.amount,
        dueDate: planned.date,
        accountId: planned.accountId
      })
      return
    }
    const item = recurring.find((r) => r.id === planned.sourceId)
    if (item) setConfirming({ item, plannedDate: planned.date })
  }

  const data = calendar.data

  return (
    <>
      <PageHeader title="Calendar" description="What happened and what’s coming, day by day." />

      <MonthNav month={month} onChange={go} />

      {calendar.isError && (
        <Card className="max-w-3xl">
          <CardTitle>The calendar could not be loaded</CardTitle>
          <CardDescription className="mt-1">{calendar.error.message}</CardDescription>
        </Card>
      )}

      {data && (
        <div className={cn('transition-opacity', calendar.isPlaceholderData && 'opacity-60')}>
          <MonthSummary
            summary={data.summary}
            totals={sheet.data?.month === monthKeyOf(month) ? sheet.data.totals : undefined}
          />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <CalendarGrid
              data={data}
              weekStart={weekStart}
              selected={selected}
              onSelect={pick}
              onPlanned={(item) => {
                pick(item.countsOn)
                confirm(item)
              }}
            />
            <DayPanel
              ref={panel}
              date={selected}
              cardDues={data.cardDues.filter((m) => m.date === selected)}
              planned={data.planned.filter((p) => p.countsOn === selected)}
              onConfirm={confirm}
            />
          </div>
        </div>
      )}

      <ConfirmPaymentDialog target={confirming} onClose={() => setConfirming(null)} />
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
    </>
  )
}

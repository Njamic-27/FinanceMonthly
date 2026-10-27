import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CopyPlus } from 'lucide-react'
import { addMonths, formatDate, today, type IsoDate } from '@shared/dates'
import { monthKeyOf, type MonthSheetRow } from '@shared/month'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { calendarParams, readCalendarMonth } from '@renderer/features/calendar/month'
import { MonthNav } from '@renderer/features/calendar/MonthNav'
import { MonthSummary } from '@renderer/features/calendar/MonthSummary'
import { rowKey } from '@renderer/features/month/cells'
import { MonthSheetView } from '@renderer/features/month/MonthSheetView'
import { useCopyFromLastMonth, useMonthSheet } from '@renderer/features/month/queries'
import { RowPanel } from '@renderer/features/month/RowPanel'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

/** One month like a spreadsheet: type what each row came to instead of every purchase. */
export function MonthPage(): React.JSX.Element {
  const money = useCurrency()
  const [params, setParams] = useSearchParams()
  const first = readCalendarMonth(params, today())
  const month = monthKeyOf(first)
  const sheet = useMonthSheet(month)
  const accounts = useAccounts().data ?? []
  const copy = useCopyFromLastMonth()

  // The open row is looked up again in fresh data, so its panel follows edits.
  const [open, setOpen] = useState<MonthSheetRow | null>(null)
  const rows = sheet.data?.sections.flatMap((s) => s.rows) ?? []
  const openRow = open && (rows.find((r) => rowKey(r) === rowKey(open)) ?? open)

  const go = (next: IsoDate): void => {
    setOpen(null)
    setParams(calendarParams(next), { replace: true })
  }

  const copyLastMonth = (): void => {
    const last = formatDate(addMonths(first, -1), money.locale, { month: 'long' })
    copy.mutate(month, {
      onSuccess: (filled) =>
        toast(
          filled === 0
            ? {
                title: 'Nothing to copy',
                description: `Rows with amounts in ${last} have something in them already.`
              }
            : {
                title: filled === 1 ? 'Copied 1 row' : `Copied ${filled} rows`,
                description: `Filled from ${last}. Rows that had something stayed as they were.`,
                variant: 'success'
              }
        ),
      onError: (error) =>
        toast({ title: 'Nothing copied', description: error.message, variant: 'error' })
    })
  }

  return (
    <>
      <PageHeader
        title="Month"
        description="Type what each row came to; the purchases behind it are optional."
      />

      <MonthNav month={first} onChange={go}>
        <Button
          variant="outline"
          onClick={copyLastMonth}
          disabled={copy.isPending || !sheet.data}
          title="Fill this month’s empty rows with last month’s amounts"
        >
          <CopyPlus />
          Copy from last month
        </Button>
      </MonthNav>

      {sheet.isError && (
        <Card className="max-w-3xl">
          <CardTitle>The month could not be loaded</CardTitle>
          <CardDescription className="mt-1">{sheet.error.message}</CardDescription>
        </Card>
      )}

      {sheet.data && (
        <div
          className={cn('max-w-5xl transition-opacity', sheet.isPlaceholderData && 'opacity-60')}
        >
          <MonthSummary
            summary={sheet.data.summary}
            overdueHint="Press Enter on its row to confirm it."
          />
          <MonthSheetView sheet={sheet.data} accounts={accounts} onOpenRow={setOpen} />
        </div>
      )}

      <RowPanel month={month} row={openRow} onClose={() => setOpen(null)} />
    </>
  )
}

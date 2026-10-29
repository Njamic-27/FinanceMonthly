import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CopyPlus } from 'lucide-react'
import { addMonths, formatDate, today, type IsoDate } from '@shared/dates'
import {
  monthKeyOf,
  summaryDate,
  type MonthLineType,
  type MonthRowRename,
  type MonthSheetRow
} from '@shared/month'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { AccountDialog } from '@renderer/features/accounts/AccountDialog'
import { useAccounts } from '@renderer/features/accounts/queries'
import { calendarParams, readCalendarMonth } from '@renderer/features/calendar/month'
import { MonthNav } from '@renderer/features/calendar/MonthNav'
import { BankLoanDialog } from '@renderer/features/loans/BankLoanDialog'
import { LoanDialog } from '@renderer/features/loans/LoanDialog'
import { AddRowDialog } from '@renderer/features/month/AddRowDialog'
import { canRename, rowKey, type AddChoice } from '@renderer/features/month/cells'
import { MonthHeader } from '@renderer/features/month/MonthHeader'
import { WaitingStrip } from '@renderer/features/month/WaitingStrip'
import { MonthSheetView } from '@renderer/features/month/MonthSheetView'
import { useCopyFromLastMonth, useMonthSheet } from '@renderer/features/month/queries'
import { RenameRowDialog } from '@renderer/features/month/RenameRowDialog'
import { RowPanel } from '@renderer/features/month/RowPanel'
import { RecurringDialog } from '@renderer/features/recurring/RecurringDialog'
import { GoalDialog } from '@renderer/features/savings/GoalDialog'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
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
  const goals = useSavingsGoals().data ?? []
  const copy = useCopyFromLastMonth()
  const [adding, setAdding] = useState<AddChoice | null>(null)
  const [renaming, setRenaming] = useState<MonthSheetRow | null>(null)

  // The open row is looked up again in fresh data, so its panel follows edits.
  const [open, setOpen] = useState<MonthSheetRow | null>(null)
  const rows = sheet.data?.sections.flatMap((s) => s.rows) ?? []
  const openRow = open && (rows.find((r) => rowKey(r) === rowKey(open)) ?? open)

  const go = (next: IsoDate): void => {
    setOpen(null)
    setParams(calendarParams(next), { replace: true })
  }

  /** "+" under a section: the dialog that adds that kind of row. */
  const add = (choice: AddChoice): void => {
    if (choice !== 'installments') {
      setAdding(choice)
      return
    }
    const card = accounts.find((a) => a.type === 'credit' && !a.isArchived)
    if (!card) {
      toast({ title: 'Add a card first', description: 'Installments are paid off on a card.' })
      setAdding('card')
      return
    }
    openTransactionDialog({
      kind: 'new',
      prefill: {
        type: 'expense',
        accountId: card.id,
        inInstallments: true,
        date: summaryDate(month, today())
      }
    })
  }
  const lineType: MonthLineType | null = adding === 'income' || adding === 'expense' ? adding : null
  const close = (): void => setAdding(null)

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
        <div className={cn('transition-opacity', sheet.isPlaceholderData && 'opacity-60')}>
          <MonthHeader month={first} summary={sheet.data.summary} />
          <WaitingStrip />
          <MonthSheetView
            sheet={sheet.data}
            accounts={accounts}
            onOpenRow={setOpen}
            onAdd={add}
            onRename={setRenaming}
          />
        </div>
      )}

      <RowPanel month={month} row={openRow} onClose={() => setOpen(null)} />
      <RenameRowDialog
        row={
          renaming && canRename(renaming)
            ? (renaming as MonthSheetRow & { kind: MonthRowRename['kind'] })
            : null
        }
        onClose={() => setRenaming(null)}
      />
      <AddRowDialog month={month} type={lineType} onClose={close} />
      <RecurringDialog
        target={adding === 'subscription' ? { kind: 'new', itemKind: 'subscription' } : null}
        onClose={close}
      />
      <AccountDialog
        target={adding === 'card' ? { kind: 'new', type: 'credit' } : null}
        accounts={accounts}
        onClose={close}
      />
      <BankLoanDialog open={adding === 'bank_loan'} loan={null} onClose={close} />
      <LoanDialog
        target={
          adding === 'borrowed' || adding === 'lent' ? { kind: 'new', loanKind: adding } : null
        }
        onClose={close}
      />
      <GoalDialog
        target={adding === 'goal' ? { kind: 'new' } : null}
        goals={goals}
        onClose={close}
      />
    </>
  )
}

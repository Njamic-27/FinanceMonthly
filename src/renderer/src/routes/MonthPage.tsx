import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CopyPlus } from 'lucide-react'
import { addMonths, formatDate, today, type IsoDate } from '@shared/dates'
import { monthKeyOf, summaryDate, type MonthRowRename, type MonthSheetRow } from '@shared/month'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { AccountDialog } from '@renderer/features/accounts/AccountDialog'
import { useAccounts } from '@renderer/features/accounts/queries'
import { calendarParams, readCalendarMonth } from '@renderer/features/calendar/month'
import { MonthNav } from '@renderer/features/calendar/MonthNav'
import { BankLoanDialog } from '@renderer/features/loans/BankLoanDialog'
import { LoanDialog } from '@renderer/features/loans/LoanDialog'
import { nextInstallment } from '@renderer/features/loans/installment'
import {
  PayInstallmentDialog,
  type PayInstallmentTarget
} from '@renderer/features/loans/PayInstallmentDialog'
import { useLoans } from '@renderer/features/loans/queries'
import {
  RepaymentDialog,
  type RepaymentDialogTarget
} from '@renderer/features/loans/RepaymentDialog'
import { AddLineDialog, type LineTarget } from '@renderer/features/month/AddLineDialog'
import type { AddAction } from '@renderer/features/month/addMenuEntries'
import { canRename, rowKey, type AddChoice } from '@renderer/features/month/cells'
import { CardDaysNotice } from '@renderer/features/month/CardDaysNotice'
import { MonthHeader } from '@renderer/features/month/MonthHeader'
import { WaitingStrip } from '@renderer/features/month/WaitingStrip'
import { MonthSheetView } from '@renderer/features/month/MonthSheetView'
import { useCopyFromLastMonth, useMonthSheet } from '@renderer/features/month/queries'
import { RenameRowDialog } from '@renderer/features/month/RenameRowDialog'
import { RowPanel } from '@renderer/features/month/RowPanel'
import { RecurringDialog } from '@renderer/features/recurring/RecurringDialog'
import { GoalDialog } from '@renderer/features/savings/GoalDialog'
import {
  MovementDialog,
  type MovementDialogTarget
} from '@renderer/features/savings/MovementDialog'
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
  // `?row=kind:id` (from a reminder or a planned payment) opens that row's panel too.
  const linkedRow = params.get('row')
  const linked =
    linkedRow && sheet.data?.month === month
      ? (rows.find((r) => rowKey(r) === linkedRow) ?? null)
      : null
  const shown = open ?? linked
  const openRow = shown && (rows.find((r) => rowKey(r) === rowKey(shown)) ?? shown)
  const closeRow = (): void => {
    setOpen(null)
    // Leaves the address, so Back doesn't open it again.
    if (linkedRow) setParams(calendarParams(first), { replace: true })
  }

  const go = (next: IsoDate): void => {
    setOpen(null)
    setParams(calendarParams(next), { replace: true })
  }

  const loans = useLoans().data ?? []
  const [line, setLine] = useState<LineTarget | null>(null)
  const [paying, setPaying] = useState<PayInstallmentTarget | null>(null)
  const [repaying, setRepaying] = useState<RepaymentDialogTarget | null>(null)
  const [moving, setMoving] = useState<MovementDialogTarget | null>(null)
  const date = summaryDate(month, today())
  const payFrom = accounts.find((a) => a.type !== 'credit' && !a.isArchived)

  /** A dialog that adds something new: buying in installments needs a card first. */
  const openNew = (choice: AddChoice): void => {
    if (choice === 'transfer') {
      openTransactionDialog({ kind: 'new', prefill: { type: 'transfer', date } })
      return
    }
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
      prefill: { type: 'expense', accountId: card.id, inInstallments: true, date }
    })
  }

  /** What "+" picked, opened right here on Month. */
  const add = (action: AddAction): void => {
    switch (action.kind) {
      case 'line':
        setLine(action)
        return
      case 'open':
        openNew(action.choice)
        return
      case 'pay_card':
        openTransactionDialog({
          kind: 'new',
          prefill: { type: 'transfer', accountId: payFrom?.id, toAccountId: action.accountId, date }
        })
        return
      case 'loan': {
        const loan = loans.find((l) => l.id === action.loanId)
        if (!loan) return
        if (loan.kind !== 'bank_loan') {
          setRepaying({ kind: 'new', loan })
          return
        }
        const next = nextInstallment(loan)
        if (next) setPaying(next)
        else toast({ title: `${loan.title} has no installment left to pay` })
        return
      }
      case 'savings': {
        const goal = goals.find((g) => g.id === action.goalId)
        if (goal) setMoving({ kind: 'new', goal, type: action.movement })
      }
    }
  }
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
          <MonthHeader month={first} summary={sheet.data.summary} totals={sheet.data.totals} />
          <CardDaysNotice />
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

      <RowPanel month={month} row={openRow} onClose={closeRow} onRename={setRenaming} />
      <RenameRowDialog
        row={
          renaming && canRename(renaming)
            ? (renaming as MonthSheetRow & { kind: MonthRowRename['kind'] })
            : null
        }
        onClose={() => setRenaming(null)}
      />
      <AddLineDialog month={month} target={line} onClose={() => setLine(null)} />
      <PayInstallmentDialog target={paying} onClose={() => setPaying(null)} />
      <RepaymentDialog target={repaying} onClose={() => setRepaying(null)} />
      <MovementDialog target={moving} onClose={() => setMoving(null)} />
      <RecurringDialog
        target={adding === 'subscription' ? { kind: 'new', itemKind: 'subscription' } : null}
        onClose={close}
      />
      <AccountDialog
        target={
          adding === 'card'
            ? { kind: 'new', type: 'credit' }
            : adding === 'account'
              ? { kind: 'new' }
              : null
        }
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

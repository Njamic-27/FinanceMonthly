import { useEffect, useRef, useState } from 'react'
import type { Account } from '@shared/accounts'
import type { Cents } from '@shared/money'
import type {
  MonthCellInput,
  MonthKey,
  MonthSheet,
  MonthSheetRow,
  MonthSheetSection
} from '@shared/month'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card } from '@renderer/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { useCurrency, type CurrencyTools } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  cellValue,
  editStart,
  lockedReason,
  needsSaving,
  rowKey,
  rowNote,
  savingValue,
  sectionEmpty,
  sectionNotes,
  sectionTitles
} from './cells'
import { useSetMonthCell, useSetMonthRowAccount } from './queries'

/** A cell being typed into. */
interface Editing {
  key: string
  text: string
  /** Select the text on focus (opened with Enter or a click, not by typing over it). */
  select: boolean
  error?: string
}

/** Keys that start typing over a cell, as in a spreadsheet. */
const TYPING = /^[\d.,\-−]$/

const signed = (row: MonthSheetRow): boolean => row.kind === 'loan'

function formatCell(row: MonthSheetRow, amount: Cents, money: CurrencyTools): string {
  return signed(row) ? money.format(amount, 'exceptZero') : money.format(amount)
}

/** The Account column: which account the row's new amounts use. */
function AccountCell({
  row,
  accounts,
  value,
  onChange
}: {
  row: MonthSheetRow
  accounts: Account[]
  value: number | null
  onChange: (accountId: number) => void
}): React.JSX.Element {
  const current = accounts.find((a) => a.id === value)
  if (!row.editable) {
    return current ? (
      <span className="flex items-center gap-2 px-3 text-sm text-ink-muted">
        <ColorChip color={current.color} icon={accountTypeIcons[current.type]} size="sm" />
        <span className="truncate">{current.name}</span>
      </span>
    ) : (
      <span />
    )
  }
  // A card is paid from another account, never from itself.
  const options = accounts.filter(
    (a) => !a.isArchived && !(row.kind === 'card_payment' && a.id === row.sourceId)
  )
  return (
    <Select value={value === null ? '' : String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger
        aria-label={`Account for ${row.title}`}
        className="h-9 border-transparent bg-transparent text-sm hover:border-line"
      >
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        {options.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            <span className="flex items-center gap-2">
              <ColorChip color={a.color} icon={accountTypeIcons[a.type]} size="sm" />
              {a.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface SheetRowProps {
  row: MonthSheetRow
  /** In the Income section: amounts in the income colour. */
  isIncome: boolean
  accounts: Account[]
  accountId: number | null
  editing: Editing | null
  /** The amount being saved, shown until the sheet catches up. */
  saving: Cents | undefined
  cellRef: (element: HTMLElement | null) => void
  onOpen: () => void
  onAccount: (accountId: number) => void
  onCellKey: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  onCellClick: () => void
  onInputKey: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onInputChange: (text: string) => void
  onInputBlur: () => void
}

function SheetRow({
  row,
  isIncome,
  accounts,
  accountId,
  editing,
  saving,
  cellRef,
  onOpen,
  onAccount,
  onCellKey,
  onCellClick,
  onInputKey,
  onInputChange,
  onInputBlur
}: SheetRowProps): React.JSX.Element {
  const money = useCurrency()
  const note = rowNote(row)
  const locked = lockedReason(row)
  const shown =
    saving === undefined ? cellValue(row) : { amount: savingValue(row, saving), planned: false }
  const extraPlanned = !shown.planned && row.planned !== 0 && saving === undefined
  const label = [
    row.title,
    shown.amount === 0 && !shown.planned ? 'nothing yet' : formatCell(row, shown.amount, money),
    shown.planned && (row.overdue ? 'planned, overdue' : 'planned'),
    locked ?? 'press Enter to change'
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <tr className="border-t border-line first:border-t-0">
      <td className="py-1 pr-2">
        <button
          type="button"
          onClick={onOpen}
          className="group flex max-w-full min-w-0 cursor-pointer items-baseline gap-2 rounded-control px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="truncate font-semibold group-hover:text-primary">{row.title}</span>
          {note && (
            <span className={cn('shrink-0 text-sm text-ink-muted', row.overdue && 'text-expense')}>
              {note}
            </span>
          )}
        </button>
      </td>
      <td className="py-1 pr-2">
        <AccountCell row={row} accounts={accounts} value={accountId} onChange={onAccount} />
      </td>
      <td className="py-1">
        {editing ? (
          <input
            ref={(element) => {
              cellRef(element)
              if (element && document.activeElement !== element) {
                element.focus()
                if (editing.select) element.select()
              }
            }}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`Amount for ${row.title}`}
            aria-invalid={editing.error ? true : undefined}
            title={editing.error}
            value={editing.text}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onInputKey}
            onBlur={onInputBlur}
            className="amount h-9 w-full rounded-control border border-primary bg-surface px-2.5 text-right font-semibold text-ink outline-2 -outline-offset-1 outline-primary aria-invalid:border-expense aria-invalid:outline-expense"
          />
        ) : (
          <button
            ref={cellRef}
            type="button"
            aria-label={label}
            title={locked ?? undefined}
            onKeyDown={onCellKey}
            onClick={onCellClick}
            className={cn(
              'flex min-h-9 w-full flex-col items-end justify-center rounded-control px-2.5 py-1 text-right transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
              row.editable ? 'cursor-text hover:bg-surface-2' : 'cursor-default'
            )}
          >
            {shown.planned ? (
              <span
                className={cn(
                  'amount rounded-full border border-dashed px-2 leading-6',
                  row.overdue
                    ? 'border-expense/40 bg-expense-soft font-semibold text-expense'
                    : 'border-ink-muted/40 text-ink-muted'
                )}
              >
                {formatCell(row, shown.amount, money)}
              </span>
            ) : shown.amount === 0 && row.count === 0 ? (
              <span className="text-ink-muted/60" aria-hidden>
                –
              </span>
            ) : (
              <span
                className={cn(
                  'amount font-semibold',
                  isIncome && 'text-income',
                  saving !== undefined && 'opacity-60'
                )}
              >
                {formatCell(row, shown.amount, money)}
              </span>
            )}
            {extraPlanned && (
              <span className="text-xs text-ink-muted">
                {formatCell(row, row.planned, money)} planned
              </span>
            )}
          </button>
        )}
      </td>
    </tr>
  )
}

function SectionTotal({ section }: { section: MonthSheetSection }): React.JSX.Element {
  const money = useCurrency()
  const isSigned = section.key === 'loans'
  const format = (cents: Cents): string =>
    isSigned ? money.format(cents, 'exceptZero') : money.format(cents)
  return (
    <p className="text-right">
      <span
        className={cn('amount text-lg font-semibold', section.key === 'income' && 'text-income')}
      >
        {format(section.actual + section.planned)}
      </span>
      {section.planned !== 0 && (
        <span className="block text-sm text-ink-muted">
          {section.actual !== 0
            ? `${format(section.actual)} recorded · ${format(section.planned)} planned`
            : 'Planned'}
        </span>
      )}
    </p>
  )
}

/**
 * The month's sections as a spreadsheet: click an amount or press Enter to type, Enter or Tab
 * saves and moves to the next row (Shift+Tab back), Esc cancels, arrows move between rows.
 */
export function MonthSheetView({
  sheet,
  accounts,
  onOpenRow
}: {
  sheet: MonthSheet
  accounts: Account[]
  onOpenRow: (row: MonthSheetRow) => void
}): React.JSX.Element {
  const money = useCurrency()
  const month: MonthKey = sheet.month
  const rows = sheet.sections.flatMap((s) => s.rows)
  const keys = rows.map(rowKey)

  const [editing, setEditingState] = useState<Editing | null>(null)
  // Mirrors `editing` at once, so a blur after Enter doesn't save the cell a second time.
  const editingRef = useRef<Editing | null>(null)
  const setEditing = (next: Editing | null): void => {
    editingRef.current = next
    setEditingState(next)
  }

  const [saving, setSaving] = useState<Map<string, Cents>>(() => new Map())
  // Accounts picked for this month's rows that don't remember one (only categories do).
  const [picked, setPicked] = useState<{ month: MonthKey; ids: Map<string, number> }>({
    month,
    ids: new Map()
  })
  const pickedIds = picked.month === month ? picked.ids : new Map<string, number>()

  const cells = useRef(new Map<string, HTMLElement>())
  const [focusRequest, setFocusRequest] = useState<{ key: string } | null>(null)
  useEffect(() => {
    if (focusRequest) cells.current.get(focusRequest.key)?.focus()
  }, [focusRequest])
  const focusCell = (key: string): void => setFocusRequest({ key })

  const step = (key: string, by: 1 | -1): void => {
    const next = keys[keys.indexOf(key) + by]
    focusCell(next ?? key)
  }

  const setCell = useSetMonthCell((input, error) => {
    const key = rowKey(input)
    setSaving((current) => {
      const next = new Map(current)
      next.delete(key)
      return next
    })
    if (error) toast({ title: 'Not saved', description: error.message, variant: 'error' })
  })
  const setAccount = useSetMonthRowAccount()

  const accountOf = (row: MonthSheetRow): number | null =>
    pickedIds.get(rowKey(row)) ?? row.accountId

  const startEditing = (row: MonthSheetRow, typed?: string): void => {
    if (!row.editable) return
    const start = editStart(row)
    setEditing({
      key: rowKey(row),
      text: typed ?? (start === null ? '' : money.toInput(start)),
      select: typed === undefined
    })
  }

  /** Saves what's typed; false (and the cell stays open) when it isn't an amount. */
  const commit = (row: MonthSheetRow): boolean => {
    const current = editingRef.current
    if (current?.key !== rowKey(row)) return true
    const text = current.text.trim()
    const amount = text === '' ? 0 : money.parse(text)
    if (amount === null || amount < 0) {
      setEditing({
        ...current,
        error: amount === null ? 'Enter an amount, like 120 or 45.50' : 'Enter 0 or more'
      })
      return false
    }
    setEditing(null)
    if (!needsSaving(row, amount)) return true
    const input: MonthCellInput = {
      month,
      kind: row.kind,
      sourceId: row.sourceId,
      amount,
      accountId: row.kind === 'category' ? undefined : (pickedIds.get(rowKey(row)) ?? undefined)
    }
    setSaving((m) => new Map(m).set(rowKey(row), amount))
    setCell.mutate(input)
    return true
  }

  const onCellKey = (row: MonthSheetRow, event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const key = rowKey(row)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      step(key, event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault()
      if (row.editable) startEditing(row)
      else onOpenRow(row)
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      startEditing(row, '')
    } else if (TYPING.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault()
      startEditing(row, event.key)
    }
  }

  const onInputKey = (row: MonthSheetRow, event: React.KeyboardEvent<HTMLInputElement>): void => {
    const key = rowKey(row)
    const moves: Record<string, 1 | -1 | undefined> = {
      Enter: 1,
      Tab: event.shiftKey ? -1 : 1,
      ArrowDown: 1,
      ArrowUp: -1
    }
    const by = moves[event.key]
    if (by !== undefined) {
      event.preventDefault()
      if (commit(row)) step(key, by)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      // Esc closes the field, not the screen's dialogs.
      event.stopPropagation()
      setEditing(null)
      focusCell(key)
    }
  }

  const onInputBlur = (row: MonthSheetRow): void => {
    // Clicking away saves, as in a spreadsheet; something that isn't an amount is dropped.
    if (!commit(row)) {
      toast({ title: 'Not saved', description: 'That isn’t an amount.', variant: 'error' })
      setEditing(null)
    }
  }

  const onAccount = (row: MonthSheetRow, accountId: number): void => {
    if (row.kind !== 'category') {
      setPicked({ month, ids: new Map(pickedIds).set(rowKey(row), accountId) })
    }
    setAccount.mutate(
      { month, kind: row.kind, sourceId: row.sourceId, accountId },
      {
        onError: (error) =>
          toast({ title: 'Account not changed', description: error.message, variant: 'error' })
      }
    )
  }

  return (
    <div className="grid gap-4">
      {sheet.sections.map((section) => {
        const titleId = `month-section-${section.key}`
        return (
          <Card key={section.key} className="p-0" aria-labelledby={titleId}>
            <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
              <div className="min-w-0">
                <h3 id={titleId} className="text-lg font-semibold">
                  {sectionTitles[section.key]}
                </h3>
                {sectionNotes[section.key] && (
                  <p className="text-sm text-ink-muted">{sectionNotes[section.key]}</p>
                )}
              </div>
              {section.rows.length > 0 && <SectionTotal section={section} />}
            </header>
            {section.rows.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-muted">{sectionEmpty[section.key]}</p>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col />
                  <col className="w-56" />
                  <col className="w-44" />
                </colgroup>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Account</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody className="[&>tr>td:first-child]:pl-3 [&>tr>td:last-child]:pr-3">
                  {section.rows.map((row) => {
                    const key = rowKey(row)
                    return (
                      <SheetRow
                        key={key}
                        row={row}
                        isIncome={section.key === 'income'}
                        accounts={accounts}
                        accountId={accountOf(row)}
                        editing={editing?.key === key ? editing : null}
                        saving={saving.get(key)}
                        cellRef={(element) => {
                          if (element) cells.current.set(key, element)
                          else cells.current.delete(key)
                        }}
                        onOpen={() => onOpenRow(row)}
                        onAccount={(accountId) => onAccount(row, accountId)}
                        onCellKey={(event) => onCellKey(row, event)}
                        onCellClick={() => startEditing(row)}
                        onInputKey={(event) => onInputKey(row, event)}
                        onInputChange={(text) =>
                          editing && setEditing({ ...editing, text, error: undefined })
                        }
                        onInputBlur={() => onInputBlur(row)}
                      />
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        )
      })}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus
} from 'lucide-react'
import type { Account } from '@shared/accounts'
import type { Cents } from '@shared/money'
import type {
  MonthCellInput,
  MonthKey,
  MonthLineType,
  MonthSectionKey,
  MonthSheet,
  MonthSheetRow,
  MonthSheetSection
} from '@shared/month'
import { ColorChip } from '@renderer/components/ColorChip'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@renderer/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { useSettings } from '@renderer/features/settings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { accountPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import {
  canRename,
  cellValue,
  editStart,
  isCategoryRow,
  lockedReason,
  expenseGroups,
  moveCategory,
  needsSaving,
  monthNet,
  rowKey,
  rowNote,
  savingValue,
  sectionAdds,
  sectionEmpty,
  sectionNotes,
  sectionTitles,
  sheetAmount,
  type AddChoice
} from './cells'
import {
  useHideMonthRow,
  useReorderMonthRows,
  useSetMonthCell,
  useSetMonthRowAccount
} from './queries'

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

/** The category sections a row can be moved within, by category type. */
const lineTypes: Partial<Record<MonthSectionKey, MonthLineType>> = {
  income: 'income',
  expenses: 'expense'
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
      <span className="block truncate px-2 text-sm text-ink-muted">
        <Link to={accountPath(current.id)} className="link">
          {current.name}
        </Link>
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
        className="h-9 border-transparent bg-transparent px-2 text-sm hover:border-line"
      >
        {/* Just the name: the column is narrow. */}
        <SelectValue placeholder="Choose…">{current?.name}</SelectValue>
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

/** What a row's menu can do; absent entries aren't offered. */
interface RowActions {
  rename?: () => void
  moveUp?: () => void
  moveDown?: () => void
  hide?: () => void
}

function RowMenu({ title, actions }: { title: string; actions: RowActions }): React.JSX.Element {
  const items = [
    { key: 'rename', label: 'Rename…', icon: Pencil, run: actions.rename },
    { key: 'up', label: 'Move up', icon: ArrowUp, run: actions.moveUp },
    { key: 'down', label: 'Move down', icon: ArrowDown, run: actions.moveDown },
    { key: 'hide', label: 'Hide from the sheet', icon: EyeOff, run: actions.hide }
  ].filter((item) => item.run)
  if (items.length === 0) return <span className="size-8 shrink-0" />
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`More for ${title}`}
        title="More"
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted opacity-0 transition group-hover/row:opacity-100 group-focus-within/row:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary data-[state=open]:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-52 gap-0.5 p-1">
        {items.map(({ key, label, icon: Icon, run }) => (
          <PopoverClose
            key={key}
            onClick={run}
            className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[0.4rem] px-2.5 text-left text-body hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
          >
            <Icon className="size-4 text-ink-muted" />
            {label}
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** Where a dragged row would land: before or after this one. */
type DropMark = 'before' | 'after' | null

interface SheetRowProps {
  row: MonthSheetRow
  section: MonthSectionKey
  accounts: Account[]
  accountId: number | null
  editing: Editing | null
  /** The amount being saved, shown until the sheet catches up. */
  saving: Cents | undefined
  actions: RowActions
  /** Category rows can be dragged within their section. */
  drag: {
    draggable: boolean
    mark: DropMark
    onStart: (event: React.DragEvent) => void
    onOver: (event: React.DragEvent<HTMLTableRowElement>) => void
    onDrop: (event: React.DragEvent) => void
    onEnd: () => void
  }
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
  section,
  accounts,
  accountId,
  editing,
  saving,
  actions,
  drag,
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
  // A card's row also says how much of the month's spending is on it.
  const byBill = useSettings().data?.cardSpendingMonth !== 'purchase'
  const onBill = !row.onBill
    ? null
    : row.onBill > 0
      ? `${money.format(row.onBill)} ${byBill ? 'on this month’s bill' : 'spent on it this month'}`
      : `${money.format(-row.onBill)} in refunds ${byBill ? 'on this month’s bill' : 'this month'}`
  const note = [rowNote(row), onBill].filter(Boolean).join(' · ') || null
  const locked = lockedReason(row)
  const shown =
    saving === undefined ? cellValue(row) : { amount: savingValue(row, saving), planned: false }
  const extraPlanned = !shown.planned && row.planned !== 0 && saving === undefined
  const format = (amount: Cents): string => formatSheet(money, section, amount)
  const comesIn = section === 'income' || sheetAmount(section, shown.amount).plus
  const label = [
    row.title,
    shown.amount === 0 && !shown.planned ? 'nothing yet' : format(shown.amount),
    shown.planned && (row.overdue ? 'planned, overdue' : 'planned'),
    locked ?? 'press Enter to change'
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <tr
      draggable={drag.draggable && !editing}
      onDragStart={drag.onStart}
      onDragOver={drag.onOver}
      onDrop={drag.onDrop}
      onDragEnd={drag.onEnd}
      className={cn(
        'group/row border-t border-line first:border-t-0',
        drag.mark === 'before' && 'shadow-[inset_0_2px_0_var(--primary)]',
        drag.mark === 'after' && 'shadow-[inset_0_-2px_0_var(--primary)]'
      )}
    >
      <td className="py-1 pr-1">
        <div className="flex min-w-0 items-center">
          {drag.draggable ? (
            <GripVertical
              className="size-4 shrink-0 cursor-grab text-ink-muted/50 group-hover/row:text-ink-muted"
              aria-hidden
            />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button
            type="button"
            onClick={onOpen}
            title={row.title}
            className="group grid max-w-full min-w-0 cursor-pointer rounded-control px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="truncate font-semibold underline-offset-[0.2em] group-hover:text-primary group-hover:underline">
              {row.title}
            </span>
            {note && (
              <span
                className={cn('truncate text-xs text-ink-muted', row.overdue && 'text-expense')}
              >
                {note}
              </span>
            )}
          </button>
          <span className="ml-auto">
            <RowMenu title={row.title} actions={actions} />
          </span>
        </div>
      </td>
      <td className="py-1 pr-1">
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
                {format(shown.amount)}
              </span>
            ) : shown.amount === 0 && row.count === 0 ? (
              <span className="text-ink-muted/60" aria-hidden>
                –
              </span>
            ) : (
              <span
                className={cn(
                  'amount font-semibold',
                  comesIn && 'text-income',
                  saving !== undefined && 'opacity-60'
                )}
              >
                {format(shown.amount)}
              </span>
            )}
            {extraPlanned && (
              <span className="text-xs text-ink-muted">{format(row.planned)} planned</span>
            )}
          </button>
        )}
      </td>
    </tr>
  )
}

/** An amount as the sheet reads it: plain, or "+" for money coming in under Expenses. */
function formatSheet(
  money: ReturnType<typeof useCurrency>,
  section: MonthSectionKey,
  amount: Cents
): string {
  const { value, plus } = sheetAmount(section, amount)
  return money.format(value, plus ? 'always' : 'auto')
}

function SectionTotal({ section }: { section: MonthSheetSection }): React.JSX.Element {
  const money = useCurrency()
  const format = (cents: Cents): string => formatSheet(money, section.key, cents)
  const total = section.actual + section.planned
  return (
    <p className="shrink-0 text-right">
      <span
        className={cn(
          'amount text-lg font-semibold whitespace-nowrap',
          (section.key === 'income' || sheetAmount(section.key, total).plus) && 'text-income'
        )}
      >
        {format(total)}
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

/** "Income" or "Expenses" over its rows, with the month's total. */
function SheetHeading({
  id,
  title,
  total,
  income = false,
  note
}: {
  id: string
  title: string
  total: Cents
  income?: boolean
  note?: string
}): React.JSX.Element {
  const money = useCurrency()
  return (
    <header className="flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        <h2 id={id} className="text-title font-bold">
          {title}
        </h2>
        {note && <p className="text-sm text-ink-muted">{note}</p>}
      </div>
      <span className={cn('amount shrink-0 text-title', income && 'text-income')}>
        {money.format(total)}
      </span>
    </header>
  )
}

/** "+" under a section: one button, or a short menu when there's more than one thing to add. */
function AddButton({
  label,
  choices,
  onAdd
}: {
  label: string
  choices: (typeof sectionAdds)[MonthSectionKey]['choices']
  onAdd: (choice: AddChoice) => void
}): React.JSX.Element {
  if (choices.length === 1) {
    return (
      <Button variant="ghost" size="sm" onClick={() => onAdd(choices[0].choice)}>
        <Plus />
        {label}
      </Button>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-0.5 p-1">
        {choices.map(({ choice, label: name, description }) => (
          <PopoverClose
            key={choice}
            onClick={() => onAdd(choice)}
            className="grid cursor-pointer gap-0.5 rounded-[0.4rem] px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
          >
            <span className="font-semibold">{name}</span>
            {description && <span className="text-sm text-ink-muted">{description}</span>}
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The month as a spreadsheet in one column: Income, a divider, then Expenses in groups (groups
 * with nothing this month are left out, their "+" gathered at the end). Click an amount or press
 * Enter to type; Enter or Tab saves and moves to the next row (Shift+Tab back), Esc cancels,
 * arrows move between rows. Category rows can be renamed, hidden and dragged into order.
 */
export function MonthSheetView({
  sheet,
  accounts,
  onOpenRow,
  onAdd,
  onRename
}: {
  sheet: MonthSheet
  accounts: Account[]
  onOpenRow: (row: MonthSheetRow) => void
  onAdd: (choice: AddChoice) => void
  onRename: (row: MonthSheetRow) => void
}): React.JSX.Element {
  const money = useCurrency()
  const month: MonthKey = sheet.month

  // A new order shows at once, while it's saved.
  const [order, setOrder] = useState<{ section: MonthSectionKey; ids: number[] } | null>(null)
  const sections = sheet.sections.map((section) => {
    if (order?.section !== section.key) return section
    const position = (row: MonthSheetRow): number =>
      isCategoryRow(row) ? order.ids.indexOf(row.sourceId) : Number.MAX_SAFE_INTEGER
    return { ...section, rows: [...section.rows].sort((a, b) => position(a) - position(b)) }
  })
  const income = sections.filter((s) => s.key === 'income')
  // Everyday spending always shows, so there's somewhere to add to; empty groups don't.
  const groups = expenseGroups.flatMap((key) =>
    sections.filter((s) => s.key === key && (s.rows.length > 0 || key === 'expenses'))
  )
  const otherAdds = expenseGroups
    .filter((key) => !groups.some((g) => g.key === key))
    .flatMap((key) => sectionAdds[key].choices)
  // Arrows and Enter move down the one column.
  const keys = [...income, ...groups].flatMap((s) => s.rows.map(rowKey))

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
  const hideRow = useHideMonthRow()
  const reorder = useReorderMonthRows()

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

  /** Saves a section's category rows in a new order. */
  const saveOrder = (section: MonthSectionKey, ids: number[]): void => {
    const type = lineTypes[section]
    if (!type) return
    setOrder({ section, ids })
    reorder.mutate(
      { type, categoryIds: ids },
      {
        onError: (error) =>
          toast({ title: 'Order not saved', description: error.message, variant: 'error' }),
        onSettled: () => setOrder(null)
      }
    )
  }

  const hide = (row: MonthSheetRow): void =>
    hideRow.mutate(
      { categoryId: row.sourceId, hidden: true },
      {
        onSuccess: () =>
          toast({
            title: `${row.title} hidden`,
            description:
              row.count > 0
                ? 'It still shows in months with its transactions, like this one.'
                : 'It still shows in months with its transactions. Add it again with “+”.'
          }),
        onError: (error) =>
          toast({ title: 'Not hidden', description: error.message, variant: 'error' })
      }
    )

  // Dragging a category row within its section.
  const [dragging, setDragging] = useState<{ section: MonthSectionKey; id: number } | null>(null)
  const [drop, setDrop] = useState<{ id: number; mark: 'before' | 'after' } | null>(null)
  const endDrag = (): void => {
    setDragging(null)
    setDrop(null)
  }

  const renderSection = (section: MonthSheetSection): React.JSX.Element => {
    const titleId = `month-section-${section.key}`
    const movable = lineTypes[section.key] !== undefined
    const categoryIds = section.rows.filter(isCategoryRow).map((r) => r.sourceId)

    const isIncome = section.key === 'income'

    return (
      <Card
        key={section.key}
        className={cn('p-0', isIncome && 'pt-2')}
        aria-labelledby={isIncome ? 'month-income' : titleId}
      >
        <header
          className={cn(
            'flex items-start justify-between gap-4 px-5 pt-4 pb-2',
            isIncome && 'sr-only'
          )}
        >
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
          <p className={cn('px-5 pb-2 text-sm text-ink-muted', isIncome && 'pt-2')}>
            {sectionEmpty[section.key]}
          </p>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col />
              <col className="w-32" />
              <col className="w-32" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Account</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td:first-child]:pl-1.5 [&>tr>td:last-child]:pr-3">
              {section.rows.map((row) => {
                const key = rowKey(row)
                const isCategory = movable && isCategoryRow(row)
                const index = categoryIds.indexOf(row.sourceId)
                const actions: RowActions = {
                  rename: canRename(row) ? () => onRename(row) : undefined,
                  moveUp:
                    isCategory && index > 0
                      ? () =>
                          saveOrder(section.key, moveCategory(categoryIds, row.sourceId, index - 1))
                      : undefined,
                  moveDown:
                    isCategory && index < categoryIds.length - 1
                      ? () =>
                          saveOrder(section.key, moveCategory(categoryIds, row.sourceId, index + 1))
                      : undefined,
                  hide: isCategory ? () => hide(row) : undefined
                }
                const canDrop =
                  isCategory && dragging?.section === section.key && dragging.id !== row.sourceId
                return (
                  <SheetRow
                    key={key}
                    row={row}
                    section={section.key}
                    accounts={accounts}
                    accountId={accountOf(row)}
                    editing={editing?.key === key ? editing : null}
                    saving={saving.get(key)}
                    actions={actions}
                    drag={{
                      draggable: isCategory,
                      mark: canDrop && drop?.id === row.sourceId ? drop.mark : null,
                      onStart: (event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', row.title)
                        setDragging({ section: section.key, id: row.sourceId })
                      },
                      onOver: (event) => {
                        if (!canDrop) return
                        event.preventDefault()
                        const box = event.currentTarget.getBoundingClientRect()
                        const mark = event.clientY < box.top + box.height / 2 ? 'before' : 'after'
                        if (drop?.id !== row.sourceId || drop.mark !== mark) {
                          setDrop({ id: row.sourceId, mark })
                        }
                      },
                      onDrop: (event) => {
                        if (!canDrop || !dragging || !drop) return
                        event.preventDefault()
                        const rest = categoryIds.filter((id) => id !== dragging.id)
                        const to = rest.indexOf(row.sourceId) + (drop.mark === 'after' ? 1 : 0)
                        saveOrder(section.key, moveCategory(categoryIds, dragging.id, to))
                        endDrag()
                      },
                      onEnd: endDrag
                    }}
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
        <div className="border-t border-line px-3 py-2">
          <AddButton {...sectionAdds[section.key]} onAdd={onAdd} />
        </div>
      </Card>
    )
  }

  const totals = monthNet(sheet.summary)

  return (
    <div className="max-w-4xl">
      <section aria-labelledby="month-income" className="grid gap-3">
        <SheetHeading id="month-income" title="Income" total={totals.income} income />
        {income.map(renderSection)}
      </section>

      {/* A clear line between what comes in and what goes out. */}
      <hr className="my-10 border-t-2 border-line" />

      <section aria-labelledby="month-expenses" className="grid gap-4">
        <SheetHeading
          id="month-expenses"
          title="Expenses"
          total={totals.expenses}
          note="Spending this month. Card payments, loans and savings move money: they’re in your balance, not in this total."
        />
        {groups.map(renderSection)}
        {otherAdds.length > 0 && (
          <div>
            <AddButton label="Add something else" choices={otherAdds} onAdd={onAdd} />
          </div>
        )}
      </section>
    </div>
  )
}

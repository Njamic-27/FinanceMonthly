import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCategories } from '@renderer/features/categories/queries'
import { useLoans } from '@renderer/features/loans/queries'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import type { MessageKey } from '@shared/i18n'
import { addGroupLabel, addMenu, type AddAction, type AddGroupKey } from './addMenuEntries'
import { t } from '@renderer/lib/i18n'

const placeholders: Record<AddGroupKey, MessageKey> = {
  subscriptions: 'add.placeholderSubscription',
  bills: 'add.placeholderBill',
  everyday: 'add.placeholderCategory',
  loans: 'add.placeholderLoan',
  savings: 'add.placeholderGoal'
}

/**
 * "+" on Income or Expenses: a search box over your categories (or a new one by name). Under
 * Expenses, first a group, then what's in it (PLAN.md step 51); typing at the top searches all
 * of them. Type to filter, arrows to move, Enter to pick, Backspace in an empty box goes back.
 */
export function AddMenu({
  section,
  onAction
}: {
  section: 'income' | 'expenses'
  onAction: (action: AddAction) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<AddGroupKey | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const categories = useCategories().data ?? []
  const accounts = useAccounts().data ?? []
  const loans = useLoans().data ?? []
  const goals = useSavingsGoals().data ?? []

  const groups = addMenu(
    section,
    query,
    {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        group: c.group,
        isArchived: c.isArchived
      })),
      cards: accounts.filter((a) => a.type === 'credit' && !a.isArchived),
      loans: loans.filter((l) => l.status === 'active'),
      goals: goals.filter((g) => !g.isArchived)
    },
    group
  )
  const first = groups[0]?.entries[0]

  const show = (next: AddGroupKey | null): void => {
    setGroup(next)
    setQuery('')
    search.current?.focus()
  }

  const pick = (action: AddAction): void => {
    if (action.kind === 'group') {
      show(action.group)
      return
    }
    setOpen(false)
    setQuery('')
    setGroup(null)
    onAction(action)
  }

  /** Arrow keys move between the entries (and back up to the search box). */
  const move = (event: React.KeyboardEvent, from: number): void => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[data-add-entry]') ?? [])]
    const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (by === 0) return
    event.preventDefault()
    const next = from + by
    if (next < 0) list.current?.parentElement?.querySelector('input')?.focus()
    else items[Math.min(next, items.length - 1)]?.focus()
  }

  // Each group's first entry's place in the whole list, for the arrow keys.
  const starts = groups.map((_, i) =>
    groups.slice(0, i).reduce((sum, g) => sum + g.entries.length, 0)
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery('')
          setGroup(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus />
          {section === 'income' ? t('month.addIncome') : t('month.addExpense')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex max-h-[min(32rem,70vh)] w-80 flex-col p-0">
        {group && (
          <button
            type="button"
            onClick={() => show(null)}
            className="flex cursor-pointer items-center gap-1 border-b border-line px-2 py-2 text-left text-sm font-semibold hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
          >
            <ChevronLeft className="size-4 text-ink-muted" aria-hidden />
            <span className="sr-only">{t('add.backToGroups')} </span>
            {addGroupLabel(group)}
          </button>
        )}
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <input
            ref={search}
            autoFocus
            value={query}
            aria-label={
              section === 'income'
                ? t('add.searchIncome')
                : group
                  ? t('add.searchIn', { group: addGroupLabel(group) })
                  : t('add.search')
            }
            placeholder={
              section === 'income'
                ? t('add.placeholderCategory')
                : group
                  ? t(placeholders[group])
                  : t('add.placeholderTop')
            }
            className="h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted/70"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && first) {
                event.preventDefault()
                pick(first.action)
              } else if (event.key === 'Backspace' && query === '' && group) {
                event.preventDefault()
                show(null)
              } else move(event, -1)
            }}
          />
        </div>
        <div ref={list} className="min-h-0 overflow-y-auto p-1">
          {groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-muted">{t('add.nothingMatches', { query })}</p>
          )}
          {groups.map((group, g) => (
            <div key={group.heading} role="group" aria-label={group.heading} className="py-1">
              <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-ink-muted">
                {group.heading}
              </p>
              {group.entries.map((entry, e) => {
                const at = starts[g] + e
                return (
                  <button
                    key={entry.key}
                    type="button"
                    data-add-entry
                    onClick={() => pick(entry.action)}
                    onKeyDown={(event) => move(event, at)}
                    className="grid w-full cursor-pointer gap-0.5 rounded-[0.4rem] px-3 py-1.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-semibold">{entry.label}</span>
                      {entry.action.kind === 'group' && (
                        <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                      )}
                    </span>
                    {entry.description && (
                      <span className="truncate text-sm text-ink-muted">{entry.description}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

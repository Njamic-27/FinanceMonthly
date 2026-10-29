import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import type { Account } from '@shared/accounts'
import { Button } from '@renderer/components/ui/button'
import { AccountDialog } from '@renderer/features/accounts/AccountDialog'
import { useAccounts } from '@renderer/features/accounts/queries'

/**
 * Asks for the statement and due days of cards that don't have them: without both, their
 * spending counts in the month of purchase instead of the month the card is paid.
 */
export function CardDaysNotice(): React.JSX.Element | null {
  const accounts = useAccounts().data ?? []
  const [editing, setEditing] = useState<Account | null>(null)
  const missing = accounts.filter(
    (a) =>
      a.type === 'credit' && !a.isArchived && (a.statementDay === null || a.paymentDueDay === null)
  )
  if (missing.length === 0) return null

  return (
    <section
      aria-label="Card days missing"
      className="mb-6 grid gap-3 rounded-panel border border-line bg-surface p-4"
    >
      {missing.map((card) => (
        <div key={card.id} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1">
            Set {card.name}’s statement and due days so its spending counts in the month you pay it.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setEditing(card)}>
            Set days…
          </Button>
        </div>
      ))}
      <AccountDialog
        target={editing && { kind: 'edit', account: editing }}
        accounts={accounts}
        onClose={() => setEditing(null)}
      />
    </section>
  )
}

import { Link } from 'react-router'
import type { Account } from '@shared/accounts'
import { Card } from '@renderer/components/ui/card'
import { useLoans } from '@renderer/features/loans/queries'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'

interface Position {
  label: string
  value: number
  caption: string
  to: string
}

/**
 * Money that isn't in the total balance's accounts, or that the balance owes: set aside in
 * savings goals, owed on cards, owed on loans and owed to you. Only what applies shows.
 */
export function Positions({ accounts }: { accounts: Account[] }): React.JSX.Element | null {
  const money = useCurrency()
  const goals = (useSavingsGoals().data ?? []).filter((g) => !g.isArchived)
  const loans = (useLoans().data ?? []).filter((l) => l.status === 'active')
  const cards = accounts.filter((a) => a.type === 'credit')

  const owed = (kinds: string[]): number =>
    loans.filter((l) => kinds.includes(l.kind)).reduce((sum, l) => sum + l.outstanding, 0)
  const youOwe = loans.filter((l) => l.kind !== 'lent')

  const positions: Position[] = [
    goals.length > 0 && {
      label: 'In savings goals',
      value: goals.reduce((sum, g) => sum + g.saved, 0),
      caption: `${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}, set aside from your accounts`,
      to: '/savings'
    },
    cards.length > 0 && {
      label: 'Owed on cards',
      value: cards.reduce((sum, a) => sum + Math.max(0, -a.balance), 0),
      caption: `${cards.length} credit ${cards.length === 1 ? 'card' : 'cards'}`,
      to: '/accounts'
    },
    youOwe.length > 0 && {
      label: 'Loans you owe',
      value: owed(['borrowed', 'bank_loan']),
      caption: `${youOwe.length} ${youOwe.length === 1 ? 'loan' : 'loans'}`,
      to: '/loans'
    },
    loans.some((l) => l.kind === 'lent') && {
      label: 'Owed to you',
      value: owed(['lent']),
      caption: 'Money you lent',
      to: '/loans'
    }
  ].filter((p): p is Position => !!p)

  if (positions.length === 0) return null

  return (
    <section
      aria-label="Savings and debt"
      className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {positions.map((p) => (
        <Link
          key={p.label}
          to={p.to}
          className="rounded-panel focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Card className="h-full p-4 transition-colors hover:border-ink-muted/40">
            <p className="text-sm text-ink-muted">{p.label}</p>
            <p className="amount text-title">{money.format(p.value)}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{p.caption}</p>
          </Card>
        </Link>
      ))}
    </section>
  )
}

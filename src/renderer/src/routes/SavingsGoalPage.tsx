import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Pencil, PiggyBank } from 'lucide-react'
import { formatDate, today } from '@shared/dates'
import { goalShare, type SavingsGoal } from '@shared/savings'
import { BalanceTrend } from '@renderer/components/charts/BalanceTrend'
import { ColorChip } from '@renderer/components/ColorChip'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useAccounts } from '@renderer/features/accounts/queries'
import { GoalDialog, type GoalDialogTarget } from '@renderer/features/savings/GoalDialog'
import {
  MovementDialog,
  type MovementDialogTarget
} from '@renderer/features/savings/MovementDialog'
import { goalOutlook } from '@renderer/features/savings/outlook'
import { ProgressRing } from '@renderer/features/savings/ProgressRing'
import {
  useSavingsGoals,
  useSavingsMovements,
  useSavingsSeries
} from '@renderer/features/savings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'

function Progress({ goal }: { goal: SavingsGoal }): React.JSX.Element {
  const money = useCurrency()
  const share = goalShare(goal)
  const left = Math.max(0, goal.targetAmount - goal.saved)
  return (
    <Card className="grid content-start gap-5">
      <div className="flex items-center gap-5">
        <ProgressRing
          share={share}
          size={112}
          label={`${Math.floor(share * 100)}% of ${money.format(goal.targetAmount)} saved`}
        />
        <div>
          <p className="text-sm text-ink-muted">Saved</p>
          <p className="amount text-amount">{money.format(goal.saved)}</p>
          <p className="text-sm text-ink-muted">of {money.format(goal.targetAmount)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 border-y border-line py-4">
        <div>
          <dt className="text-sm text-ink-muted">Left to save</dt>
          <dd className="amount text-lg">{money.format(left)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Each month</dt>
          <dd className="amount text-lg">
            {goal.plannedMonthly ? money.format(goal.plannedMonthly) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">By</dt>
          <dd className="text-lg font-semibold">
            {goal.targetDate
              ? formatDate(goal.targetDate, money.locale, { month: 'short', year: 'numeric' })
              : '—'}
          </dd>
        </div>
      </dl>
      <p className="text-ink-muted">{goalOutlook(goal, today(), money)}</p>
    </Card>
  )
}

function Movements({
  goal,
  onEdit
}: {
  goal: SavingsGoal
  onEdit: (target: MovementDialogTarget) => void
}): React.JSX.Element {
  const money = useCurrency()
  const movements = useSavingsMovements(goal.id)
  const accounts = useAccounts().data ?? []
  const list = movements.data ?? []

  return (
    <Card className="mt-8 max-w-3xl">
      <CardHeader>
        <div>
          <CardTitle>Deposits and withdrawals</CardTitle>
          <CardDescription>
            {goal.startingAmount > 0
              ? `Started with ${money.format(goal.startingAmount)} already saved.`
              : 'Everything put in and taken out.'}
          </CardDescription>
        </div>
      </CardHeader>
      {movements.isSuccess && list.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing put in yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((tx) => {
            const deposit = tx.type === 'savings_deposit'
            const account = accounts.find((a) => a.id === tx.accountId)
            const Icon = deposit ? ArrowDownToLine : ArrowUpFromLine
            return (
              <li key={tx.id} className="py-1 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => onEdit({ kind: 'edit', goal, movement: tx })}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-savings-soft text-savings">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {deposit ? 'Put in' : 'Taken out'}
                      {account && ` ${deposit ? 'from' : 'into'} ${account.name}`}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      {formatDate(tx.date, money.locale)}
                      {tx.note && <span className="italic"> · {tx.note}</span>}
                    </span>
                  </span>
                  <span className="amount shrink-0">
                    {money.format(deposit ? tx.amount : -tx.amount, 'exceptZero')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function GoalDetail({ goal, all }: { goal: SavingsGoal; all: SavingsGoal[] }): React.JSX.Element {
  const navigate = useNavigate()
  const series = useSavingsSeries(goal.id)
  const [dialog, setDialog] = useState<GoalDialogTarget | null>(null)
  const [moving, setMoving] = useState<MovementDialogTarget | null>(null)

  return (
    <>
      <Link
        to="/savings"
        className="mb-3 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Savings
      </Link>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ColorChip color={goal.color} icon={PiggyBank} />
          <div className="min-w-0">
            <h1 className="truncate text-[2rem] leading-tight font-bold">{goal.name}</h1>
            <p className="mt-1 text-ink-muted">Savings goal{goal.isArchived && ' · Archived'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDialog({ kind: 'edit', goal })}>
            <Pencil />
            Edit goal
          </Button>
          {!goal.isArchived && goal.saved > 0 && (
            <Button
              variant="outline"
              onClick={() => setMoving({ kind: 'new', goal, type: 'withdrawal' })}
            >
              Take out
            </Button>
          )}
          {!goal.isArchived && (
            <Button onClick={() => setMoving({ kind: 'new', goal, type: 'deposit' })}>
              Put in
            </Button>
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Progress goal={goal} />
        </div>
        <BalanceTrend className="lg:col-span-3" points={series.data ?? []} title="Saved" />
      </div>

      <Movements goal={goal} onEdit={setMoving} />

      <GoalDialog
        target={dialog}
        goals={all}
        onClose={() => setDialog(null)}
        onDeleted={() => navigate('/savings')}
      />
      <MovementDialog target={moving} onClose={() => setMoving(null)} />
    </>
  )
}

/** One goal: progress and outlook, what it held over time, and every deposit and withdrawal. */
export function SavingsGoalPage(): React.JSX.Element | null {
  const { id } = useParams()
  const goals = useSavingsGoals()
  const all = goals.data ?? []
  const goal = all.find((g) => g.id === Number(id))

  if (goals.isSuccess && !goal) {
    return (
      <Card className="max-w-3xl">
        <CardTitle>That goal no longer exists</CardTitle>
        <CardDescription className="mt-1">
          It may have been deleted.{' '}
          <Link to="/savings" className="font-semibold text-primary hover:underline">
            Back to savings
          </Link>
        </CardDescription>
      </Card>
    )
  }
  return goal ? <GoalDetail key={goal.id} goal={goal} all={all} /> : null
}

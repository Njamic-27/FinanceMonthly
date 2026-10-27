import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PiggyBank, Plus } from 'lucide-react'
import { today } from '@shared/dates'
import { goalShare, type SavingsGoal } from '@shared/savings'
import { ColorChip } from '@renderer/components/ColorChip'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { GoalDialog, type GoalDialogTarget } from '@renderer/features/savings/GoalDialog'
import {
  MovementDialog,
  type MovementDialogTarget
} from '@renderer/features/savings/MovementDialog'
import { goalOutlook } from '@renderer/features/savings/outlook'
import { ProgressRing } from '@renderer/features/savings/ProgressRing'
import { useSavingsGoals } from '@renderer/features/savings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'

function GoalCard({
  goal,
  onOpen,
  onMove
}: {
  goal: SavingsGoal
  onOpen: () => void
  onMove: (target: MovementDialogTarget) => void
}): React.JSX.Element {
  const money = useCurrency()
  const share = goalShare(goal)

  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface text-ink transition-colors hover:border-ink-muted/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col gap-4 rounded-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-3">
          <ColorChip color={goal.color} icon={PiggyBank} />
          <span className="min-w-0 flex-1 truncate font-semibold">{goal.name}</span>
        </span>
        <span className="flex items-center gap-4">
          <ProgressRing
            share={share}
            label={`${Math.floor(share * 100)}% of ${money.format(goal.targetAmount)} saved`}
          />
          <span className="min-w-0">
            <span className="amount block text-title">{money.format(goal.saved)}</span>
            <span className="block text-sm text-ink-muted">
              of {money.format(goal.targetAmount)}
            </span>
          </span>
        </span>
        <span className="text-sm text-ink-muted">{goalOutlook(goal, today(), money)}</span>
      </button>
      {!goal.isArchived && (
        <div className="flex gap-2 px-5 pb-5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onMove({ kind: 'new', goal, type: 'deposit' })}
          >
            Put in
          </Button>
          {goal.saved > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove({ kind: 'new', goal, type: 'withdrawal' })}
            >
              Take out
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Savings goals with how far along each is and where it's heading. */
export function SavingsPage(): React.JSX.Element {
  const money = useCurrency()
  const navigate = useNavigate()
  const goals = useSavingsGoals()
  const [dialog, setDialog] = useState<GoalDialogTarget | null>(null)
  const [moving, setMoving] = useState<MovementDialogTarget | null>(null)
  const all = goals.data ?? []
  const active = all.filter((g) => !g.isArchived)
  const archived = all.filter((g) => g.isArchived)
  const saved = active.reduce((sum, g) => sum + g.saved, 0)
  const target = active.reduce((sum, g) => sum + g.targetAmount, 0)
  const open = (goal: SavingsGoal): void => {
    void navigate(`/savings/${goal.id}`)
  }

  return (
    <>
      <PageHeader
        title="Savings"
        description="Goals and how close you are."
        actions={
          active.length > 0 && (
            <Button onClick={() => setDialog({ kind: 'new' })}>
              <Plus />
              Add goal
            </Button>
          )
        }
      />

      {goals.isError && (
        <Card className="max-w-3xl">
          <CardTitle>Savings could not be loaded</CardTitle>
          <CardDescription className="mt-1">
            {goals.error.message} Restart Financije to try again.
          </CardDescription>
        </Card>
      )}

      {goals.isSuccess && active.length === 0 && (
        <section className="flex max-w-2xl flex-col items-start gap-4 rounded-panel border border-dashed border-line p-8">
          <span className="flex size-12 items-center justify-center rounded-full bg-savings-soft text-savings">
            <PiggyBank className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Save towards something</h2>
            <p className="mt-1 text-ink-muted">
              A holiday, a new laptop or a safety cushion. Set a target, put money in from your
              accounts, and see when you’ll get there.
            </p>
          </div>
          <Button onClick={() => setDialog({ kind: 'new' })}>
            <Plus />
            Add your first goal
          </Button>
        </section>
      )}

      {active.length > 0 && (
        <>
          <Card className="mb-6 flex flex-wrap items-end gap-x-10 gap-y-2">
            <div>
              <p className="text-sm text-ink-muted">Saved in total</p>
              <p className="amount text-amount">{money.format(saved)}</p>
            </div>
            <p className="pb-1.5 text-ink-muted">
              of {money.format(target)} across {active.length}{' '}
              {active.length === 1 ? 'goal' : 'goals'}
            </p>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onOpen={() => open(goal)} onMove={setMoving} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-semibold">Archived</h2>
          <p className="mb-3 text-sm text-ink-muted">
            Reached or set aside. Their history stays, and money still in them still counts.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onOpen={() => open(goal)} onMove={setMoving} />
            ))}
          </div>
        </section>
      )}

      <GoalDialog target={dialog} goals={all} onClose={() => setDialog(null)} />
      <MovementDialog target={moving} onClose={() => setMoving(null)} />
    </>
  )
}

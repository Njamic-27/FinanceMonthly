import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowDownToLine, ArrowUpFromLine, Pencil, PiggyBank } from 'lucide-react'
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
import { accountPath, dayPath } from '@renderer/lib/links'
import { t } from '@renderer/lib/i18n'

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
          <p className="text-sm text-ink-muted">{t('loans.saved')}</p>
          <p className="amount text-amount">{money.format(goal.saved)}</p>
          <p className="text-sm text-ink-muted">
            {t('common.ofAmount', { amount: money.format(goal.targetAmount) })}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 border-y border-line py-4">
        <div>
          <dt className="text-sm text-ink-muted">{t('savings.leftToSave')}</dt>
          <dd className="amount text-lg">{money.format(left)}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{t('panel.eachMonth')}</dt>
          <dd className="amount text-lg">
            {goal.plannedMonthly ? money.format(goal.plannedMonthly) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{t('savings.by')}</dt>
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
          <CardTitle>{t('savings.depositsAndWithdrawals')}</CardTitle>
          <CardDescription>
            {goal.startingAmount > 0
              ? t('savings.startedWith', { amount: money.format(goal.startingAmount) })
              : t('savings.everythingPutInAnd')}
          </CardDescription>
        </div>
      </CardHeader>
      {movements.isSuccess && list.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('savings.nothingPutInYet')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((tx) => {
            const deposit = tx.type === 'savings_deposit'
            const account = accounts.find((a) => a.id === tx.accountId)
            const Icon = deposit ? ArrowDownToLine : ArrowUpFromLine
            return (
              <li key={tx.id} className="py-1 first:pt-0 last:pb-0">
                <div className="link-row relative flex items-center gap-3 px-2 py-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-savings-soft text-savings">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      <button
                        type="button"
                        onClick={() => onEdit({ kind: 'edit', goal, movement: tx })}
                        className="link-cover cursor-pointer text-left"
                      >
                        {deposit ? t('savings.putIn') : t('savings.takenOut2')}
                      </button>
                      {account && (
                        <>
                          {deposit ? ' from ' : ' into '}
                          <Link to={accountPath(account.id)} className="link">
                            {account.name}
                          </Link>
                        </>
                      )}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      <Link to={dayPath(tx.date)} className="link">
                        {formatDate(tx.date, money.locale)}
                      </Link>
                      {tx.note && <span className="italic"> · {tx.note}</span>}
                    </span>
                  </span>
                  <span className="amount shrink-0">
                    {money.format(deposit ? tx.amount : -tx.amount, 'exceptZero')}
                  </span>
                </div>
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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ColorChip color={goal.color} icon={PiggyBank} />
          <div className="min-w-0">
            <h1 className="truncate text-[2rem] leading-tight font-bold">{goal.name}</h1>
            <p className="mt-1 text-ink-muted">
              {t('savings.goalLabel')}
              {goal.isArchived && t('savings.archivedSuffix')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDialog({ kind: 'edit', goal })}>
            <Pencil />
            {t('savings.editGoal')}
          </Button>
          {!goal.isArchived && goal.saved > 0 && (
            <Button
              variant="outline"
              onClick={() => setMoving({ kind: 'new', goal, type: 'withdrawal' })}
            >
              {t('savings.takeOut')}
            </Button>
          )}
          {!goal.isArchived && (
            <Button onClick={() => setMoving({ kind: 'new', goal, type: 'deposit' })}>
              {t('savings.putIn')}
            </Button>
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Progress goal={goal} />
        </div>
        <BalanceTrend
          className="lg:col-span-3"
          points={series.data ?? []}
          title={t('loans.saved')}
        />
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
        <CardTitle>{t('savings.thatGoalNoLonger')}</CardTitle>
        <CardDescription className="mt-1">
          {t('common.mayBeDeleted')}{' '}
          <Link to="/savings" className="link font-semibold text-primary">
            {t('savings.backToSavings')}
          </Link>
        </CardDescription>
      </Card>
    )
  }
  return goal ? <GoalDetail key={goal.id} goal={goal} all={all} /> : null
}

import { useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { formatDate } from '@shared/dates'
import type { InstallmentPlan } from '@shared/installments'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import { useCategories } from '@renderer/features/categories/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { categoryPath, dayPath } from '@renderer/lib/links'
import { toast } from '@renderer/lib/toast'
import { useDeleteInstallmentPlan, useInstallmentPlans } from './queries'

function PlanRow({
  plan,
  onDelete
}: {
  plan: InstallmentPlan
  onDelete: () => void
}): React.JSX.Element {
  const money = useCurrency()
  const category = useCategories().data?.find((c) => c.id === plan.categoryId)
  const done = plan.nextDate === null
  const short = (date: string): React.ReactNode => (
    <Link to={dayPath(date)} className="link">
      {formatDate(date, money.locale, { day: 'numeric', month: 'short', year: 'numeric' })}
    </Link>
  )

  return (
    <li className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        {category && <CategoryChip color={category.color} icon={category.icon} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{plan.title}</p>
          <p className="text-sm text-ink-muted">
            {category && (
              <>
                <Link to={categoryPath(category.id)} className="link">
                  {category.name}
                </Link>
                {' · '}
              </>
            )}
            {money.format(plan.totalAmount)} in {plan.count} · {money.format(plan.installment)}
            /month
            {plan.lastInstallment !== plan.installment &&
              `, last ${money.format(plan.lastInstallment)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="amount">{done ? 'Paid off' : `${money.format(plan.remaining)} to go`}</p>
          <p className="text-sm text-ink-muted">
            {plan.postedCount} of {plan.count} charged
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`${plan.title}: installments charged`}
        aria-valuemin={0}
        aria-valuemax={plan.count}
        aria-valuenow={plan.postedCount}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-loan"
          style={{ width: `${(plan.postedCount / plan.count) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
        <span>
          {done ? (
            <>Last installment on {short(plan.lastDate)}</>
          ) : (
            <>
              Next on {short(plan.nextDate ?? plan.lastDate)} · last on {short(plan.lastDate)}
            </>
          )}
        </span>
        <Button variant="ghost" size="sm" className="text-expense" onClick={onDelete}>
          Delete purchase…
        </Button>
      </div>
    </li>
  )
}

/** A card's purchases paid in installments, with what's still to come. */
export function InstallmentPlans({
  accountId,
  className
}: {
  accountId: number
  className?: string
}): React.JSX.Element | null {
  const money = useCurrency()
  const plans = useInstallmentPlans(accountId)
  const deletePlan = useDeleteInstallmentPlan()
  const [deleting, setDeleting] = useState<InstallmentPlan | null>(null)
  const all = plans.data ?? []
  const running = all.filter((p) => p.nextDate !== null)
  const paidOff = all.filter((p) => p.nextDate === null)
  const remaining = running.reduce((sum, p) => sum + p.remaining, 0)

  const remove = (plan: InstallmentPlan): void =>
    deletePlan.mutate(plan.id, {
      onSuccess: () => {
        toast({ title: `${plan.title} deleted`, variant: 'success' })
        setDeleting(null)
      },
      onError: (error) =>
        toast({ title: 'Purchase not deleted', description: error.message, variant: 'error' })
    })

  if (!plans.isSuccess) return null

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Installments</CardTitle>
          <CardDescription>
            {running.length > 0
              ? `${money.format(remaining)} still to come, held from the limit.`
              : 'Purchases you pay off in monthly installments.'}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openTransactionDialog({ kind: 'new', prefill: { type: 'expense', accountId } })
          }
        >
          <Plus />
          Buy in installments
        </Button>
      </CardHeader>

      {all.length === 0 ? (
        <p className="text-sm text-ink-muted">
          None yet. Add an expense on this card and turn on “Pay in installments”.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {[...running, ...paidOff].map((plan) => (
            <PlanRow key={plan.id} plan={plan} onDelete={() => setDeleting(plan)} />
          ))}
        </ul>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="w-[min(30rem,calc(100vw-2rem))]">
          {deleting && (
            <>
              <DialogHeader>
                <DialogTitle>Delete “{deleting.title}”?</DialogTitle>
                <DialogDescription>
                  {deleting.postedCount > 0
                    ? `Its ${deleting.postedCount} charged installment${deleting.postedCount === 1 ? '' : 's'} (${money.format(deleting.totalAmount - deleting.remaining)}) are removed too, as if you never bought it.`
                    : 'Nothing has been charged for it yet.'}{' '}
                  This can’t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Keep it</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  disabled={deletePlan.isPending}
                  onClick={() => remove(deleting)}
                >
                  Delete purchase
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

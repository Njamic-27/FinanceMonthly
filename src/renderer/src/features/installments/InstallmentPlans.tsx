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
import { t, tNode } from '@renderer/lib/i18n'

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
            {t('accounts.planInfo', {
              total: money.format(plan.totalAmount),
              count: plan.count,
              each: money.format(plan.installment)
            })}
            {plan.lastInstallment !== plan.installment &&
              t('accounts.planLast', { amount: money.format(plan.lastInstallment) })}
          </p>
        </div>
        <div className="text-right">
          <p className="amount">
            {done
              ? t('accounts.paidOff')
              : t('accounts.toGo', { amount: money.format(plan.remaining) })}
          </p>
          <p className="text-sm text-ink-muted">
            {t('accounts.chargedOf', { posted: plan.postedCount, total: plan.count })}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={t('accounts.installmentsCharged', { title: plan.title })}
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
          {done
            ? tNode('accounts.lastInstallmentOn', { date: short(plan.lastDate) })
            : tNode('accounts.nextAndLast', {
                next: short(plan.nextDate ?? plan.lastDate),
                last: short(plan.lastDate)
              })}
        </span>
        <Button variant="ghost" size="sm" className="text-expense" onClick={onDelete}>
          {t('panel.deletePurchase')}
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
        toast({
          title: t('accounts.purchaseNotDeleted'),
          description: error.message,
          variant: 'error'
        })
    })

  if (!plans.isSuccess) return null

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{t('accounts.installments')}</CardTitle>
          <CardDescription>
            {running.length > 0
              ? t('accounts.stillToComeHeld', { amount: money.format(remaining) })
              : t('accounts.purchasesYouPayOff')}
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
          {t('accounts.buyInInstallments')}
        </Button>
      </CardHeader>

      {all.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('accounts.noneYetAddAn')}</p>
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
                <DialogTitle>{t('panel.deleteTitle', { title: deleting.title })}</DialogTitle>
                <DialogDescription>
                  {deleting.postedCount > 0
                    ? t('accounts.deletePlanCharged', {
                        count: deleting.postedCount,
                        amount: money.format(deleting.totalAmount - deleting.remaining)
                      })
                    : t('accounts.nothingHasBeenCharged')}{' '}
                  {t('recurring.thisCantBeUndone')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t('confirm.keep')}</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  disabled={deletePlan.isPending}
                  onClick={() => remove(deleting)}
                >
                  {t('panel.deletePurchaseAction')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

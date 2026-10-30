import { useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { addMonths, today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import { nextPaletteColor, type PaletteColor } from '@shared/palette'
import { savingsGoalInputSchema, type SavingsGoal } from '@shared/savings'
import { ActionRow } from '@renderer/components/ActionRow'
import { AmountInput } from '@renderer/components/AmountInput'
import { ColorChip } from '@renderer/components/ColorChip'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { DatePicker } from '@renderer/components/DatePicker'
import { FieldError } from '@renderer/components/FieldError'
import { FormError } from '@renderer/components/FormError'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import {
  useArchiveSavingsGoal,
  useCreateSavingsGoal,
  useDeleteSavingsGoal,
  useUpdateSavingsGoal
} from './queries'
import { t } from '@renderer/lib/i18n'

export type GoalDialogTarget = { kind: 'new' } | { kind: 'edit'; goal: SavingsGoal }

type Field = 'name' | 'targetAmount' | 'targetDate' | 'startingAmount' | 'plannedMonthly'

interface FormProps {
  target: GoalDialogTarget
  goals: SavingsGoal[]
  onClose: () => void
  /** Called after the goal is deleted, e.g. to leave its page. */
  onDeleted?: () => void
}

function GoalForm({ target, goals, onClose, onDeleted }: FormProps): React.JSX.Element {
  const money = useCurrency()
  const existing = target.kind === 'edit' ? target.goal : null
  const placeholder = `0${decimalSeparator(money.locale)}00`
  const toInput = (cents: number | null | undefined): string => (cents ? money.toInput(cents) : '')

  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState<PaletteColor>(
    existing?.color ?? nextPaletteColor(goals.filter((g) => !g.isArchived).map((g) => g.color))
  )
  const [targetAmount, setTargetAmount] = useState(toInput(existing?.targetAmount))
  const [hasDate, setHasDate] = useState(existing ? existing.targetDate !== null : true)
  const [targetDate, setTargetDate] = useState<IsoDate>(
    existing?.targetDate ?? addMonths(today(), 12)
  )
  const [startingAmount, setStartingAmount] = useState(toInput(existing?.startingAmount))
  const [plannedMonthly, setPlannedMonthly] = useState(toInput(existing?.plannedMonthly))
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createGoal = useCreateSavingsGoal()
  const updateGoal = useUpdateSavingsGoal()
  const archiveGoal = useArchiveSavingsGoal()
  const deleteGoal = useDeleteSavingsGoal()
  const pending =
    createGoal.isPending || updateGoal.isPending || archiveGoal.isPending || deleteGoal.isPending

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }
  const done = (title: string): void => {
    toast({ title, variant: 'success' })
    onClose()
  }
  const onError = (error: Error): void => setFormError(error.message)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const found: Partial<Record<Field, string>> = {}
    /** An optional amount: '' is none; anything else must be an amount. */
    const amount = (value: string, field: Field, required = false): number | null => {
      if (value.trim() === '') {
        if (required) found[field] = t('recurring.enterTheAmount')
        return null
      }
      const cents = money.parse(value)
      if (cents === null) {
        found[field] = t('line.enterAmountLike', { example: money.toInput(150000) })
      }
      return cents
    }
    const target = amount(targetAmount, 'targetAmount', true)
    const starting = amount(startingAmount, 'startingAmount')
    const monthly = amount(plannedMonthly, 'plannedMonthly')

    const parsed = savingsGoalInputSchema.safeParse({
      name,
      color,
      targetAmount: target ?? 0,
      targetDate: hasDate ? targetDate : null,
      startingAmount: starting ?? 0,
      plannedMonthly: monthly
    })
    const all = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...found }
    if (!parsed.success || Object.values(found).some(Boolean)) {
      setErrors(all)
      return
    }
    if (existing) {
      updateGoal.mutate(
        { id: existing.id, input: parsed.data },
        { onSuccess: () => done(t('savings.goalSaved')), onError }
      )
    } else {
      createGoal.mutate(parsed.data, {
        onSuccess: (goal) => done(`${goal.name} added`),
        onError
      })
    }
  }

  if (existing && confirmDelete) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('panel.deleteTitle', { title: existing.name })}</DialogTitle>
          <DialogDescription>{t('savings.nothingHasBeenSaved')}</DialogDescription>
        </DialogHeader>
        {formError && <FormError message={formError} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            {t('shell.back')}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              deleteGoal.mutate(existing.id, {
                onSuccess: () => {
                  done(`${existing.name} deleted`)
                  onDeleted?.()
                },
                onError
              })
            }
          >
            {t('savings.deleteGoal')}
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? t('savings.editGoal') : t('add.newGoal')}</DialogTitle>
        <DialogDescription>{t('savings.somethingYoureSavingTowards')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-name">{t('common.name')}</Label>
          <div className="flex items-center gap-3">
            <ColorChip color={color} icon={PiggyBank} />
            <Input
              id="goal-name"
              value={name}
              autoFocus
              maxLength={40}
              placeholder={t('savings.namePlaceholder')}
              {...errorProps('goal-name', errors.name)}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
          </div>
          <FieldError id="goal-name-error" message={errors.name} />
        </div>

        <ColorPicker name="goal-color" value={color} onChange={setColor} />

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="goal-target">{t('savings.target')}</Label>
            <AmountInput
              id="goal-target"
              value={targetAmount}
              placeholder={placeholder}
              {...errorProps('goal-target', errors.targetAmount)}
              onChange={(event) => {
                setTargetAmount(event.target.value)
                clearError('targetAmount')
              }}
            />
            <FieldError id="goal-target-error" message={errors.targetAmount} />
          </div>
          <div className="grid content-start gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="goal-date">{t('savings.by')}</Label>
              <Switch
                checked={hasDate}
                onCheckedChange={(on) => {
                  setHasDate(on)
                  clearError('targetDate')
                }}
                aria-label={t('savings.reachItByA')}
                className="scale-75"
              />
            </div>
            {hasDate ? (
              <DatePicker
                id="goal-date"
                value={targetDate}
                {...errorProps('goal-date', errors.targetDate)}
                onChange={(value) => {
                  setTargetDate(value)
                  clearError('targetDate')
                }}
              />
            ) : (
              <p id="goal-date" className="flex h-10 items-center text-sm text-ink-muted">
                {t('loans.noDate')}
              </p>
            )}
            <FieldError id="goal-date-error" message={errors.targetDate} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="goal-starting">
              {t('savings.alreadySaved')}{' '}
              <span className="font-normal text-ink-muted">{t('common.optional')}</span>
            </Label>
            <AmountInput
              id="goal-starting"
              value={startingAmount}
              placeholder={placeholder}
              {...errorProps('goal-starting', errors.startingAmount)}
              onChange={(event) => {
                setStartingAmount(event.target.value)
                clearError('startingAmount')
              }}
            />
            <FieldError id="goal-starting-error" message={errors.startingAmount} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="goal-monthly">
              {t('savings.eachMonth')}{' '}
              <span className="font-normal text-ink-muted">{t('common.optional')}</span>
            </Label>
            <AmountInput
              id="goal-monthly"
              value={plannedMonthly}
              placeholder={placeholder}
              {...errorProps('goal-monthly', errors.plannedMonthly)}
              onChange={(event) => {
                setPlannedMonthly(event.target.value)
                clearError('plannedMonthly')
              }}
            />
            <FieldError id="goal-monthly-error" message={errors.plannedMonthly} />
          </div>
        </div>
        <p className="-mt-2 text-sm text-ink-muted">{t('savings.amountsHint')}</p>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      {existing && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          <ActionRow
            title={existing.isArchived ? t('accounts.restore') : t('accounts.archive')}
            description={
              existing.isArchived ? t('savings.showItWithYour') : t('savings.reachedItOrGave')
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                archiveGoal.mutate(
                  { id: existing.id, archived: !existing.isArchived },
                  {
                    onSuccess: () =>
                      done(`${existing.name} ${existing.isArchived ? 'restored' : 'archived'}`),
                    onError
                  }
                )
              }
            >
              {existing.isArchived ? t('savings.restoreGoal') : t('savings.archiveGoal')}
            </Button>
          </ActionRow>
          <ActionRow
            title={t('common.delete')}
            description={
              existing.movementCount > 0
                ? t('savings.onlyGoalsWithoutDeposits')
                : t('accounts.removeItForGood')
            }
          >
            {existing.movementCount === 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="text-expense"
                onClick={() => setConfirmDelete(true)}
              >
                {t('recurring.delete')}
              </Button>
            )}
          </ActionRow>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {existing ? t('savings.saveGoal') : t('savings.addGoal')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add or edit a savings goal; editing also archives or deletes it. */
export function GoalDialog({
  target,
  goals,
  onClose,
  onDeleted
}: {
  target: GoalDialogTarget | null
  goals: SavingsGoal[]
  onClose: () => void
  onDeleted?: () => void
}): React.JSX.Element {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {target && (
          <GoalForm
            key={target.kind === 'edit' ? target.goal.id : 'new'}
            target={target}
            goals={goals}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

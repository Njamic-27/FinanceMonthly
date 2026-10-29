import { useState } from 'react'
import type { Account } from '@shared/accounts'
import type { Category } from '@shared/categories'
import { formatDate, today, type IsoDate } from '@shared/dates'
import { decimalSeparator } from '@shared/money'
import { occurrences } from '@shared/recurrence'
import { subscriptionCategoryName } from '@shared/subscription-presets'
import {
  frequencies,
  hasEnded,
  postedType,
  recurringItemInputSchema,
  reminderChoices,
  type Frequency,
  type RecurringItem,
  type RecurringKind
} from '@shared/recurring'
import { ActionRow } from '@renderer/components/ActionRow'
import { AmountInput } from '@renderer/components/AmountInput'
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
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import { AccountSelect } from '@renderer/features/accounts/AccountSelect'
import { useAccounts } from '@renderer/features/accounts/queries'
import { CategorySelect } from '@renderer/features/categories/CategorySelect'
import { useCategories } from '@renderer/features/categories/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { kindLabels, reminderLabel } from './appearance'
import { PresetPicker } from './PresetPicker'
import {
  useCancelRecurringItem,
  useCreateRecurringItem,
  useDeleteRecurringItem,
  useSetRecurringActive,
  useUpdateRecurringItem
} from './queries'
import { anchorFor, describeSchedule } from './schedule'

export type RecurringDialogTarget =
  { kind: 'new'; itemKind: RecurringKind } | { kind: 'edit'; item: RecurringItem }

type Field =
  | 'title'
  | 'amount'
  | 'categoryId'
  | 'accountId'
  | 'interval'
  | 'nextDueDate'
  | 'endDate'
  | 'url'
  | 'note'

const frequencyOptions = frequencies.map((value) => ({
  value,
  label: { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[value]
}))
const units: Record<Frequency, [one: string, many: string]> = {
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years']
}

type Posting = 'auto' | 'ask'
const postingOptions: { value: Posting; label: string }[] = [
  { value: 'auto', label: 'Add it automatically' },
  { value: 'ask', label: 'Ask me first' }
]

type Ending = 'never' | 'on'
const endingOptions: { value: Ending; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'on', label: 'On a date' }
]

/** The reminder select's value for no reminder. */
const OFF = 'off'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

interface FormProps {
  target: RecurringDialogTarget
  accounts: Account[]
  categories: Category[]
  /** A name picked from the subscription presets. */
  presetTitle?: string
  onClose: () => void
}

function RecurringForm({
  target,
  accounts,
  categories,
  presetTitle,
  onClose
}: FormProps): React.JSX.Element {
  const money = useCurrency()
  const existing = target.kind === 'edit' ? target.item : null
  const itemKind = existing?.kind ?? (target.kind === 'new' ? target.itemKind : 'expense')
  const categoryType = postedType(itemKind)
  const now = today()

  const usableAccounts = accounts.filter((a) => !a.isArchived || a.id === existing?.accountId)
  const usableCategories = categories.filter(
    (c) => c.type === categoryType && (!c.isArchived || c.id === existing?.categoryId)
  )

  const [title, setTitle] = useState(existing?.title ?? presetTitle ?? '')
  const [amount, setAmount] = useState(existing ? money.toInput(existing.amount) : '')
  const [categoryId, setCategoryId] = useState(() => {
    if (existing) return String(existing.categoryId)
    const preferred = itemKind === 'subscription' ? subscriptionCategoryName : null
    return String(usableCategories.find((c) => c.name === preferred)?.id ?? '')
  })
  const [accountId, setAccountId] = useState(() =>
    String(
      existing?.accountId ??
        usableAccounts.find((a) => a.type === 'debit')?.id ??
        usableAccounts[0]?.id ??
        ''
    )
  )
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly')
  const [interval, setIntervalText] = useState(String(existing?.interval ?? 1))
  const [nextDueDate, setNextDueDate] = useState<IsoDate>(existing?.nextDueDate ?? now)
  const [ending, setEnding] = useState<Ending>(existing?.endDate ? 'on' : 'never')
  const [endDate, setEndDate] = useState<IsoDate>(existing?.endDate ?? nextDueDate)
  const [posting, setPosting] = useState<Posting>(
    (existing?.autoPost ?? itemKind !== 'subscription') ? 'auto' : 'ask'
  )
  // Subscriptions start with a reminder two days before; bills and income without.
  const [reminder, setReminder] = useState(
    existing
      ? (existing.reminderDaysBefore?.toString() ?? OFF)
      : itemKind === 'subscription'
        ? '2'
        : OFF
  )
  const [url, setUrl] = useState(existing?.url ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createItem = useCreateRecurringItem()
  const updateItem = useUpdateRecurringItem()
  const deleteItem = useDeleteRecurringItem()
  const setActive = useSetRecurringActive()
  const cancelItem = useCancelRecurringItem()
  const pending =
    createItem.isPending ||
    updateItem.isPending ||
    deleteItem.isPending ||
    setActive.isPending ||
    cancelItem.isPending

  // Reminders are for money going out; a website only for subscriptions.
  const hasReminder = itemKind !== 'income'
  const hasWebsite = itemKind === 'subscription'
  const reminderOptions = [
    ...new Set([...reminderChoices, existing?.reminderDaysBefore ?? null])
  ].sort((a, b) => (a ?? -1) - (b ?? -1))

  const clearError = (field: Field): void => {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  const intervalNumber = Number(interval)
  const validInterval = Number.isInteger(intervalNumber) && intervalNumber >= 1
  const schedule = {
    frequency,
    interval: validInterval ? intervalNumber : 1,
    anchorDate: anchorFor(existing, {
      frequency,
      interval: validInterval ? intervalNumber : 1,
      nextDueDate
    }),
    endDate: ending === 'on' ? endDate : null
  }
  const dueByToday =
    nextDueDate <= now && (schedule.endDate === null || schedule.endDate >= nextDueDate)
      ? occurrences(schedule, nextDueDate, now).length
      : 0

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    let found: Partial<Record<Field, string>> = {}

    const cents = money.parse(amount)
    if (amount.trim() === '') found.amount = 'Enter the amount'
    else if (cents === null) found.amount = `Enter an amount like ${money.toInput(1250)}`
    else if (cents <= 0) found.amount = 'Enter an amount above zero'

    const parsed = recurringItemInputSchema.safeParse({
      kind: itemKind,
      title,
      amount: cents ?? 0,
      accountId: accountId ? Number(accountId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      frequency,
      interval: interval.trim() === '' ? undefined : intervalNumber,
      anchorDate: schedule.anchorDate,
      nextDueDate,
      endDate: schedule.endDate,
      autoPost: posting === 'auto',
      reminderDaysBefore: hasReminder && reminder !== OFF ? Number(reminder) : null,
      url: hasWebsite ? url : (existing?.url ?? null),
      note
    })
    // Problems found above explain more than the schema's messages, so they win.
    if (!parsed.success) {
      const { anchorDate, ...rest } = fieldErrors(parsed.error)
      found = { ...rest, ...(anchorDate ? { nextDueDate: anchorDate } : {}), ...found }
    }
    if (!parsed.success || Object.values(found).some(Boolean)) {
      setErrors(found)
      return
    }

    const saved = (verb: string) => (item: RecurringItem) => {
      const posted = item.postedCount - (existing?.postedCount ?? 0)
      toast({
        title: `${item.title} ${verb}`,
        description:
          posted > 0
            ? `${plural(posted, 'payment', 'payments')} added to your transactions.`
            : undefined,
        variant: 'success'
      })
      onClose()
    }
    const onError = (error: Error): void => setFormError(error.message)
    if (existing) {
      updateItem.mutate(
        { id: existing.id, input: parsed.data },
        { onSuccess: saved('saved'), onError }
      )
    } else {
      createItem.mutate(parsed.data, { onSuccess: saved('added'), onError })
    }
  }

  const changeState = (action: 'pause' | 'resume' | 'cancel', item: RecurringItem): void => {
    const done = (updated: RecurringItem): void => {
      const posted = updated.postedCount - item.postedCount
      const verbs = {
        pause: 'paused',
        resume: 'resumed',
        cancel: itemKind === 'subscription' ? 'cancelled' : 'ended'
      }
      const description = {
        pause: 'Nothing is added until you resume it.',
        resume: hasEnded(updated)
          ? 'It has no payments left before its end date.'
          : `Next on ${formatDate(updated.nextDueDate, money.locale)}.${posted > 0 ? ` ${plural(posted, 'payment', 'payments')} added.` : ''}`,
        cancel: 'Nothing after today will be added.'
      }
      toast({
        title: `${item.title} ${verbs[action]}`,
        description: description[action],
        variant: 'success'
      })
      onClose()
    }
    const onError = (error: Error): void => setFormError(error.message)
    if (action === 'cancel') cancelItem.mutate(item.id, { onSuccess: done, onError })
    else
      setActive.mutate({ id: item.id, active: action === 'resume' }, { onSuccess: done, onError })
  }

  if (existing && confirmDelete) {
    const remove = (): void =>
      deleteItem.mutate(existing.id, {
        onSuccess: () => {
          toast({ title: `${existing.title} deleted`, variant: 'success' })
          onClose()
        },
        onError: (error) => setFormError(error.message)
      })
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete “{existing.title}”?</DialogTitle>
          <DialogDescription>
            {existing.postedCount > 0
              ? `Nothing more will be added for it. The ${plural(existing.postedCount, 'transaction', 'transactions')} it already added stay in your history.`
              : 'Nothing more will be added for it.'}{' '}
            This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        {formError && <FormError message={formError} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Back
          </Button>
          <Button variant="danger" disabled={pending} onClick={remove}>
            Delete {kindLabels[itemKind].noun}
          </Button>
        </DialogFooter>
      </>
    )
  }

  const unit = units[frequency]

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>
          {existing ? `Edit ${kindLabels[itemKind].noun}` : `New ${kindLabels[itemKind].noun}`}
        </DialogTitle>
        <DialogDescription>
          {itemKind === 'income'
            ? 'Money you receive on a schedule, like your salary.'
            : 'A payment that repeats on a schedule.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="recurring-title">Name</Label>
          <Input
            id="recurring-title"
            value={title}
            autoFocus={!presetTitle}
            maxLength={80}
            placeholder={kindLabels[itemKind].placeholder}
            {...errorProps('recurring-title', errors.title)}
            onChange={(event) => {
              setTitle(event.target.value)
              clearError('title')
            }}
          />
          <FieldError id="recurring-title-error" message={errors.title} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="recurring-amount">Amount</Label>
            <AmountInput
              id="recurring-amount"
              autoFocus={!!presetTitle}
              value={amount}
              placeholder={`0${decimalSeparator(money.locale)}00`}
              {...errorProps('recurring-amount', errors.amount)}
              onChange={(event) => {
                setAmount(event.target.value)
                clearError('amount')
              }}
            />
            <FieldError id="recurring-amount-error" message={errors.amount} />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="recurring-category">Category</Label>
            <CategorySelect
              id="recurring-category"
              value={categoryId}
              categories={usableCategories}
              error={errors.categoryId}
              onChange={(value) => {
                setCategoryId(value)
                clearError('categoryId')
              }}
            />
            <FieldError id="recurring-category-error" message={errors.categoryId} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="recurring-account">
            {itemKind === 'income' ? 'Paid into' : 'Paid with'}
          </Label>
          <AccountSelect
            id="recurring-account"
            value={accountId}
            accounts={usableAccounts}
            error={errors.accountId}
            onChange={(value) => {
              setAccountId(value)
              clearError('accountId')
            }}
          />
          <FieldError id="recurring-account-error" message={errors.accountId} />
        </div>

        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <span id="recurring-frequency-label" className="text-sm font-semibold">
                Repeats
              </span>
              <SegmentedControl
                name="recurring-frequency"
                aria-labelledby="recurring-frequency-label"
                value={frequency}
                options={frequencyOptions}
                onValueChange={(value) => {
                  setFrequency(value)
                  clearError('nextDueDate')
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recurring-interval">Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="recurring-interval"
                  type="number"
                  min={1}
                  max={24}
                  className="w-16"
                  value={interval}
                  {...errorProps('recurring-interval', errors.interval)}
                  onChange={(event) => {
                    setIntervalText(event.target.value)
                    clearError('interval')
                  }}
                />
                <span className="text-ink-muted">{intervalNumber === 1 ? unit[0] : unit[1]}</span>
              </div>
            </div>
          </div>
          <FieldError id="recurring-interval-error" message={errors.interval} />
        </div>

        <div className="grid gap-1.5">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="recurring-next">{existing ? 'Next date' : 'First date'}</Label>
              <DatePicker
                id="recurring-next"
                value={nextDueDate}
                {...errorProps('recurring-next', errors.nextDueDate)}
                onChange={(value) => {
                  setNextDueDate(value)
                  if (endDate < value) setEndDate(value)
                  clearError('nextDueDate')
                  clearError('endDate')
                }}
              />
            </div>
            <div className="grid content-start gap-1.5">
              <span id="recurring-ending-label" className="text-sm font-semibold">
                Ends
              </span>
              {ending === 'never' ? (
                <SegmentedControl
                  name="recurring-ending"
                  aria-labelledby="recurring-ending-label"
                  value={ending}
                  options={endingOptions}
                  onValueChange={setEnding}
                  className="justify-self-start"
                />
              ) : (
                <div className="flex items-center gap-1">
                  <DatePicker
                    id="recurring-end"
                    value={endDate}
                    min={nextDueDate}
                    {...errorProps('recurring-end', errors.endDate)}
                    onChange={(value) => {
                      setEndDate(value)
                      clearError('endDate')
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEnding('never')
                      clearError('endDate')
                    }}
                  >
                    Never
                  </Button>
                </div>
              )}
            </div>
          </div>
          <FieldError id="recurring-next-error" message={errors.nextDueDate} />
          <FieldError id="recurring-end-error" message={errors.endDate} />
          <p className="text-sm text-ink-muted">
            {describeSchedule(schedule, money.locale)}
            {schedule.endDate && `, until ${formatDate(schedule.endDate, money.locale)}`}.
          </p>
        </div>

        <div className="grid gap-1.5">
          <span id="recurring-posting-label" className="text-sm font-semibold">
            When it’s due
          </span>
          <SegmentedControl
            name="recurring-posting"
            aria-labelledby="recurring-posting-label"
            value={posting}
            options={postingOptions}
            onValueChange={setPosting}
            className="justify-self-start"
          />
          <p className="text-sm text-ink-muted">
            {posting === 'auto'
              ? 'Added to your transactions on the day, even if Financije was closed.'
              : 'Waits under Due now until you confirm it, with the amount you actually paid.'}
            {dueByToday > 0 &&
              (posting === 'auto'
                ? ` ${plural(dueByToday, 'payment is', 'payments are')} already due and will be added when you save.`
                : ` ${plural(dueByToday, 'payment is', 'payments are')} already due.`)}
          </p>
        </div>

        {(hasReminder || hasWebsite) && (
          <div className="grid grid-cols-2 gap-4">
            {hasReminder && (
              <div className="grid content-start gap-1.5">
                <Label htmlFor="recurring-reminder">Remind me</Label>
                <Select value={reminder} onValueChange={setReminder}>
                  <SelectTrigger id="recurring-reminder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderOptions.map((days) => (
                      <SelectItem key={days ?? OFF} value={days?.toString() ?? OFF}>
                        {days === null ? 'No reminder' : reminderLabel(days)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {hasWebsite && (
              <div className="grid content-start gap-1.5">
                <Label htmlFor="recurring-url">
                  Website <span className="font-normal text-ink-muted">(optional)</span>
                </Label>
                <Input
                  id="recurring-url"
                  value={url}
                  maxLength={300}
                  placeholder="Where you manage it"
                  {...errorProps('recurring-url', errors.url)}
                  onChange={(event) => {
                    setUrl(event.target.value)
                    clearError('url')
                  }}
                />
                <FieldError id="recurring-url-error" message={errors.url} />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="recurring-note">
            Note <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Textarea
            id="recurring-note"
            rows={2}
            maxLength={500}
            value={note}
            {...errorProps('recurring-note', errors.note)}
            onChange={(event) => {
              setNote(event.target.value)
              clearError('note')
            }}
          />
          <FieldError id="recurring-note-error" message={errors.note} />
        </div>
      </div>

      {formError && <FormError message={formError} className="mt-5" />}

      {existing && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          {!hasEnded(existing) &&
            (existing.isActive ? (
              <ActionRow
                title="Pause"
                description="Nothing is added or asked for until you resume it."
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => changeState('pause', existing)}
                >
                  Pause
                </Button>
              </ActionRow>
            ) : (
              <ActionRow
                title="Resume"
                description="It continues from its next date. Payments missed while paused are left out."
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => changeState('resume', existing)}
                >
                  Resume
                </Button>
              </ActionRow>
            ))}
          {!hasEnded(existing) && (
            <ActionRow
              title={itemKind === 'subscription' ? 'Cancel' : 'End'}
              description="It ends today, so nothing after today is added. To restart it, set a new next date and end."
            >
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => changeState('cancel', existing)}
              >
                {itemKind === 'subscription' ? 'Cancel subscription' : 'End today'}
              </Button>
            </ActionRow>
          )}
          <ActionRow
            title="Delete"
            description={
              hasEnded(existing)
                ? 'It has ended. Remove it from the list; what it added stays.'
                : 'Remove it for good. What it already added stays.'
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              className="text-expense"
              onClick={() => setConfirmDelete(true)}
            >
              Delete…
            </Button>
          </ActionRow>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {existing ? 'Save changes' : `Add ${kindLabels[itemKind].noun}`}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DialogBody({
  target,
  onClose
}: {
  target: RecurringDialogTarget
  onClose: () => void
}): React.JSX.Element | null {
  const accounts = useAccounts()
  const categories = useCategories()
  const picksPreset = target.kind === 'new' && target.itemKind === 'subscription'
  // A new subscription starts with the presets: undefined until one (or "Custom", '') is picked.
  const [preset, setPreset] = useState<string | undefined>(picksPreset ? undefined : '')

  if (!accounts.data || !categories.data) return null
  if (preset === undefined) return <PresetPicker onPick={setPreset} />
  return (
    <RecurringForm
      target={target}
      accounts={accounts.data}
      categories={categories.data}
      presetTitle={preset || undefined}
      onClose={onClose}
    />
  )
}

/** Add or edit recurring income, a recurring expense or a subscription; editing also deletes. */
export function RecurringDialog({
  target,
  onClose
}: {
  target: RecurringDialogTarget | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(38rem,calc(100vw-2rem))]">
        {target && (
          <DialogBody
            key={target.kind === 'edit' ? target.item.id : `new-${target.itemKind}`}
            target={target}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

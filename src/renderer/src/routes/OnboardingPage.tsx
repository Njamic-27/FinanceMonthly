import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Check, CircleCheck, Plus, X } from 'lucide-react'
import { accountTypeLabels, accountTypes, type Account, type AccountType } from '@shared/accounts'
import type { Category, CategoryType } from '@shared/categories'
import { formatDate, monthlySchedule, today } from '@shared/dates'
import { decimalSeparator, formatMoney } from '@shared/money'
import { AmountInput } from '@renderer/components/AmountInput'
import { BrandMark } from '@renderer/components/BrandMark'
import { ColorChip } from '@renderer/components/ColorChip'
import { FieldError } from '@renderer/components/FieldError'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { AccountDialog, type AccountDialogTarget } from '@renderer/features/accounts/AccountDialog'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { useAccounts } from '@renderer/features/accounts/queries'
import { categoryIconComponents } from '@renderer/features/categories/appearance'
import {
  CategoryDialog,
  type CategoryDialogTarget
} from '@renderer/features/categories/CategoryDialog'
import { useCategories, useDeleteCategory } from '@renderer/features/categories/queries'
import { useCreateRecurringItem } from '@renderer/features/recurring/queries'
import {
  currencyOptions,
  localeOptions,
  weekdayName,
  weekStartOptions
} from '@renderer/features/settings/options'
import { useSettings, useUpdateSettings } from '@renderer/features/settings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

const steps = [
  {
    title: 'Money and dates',
    label: 'Currency and dates',
    description: 'How amounts and dates look. You can change this later in Settings.'
  },
  {
    title: 'Your accounts',
    label: 'Accounts',
    description:
      'Add the cards and cash you pay with, with what’s on each of them today. Every transaction comes from or goes to one of them.'
  },
  {
    title: 'Categories',
    label: 'Categories',
    description:
      'What you sort spending and income into. Remove the ones you won’t use and add your own; you can change them any time.'
  },
  {
    title: 'Salary',
    label: 'Salary (optional)',
    description:
      'If you’re paid a regular monthly salary, add it here and it shows up in your plans and projections.'
  }
]

const showError = (title: string) => (error: Error) =>
  toast({ title, description: error.message, variant: 'error' })

interface StepProps {
  onBack?: () => void
  onNext: () => void
}

function StepFooter({
  onBack,
  children
}: {
  onBack?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
      <div>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/**
 * Confirms what just happened, in place of a toast: toasts stacked up over the step's buttons.
 * Always mounted so screen readers announce each new message.
 */
function StepNotice({ message }: { message: string | null }): React.JSX.Element {
  return (
    <p role="status" className="mt-4 flex min-h-6 items-center gap-2 text-sm text-ink-muted">
      {message && (
        <>
          <CircleCheck className="size-4 shrink-0 text-income" aria-hidden />
          {message}
        </>
      )}
    </p>
  )
}

function Field({
  id,
  label,
  children
}: {
  id: string
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function BasicsStep({ onNext }: StepProps): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  if (!settings) return null

  const save = (patch: Parameters<typeof updateSettings.mutate>[0]): void =>
    updateSettings.mutate(patch, { onError: showError('Not saved') })
  const { currency, locale, weekStart } = settings

  return (
    <>
      <div className="grid max-w-md gap-5">
        <Field id="setup-currency" label="Currency">
          <Select value={currency} onValueChange={(value) => save({ currency: value })}>
            <SelectTrigger id="setup-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions(currency).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="setup-locale" label="Number and date format">
          <Select value={locale} onValueChange={(value) => save({ locale: value })}>
            <SelectTrigger id="setup-locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {localeOptions(locale).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="setup-week-start" label="First day of the week">
          <Select
            value={String(weekStart)}
            onValueChange={(value) => save({ weekStart: Number(value) })}
          >
            <SelectTrigger id="setup-week-start">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekStartOptions.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="rounded-control bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          Amounts look like{' '}
          <span className="amount text-ink">{formatMoney(123456, { currency, locale })}</span>,
          dates like{' '}
          <span className="text-ink">
            {formatDate(today(), locale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          , and weeks run {weekdayName(weekStart)} to {weekdayName((weekStart + 6) % 7)}.
        </p>
      </div>
      <StepFooter>
        <Button onClick={onNext}>Continue</Button>
      </StepFooter>
    </>
  )
}

function AccountsStep({ onBack, onNext }: StepProps): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts()
  const [dialog, setDialog] = useState<AccountDialogTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const active = (accounts.data ?? []).filter((a) => !a.isArchived)

  const shown = (a: Account): string =>
    a.type === 'credit' ? `${money.format(Math.max(0, -a.balance))} owed` : money.format(a.balance)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {accountTypes.map((type: AccountType) => {
          const Icon = accountTypeIcons[type]
          return (
            <Button key={type} variant="outline" onClick={() => setDialog({ kind: 'new', type })}>
              <Plus />
              <Icon />
              {accountTypeLabels[type]}
            </Button>
          )
        })}
      </div>

      {active.length > 0 ? (
        <ul className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface p-2">
          {active.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'edit', account: a })}
                className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ColorChip color={a.color} icon={accountTypeIcons[a.type]} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block text-sm text-ink-muted">{accountTypeLabels[a.type]}</span>
                </span>
                <span className="amount">{shown(a)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-panel border border-dashed border-line px-6 py-8 text-center text-ink-muted">
          No accounts yet. Start with the card you use most.
        </p>
      )}
      <StepNotice message={notice} />

      <StepFooter onBack={onBack}>
        {active.length === 0 && (
          <span className="text-sm text-ink-muted">Add at least one account to continue</span>
        )}
        <Button disabled={active.length === 0} onClick={onNext}>
          Continue
        </Button>
      </StepFooter>

      <AccountDialog
        target={dialog}
        accounts={accounts.data ?? []}
        onClose={() => setDialog(null)}
        onDone={setNotice}
      />
    </>
  )
}

function CategoryChips({
  type,
  categories,
  onEdit,
  onAdd,
  onRemoved
}: {
  type: CategoryType
  categories: Category[]
  onEdit: (category: Category) => void
  onAdd: () => void
  onRemoved: (message: string) => void
}): React.JSX.Element {
  const deleteCategory = useDeleteCategory()
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">{type === 'expense' ? 'Spending' : 'Income'}</h2>
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="inline-flex items-center rounded-full border border-line bg-surface py-1 pr-1 pl-1"
          >
            <button
              type="button"
              onClick={() => onEdit(c)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full pr-2 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <ColorChip color={c.color} icon={categoryIconComponents[c.icon]} size="sm" />
              <span className="text-sm font-semibold">{c.name}</span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${c.name}`}
              title="Remove"
              disabled={deleteCategory.isPending}
              onClick={() =>
                deleteCategory.mutate(c.id, {
                  onSuccess: () => onRemoved(`${c.name} removed`),
                  onError: showError(`${c.name} not removed`)
                })
              }
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        <li>
          <Button variant="ghost" size="sm" className="h-9 rounded-full" onClick={onAdd}>
            <Plus />
            Add
          </Button>
        </li>
      </ul>
    </section>
  )
}

function CategoriesStep({ onBack, onNext }: StepProps): React.JSX.Element {
  const categories = useCategories()
  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const active = (categories.data ?? []).filter((c) => !c.isArchived)

  return (
    <>
      <div className="grid gap-8">
        {(['expense', 'income'] as const).map((type) => (
          <CategoryChips
            key={type}
            type={type}
            categories={active.filter((c) => c.type === type)}
            onEdit={(category) => setDialog({ kind: 'edit', category })}
            onAdd={() => setDialog({ kind: 'new', type })}
            onRemoved={setNotice}
          />
        ))}
      </div>
      <StepNotice message={notice} />
      <StepFooter onBack={onBack}>
        <Button onClick={onNext}>Continue</Button>
      </StepFooter>
      <CategoryDialog
        target={dialog}
        categories={categories.data ?? []}
        onClose={() => setDialog(null)}
        onDone={setNotice}
      />
    </>
  )
}

const paydays = Array.from({ length: 31 }, (_, i) => i + 1)

function SalaryStep({
  onBack,
  onFinish
}: {
  onBack: () => void
  onFinish: (withSalary: boolean) => void
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = (useAccounts().data ?? []).filter((a) => !a.isArchived)
  const incomeCategories = (useCategories().data ?? []).filter(
    (c) => c.type === 'income' && !c.isArchived
  )
  const createRecurring = useCreateRecurringItem()

  const [amount, setAmount] = useState('')
  const [payday, setPayday] = useState('10')
  const [accountId, setAccountId] = useState(
    String(accounts.find((a) => a.type === 'debit')?.id ?? accounts[0]?.id ?? '')
  )
  const [categoryId, setCategoryId] = useState(
    String(incomeCategories.find((c) => c.name === 'Salary')?.id ?? incomeCategories[0]?.id ?? '')
  )
  const [error, setError] = useState<string | undefined>()

  const schedule = monthlySchedule(Number(payday), today())

  const submit = (): void => {
    const cents = money.parse(amount)
    if (cents === null || cents <= 0) {
      setError(
        amount.trim() ? `Enter an amount like ${money.toInput(245000)}` : 'Enter your monthly pay'
      )
      return
    }
    createRecurring.mutate(
      {
        kind: 'income',
        title: 'Salary',
        amount: cents,
        accountId: Number(accountId),
        categoryId: Number(categoryId),
        frequency: 'monthly',
        interval: 1,
        ...schedule,
        autoPost: true,
        reminderDaysBefore: null
      },
      { onSuccess: () => onFinish(true), onError: showError('Salary not added') }
    )
  }

  return (
    <>
      <div className="grid max-w-md gap-5">
        <Field id="salary-amount" label="Monthly pay, after tax">
          <AmountInput
            id="salary-amount"
            size="lg"
            value={amount}
            placeholder={`0${decimalSeparator(money.locale)}00`}
            {...errorProps('salary-amount', error)}
            onChange={(event) => {
              setAmount(event.target.value)
              setError(undefined)
            }}
          />
          <FieldError id="salary-amount-error" message={error} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="salary-day" label="Paid on day">
            <Select value={payday} onValueChange={setPayday}>
              <SelectTrigger id="salary-day">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paydays.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="salary-account" label="Paid into">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="salary-account">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {incomeCategories.length > 1 && (
          <Field id="salary-category" label="Category">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="salary-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {incomeCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <p className="text-sm text-ink-muted">
          Next expected on{' '}
          <span className="text-ink">
            {formatDate(schedule.nextDueDate, money.locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </span>
          {Number(payday) > 28 && ' — in shorter months, on their last day'}.
        </p>
      </div>
      <StepFooter onBack={onBack}>
        <Button
          variant="ghost"
          disabled={createRecurring.isPending}
          onClick={() => onFinish(false)}
        >
          Skip
        </Button>
        <Button disabled={createRecurring.isPending || !accountId || !categoryId} onClick={submit}>
          Add salary and finish
        </Button>
      </StepFooter>
    </>
  )
}

/** First-run setup: currency and dates, accounts, categories, and an optional salary. */
export function OnboardingPage(): React.JSX.Element | null {
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  // Set while finishing, so the optimistic onboardingDone doesn't redirect before we navigate.
  const [finishing, setFinishing] = useState(false)

  if (!settings.data) return null
  if (settings.data.onboardingDone && !finishing) return <Navigate to="/" replace />

  const finish = (how: 'done' | 'skipped', withSalary = false): void => {
    setFinishing(true)
    updateSettings.mutate(
      { onboardingDone: true },
      {
        onSuccess: () => {
          toast(
            how === 'skipped'
              ? { title: 'Setup skipped', description: 'Add your accounts any time in Accounts.' }
              : {
                  title: 'You’re all set',
                  description: withSalary
                    ? 'Your salary is in. Add what you spend with Ctrl+N.'
                    : 'Add what you spend with Ctrl+N.',
                  variant: 'success'
                }
          )
          // Accounts shows what was just set up; the dashboard is a placeholder until step 18.
          navigate(how === 'skipped' ? '/' : '/accounts', { replace: true })
        },
        onError: (error) => {
          setFinishing(false)
          showError('Setup not finished')(error)
        }
      }
    )
  }

  const back = (): void => setStep((s) => Math.max(0, s - 1))
  const next = (): void => setStep((s) => Math.min(steps.length - 1, s + 1))
  const current = steps[step]

  return (
    <div className="grid min-h-screen grid-cols-[17rem_1fr]">
      <aside className="flex flex-col border-r border-line bg-surface px-6 py-8">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-xl font-bold tracking-tight">Financije</span>
        </div>
        <p className="mt-8 text-sm text-ink-muted">Set up in four short steps.</p>
        <ol className="mt-4 grid gap-1" aria-label="Setup steps">
          {steps.map((s, i) => (
            <li
              key={s.title}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-control px-2 py-2 text-sm',
                i === step ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-muted'
              )}
            >
              <span
                className={cn(
                  'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  i < step && 'border-primary bg-primary text-on-primary',
                  i === step && 'border-primary',
                  i > step && 'border-line'
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
        <div className="mt-auto">
          <Button variant="ghost" className="-ml-3" onClick={() => finish('skipped')}>
            Skip setup
          </Button>
        </div>
      </aside>

      <main className="overflow-y-auto">
        <div className="mx-auto max-w-2xl px-12 py-14">
          <p className="text-sm font-semibold text-primary">
            Step {step + 1} of {steps.length}
          </p>
          <h1 className="mt-1 text-[2rem] leading-tight font-bold">{current.title}</h1>
          <p className="mt-2 mb-8 max-w-xl text-ink-muted">{current.description}</p>

          {step === 0 && <BasicsStep onNext={next} />}
          {step === 1 && <AccountsStep onBack={back} onNext={next} />}
          {step === 2 && <CategoriesStep onBack={back} onNext={next} />}
          {step === 3 && (
            <SalaryStep onBack={back} onFinish={(withSalary) => finish('done', withSalary)} />
          )}
        </div>
      </main>
    </div>
  )
}

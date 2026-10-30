import { useState } from 'react'
import { ChevronDown, CreditCard } from 'lucide-react'
import type { MonthKey, MoneyOutGroup, MoneyOutLine } from '@shared/month'
import { ColorChip } from '@renderer/components/ColorChip'
import { Card } from '@renderer/components/ui/card'
import { accountTypeIcons } from '@renderer/features/accounts/appearance'
import { useAccounts } from '@renderer/features/accounts/queries'
import { useCurrency, type CurrencyTools } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'
import { MoneyOutLineDialog } from './MoneyOutLineDialog'
import { lineLabel } from './moneyOut'
import { t } from '@renderer/lib/i18n'

type MethodGroup = 'debit' | 'cash'

const groupOrder: MoneyOutGroup[] = [
  'subscriptions',
  'bills',
  'everyday',
  'loans',
  'savings',
  'card'
]

const totalOf = (l: Pick<MoneyOutLine, 'recorded' | 'planned'>): number => l.recorded + l.planned

/** Money out reads plain; money coming back (more taken out of savings than put in) gets "+". */
function formatOut(money: CurrencyTools, amount: number): string {
  return amount < 0 ? money.format(-amount, 'always') : money.format(amount)
}

/**
 * Money out by payment method (PLAN.md step 50), the main view: Debit and Cash, each account
 * with a line per group for what it paid and a line per card whose bill it pays. The lines
 * add up to money out. A group folds away on a click; a line opens what it's made of.
 */
export function PaymentMethodView({
  month,
  lines
}: {
  month: MonthKey
  lines: MoneyOutLine[]
}): React.JSX.Element {
  const money = useCurrency()
  const accounts = useAccounts().data ?? []
  const [folded, setFolded] = useState<Set<MethodGroup>>(() => new Set())
  const [open, setOpen] = useState<MoneyOutLine | null>(null)
  // Looked up again in fresh data, so the popup's total follows edits made in it.
  const openLine =
    open &&
    (lines.find(
      (l) => l.accountId === open.accountId && l.group === open.group && l.cardId === open.cardId
    ) ?? { ...open, recorded: 0, planned: 0, count: 0 })

  const shown = lines.filter((l) => totalOf(l) !== 0 || l.count > 0)
  const methods = (['debit', 'cash'] as MethodGroup[])
    .map((method) => {
      // A card paid from nothing (no debit account yet) shows under Debit with its own name.
      const owners = accounts.filter((a) =>
        method === 'cash' ? a.type === 'cash' : a.type !== 'cash'
      )
      const byAccount = owners
        .map((account) => ({
          account,
          lines: shown
            .filter((l) => l.accountId === account.id)
            .sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group))
        }))
        .filter((a) => a.lines.length > 0)
      const total = byAccount.reduce(
        (sum, a) => sum + a.lines.reduce((s, l) => s + totalOf(l), 0),
        0
      )
      return { method, byAccount, total }
    })
    .filter((m) => m.byAccount.length > 0)

  const toggle = (method: MethodGroup): void =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(method)) next.delete(method)
      else next.add(method)
      return next
    })

  if (methods.length === 0) {
    return <p className="px-1 text-ink-muted">{t('month.nothingLeft')}</p>
  }

  return (
    <>
      {methods.map(({ method, byAccount, total }) => {
        const isOpen = !folded.has(method)
        const listId = `month-method-${method}`
        return (
          <Card key={method} className="p-0">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={listId}
              onClick={() => toggle(method)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-panel px-5 py-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronDown
                className={cn(
                  'size-5 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none',
                  !isOpen && '-rotate-90'
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-lg font-semibold">
                {t(`month.method.${method}`)}
              </span>
              <span className="amount text-lg">{formatOut(money, total)}</span>
            </button>
            {isOpen && (
              <div id={listId} className="grid gap-3 border-t border-line px-2 py-3">
                {byAccount.map(({ account, lines: accountLines }) => (
                  <section key={account.id} aria-label={account.name}>
                    {byAccount.length > 1 || method === 'debit' ? (
                      <p className="flex items-center gap-2 px-3 pb-1 text-sm font-semibold text-ink-muted">
                        <ColorChip
                          color={account.color}
                          icon={accountTypeIcons[account.type]}
                          size="sm"
                        />
                        {account.name}
                        <span className="amount ml-auto">
                          {formatOut(
                            money,
                            accountLines.reduce((s, l) => s + totalOf(l), 0)
                          )}
                        </span>
                      </p>
                    ) : null}
                    <ul>
                      {accountLines.map((line) => (
                        <li key={`${line.group}-${line.cardId}`}>
                          <button
                            type="button"
                            onClick={() => setOpen(line)}
                            className="link-row flex w-full items-center gap-3 px-3 py-2 text-left"
                          >
                            {line.group === 'card' && (
                              <CreditCard className="size-4 shrink-0 text-ink-muted" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">
                                {lineLabel(line, accounts)}
                              </span>
                              <span className="block truncate text-sm text-ink-muted">
                                {[
                                  line.count > 0 && t('month.transactions', { count: line.count }),
                                  line.planned !== 0 &&
                                    t('month.stillPlanned', {
                                      amount: money.format(Math.abs(line.planned))
                                    })
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                            <span
                              className={cn('amount shrink-0', totalOf(line) < 0 && 'text-income')}
                            >
                              {formatOut(money, totalOf(line))}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>
        )
      })}
      <MoneyOutLineDialog month={month} line={openLine} onClose={() => setOpen(null)} />
    </>
  )
}

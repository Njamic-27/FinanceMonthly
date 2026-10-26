import { currencyAffix } from '@shared/money'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { cn } from '@renderer/lib/utils'

type AmountInputProps = Omit<React.ComponentProps<'input'>, 'type'>

/**
 * A text field for money, with the currency symbol on the side the locale writes it.
 * The value stays the typed text; read it with `useCurrency().parse`.
 */
export function AmountInput({ className, ...props }: AmountInputProps): React.JSX.Element {
  const { currency, locale } = useCurrency()
  const { symbol, position } = currencyAffix(currency, locale)
  const affix = <span className="shrink-0 text-ink-muted select-none">{symbol}</span>

  return (
    <div
      className={cn(
        'flex h-10 w-full min-w-0 items-center gap-2 rounded-control border border-line bg-surface px-3 transition-colors focus-within:border-primary focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary hover:border-ink-muted/40 has-aria-invalid:border-expense has-disabled:opacity-50',
        className
      )}
    >
      {position === 'prefix' && affix}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="amount h-full min-w-0 flex-1 bg-transparent text-body font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted/70"
        {...props}
      />
      {position === 'suffix' && affix}
    </div>
  )
}

import { useMemo } from 'react'
import {
  formatAmountInput,
  formatMoney,
  formatMoneyCompact,
  parseAmount,
  type Cents
} from '@shared/money'
import { defaultSettings } from '@shared/settings'
import { useSettings } from '@renderer/features/settings/queries'

export interface CurrencyTools {
  currency: string
  locale: string
  /** "€1,234.50"; pass 'exceptZero' for "+€1,234.50". */
  format: (cents: Cents, signDisplay?: Intl.NumberFormatOptions['signDisplay']) => string
  /** "€1.2K", for chart axes. */
  compact: (cents: Cents) => string
  /** Reads a typed amount; null if it isn't one. */
  parse: (input: string) => Cents | null
  /** Value for an editable amount field, e.g. "1234.50". */
  toInput: (cents: Cents) => string
}

/** Money formatting for the currency and locale chosen in Settings. */
export function useCurrency(): CurrencyTools {
  const { data } = useSettings()
  const currency = data?.currency ?? defaultSettings.currency
  const locale = data?.locale ?? defaultSettings.locale

  return useMemo(
    () => ({
      currency,
      locale,
      format: (cents, signDisplay) => formatMoney(cents, { currency, locale }, signDisplay),
      compact: (cents) => formatMoneyCompact(cents, { currency, locale }),
      parse: (input) => parseAmount(input, locale),
      toInput: (cents) => formatAmountInput(cents, locale)
    }),
    [currency, locale]
  )
}

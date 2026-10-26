/**
 * Money is stored as an integer number of hundredths of the currency unit ("cents"),
 * whatever the currency. Only formatting looks at the currency (e.g. JPY shows no decimals).
 */
export type Cents = number

export interface MoneyFormat {
  currency: string
  locale: string
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(
  locale: string,
  options: Intl.NumberFormatOptions & { currency?: string }
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, options)
    formatters.set(key, f)
  }
  return f
}

/** "€1,234.50" — `signDisplay: 'exceptZero'` gives "+€1,234.50" / "−€1,234.50". */
export function formatMoney(
  cents: Cents,
  { currency, locale }: MoneyFormat,
  signDisplay: Intl.NumberFormatOptions['signDisplay'] = 'auto'
): string {
  return formatter(locale, { style: 'currency', currency, signDisplay }).format(cents / 100)
}

/** The locale's decimal separator, e.g. "." for en-GB and "," for hr-HR. */
export function decimalSeparator(locale: string): string {
  return (
    formatter(locale, {})
      .formatToParts(1.5)
      .find((p) => p.type === 'decimal')?.value ?? '.'
  )
}

/** Value for an editable amount field: no currency symbol or grouping, e.g. "1234,50". */
export function formatAmountInput(cents: Cents, locale: string): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const fraction = abs % 100
  return fraction === 0
    ? `${sign}${whole}`
    : `${sign}${whole}${decimalSeparator(locale)}${String(fraction).padStart(2, '0')}`
}

/**
 * Parses what a person types into an amount field. Accepts "12", "12.5", "12,50",
 * "1,234.56", "1.234,56", "1 234,56", "€ 12" and a leading minus. When both "." and ","
 * appear, the last one is the decimal separator. A single separator followed by exactly
 * three digits ("1.234") is read using the locale. Returns null when it isn't an amount
 * or has more than two decimals.
 */
export function parseAmount(input: string, locale: string): Cents | null {
  // Currency symbols or codes around the number, e.g. "€", "EUR", "kn".
  const surrounding = /^[^\d.,\-−]+|[^\d.,\-−]+$/g
  let s = input.replace(/[\s\u00a0\u202f']/g, '').replace(surrounding, '')
  let negative = false
  if (/^[-−]/.test(s)) {
    negative = true
    s = s.slice(1).replace(surrounding, '') // "-€12"
  }
  if (!/^[\d.,]+$/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let decimal: string | null = null

  if (lastDot !== -1 && lastComma !== -1) {
    decimal = lastDot > lastComma ? '.' : ','
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ','
    const count = s.split(sep).length - 1
    const digitsAfter = s.length - s.lastIndexOf(sep) - 1
    if (count === 1 && (digitsAfter !== 3 || sep === decimalSeparator(locale))) decimal = sep
  }

  const group = decimal === '.' ? ',' : decimal === ',' ? '.' : null
  const [whole, fraction = '', ...rest] = (
    group ? s.split(group).join('') : s.replace(/[.,]/g, '')
  ).split(decimal ?? '\0')
  if (rest.length > 0 || fraction.length > 2 || !/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) {
    return null
  }
  if (whole === '' && fraction === '') return null

  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return negative && cents !== 0 ? -cents : cents
}

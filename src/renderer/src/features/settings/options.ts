/** Choices offered on the Settings screen. Labels are English, like the rest of the UI. */

export interface Option<V> {
  value: V
  label: string
}

/** Currencies offered first: the euro, its neighbours and the major world currencies. */
export const currencyCodes = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'BAM',
  'RSD',
  'MKD',
  'HUF',
  'PLN',
  'CZK',
  'RON',
  'BGN',
  'TRY',
  'SEK',
  'NOK',
  'DKK',
  'CAD',
  'AUD',
  'JPY'
]

/** Number and date formats. A locale only changes formatting, never the UI language. */
export const localeTags = [
  'en-GB',
  'en-US',
  'hr-HR',
  'sl-SI',
  'bs-BA',
  'sr-Latn-RS',
  'de-DE',
  'de-AT',
  'de-CH',
  'it-IT',
  'fr-FR',
  'es-ES',
  'nl-NL',
  'hu-HU',
  'pl-PL',
  'cs-CZ',
  'sv-SE'
]

const currencyNames = new Intl.DisplayNames('en', { type: 'currency' })
const localeNames = new Intl.DisplayNames('en', { type: 'language', languageDisplay: 'standard' })

/** Keeps a saved value selectable even when it isn't in the list. */
function withCurrent(values: string[], current: string | undefined): string[] {
  return current && !values.includes(current) ? [current, ...values] : values
}

/** "EUR · Euro" */
export function currencyOptions(current?: string): Option<string>[] {
  return withCurrent(currencyCodes, current).map((code) => ({
    value: code,
    label: `${code} · ${currencyNames.of(code) ?? code}`
  }))
}

/** "Croatian (Croatia)" */
export function localeOptions(current?: string): Option<string>[] {
  return withCurrent(localeTags, current).map((tag) => ({
    value: tag,
    label: localeNames.of(tag) ?? tag
  }))
}

/** Monday, 5 January 2026 — any known Monday works as a base. */
const A_MONDAY = Date.UTC(2026, 0, 5)
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' })

/** Day name for Settings.weekStart numbering (0 = Sunday … 6 = Saturday). */
export function weekdayName(day: number): string {
  const offsetFromMonday = (day + 6) % 7
  return weekdayFormat.format(A_MONDAY + offsetFromMonday * 86_400_000)
}

/** Monday through Sunday, valued 1…6, 0. */
export const weekStartOptions: Option<number>[] = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  value: day,
  label: weekdayName(day)
}))

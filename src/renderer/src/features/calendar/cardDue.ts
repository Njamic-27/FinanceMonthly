import type { CardDueMarker } from '@shared/planned'
import type { CurrencyTools } from '@renderer/hooks/useCurrency'

/** "Mastercard due · €287.17", "Mastercard due · paid", or "Mastercard due" before the statement closes. */
export function cardDueLabel(marker: CardDueMarker, money: CurrencyTools): string {
  if (marker.amount === null) return `${marker.name} due`
  return `${marker.name} due · ${marker.amount > 0 ? money.format(marker.amount) : 'paid'}`
}

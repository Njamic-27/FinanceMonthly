import { formatDate, type IsoDate } from '@shared/dates'
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS, splitInstallments } from '@shared/installments'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps } from '@renderer/lib/forms'
import { parseCount } from './count'

/**
 * "Pay in installments" for an expense on a credit card: a switch, the number of
 * installments and the monthly amount worked out live ("€2,000.00 / 5 = €400.00/month").
 */
export function InstallmentsField({
  enabled,
  onEnabledChange,
  count,
  onCountChange,
  total,
  firstDate,
  error
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  count: string
  onCountChange: (count: string) => void
  /** The amount entered so far, in cents; null while it isn't a valid amount. */
  total: number | null
  firstDate: IsoDate
  error?: string
}): React.JSX.Element {
  const money = useCurrency()
  const n = parseCount(count)
  const parts =
    total !== null && total >= (n ?? 1) && n !== null ? splitInstallments(total, n) : null

  return (
    <div className="grid gap-3 rounded-control bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="tx-installments">Pay in installments</Label>
          <p id="tx-installments-description" className="text-sm text-ink-muted">
            Split the purchase into monthly payments on the card.
          </p>
        </div>
        <Switch
          id="tx-installments"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-describedby="tx-installments-description"
        />
      </div>

      {enabled && (
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Input
                id="tx-installments-count"
                type="number"
                min={MIN_INSTALLMENTS}
                max={MAX_INSTALLMENTS}
                className="w-20"
                aria-label="Number of installments"
                value={count}
                {...errorProps('tx-installments-count', error)}
                onChange={(event) => onCountChange(event.target.value)}
              />
              <span className="text-ink-muted">installments</span>
            </div>
            {parts && total !== null && n !== null && (
              <p className="amount" aria-live="polite">
                {money.format(total)} / {n} = {money.format(parts[0])}/month
              </p>
            )}
          </div>
          <FieldError id="tx-installments-count-error" message={error} />
          {parts && (
            <p className="text-sm text-ink-muted">
              {parts[0] !== parts[parts.length - 1] &&
                `Last installment ${money.format(parts[parts.length - 1])}. `}
              The first is charged on {formatDate(firstDate, money.locale)}, then one each month.
              What’s still to come is held from the card’s limit.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

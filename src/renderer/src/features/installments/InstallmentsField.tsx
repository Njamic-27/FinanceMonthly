import { formatDate, type IsoDate } from '@shared/dates'
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS, splitInstallments } from '@shared/installments'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { errorProps } from '@renderer/lib/forms'
import { parseCount } from './count'
import { t } from '@renderer/lib/i18n'

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
          <Label htmlFor="tx-installments">{t('inst.pay')}</Label>
          <p id="tx-installments-description" className="text-sm text-ink-muted">
            {t('inst.payHint')}
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
                aria-label={t('inst.count')}
                value={count}
                {...errorProps('tx-installments-count', error)}
                onChange={(event) => onCountChange(event.target.value)}
              />
              <span className="text-ink-muted">{t('inst.installments')}</span>
            </div>
            {parts && total !== null && n !== null && (
              <p className="amount" aria-live="polite">
                {t('inst.perMonth', {
                  total: money.format(total),
                  count: n,
                  each: money.format(parts[0])
                })}
              </p>
            )}
          </div>
          <FieldError id="tx-installments-count-error" message={error} />
          {parts && (
            <p className="text-sm text-ink-muted">
              {parts[0] !== parts[parts.length - 1] &&
                `${t('inst.last', { amount: money.format(parts[parts.length - 1]) })} `}
              {t('inst.firstOn', { date: formatDate(firstDate, money.locale) })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

import type { ProjectionResult } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { useUpdateSettings } from '@renderer/features/settings/queries'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { toast } from '@renderer/lib/toast'

const monthsOptions = [1, 3, 6, 12]

/**
 * What the projection assumes beyond what's planned, as switches. They're saved in Settings,
 * so the dashboard teaser and later visits use the same assumptions.
 */
export function Assumptions({
  projection,
  className
}: {
  projection: ProjectionResult
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const update = useUpdateSettings()
  const { assumptions } = projection
  const save = (patch: Parameters<typeof update.mutate>[0]): void =>
    update.mutate(patch, {
      onError: (error) =>
        toast({ title: 'Not saved', description: error.message, variant: 'error' })
    })

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Assumptions</CardTitle>
          <CardDescription>
            Always included: today’s balance, recurring income and bills, subscriptions, card and
            bank loan installments, and anything entered for later dates.
          </CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-5">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="assume-variable">Everyday spending</Label>
              <p id="assume-variable-description" className="text-sm text-ink-muted">
                {assumptions.variableMonthly === null
                  ? 'Your average once there’s a full month of data.'
                  : `About ${money.format(assumptions.variableMonthly)} a month: what you spent beyond bills and installments.`}
              </p>
            </div>
            <Switch
              id="assume-variable"
              checked={assumptions.includeVariable}
              onCheckedChange={(on) => save({ projectionIncludeVariable: on })}
              aria-describedby="assume-variable-description"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="assume-months" className="font-normal text-ink-muted">
              Averaged over the last
            </Label>
            <Select
              value={String(assumptions.variableMonths)}
              onValueChange={(value) => save({ projectionVariableMonths: Number(value) })}
            >
              <SelectTrigger id="assume-months" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthsOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 1 ? 'month' : `${n} months`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <div>
            <Label htmlFor="assume-savings">Savings plans</Label>
            <p id="assume-savings-description" className="text-sm text-ink-muted">
              {assumptions.savingsMonthly > 0
                ? `${money.format(assumptions.savingsMonthly)} a month into your goals, until each is reached.`
                : 'None of your goals has a monthly amount yet.'}
            </p>
          </div>
          <Switch
            id="assume-savings"
            checked={assumptions.includeSavings}
            onCheckedChange={(on) => save({ projectionIncludeSavings: on })}
            aria-describedby="assume-savings-description"
          />
        </div>
      </div>
    </Card>
  )
}

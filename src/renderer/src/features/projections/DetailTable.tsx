import { Link } from 'react-router'
import type { ProjectionResult } from '@shared/projection'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { useCurrency } from '@renderer/hooks/useCurrency'
import { dayPath } from '@renderer/lib/links'
import { cn } from '@renderer/lib/utils'
import { periodLabel } from './labels'
import { flowParts } from './parts'

/**
 * Every week or month of the projection in numbers: the table behind both charts. Each opens in
 * the Calendar, with what's planned in it.
 */
export function DetailTable({
  projection,
  className
}: {
  projection: ProjectionResult
  className?: string
}): React.JSX.Element {
  const money = useCurrency()
  const parts = flowParts.filter((part) => projection.periods.some((p) => p[part.key] > 0))

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Each {projection.granularity}, and the balance at its end.
          </CardDescription>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-semibold">
                {projection.granularity === 'week' ? 'Week' : 'Month'}
              </th>
              {parts.map((part) => (
                <th key={part.key} scope="col" className="py-2 pr-4 text-right font-semibold">
                  {part.label}
                </th>
              ))}
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Net
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {projection.periods.map((p) => (
              <tr key={p.start}>
                <th scope="row" className="py-2 pr-4 text-left font-semibold whitespace-nowrap">
                  <Link to={dayPath(p.start)} className="link">
                    {periodLabel(p, projection.granularity, money.locale)}
                  </Link>
                </th>
                {parts.map((part) => (
                  <td key={part.key} className="amount py-2 pr-4 text-right">
                    {p[part.key] ? money.format(p[part.key]) : '—'}
                  </td>
                ))}
                <td className="amount py-2 pr-4 text-right">{money.format(p.net, 'exceptZero')}</td>
                <td className={cn('amount py-2 text-right', p.balance < 0 && 'text-expense')}>
                  {money.format(p.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

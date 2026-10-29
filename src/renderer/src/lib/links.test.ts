import { describe, expect, it } from 'vitest'
import type { PlannedItem } from '@shared/planned'
import type { Transaction } from '@shared/transactions'
import { readCalendarDay, readCalendarMonth } from '@renderer/features/calendar/month'
import { readOverviewPeriod } from '@renderer/features/overview/period'
import { readFilters } from '@renderer/features/transactions/filters'
import { categoryPath, dayPath, milestonePath, ownerPath, periodPath, plannedPath } from './links'

const TODAY = '2026-10-26'
const query = (path: string): URLSearchParams => new URLSearchParams(path.split('?')[1])

describe('links', () => {
  it('opens a day in the Calendar with its panel', () => {
    const params = query(dayPath('2026-11-03'))
    expect(dayPath('2026-11-03').startsWith('/calendar?')).toBe(true)
    const month = readCalendarMonth(params, TODAY)
    expect(month).toBe('2026-11-01')
    expect(readCalendarDay(params, month)).toBe('2026-11-03')
  })

  it('opens a period in Overview', () => {
    const period = readOverviewPeriod(query(periodPath('week', '2026-10-14')), TODAY, 1)
    expect(period.kind).toBe('week')
    expect(period.range).toEqual({ start: '2026-10-12', end: '2026-10-18' })
  })

  it('opens a category in Transactions, within a period when given', () => {
    expect(readFilters(query(categoryPath(4)))).toEqual({ search: '', categoryId: 4 })
    expect(readFilters(query(categoryPath(4, { start: '2026-10-01', end: '2026-10-31' })))).toEqual(
      { search: '', categoryId: 4, from: '2026-10-01', to: '2026-10-31' }
    )
  })

  it('opens a planned payment’s row on Month, in the month it counts', () => {
    const planned = (patch: Partial<PlannedItem>): PlannedItem => ({
      source: 'recurring',
      sourceId: 7,
      date: TODAY,
      countsOn: TODAY,
      title: 'Rent',
      amount: 50000,
      group: 'expense',
      accountId: 2,
      categoryId: null,
      overdue: false,
      ...patch
    })
    const row = (path: string): [string | null, string | null] => {
      const params = new URLSearchParams(path.split('?')[1])
      return [params.get('month'), params.get('row')]
    }
    expect(row(plannedPath(planned({})))).toEqual(['2026-10', 'recurring:7'])
    // A charge on a card counts when its bill is due.
    expect(
      row(plannedPath(planned({ source: 'installment_plan', countsOn: '2026-11-15' })))
    ).toEqual(['2026-11', 'installment_plan:7'])
    expect(row(plannedPath(planned({ source: 'loan_installment', loanId: 3 })))).toEqual([
      '2026-10',
      'loan:3'
    ])
  })

  it('opens savings and loan payments on their goal or loan', () => {
    const tx = { savingsGoalId: null, loanId: null } as Transaction
    expect(ownerPath(tx)).toBeNull()
    expect(ownerPath({ ...tx, savingsGoalId: 5 })).toBe('/savings/5')
    expect(ownerPath({ ...tx, loanId: 9 })).toBe('/loans/9')
  })

  it('opens what a milestone is about, or its day', () => {
    expect(milestonePath({ kind: 'goal_reached', sourceId: 1, title: 'Car', date: TODAY })).toBe(
      '/savings/1'
    )
    expect(milestonePath({ kind: 'below_zero', date: '2027-02-10', balance: -100 })).toBe(
      dayPath('2027-02-10')
    )
  })
})

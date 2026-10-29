import { describe, expect, it } from 'vitest'
import type { PlannedItem } from './planned'
import { project, type ProjectionInput } from './projection'

// Tuesday 27 October 2026.
const TODAY = '2026-10-27'

const item = (
  date: string,
  amount: number,
  group: PlannedItem['group'] = 'expense',
  title = 'Rent'
): PlannedItem => ({
  source: group === 'loan' ? 'loan_installment' : 'recurring',
  sourceId: 1,
  date,
  countsOn: date,
  title,
  amount,
  group,
  accountId: 1,
  categoryId: null,
  overdue: date < TODAY
})

const input = (overrides: Partial<ProjectionInput> = {}): ProjectionInput => ({
  today: TODAY,
  end: '2027-01-31',
  granularity: 'month',
  weekStart: 1,
  startBalance: 100000,
  planned: [],
  recorded: [],
  variableMonthly: null,
  savings: [],
  payoffs: [],
  ...overrides
})

const months = (projection: ReturnType<typeof project>): [string, string, number, number][] =>
  projection.periods.map((p) => [p.start, p.end, p.net, p.balance])

describe('project', () => {
  it('stays flat with nothing planned', () => {
    const projection = project(input())
    expect(months(projection)).toEqual([
      ['2026-10-27', '2026-10-31', 0, 100000],
      ['2026-11-01', '2026-11-30', 0, 100000],
      ['2026-12-01', '2026-12-31', 0, 100000],
      ['2027-01-01', '2027-01-31', 0, 100000]
    ])
    expect(projection.endBalance).toBe(100000)
    expect(projection.milestones).toEqual([])
  })

  it('puts payments on the last days of months in those months', () => {
    const projection = project(
      input({
        planned: [
          item('2026-10-31', 245000, 'income', 'Salary'),
          item('2026-11-30', 245000, 'income', 'Salary'),
          item('2026-12-31', 245000, 'income', 'Salary'),
          item('2026-11-01', 65000),
          item('2026-12-01', 65000)
        ]
      })
    )
    expect(months(projection)).toEqual([
      ['2026-10-27', '2026-10-31', 245000, 345000],
      ['2026-11-01', '2026-11-30', 180000, 525000],
      ['2026-12-01', '2026-12-31', 180000, 705000],
      ['2027-01-01', '2027-01-31', 0, 705000]
    ])
    expect(projection.periods[1]).toMatchObject({ inflow: 245000, fixed: 65000 })
  })

  it('counts a card charge in the month its bill is due', () => {
    // Netflix on the card on 5 November, on the bill due 15 December.
    const projection = project(
      input({ planned: [{ ...item('2026-11-05', 1399), countsOn: '2026-12-15' }] })
    )
    expect(months(projection).map(([start, , net]) => [start, net])).toEqual([
      ['2026-10-27', 0],
      ['2026-11-01', 0],
      ['2026-12-01', -1399],
      ['2027-01-01', 0]
    ])
  })

  it('counts overdue payments today', () => {
    const projection = project(input({ planned: [item('2026-10-15', 20000)] }))
    expect(projection.periods[0]).toMatchObject({ fixed: 20000, balance: 80000 })
  })

  it('stops a loan’s payments when it ends mid-horizon and marks the payoff', () => {
    const loan = ['2026-11-15', '2026-12-15', '2027-01-15'].map((d) => item(d, 30000, 'loan'))
    const projection = project(
      input({
        end: '2027-03-31',
        planned: loan,
        payoffs: [{ kind: 'loan_paid_off', sourceId: 7, title: 'Car loan', date: '2027-01-15' }]
      })
    )
    expect(projection.periods.map((p) => p.loans)).toEqual([0, 30000, 30000, 30000, 0, 0])
    expect(projection.endBalance).toBe(10000)
    expect(projection.milestones).toEqual([
      { kind: 'loan_paid_off', sourceId: 7, title: 'Car loan', date: '2027-01-15' }
    ])
  })

  it('leaves out payoffs outside the horizon', () => {
    const projection = project(
      input({
        payoffs: [
          { kind: 'plan_paid_off', sourceId: 1, title: 'Laptop', date: TODAY },
          { kind: 'plan_paid_off', sourceId: 2, title: 'TV', date: '2027-02-01' }
        ]
      })
    )
    expect(projection.milestones).toEqual([])
  })

  it('adds money already entered for later days', () => {
    const projection = project(
      input({
        recorded: [
          { date: TODAY, delta: -999 },
          { date: '2026-11-05', delta: -8000 },
          { date: '2026-11-06', delta: 3000 }
        ]
      })
    )
    expect(projection.periods[0].net).toBe(0)
    expect(projection.periods[1]).toMatchObject({ inflow: 3000, fixed: 8000, balance: 95000 })
  })

  it('spreads average spending over the days after today, without drift', () => {
    // 3,043.75 a month is exactly 100.00 a day.
    const projection = project(input({ variableMonthly: 304375 }))
    expect(projection.periods.map((p) => p.variable)).toEqual([40000, 300000, 310000, 310000])
    const other = project(input({ variableMonthly: 100000 }))
    const total = other.periods.reduce((sum, p) => sum + p.variable, 0)
    // 96 days after today at 1,000.00 a month.
    expect(total).toBe(Math.round((100000 * 96) / 30.4375))
  })

  it('follows savings plans until each goal is reached', () => {
    const plan = {
      goalId: 3,
      name: 'Holiday',
      plannedMonthly: 15000,
      saved: 170000,
      targetAmount: 200000,
      depositedThisMonth: true
    }
    const projection = project(input({ savings: [plan] }))
    // November and December, then the goal is full.
    expect(projection.periods.map((p) => p.savings)).toEqual([0, 15000, 15000, 0])
    expect(projection.milestones).toEqual([
      { kind: 'goal_reached', sourceId: 3, title: 'Holiday', date: '2026-12-01' }
    ])

    // Not deposited yet this month: today counts, and the last deposit only tops it up.
    const now = project(input({ savings: [{ ...plan, saved: 180000, depositedThisMonth: false }] }))
    expect(now.periods.map((p) => p.savings)).toEqual([15000, 5000, 0, 0])
    expect(now.milestones[0]).toMatchObject({ kind: 'goal_reached', date: '2026-11-01' })
  })

  it('warns when the balance goes below zero and finds the lowest point', () => {
    const projection = project(
      input({
        planned: [
          item('2026-11-01', 150000),
          item('2026-11-30', 245000, 'income', 'Salary'),
          item('2027-01-01', 300000)
        ]
      })
    )
    expect(projection.milestones).toEqual([
      { kind: 'below_zero', date: '2026-11-01', balance: -50000 }
    ])
    expect(projection.lowest).toEqual({ date: '2027-01-01', balance: -105000 })
  })

  it('works in weeks from the chosen first day', () => {
    const projection = project(
      input({ end: '2026-11-15', granularity: 'week', planned: [item('2026-11-02', 5000)] })
    )
    expect(projection.periods.map((p) => [p.start, p.end, p.fixed])).toEqual([
      ['2026-10-27', '2026-11-01', 0],
      ['2026-11-02', '2026-11-08', 5000],
      ['2026-11-09', '2026-11-15', 0]
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { cardCycle } from './cards'

describe('cardCycle', () => {
  it('pays the last statement until its due date passes', () => {
    // Statement on the 25th, due on the 15th of the next month.
    expect(cardCycle(25, 15, '2026-10-27')).toEqual({
      lastStatement: '2026-10-25',
      nextStatement: '2026-11-25',
      dueDate: '2026-11-15',
      dueStatement: '2026-10-25'
    })
    expect(cardCycle(25, 15, '2026-11-15')).toMatchObject({
      dueDate: '2026-11-15',
      dueStatement: '2026-10-25'
    })
    // After the 15th the next payment belongs to the statement that hasn't closed yet.
    expect(cardCycle(25, 15, '2026-11-16')).toEqual({
      lastStatement: '2026-10-25',
      nextStatement: '2026-11-25',
      dueDate: '2026-12-15',
      dueStatement: '2026-11-25'
    })
  })

  it('counts the statement day itself as closed', () => {
    expect(cardCycle(25, 15, '2026-10-25')).toMatchObject({
      lastStatement: '2026-10-25',
      nextStatement: '2026-11-25',
      dueStatement: '2026-10-25'
    })
  })

  it('handles a due day later in the same month', () => {
    // Statement on the 1st, due on the 20th.
    expect(cardCycle(1, 20, '2026-10-10')).toEqual({
      lastStatement: '2026-10-01',
      nextStatement: '2026-11-01',
      dueDate: '2026-10-20',
      dueStatement: '2026-10-01'
    })
    expect(cardCycle(1, 20, '2026-10-21')).toMatchObject({
      dueDate: '2026-11-20',
      dueStatement: '2026-11-01'
    })
  })

  it('moves the 31st to the last day of shorter months', () => {
    expect(cardCycle(31, 31, '2026-11-10')).toEqual({
      lastStatement: '2026-10-31',
      nextStatement: '2026-11-30',
      dueDate: '2026-11-30',
      dueStatement: '2026-10-31'
    })
    expect(cardCycle(31, 28, '2026-03-01')).toMatchObject({
      lastStatement: '2026-02-28',
      nextStatement: '2026-03-31',
      dueDate: '2026-03-28'
    })
  })

  it('works with only one of the two days', () => {
    expect(cardCycle(null, 15, '2026-10-27')).toEqual({
      lastStatement: null,
      nextStatement: null,
      dueDate: '2026-11-15',
      dueStatement: null
    })
    expect(cardCycle(null, 27, '2026-10-27').dueDate).toBe('2026-10-27')
    expect(cardCycle(25, null, '2026-10-27')).toEqual({
      lastStatement: '2026-10-25',
      nextStatement: '2026-11-25',
      dueDate: null,
      dueStatement: null
    })
    expect(cardCycle(null, null, '2026-10-27').dueDate).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { billDueDate, cardCycle, countedDate } from './cards'

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

describe('billDueDate', () => {
  it('pays a purchase with the bill of the next statement', () => {
    // Statement on the 25th, paid by the 15th of the next month.
    expect(billDueDate('2026-10-20', 25, 15)).toBe('2026-11-15')
    expect(billDueDate('2026-10-25', 25, 15)).toBe('2026-11-15')
    // After the statement day: the following bill.
    expect(billDueDate('2026-10-26', 25, 15)).toBe('2026-12-15')
    expect(billDueDate('2026-12-28', 25, 15)).toBe('2027-02-15')
  })

  it('pays in the same month when the due day comes after the statement day', () => {
    // Statement on the 5th, due on the 25th.
    expect(billDueDate('2026-10-03', 5, 25)).toBe('2026-10-25')
    expect(billDueDate('2026-10-06', 5, 25)).toBe('2026-11-25')
  })

  it('moves days past a month’s end to its last day', () => {
    // Statement on the 31st: 28 February closes February's statement.
    expect(billDueDate('2027-02-28', 31, 10)).toBe('2027-03-10')
    expect(billDueDate('2027-03-01', 31, 10)).toBe('2027-04-10')
    // A due day past the month's end, after a statement on the 15th: its last day.
    expect(billDueDate('2027-01-10', 15, 31)).toBe('2027-01-31')
    expect(billDueDate('2027-01-20', 15, 30)).toBe('2027-02-28')
  })
})

describe('countedDate', () => {
  const card = { type: 'credit', statementDay: 25, paymentDueDay: 15 }

  it('counts card spending on the bill’s due date', () => {
    expect(countedDate('2026-10-20', card, 'payment')).toBe('2026-11-15')
  })

  it('keeps the day for other accounts, cards without their days, and month of purchase', () => {
    expect(countedDate('2026-10-20', { ...card, type: 'debit' }, 'payment')).toBe('2026-10-20')
    expect(countedDate('2026-10-20', { ...card, statementDay: null }, 'payment')).toBe('2026-10-20')
    expect(countedDate('2026-10-20', card, 'purchase')).toBe('2026-10-20')
  })
})

import { describe, expect, it } from 'vitest'
import type { MonthSheetRow } from '@shared/month'
import {
  cellValue,
  editStart,
  moveCategory,
  needsSaving,
  rowNote,
  savingValue,
  sheetAmount,
  signedAmount
} from './cells'

const row = (overrides: Partial<MonthSheetRow> = {}): MonthSheetRow => ({
  kind: 'category',
  sourceId: 1,
  rowId: null,
  title: 'Groceries',
  accountId: 1,
  categoryId: 1,
  actual: 0,
  summary: 0,
  planned: 0,
  count: 0,
  overdue: false,
  editable: true,
  ...overrides
})

describe('cells', () => {
  it('show what’s recorded, or what’s planned while nothing is', () => {
    expect(cellValue(row({ actual: 12000, count: 2 }))).toEqual({ amount: 12000, planned: false })
    expect(cellValue(row({ planned: 1399 }))).toEqual({ amount: 1399, planned: true })
    expect(cellValue(row({ actual: 5000, count: 1, planned: 3000 }))).toEqual({
      amount: 5000,
      planned: false
    })
    expect(cellValue(row())).toEqual({ amount: 0, planned: false })
  })

  it('start editing with the amount shown, loans as typed', () => {
    expect(editStart(row())).toBeNull()
    expect(editStart(row({ actual: 12000, count: 2 }))).toBe(12000)
    expect(editStart(row({ kind: 'loan', planned: -25000 }))).toBe(25000)
    expect(savingValue(row({ kind: 'loan' }), 25000)).toBe(-25000)
  })

  it('save changed amounts, and planned payments even unchanged', () => {
    expect(needsSaving(row({ actual: 12000, count: 2 }), 12000)).toBe(false)
    expect(needsSaving(row({ actual: 12000, count: 2 }), 15000)).toBe(true)
    expect(needsSaving(row(), 0)).toBe(false)
    expect(needsSaving(row({ planned: 1399 }), 1399)).toBe(true)
    expect(needsSaving(row({ kind: 'loan', actual: -25000, count: 1 }), 25000)).toBe(false)
  })

  it('note installments, overdue payments and several transactions', () => {
    expect(rowNote(row({ count: 1 }))).toBeNull()
    expect(rowNote(row({ count: 3 }))).toBe('3 transactions')
    expect(rowNote(row({ kind: 'installment_plan', overdue: true }))).toBe(
      'Charged automatically · Overdue'
    )
  })
})

describe('the sheet’s signs', () => {
  it('show money in as + and money out as −, loans as they are', () => {
    expect(signedAmount('income', 245000)).toBe(245000)
    expect(signedAmount('everyday', 12000)).toBe(-12000)
    expect(signedAmount('savings', 15000)).toBe(-15000)
    expect(signedAmount('savings', -5000)).toBe(5000)
    expect(signedAmount('loans', -28127)).toBe(-28127)
    expect(signedAmount('loans', 100000)).toBe(100000)
  })
})

describe('moveCategory', () => {
  it('moves a row to a new place among the others', () => {
    expect(moveCategory([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3])
    expect(moveCategory([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4])
    expect(moveCategory([1, 2, 3], 2, 9)).toEqual([1, 3, 2])
    expect(moveCategory([1, 2, 3], 2, -1)).toEqual([2, 1, 3])
  })
})

describe('sheetAmount', () => {
  it('reads plain, with a "+" only for money coming in under Expenses', () => {
    expect(sheetAmount('income', 245000)).toEqual({ value: 245000, plus: false })
    expect(sheetAmount('everyday', 28040)).toEqual({ value: 28040, plus: false })
    // Loans carry their sign: repaid is out, borrowed is in.
    expect(sheetAmount('loans', -30000)).toEqual({ value: 30000, plus: false })
    expect(sheetAmount('loans', 100000)).toEqual({ value: 100000, plus: true })
    // Savings are deposits less withdrawals: more taken out than put in is money in.
    expect(sheetAmount('savings', 15000)).toEqual({ value: 15000, plus: false })
    expect(sheetAmount('savings', -5000)).toEqual({ value: 5000, plus: true })
  })
})

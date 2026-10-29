import { describe, expect, it } from 'vitest'
import { addMenu, type AddMenuData } from './addMenuEntries'

const data: AddMenuData = {
  categories: [
    { id: 1, name: 'Groceries', type: 'expense', isArchived: false },
    { id: 2, name: 'Eating out', type: 'expense', isArchived: false },
    { id: 3, name: 'Doručak', type: 'expense', isArchived: false },
    { id: 4, name: 'Old hobby', type: 'expense', isArchived: true },
    { id: 5, name: 'Salary', type: 'income', isArchived: false }
  ],
  cards: [{ id: 7, name: 'Mastercard' }],
  loans: [
    { id: 8, title: 'Car loan', kind: 'bank_loan' },
    { id: 9, title: 'Loan to Ana', kind: 'lent' }
  ],
  goals: [
    { id: 10, name: 'Holiday', saved: 15000 },
    { id: 11, name: 'New bike', saved: 0 }
  ]
}

const labels = (section: 'income' | 'expenses', query = ''): Record<string, string[]> =>
  Object.fromEntries(
    addMenu(section, query, data).map((g) => [g.heading, g.entries.map((e) => e.label)])
  )

describe('addMenu', () => {
  it('offers income categories under Income', () => {
    expect(labels('income')).toEqual({ Categories: ['Salary'] })
  })

  it('offers every kind of spending under Expenses', () => {
    expect(labels('expenses')).toEqual({
      Categories: ['Doručak', 'Eating out', 'Groceries'],
      'Bills & subscriptions': ['Subscription'],
      'Credit cards': ['Buy in installments', 'Pay Mastercard', 'Add a credit card'],
      Loans: [
        'Pay Car loan installment',
        'Repayment of Loan to Ana',
        'Bank loan',
        'Money borrowed',
        'Money lent'
      ],
      Savings: ['Put into Holiday', 'Take out of Holiday', 'Put into New bike', 'New savings goal'],
      Accounts: ['Add an account or card']
    })
  })

  it('filters by what’s typed, ignoring case and accents, and offers a new category', () => {
    expect(labels('expenses', 'DORU')).toEqual({ Categories: ['Create “DORU”', 'Doručak'] })
    // The whole name without its accent is that category, not a new one.
    expect(labels('expenses', 'dorucak')).toEqual({ Categories: ['Doručak'] })
    expect(labels('expenses', 'holiday')).toEqual({
      Categories: ['Create “holiday”'],
      Savings: ['Put into Holiday', 'Take out of Holiday']
    })
    // A group's name finds its entries.
    expect(labels('expenses', 'loans').Loans).toHaveLength(5)
  })

  it('reuses a category typed in full instead of creating it, archived ones included', () => {
    expect(labels('expenses', 'groceries').Categories).toEqual(['Groceries'])
    const [archived] = addMenu('expenses', 'old hobby', data)[0].entries
    expect(archived).toMatchObject({
      label: 'Old hobby',
      action: { kind: 'line', name: 'Old hobby', isNew: false }
    })
    expect(addMenu('expenses', 'Fuel', data)[0].entries[0].action).toEqual({
      kind: 'line',
      type: 'expense',
      name: 'Fuel',
      isNew: true
    })
  })
})

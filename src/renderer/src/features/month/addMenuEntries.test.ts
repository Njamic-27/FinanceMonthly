import { describe, expect, it } from 'vitest'
import { addMenu, type AddGroupKey, type AddMenuData } from './addMenuEntries'

const data: AddMenuData = {
  categories: [
    { id: 1, name: 'Groceries', type: 'expense', group: 'everyday', isArchived: false },
    { id: 2, name: 'Eating out', type: 'expense', group: 'everyday', isArchived: false },
    { id: 3, name: 'Doručak', type: 'expense', group: 'everyday', isArchived: false },
    { id: 4, name: 'Old hobby', type: 'expense', group: 'everyday', isArchived: true },
    { id: 5, name: 'Salary', type: 'income', group: null, isArchived: false },
    { id: 6, name: 'Rent', type: 'expense', group: 'bills', isArchived: false },
    { id: 12, name: 'Subscriptions', type: 'expense', group: 'subscriptions', isArchived: false },
    { id: 13, name: 'Spotify', type: 'expense', group: 'subscriptions', isArchived: false }
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

const labels = (
  section: 'income' | 'expenses',
  query = '',
  group: AddGroupKey | null = null
): Record<string, string[]> =>
  Object.fromEntries(
    addMenu(section, query, data, group).map((g) => [g.heading, g.entries.map((e) => e.label)])
  )

const first = (query: string, group: AddGroupKey | null = null): unknown =>
  addMenu('expenses', query, data, group)[0].entries[0].action

describe('addMenu', () => {
  it('offers income categories under Income', () => {
    expect(labels('income')).toEqual({ Categories: ['Salary'] })
    expect(addMenu('income', 'Gifts', data)[0].entries[0].action).toEqual({
      kind: 'line',
      type: 'income',
      name: 'Gifts',
      isNew: true,
      group: undefined
    })
  })

  it('starts Expenses with the groups, then cards and accounts', () => {
    expect(labels('expenses')).toEqual({
      'Add to': ['Subscriptions', 'Bills', 'Everyday', 'Loans', 'Savings'],
      'Cards & accounts': [
        'Pay Mastercard',
        'Move money between accounts',
        'Add an account or card'
      ]
    })
    const [groups] = addMenu('expenses', '', data)
    expect(groups.entries.map((e) => e.description)).toEqual([
      'Spotify, Subscriptions',
      'Rent',
      'Doručak, Eating out, Groceries',
      'Car loan, Loan to Ana',
      'Holiday, New bike'
    ])
    expect(groups.entries[1].action).toEqual({ kind: 'group', group: 'bills' })
  })

  it('lists a group’s categories and creates new ones in it', () => {
    expect(labels('expenses', '', 'bills')).toEqual({ Bills: ['Rent'] })
    expect(first('Water', 'bills')).toEqual({
      kind: 'line',
      type: 'expense',
      name: 'Water',
      isNew: true,
      group: 'bills'
    })
    expect(first('rent', 'bills')).toMatchObject({ name: 'Rent', isNew: false, group: 'bills' })
    // A name typed in full is that category, even in another group.
    expect(labels('expenses', 'groceries', 'bills')).toEqual({ Bills: ['Groceries'] })
    expect(first('groceries', 'bills')).toMatchObject({ isNew: false, group: 'everyday' })
  })

  it('offers subscription presets in their category, leaving out ones that are categories', () => {
    const subscriptions = labels('expenses', '', 'subscriptions')
    expect(subscriptions.Subscriptions).toEqual(['Spotify', 'Subscriptions'])
    expect(subscriptions.Services).toContain('Netflix')
    expect(subscriptions.Services).not.toContain('Spotify')
    expect(labels('expenses', 'netf', 'subscriptions')).toEqual({
      Subscriptions: ['Create “netf”'],
      Services: ['Netflix']
    })
    expect(addMenu('expenses', 'netflix', data, 'subscriptions')[1].entries[0].action).toEqual({
      kind: 'line',
      type: 'expense',
      name: 'Subscriptions',
      isNew: false,
      group: 'subscriptions',
      title: 'Netflix'
    })
  })

  it('lists loans and goals in their groups', () => {
    expect(labels('expenses', '', 'loans')).toEqual({
      Loans: [
        'Pay Car loan installment',
        'Repayment of Loan to Ana',
        'New bank loan',
        'Money borrowed',
        'Money lent'
      ]
    })
    expect(labels('expenses', '', 'savings')).toEqual({
      Savings: ['Put into Holiday', 'Take out of Holiday', 'Put into New bike', 'New savings goal']
    })
    // No new category from a loan's or goal's list.
    expect(labels('expenses', 'boat', 'savings')).toEqual({})
  })

  it('searches every group from the top, ignoring case and accents', () => {
    expect(labels('expenses', 'DORU')).toEqual({ Categories: ['Create “DORU”', 'Doručak'] })
    // The whole name without its accent is that category, not a new one.
    expect(labels('expenses', 'dorucak')).toEqual({ Categories: ['Doručak'] })
    expect(labels('expenses', 'holiday')).toEqual({
      Categories: ['Create “holiday”'],
      Savings: ['Put into Holiday', 'Take out of Holiday']
    })
    expect(labels('expenses', 'bills')).toMatchObject({ 'Add to': ['Bills'] })
    // A new name from the top goes in Everyday.
    expect(first('Fuel')).toEqual({
      kind: 'line',
      type: 'expense',
      name: 'Fuel',
      isNew: true,
      group: 'everyday'
    })
    expect(labels('expenses', 'netflix').Services).toEqual(['Netflix'])
  })

  it('offers an archived category back by its exact name', () => {
    expect(labels('expenses', 'old')).toEqual({ Categories: ['Create “old”'] })
    const [archived] = addMenu('expenses', 'old hobby', data)[0].entries
    expect(archived).toMatchObject({
      label: 'Old hobby',
      description: 'Archived; adding to it restores it',
      action: { kind: 'line', name: 'Old hobby', isNew: false }
    })
  })
})

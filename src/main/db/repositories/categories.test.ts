import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CategoryCreate, CategoryUpdate } from '@shared/categories'
import { AppError } from '../../errors'
import { createTestDb } from '../testing'
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  mergeCategory,
  updateCategory
} from './categories'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

const idOf = (name: string): number => {
  const category = listCategories(db).find((c) => c.name === name)
  if (!category) throw new Error(`No category ${name}`)
  return category.id
}

const addAccount = (): number =>
  Number(
    db
      .prepare(
        "INSERT INTO accounts (name, type, opening_date) VALUES ('Visa Debit', 'debit', '2026-01-01')"
      )
      .run().lastInsertRowid
  )

const addExpense = (accountId: number, categoryId: number): void => {
  db.prepare(
    `INSERT INTO transactions (date, title, amount, type, account_id, category_id)
     VALUES ('2026-10-01', 'Test', 1000, 'expense', ?, ?)`
  ).run(accountId, categoryId)
}

const expectAppError = (fn: () => unknown, code: AppError['code'], message?: RegExp): void => {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(code)
    if (message) expect((error as AppError).message).toMatch(message)
    return
  }
  throw new Error('Expected an AppError')
}

describe('default categories', () => {
  it('are seeded by the migrations, income first, in their sort order', () => {
    const categories = listCategories(db)
    expect(categories.map((c) => `${c.type}:${c.name}`)).toEqual([
      'income:Salary',
      'income:Bonus',
      'income:Other income',
      'expense:Groceries',
      'expense:Rent',
      'expense:Utilities',
      'expense:Transport',
      'expense:Eating out',
      'expense:Health',
      'expense:Shopping',
      'expense:Entertainment',
      'expense:Subscriptions',
      'expense:Other'
    ])
    expect(categories[0]).toMatchObject({
      color: 'blue',
      icon: 'briefcase',
      isArchived: false,
      transactionCount: 0,
      usageCount: 0
    })
  })
})

describe('createCategory', () => {
  it('trims the name and adds it at the end of its type', () => {
    const created = createCategory(db, {
      name: '  Pets ',
      type: 'expense',
      color: 'brown',
      icon: 'paw-print'
    })
    expect(created).toMatchObject({ name: 'Pets', type: 'expense', sortOrder: 11 })
    expect(listCategories(db).at(-1)?.name).toBe('Pets')
  })

  it('rejects a name already used by the same type, ignoring case', () => {
    const input: CategoryCreate = { name: 'groceries', type: 'expense', color: 'blue', icon: 'tag' }
    expectAppError(() => createCategory(db, input), 'conflict', /already an expense category/)
    expect(() => createCategory(db, { ...input, type: 'income' })).not.toThrow()
  })

  it('points to restoring an archived category with the same name', () => {
    updateCategory(db, idOf('Health'), { isArchived: true })
    expectAppError(
      () => createCategory(db, { name: 'Health', type: 'expense', color: 'pink', icon: 'pill' }),
      'conflict',
      /Restore it instead/
    )
  })

  it('validates the input', () => {
    const valid: CategoryCreate = { name: 'Pets', type: 'expense', color: 'brown', icon: 'tag' }
    expect(() => createCategory(db, { ...valid, name: '   ' })).toThrow(/name/)
    expect(() => createCategory(db, { ...valid, name: 'x'.repeat(41) })).toThrow(/40/)
    expect(() =>
      createCategory(db, { ...valid, color: 'green' } as unknown as CategoryCreate)
    ).toThrow()
    expect(() =>
      createCategory(db, { ...valid, icon: 'rocket' } as unknown as CategoryCreate)
    ).toThrow()
  })
})

describe('updateCategory', () => {
  it('renames, recolours and archives', () => {
    const id = idOf('Eating out')
    expect(
      updateCategory(db, id, {
        name: 'Restaurants',
        color: 'pink',
        icon: 'coffee',
        isArchived: true
      })
    ).toMatchObject({ name: 'Restaurants', color: 'pink', icon: 'coffee', isArchived: true })
    expect(updateCategory(db, id, { isArchived: false }).isArchived).toBe(false)
  })

  it('allows changing the case of its own name', () => {
    expect(updateCategory(db, idOf('Rent'), { name: 'RENT' }).name).toBe('RENT')
  })

  it('rejects a name taken by another category of the same type', () => {
    expectAppError(() => updateCategory(db, idOf('Rent'), { name: 'utilities' }), 'conflict')
  })

  it('does not allow changing the type', () => {
    expect(() =>
      updateCategory(db, idOf('Rent'), { type: 'income' } as unknown as CategoryUpdate)
    ).toThrow()
  })

  it('reports a missing category', () => {
    expectAppError(() => updateCategory(db, 999, { name: 'X' }), 'not_found')
  })

  it('falls back to the neutral colour and tag icon for unknown stored values', () => {
    db.prepare("UPDATE categories SET color = 'chartreuse', icon = NULL WHERE name = 'Rent'").run()
    expect(getCategory(db, idOf('Rent'))).toMatchObject({ color: 'slate', icon: 'tag' })
  })
})

describe('deleteCategory', () => {
  it('deletes an unused category', () => {
    const id = idOf('Bonus')
    deleteCategory(db, id)
    expectAppError(() => getCategory(db, id), 'not_found')
  })

  it('refuses to delete a category in use and says how many uses', () => {
    const account = addAccount()
    const groceries = idOf('Groceries')
    addExpense(account, groceries)
    addExpense(account, groceries)
    expect(getCategory(db, groceries)).toMatchObject({ transactionCount: 2, usageCount: 2 })
    expectAppError(() => deleteCategory(db, groceries), 'conflict', /used by 2 transactions/)
  })

  it('counts recurring items as uses', () => {
    const account = addAccount()
    db.prepare(
      `INSERT INTO recurring_items (kind, title, amount, account_id, category_id, frequency, anchor_date, next_due_date)
       VALUES ('subscription', 'Netflix', 1399, ?, ?, 'monthly', '2026-01-05', '2026-11-05')`
    ).run(account, idOf('Subscriptions'))
    expect(getCategory(db, idOf('Subscriptions'))).toMatchObject({
      transactionCount: 0,
      usageCount: 1
    })
    expectAppError(() => deleteCategory(db, idOf('Subscriptions')), 'conflict')
  })
})

describe('mergeCategory', () => {
  it('moves all uses to the target and deletes the source', () => {
    const account = addAccount()
    const eatingOut = idOf('Eating out')
    const groceries = idOf('Groceries')
    addExpense(account, eatingOut)
    addExpense(account, eatingOut)
    addExpense(account, groceries)

    const merged = mergeCategory(db, eatingOut, groceries)
    expect(merged).toMatchObject({ name: 'Groceries', transactionCount: 3 })
    expect(listCategories(db).some((c) => c.name === 'Eating out')).toBe(false)
  })

  it('only merges within the same type, and not into itself', () => {
    expectAppError(
      () => mergeCategory(db, idOf('Bonus'), idOf('Groceries')),
      'validation',
      /income/
    )
    expectAppError(() => mergeCategory(db, idOf('Rent'), idOf('Rent')), 'validation')
  })
})

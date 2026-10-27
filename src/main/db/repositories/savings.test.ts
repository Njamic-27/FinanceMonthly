import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SavingsGoalInput, SavingsMovementInput } from '@shared/savings'
import { createTestDb } from '../testing'
import { createAccount, getAccount, setAccountArchived } from './accounts'
import {
  addSavingsMovement,
  createSavingsGoal,
  deleteSavingsGoal,
  deleteSavingsMovement,
  getSavingsGoal,
  getSavingsSeries,
  listSavingsGoals,
  listSavingsMovements,
  setSavingsGoalArchived,
  updateSavingsGoal,
  updateSavingsMovement
} from './savings'

let db: Database.Database
let debit: number
let cash: number

const holiday = (overrides: Partial<SavingsGoalInput> = {}): number =>
  createSavingsGoal(db, {
    name: 'Summer holiday',
    targetAmount: 200000,
    targetDate: '2027-06-01',
    startingAmount: 10000,
    plannedMonthly: 15000,
    color: 'sky',
    ...overrides
  }).id

/** The editable fields of a saved goal, with changes. */
const edited = (id: number, changes: Partial<SavingsGoalInput>): SavingsGoalInput => {
  const { name, targetAmount, targetDate, startingAmount, plannedMonthly, color } = getSavingsGoal(
    db,
    id
  )
  return { name, targetAmount, targetDate, startingAmount, plannedMonthly, color, ...changes }
}

const move = (goalId: number, overrides: Partial<SavingsMovementInput> = {}): number =>
  addSavingsMovement(db, {
    goalId,
    type: 'deposit',
    amount: 15000,
    accountId: debit,
    date: '2026-10-11',
    note: null,
    ...overrides
  }).id

beforeEach(() => {
  db = createTestDb()
  debit = createAccount(db, {
    type: 'debit',
    name: 'Visa Debit',
    openingBalance: 100000,
    openingDate: '2026-01-01',
    color: 'blue'
  }).id
  cash = createAccount(db, {
    type: 'cash',
    name: 'Wallet',
    openingBalance: 0,
    openingDate: '2026-01-01',
    color: 'olive'
  }).id
})

describe('goals', () => {
  it('saves a goal holding its starting amount', () => {
    const id = holiday()
    expect(getSavingsGoal(db, id)).toMatchObject({
      name: 'Summer holiday',
      targetAmount: 200000,
      targetDate: '2027-06-01',
      startingAmount: 10000,
      plannedMonthly: 15000,
      color: 'sky',
      saved: 10000,
      movementCount: 0,
      isArchived: false
    })
    holiday({ name: 'Car', targetDate: null, plannedMonthly: null })
    expect(listSavingsGoals(db).map((g) => g.name)).toEqual(['Summer holiday', 'Car'])
  })

  it('validates the input', () => {
    expect(() => holiday({ name: ' ' })).toThrow(/name/)
    expect(() => holiday({ targetAmount: 0 })).toThrow(/above zero/)
    expect(() => holiday({ startingAmount: -1 })).toThrow(/already have/)
  })

  it('edits, archives and deletes only goals without movements', () => {
    const id = holiday()
    expect(updateSavingsGoal(db, id, edited(id, { targetAmount: 300000 }))).toMatchObject({
      targetAmount: 300000
    })
    expect(setSavingsGoalArchived(db, id, true).isArchived).toBe(true)
    move(holiday({ name: 'Car' }))
    const car = listSavingsGoals(db).find((g) => g.name === 'Car')?.id ?? 0
    expect(() => deleteSavingsGoal(db, car)).toThrow(/Archive it instead/)
    deleteSavingsGoal(db, id)
    expect(listSavingsGoals(db).map((g) => g.name)).toEqual(['Car'])
  })

  it('refuses a starting amount that would leave less than was taken out', () => {
    const id = holiday({ startingAmount: 50000 })
    move(id, { type: 'withdrawal', amount: 40000 })
    expect(() => updateSavingsGoal(db, id, edited(id, { startingAmount: 30000 }))).toThrow(
      /higher starting amount/
    )
  })
})

describe('movements', () => {
  it('moves money between an account and the goal', () => {
    const id = holiday()
    move(id)
    move(id, { type: 'withdrawal', amount: 5000, accountId: cash, date: '2026-10-20' })
    expect(getSavingsGoal(db, id)).toMatchObject({ saved: 20000, movementCount: 2 })
    expect(getAccount(db, debit, '2026-10-31').balance).toBe(85000)
    expect(getAccount(db, cash, '2026-10-31').balance).toBe(5000)
    expect(listSavingsMovements(db, id).map((t) => [t.type, t.title, t.amount])).toEqual([
      ['savings_withdrawal', 'Summer holiday', 5000],
      ['savings_deposit', 'Summer holiday', 15000]
    ])
  })

  it('never takes out more than the goal holds', () => {
    const id = holiday()
    expect(() => move(id, { type: 'withdrawal', amount: 10001 })).toThrow(/only has €100.00/)
    move(id, { type: 'withdrawal', amount: 10000 })
    expect(getSavingsGoal(db, id).saved).toBe(0)
  })

  it('checks the account and the goal', () => {
    const id = holiday()
    expect(() => move(id, { date: '2025-12-31' })).toThrow(/starts on/)
    setAccountArchived(db, cash, true)
    expect(() => move(id, { accountId: cash })).toThrow(/archived/)
    setSavingsGoalArchived(db, id, true)
    expect(() => move(id)).toThrow(/archived/)
  })

  it('edits a movement, counting it only once', () => {
    const id = holiday({ startingAmount: 0 })
    const deposit = move(id, { amount: 20000 })
    // Turning it into a withdrawal would take out money that was never there.
    expect(() =>
      updateSavingsMovement(db, deposit, {
        goalId: id,
        type: 'withdrawal',
        amount: 1,
        accountId: debit,
        date: '2026-10-11',
        note: null
      })
    ).toThrow(/only has €0.00/)
    updateSavingsMovement(db, deposit, {
      goalId: id,
      type: 'deposit',
      amount: 25000,
      accountId: cash,
      date: '2026-10-12',
      note: 'Bonus'
    })
    expect(getSavingsGoal(db, id).saved).toBe(25000)
    expect(listSavingsMovements(db, id)[0]).toMatchObject({
      amount: 25000,
      accountId: cash,
      date: '2026-10-12',
      note: 'Bonus'
    })
  })

  it('deletes a deposit only if the goal stays at or above zero', () => {
    const id = holiday({ startingAmount: 0 })
    const deposit = move(id, { amount: 20000 })
    const withdrawal = move(id, { type: 'withdrawal', amount: 15000, date: '2026-10-20' })
    expect(() => deleteSavingsMovement(db, deposit)).toThrow(/below zero/)
    deleteSavingsMovement(db, withdrawal)
    deleteSavingsMovement(db, deposit)
    expect(getSavingsGoal(db, id)).toMatchObject({ saved: 0, movementCount: 0 })
  })
})

describe('getSavingsSeries', () => {
  it('follows what the goal held each day', () => {
    const id = holiday()
    move(id, { date: '2026-10-11' })
    move(id, { type: 'withdrawal', amount: 5000, date: '2026-10-13' })
    const series = getSavingsSeries(db, id, '2026-10-14')
    expect(series.slice(0, 4)).toEqual([
      { date: '2026-10-11', balance: 25000 },
      { date: '2026-10-12', balance: 25000 },
      { date: '2026-10-13', balance: 20000 },
      { date: '2026-10-14', balance: 20000 }
    ])
  })
})

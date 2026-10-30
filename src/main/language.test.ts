import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { setCurrentLanguage, translateMessage } from '@shared/i18n'
import { validation } from '@shared/i18n/en/validation'
import { createTestDb } from './db/testing'
import { createAccount, getAccount } from './db/repositories/accounts'
import {
  createCategory,
  listCategories,
  renameBuiltinCategories,
  updateCategory
} from './db/repositories/categories'
import { toSerializedError } from './errors'
import { cardReminderMessage } from './services/cards'
import { when } from './services/when'

// The main process in Croatian (PLAN.md step 55): its notifications and errors, the shared
// validation messages, and built-in categories renamed with the language.

afterEach(() => setCurrentLanguage('en'))

const names = (db: ReturnType<typeof createTestDb>): string[] =>
  listCategories(db)
    .map((c) => c.name)
    .sort()

describe('built-in categories', () => {
  it('follow the language unless renamed', () => {
    const db = createTestDb()
    const id = (name: string): number => listCategories(db).find((c) => c.name === name)?.id ?? 0
    updateCategory(db, id('Rent'), { name: 'Flat' })
    // A name another category already has stays with that one.
    createCategory(db, { name: 'Zabava', type: 'expense', color: 'blue', icon: 'tag' })

    // Bonus is the same in both; Rent was renamed and Zabava is taken.
    expect(renameBuiltinCategories(db, 'hr')).toBe(10)
    expect(names(db)).toEqual(
      expect.arrayContaining(['Plaća', 'Namirnice', 'Komunalije', 'Pretplate', 'Flat', 'Zabava'])
    )
    expect(names(db)).toContain('Entertainment')
    expect(names(db)).not.toContain('Groceries')

    renameBuiltinCategories(db, 'en')
    expect(names(db)).toEqual(expect.arrayContaining(['Salary', 'Groceries', 'Flat']))
    expect(names(db)).not.toContain('Namirnice')
  })
})

describe('in Croatian', () => {
  it('words notifications', () => {
    setCurrentLanguage('hr')
    expect(when('2026-10-31', '2026-10-30', 'hr-HR')).toBe('sutra')
    expect(
      cardReminderMessage(
        {
          accountId: 1,
          name: 'Mastercard',
          kind: 'due',
          date: '2026-11-15',
          amount: 11399,
          dueDate: '2026-11-15'
        },
        { currency: 'EUR', locale: 'hr-HR' },
        '2026-11-15'
      )
    ).toEqual({
      title: 'Plaćanje kartice Mastercard dospijeva danas',
      // Intl puts a no-break space before the currency sign.
      body: expect.stringMatching(/^Na ovom izvodu za platiti je još 113,99\s€\.$/)
    })
  })

  it('words errors, from main and from the shared rules', () => {
    const db = createTestDb()
    setCurrentLanguage('hr')
    expect(() => getAccount(db, 999)).toThrow('Taj račun više ne postoji.')
    let error: unknown
    try {
      createAccount(db, {
        type: 'debit',
        name: '',
        openingBalance: 0,
        openingDate: '2026-01-01',
        color: 'blue'
      })
    } catch (caught) {
      error = caught
    }
    expect(toSerializedError(error).message).toBe('name: Upiši naziv računa')
  })
})

describe('validation messages', () => {
  it('are translated by their exact English text, other text left alone', () => {
    setCurrentLanguage('hr')
    expect(translateMessage('Choose a date')).toBe('Odaberi datum')
    expect(translateMessage('Something else')).toBe('Something else')
  })

  it('each still appear in the shared rules', () => {
    const shared = join(__dirname, '..', 'shared')
    const source = readdirSync(shared)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(shared, name), 'utf8'))
      .join('\n')
      .replace(/\$\{MIN_INSTALLMENTS\}/g, '2')
      .replace(/\$\{MAX_INSTALLMENTS\}/g, '60')
    for (const text of Object.values(validation)) expect(source, text).toContain(text)
  })
})

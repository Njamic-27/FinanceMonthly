import { describe, expect, it } from 'vitest'
import { en, type MessageKey } from './en'
import { hr } from './hr'
import { translate } from './index'
import type { Message } from './types'

const forms = (message: Message): string[] =>
  typeof message === 'string' ? [message] : Object.values(message).filter((f) => f !== undefined)

const placeholders = (message: Message): string[] =>
  [...new Set(forms(message).flatMap((f) => [...f.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))]
    .filter((name) => name !== 'count')
    .sort()

const keys = Object.keys(en) as MessageKey[]

describe('translations', () => {
  it('have every English text in Croatian, none empty', () => {
    expect(Object.keys(hr).sort()).toEqual([...keys].sort())
    for (const key of keys) {
      for (const form of forms(hr[key])) expect(form.trim(), key).not.toBe('')
    }
  })

  it('use the same placeholders as English', () => {
    for (const key of keys) {
      expect(placeholders(hr[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it('give Croatian plurals all three forms', () => {
    for (const key of keys) {
      const message = hr[key]
      if (typeof en[key] !== 'string') {
        expect(typeof message, key).toBe('object')
        if (typeof message === 'object') expect(message.few, key).toBeDefined()
      }
    }
  })
})

describe('translate', () => {
  it('fills placeholders, leaving unknown ones as they are', () => {
    expect(translate('en', 'screen.month')).toBe('Month')
    expect(translate('hr', 'screen.month')).toBe('Mjesec')
  })

  it('picks the plural form by count, Croatian one / few / other', () => {
    const key = 'month.transactions' as MessageKey
    expect([1, 2, 5].map((count) => translate('en', key, { count }))).toEqual([
      '1 transaction',
      '2 transactions',
      '5 transactions'
    ])
    expect([1, 3, 5, 11, 21, 22].map((count) => translate('hr', key, { count }))).toEqual([
      '1 transakcija',
      '3 transakcije',
      '5 transakcija',
      '11 transakcija',
      '21 transakcija',
      '22 transakcije'
    ])
  })
})

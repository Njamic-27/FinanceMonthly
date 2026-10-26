import { describe, expect, it } from 'vitest'
import { decimalSeparator, formatAmountInput, formatMoney, parseAmount } from './money'

// Intl uses (narrow) no-break spaces in some locales; compare with plain spaces.
const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ')

describe('formatMoney', () => {
  it('formats in the chosen currency and locale', () => {
    expect(formatMoney(123450, { currency: 'EUR', locale: 'en-GB' })).toBe('€1,234.50')
    expect(plain(formatMoney(123450, { currency: 'EUR', locale: 'hr-HR' }))).toBe('1.234,50 €')
    expect(formatMoney(123450, { currency: 'USD', locale: 'en-US' })).toBe('$1,234.50')
    expect(formatMoney(99, { currency: 'GBP', locale: 'en-GB' })).toBe('£0.99')
  })

  it('uses the currency’s own decimals for display', () => {
    expect(formatMoney(123450, { currency: 'JPY', locale: 'en-GB' })).toBe('JP¥1,235')
  })

  it('shows signs when asked', () => {
    const f = { currency: 'EUR', locale: 'en-GB' }
    expect(formatMoney(-2500, f)).toBe('-€25.00')
    expect(formatMoney(2500, f, 'exceptZero')).toBe('+€25.00')
    expect(formatMoney(0, f, 'exceptZero')).toBe('€0.00')
  })
})

describe('formatAmountInput', () => {
  it('uses the locale decimal separator and no grouping', () => {
    expect(formatAmountInput(123450, 'en-GB')).toBe('1234.50')
    expect(formatAmountInput(123450, 'hr-HR')).toBe('1234,50')
    expect(formatAmountInput(200000, 'en-GB')).toBe('2000')
    expect(formatAmountInput(5, 'en-GB')).toBe('0.05')
    expect(formatAmountInput(-1999, 'en-GB')).toBe('-19.99')
  })

  it('round-trips through parseAmount', () => {
    for (const cents of [0, 1, 99, 100, 123456, 99999999, -4250]) {
      for (const locale of ['en-GB', 'hr-HR', 'de-CH']) {
        expect(parseAmount(formatAmountInput(cents, locale), locale)).toBe(cents)
      }
    }
  })
})

describe('decimalSeparator', () => {
  it('reads it from the locale', () => {
    expect(decimalSeparator('en-GB')).toBe('.')
    expect(decimalSeparator('hr-HR')).toBe(',')
  })
})

describe('parseAmount', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12,5', 1250],
    ['12.50', 1250],
    ['12,50', 1250],
    ['0.05', 5],
    ['.5', 50],
    ['12.', 1200],
    ['1,234.56', 123456],
    ['1.234,56', 123456],
    ['1 234,56', 123456],
    ['1\u00a0234,56', 123456],
    ["1'234.56", 123456],
    ['1,234,567', 123456700],
    ['1.234.567,89', 123456789],
    ['€ 12', 1200],
    ['12 €', 1200],
    ['EUR 12.30', 1230],
    ['-25', -2500],
    ['−25,10', -2510],
    ['-€12', -1200],
    ['€ -12', -1200],
    ['-0', 0]
  ])('en-GB reads %j as %i cents', (input, cents) => {
    expect(parseAmount(input, 'en-GB')).toBe(cents)
  })

  it('reads a lone separator before exactly three digits as grouping…', () => {
    expect(parseAmount('1,234', 'en-GB')).toBe(123400)
    expect(parseAmount('1.234', 'hr-HR')).toBe(123400)
  })

  it('…unless it is the locale’s decimal separator', () => {
    expect(parseAmount('1.234', 'en-GB')).toBeNull() // 3 decimals
    expect(parseAmount('1,234', 'hr-HR')).toBeNull()
  })

  it.each(['', '   ', 'abc', '12.345.6,7.8', '1.234', '1e5', '--5', '12a3', '1-2', '€', '.'])(
    'rejects %j',
    (input) => {
      // '1.234' is an amount with three decimals in en-GB → not allowed.
      expect(parseAmount(input, 'en-GB')).toBeNull()
    }
  )
})

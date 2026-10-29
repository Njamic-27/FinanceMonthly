import { describe, expect, it } from 'vitest'
import { countsInMonth } from './countsIn'

describe('countsInMonth', () => {
  it('names the month a transaction counts in, when it isn’t its own', () => {
    expect(countsInMonth('2026-10-20', '2026-11-15', 'en-GB')).toBe('November')
    expect(countsInMonth('2026-12-28', '2027-02-15', 'en-GB')).toBe('February 2027')
    expect(countsInMonth('2026-10-03', '2026-10-25', 'en-GB')).toBeNull()
  })
})

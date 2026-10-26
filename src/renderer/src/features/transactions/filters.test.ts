import { describe, expect, it } from 'vitest'
import { hasFilters, periodPresets, presetFor, readFilters, writeFilters } from './filters'

describe('readFilters / writeFilters', () => {
  it('round-trips every filter through the URL', () => {
    const filters = {
      search: 'lidl',
      from: '2026-10-01',
      to: '2026-10-31',
      accountId: 3,
      categoryId: 7,
      kind: 'expense' as const
    }
    const params = writeFilters(filters)
    expect(params.toString()).toBe(
      'q=lidl&from=2026-10-01&to=2026-10-31&account=3&category=7&type=expense'
    )
    expect(readFilters(params)).toEqual(filters)
  })

  it('ignores malformed values', () => {
    expect(
      readFilters(new URLSearchParams('from=2026-02-30&to=x&account=-1&category=1.5&type=bogus'))
    ).toEqual({
      search: '',
      from: undefined,
      to: undefined,
      accountId: undefined,
      categoryId: undefined,
      kind: undefined
    })
  })

  it('leaves out empty filters', () => {
    expect(writeFilters({ search: '  ' }).toString()).toBe('')
    expect(hasFilters({ search: '' })).toBe(false)
    expect(hasFilters({ search: '', kind: 'income' })).toBe(true)
  })
})

describe('period presets', () => {
  const today = '2026-01-15'

  it('are relative to today, crossing year boundaries', () => {
    expect(Object.fromEntries(periodPresets(today).map((p) => [p.id, [p.from, p.to]]))).toEqual({
      all: [undefined, undefined],
      'this-month': ['2026-01-01', '2026-01-31'],
      'last-month': ['2025-12-01', '2025-12-31'],
      'last-3-months': ['2025-11-01', '2026-01-31'],
      'this-year': ['2026-01-01', '2026-12-31'],
      'last-year': ['2025-01-01', '2025-12-31']
    })
  })

  it('recognises a preset range, otherwise reports custom', () => {
    expect(presetFor(undefined, undefined, today)).toBe('all')
    expect(presetFor('2025-12-01', '2025-12-31', today)).toBe('last-month')
    expect(presetFor('2025-12-01', '2025-12-30', today)).toBe('custom')
    expect(presetFor('2026-01-01', undefined, today)).toBe('custom')
  })
})

import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings, type SettingsPatch } from '@shared/settings'
import { createTestDb } from '../testing'
import { getSettings, updateSettings } from './settings'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
})

describe('settings repository', () => {
  it('returns defaults for a new database', () => {
    expect(getSettings(db)).toEqual(defaultSettings)
  })

  it('saves a patch and returns the full settings', () => {
    const result = updateSettings(db, { currency: 'USD', weekStart: 0 })
    expect(result).toEqual({ ...defaultSettings, currency: 'USD', weekStart: 0 })
    expect(getSettings(db)).toEqual(result)
  })

  it('stores one JSON row per field under a snake_case key', () => {
    updateSettings(db, { weekStart: 0, onboardingDone: true })
    expect(db.prepare('SELECT key, value FROM settings ORDER BY key').all()).toEqual([
      { key: 'onboarding_done', value: 'true' },
      { key: 'week_start', value: '0' }
    ])
  })

  it('rejects invalid values and unknown fields without saving anything', () => {
    expect(() => updateSettings(db, { currency: 'euro' })).toThrow()
    expect(() => updateSettings(db, { weekStart: 7 })).toThrow()
    expect(() => updateSettings(db, { theme: 'neon' } as unknown as SettingsPatch)).toThrow()
    expect(() => updateSettings(db, { bogus: 1 } as unknown as SettingsPatch)).toThrow()
    expect(db.prepare('SELECT count(*) AS n FROM settings').get()).toEqual({ n: 0 })
  })

  it('falls back to defaults for broken stored values and ignores unknown keys', () => {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES
      ('currency', '"usd"'), ('week_start', 'not json'), ('from_the_future', '1'), ('locale', '"hr-HR"')`
    ).run()
    expect(getSettings(db)).toEqual({ ...defaultSettings, locale: 'hr-HR' })
  })
})

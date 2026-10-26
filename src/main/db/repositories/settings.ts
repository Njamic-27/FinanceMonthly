import type { Database } from 'better-sqlite3'
import {
  defaultSettings,
  settingsPatchSchema,
  settingsSchema,
  type Settings,
  type SettingsPatch
} from '@shared/settings'

type SettingKey = keyof Settings

/** Settings are stored one row per field, keyed in snake_case (`weekStart` → `week_start`). */
const toDbKey = (key: string): string => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

const dbKeyToField = new Map<string, SettingKey>(
  (Object.keys(defaultSettings) as SettingKey[]).map((key) => [toDbKey(key), key])
)

export function getSettings(db: Database): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const settings: Settings = { ...defaultSettings }

  for (const { key, value } of rows) {
    const field = dbKeyToField.get(key)
    if (!field) continue // a key from a newer or older version — ignore it
    try {
      const parsed = settingsSchema.shape[field].safeParse(JSON.parse(value))
      // A stored value that no longer validates falls back to the default instead of failing.
      if (parsed.success) Object.assign(settings, { [field]: parsed.data })
    } catch {
      // Unparseable JSON — keep the default.
    }
  }

  return settings
}

export function updateSettings(db: Database, patch: SettingsPatch): Settings {
  const valid = settingsPatchSchema.parse(patch)
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
  )
  db.transaction(() => {
    for (const [field, value] of Object.entries(valid)) {
      if (value !== undefined) upsert.run(toDbKey(field), JSON.stringify(value))
    }
  })()
  return getSettings(db)
}

import { describe, expect, it } from 'vitest'
import { settingsSchema } from '@shared/settings'
import {
  currencyCodes,
  currencyOptions,
  localeOptions,
  localeTags,
  weekdayName,
  weekStartOptions
} from './options'

describe('currency options', () => {
  it('only offers codes the settings schema accepts', () => {
    for (const code of currencyCodes) {
      expect(settingsSchema.shape.currency.safeParse(code).success).toBe(true)
    }
  })

  it('labels each currency with its code and English name', () => {
    expect(currencyOptions()[0]).toEqual({ value: 'EUR', label: 'EUR · Euro' })
  })

  it('keeps a saved currency that is not in the list', () => {
    const options = currencyOptions('NZD')
    expect(options[0].value).toBe('NZD')
    expect(options).toHaveLength(currencyCodes.length + 1)
    expect(currencyOptions('USD')).toHaveLength(currencyCodes.length)
  })
})

describe('locale options', () => {
  it('only offers locales Intl can format', () => {
    expect(Intl.NumberFormat.supportedLocalesOf(localeTags)).toEqual(localeTags)
  })

  it('names locales in English', () => {
    const labels = localeOptions().map((o) => o.label)
    expect(labels).toContain('Croatian (Croatia)')
    expect(labels).toContain('English (United Kingdom)')
  })
})

describe('week start options', () => {
  it('names days using Settings.weekStart numbering', () => {
    expect(weekdayName(0)).toBe('Sunday')
    expect(weekdayName(1)).toBe('Monday')
    expect(weekdayName(6)).toBe('Saturday')
  })

  it('lists Monday to Sunday', () => {
    expect(weekStartOptions().map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weekStartOptions()[0].label).toBe('Monday')
  })
})

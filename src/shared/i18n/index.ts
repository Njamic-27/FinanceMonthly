import { en, type MessageKey } from './en'
import { hr } from './hr'
import { validation } from './en/validation'
import type { Language, Message, MessageParams } from './types'

export { languageNames, languages } from './types'
export type { Language, Message, MessageParams, PluralMessage } from './types'
export type { MessageKey } from './en'

/** Whether `key` is a text of the app, for keys made from data. */
export const isMessageKey = (key: string): key is MessageKey => key in en

const catalogs: Record<Language, Record<MessageKey, Message>> = { en, hr }

const pluralRules = new Map<Language, Intl.PluralRules>()
const pluralRule = (language: Language): Intl.PluralRules => {
  let rules = pluralRules.get(language)
  if (!rules) {
    rules = new Intl.PluralRules(language)
    pluralRules.set(language, rules)
  }
  return rules
}

/**
 * The text of `key` in `language`, with `{name}` placeholders filled from `params`; a plural
 * message picks its form by `params.count`. A placeholder with no value stays as it is.
 */
export function translate(language: Language, key: MessageKey, params?: MessageParams): string {
  const message = catalogs[language][key] ?? en[key]
  let text: string
  if (typeof message === 'string') {
    text = message
  } else {
    const form = pluralRule(language).select(Number(params?.count ?? 0))
    text = (form === 'one' || form === 'few' ? message[form] : undefined) ?? message.other
  }
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  )
}

// The language the app speaks right now, in this process: the renderer sets it from the
// settings before drawing, the main process at start and whenever the setting changes.
let current: Language = 'en'

export function setCurrentLanguage(language: Language): void {
  current = language
}

export const currentLanguage = (): Language => current

/** The text of `key` in the current language: t('month.moneyOut'), t('x', { count: 3 }). */
export const t = (key: MessageKey, params?: MessageParams): string =>
  translate(current, key, params)

// The shared validation rules keep their English messages; they're translated where they're
// shown, by their exact text.
const validationKeys = new Map(
  Object.entries(validation).map(([key, text]) => [text, key as MessageKey])
)

/** A validation message in the current language; any other text comes back as it is. */
export function translateMessage(text: string): string {
  const key = validationKeys.get(text)
  return key ? t(key) : text
}

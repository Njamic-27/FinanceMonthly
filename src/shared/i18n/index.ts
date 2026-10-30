import { en, type MessageKey } from './en'
import { hr } from './hr'
import type { Language, Message, MessageParams } from './types'

export { languageNames, languages } from './types'
export type { Language, Message, MessageParams, PluralMessage } from './types'
export type { MessageKey } from './en'

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

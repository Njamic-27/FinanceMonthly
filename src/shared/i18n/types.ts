/** The languages the app speaks (PLAN.md step 53). */
export const languages = ['en', 'hr'] as const
export type Language = (typeof languages)[number]

/** Each language by its own name, as the switch in Settings shows it. */
export const languageNames: Record<Language, string> = { en: 'English', hr: 'Hrvatski' }

/**
 * A message that depends on `{count}`: English has one and other; Croatian also few
 * (2–4, 22–24…), as `Intl.PluralRules` sorts numbers.
 */
export interface PluralMessage {
  one: string
  few?: string
  other: string
}

/** A text with `{name}` placeholders, or its plural forms. */
export type Message = string | PluralMessage

export type MessageParams = Record<string, string | number>

/** A language's texts for one area: every key of the English source, so none is missed. */
export type Translation<T> = Record<keyof T, Message>

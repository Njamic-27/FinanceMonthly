import { createElement, Fragment, type ReactNode } from 'react'
import {
  currentLanguage,
  setCurrentLanguage,
  t,
  type Language,
  type MessageKey,
  type MessageParams
} from '@shared/i18n'

// The language the app shows (PLAN.md step 53). It's set from the settings before anything
// renders, and the app is drawn again from the top when it changes (I18nGate), so plain
// functions can call `t` as well as components.

export { currentLanguage, t }

export function setLanguage(language: Language): void {
  setCurrentLanguage(language)
  document.documentElement.lang = language
}

/**
 * Like `t`, for a text with elements in it, e.g. a date that links to its day:
 * tNode('accounts.closedOn', { date: <Link …>25 Oct</Link> }).
 */
export function tNode(key: MessageKey, params: Record<string, ReactNode>): ReactNode {
  const texts: MessageParams = {}
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') texts[name] = value
  }
  return t(key, texts)
    .split(/\{(\w+)\}/)
    .map((part, i) => createElement(Fragment, { key: i }, i % 2 === 1 ? params[part] : part))
}

import { t } from './i18n'

/**
 * Services offered as one-click names when adding a subscription (PLAN.md §3, screen 8).
 * A preset fills in the name only; the amount, billing date and account are always entered
 * by the user, since prices and plans differ.
 */
export const subscriptionPresets = [
  'Netflix',
  'Spotify',
  'Claude',
  'YouTube Premium',
  'Disney+',
  'HBO Max',
  'Apple Music',
  'Amazon Prime',
  'iCloud+',
  'Google One',
  'Microsoft 365',
  'ChatGPT',
  'Xbox Game Pass',
  'PlayStation Plus',
  'Adobe Creative Cloud'
] as const

/** The category a new subscription starts in, when it exists. */
export const subscriptionCategoryName = (): string => t('builtin.subscriptions')

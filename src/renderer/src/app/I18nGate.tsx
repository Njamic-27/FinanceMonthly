import { Fragment } from 'react'
import { useSettings } from '@renderer/features/settings/queries'
import { setLanguage } from '@renderer/lib/i18n'

/**
 * Waits for the settings, sets the app's language from them and draws everything under it
 * again when it changes (PLAN.md step 53), so every text, wherever it's made, follows.
 */
export function I18nGate({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const settings = useSettings()
  if (!settings.data && !settings.isError) return null
  const language = settings.data?.language ?? 'en'
  setLanguage(language)
  return <Fragment key={language}>{children}</Fragment>
}

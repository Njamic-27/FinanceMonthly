import { z } from 'zod'

export const themeModes = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof themeModes)[number]

export const settingsSchema = z.object({
  /** ISO 4217 code. Changing it only changes formatting — amounts are never converted. */
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code such as EUR'),
  /** BCP 47 locale used for number and date formatting. */
  locale: z.string().min(2),
  /** First day of the week: 0 = Sunday, 1 = Monday, … 6 = Saturday. */
  weekStart: z.number().int().min(0).max(6),
  theme: z.enum(themeModes),
  onboardingDone: z.boolean(),
  /** Windows notifications for payment reminders. */
  notificationsEnabled: z.boolean(),
  /** Closing the window keeps Financije running in the tray, so reminders still arrive. */
  closeToTray: z.boolean(),
  /** Start (in the tray) when you sign in to Windows. Only the installed app can do this. */
  startWithWindows: z.boolean(),
  projectionIncludeVariable: z.boolean(),
  projectionVariableMonths: z.number().int().min(1).max(12),
  projectionIncludeSavings: z.boolean()
})

export type Settings = z.infer<typeof settingsSchema>

export const settingsPatchSchema = settingsSchema.partial().strict()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>

export const defaultSettings: Settings = {
  currency: 'EUR',
  locale: 'en-GB',
  weekStart: 1,
  theme: 'system',
  onboardingDone: false,
  notificationsEnabled: true,
  closeToTray: true,
  startWithWindows: false,
  projectionIncludeVariable: true,
  projectionVariableMonths: 3,
  projectionIncludeSavings: true
}

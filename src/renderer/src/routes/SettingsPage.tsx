import { Info, Monitor, Moon, Sun } from 'lucide-react'
import { PageHeader } from '@renderer/components/PageHeader'
import { Card, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { SegmentedControl, type SegmentedOption } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  currencyOptions,
  localeOptions,
  weekdayName,
  weekStartOptions,
  type Option
} from '@renderer/features/settings/options'
import { useSettings, useUpdateSettings } from '@renderer/features/settings/queries'
import { toast } from '@renderer/lib/toast'
import { formatDate, today } from '@shared/dates'
import { formatMoney } from '@shared/money'
import { languageNames, languages, type Language } from '@shared/i18n'
import type { Settings, SettingsPatch, ThemeMode } from '@shared/settings'
import { t } from '@renderer/lib/i18n'

// Each language by its own name, whatever language the app is in.
const languageOptions: SegmentedOption<Language>[] = languages.map((value) => ({
  value,
  label: languageNames[value]
}))

const themeOptions = (): SegmentedOption<ThemeMode>[] => [
  { value: 'system', label: t('settings.system'), icon: Monitor },
  { value: 'light', label: t('settings.light'), icon: Sun },
  { value: 'dark', label: t('settings.dark'), icon: Moon }
]

const laterSettings = (): string[] => [t('settings.backupAndRestoreCsv')]

interface SettingRowProps {
  id: string
  label: string
  description: string
  children: React.ReactNode
  /** Shown under the row, full width. */
  footer?: React.ReactNode
}

function SettingRow({
  id,
  label,
  description,
  children,
  footer
}: SettingRowProps): React.JSX.Element {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <Label htmlFor={id}>{label}</Label>
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        </div>
        <div className="w-72 shrink-0">{children}</div>
      </div>
      {footer}
    </div>
  )
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange
}: ToggleRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-8 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-description`} className="mt-0.5 text-sm text-ink-muted">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={`${id}-description`}
      />
    </div>
  )
}

interface SettingSelectProps {
  id: string
  value: string
  options: Option<string>[]
  onValueChange: (value: string) => void
}

function SettingSelect({
  id,
  value,
  options,
  onValueChange
}: SettingSelectProps): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SettingsForm({ settings }: { settings: Settings }): React.JSX.Element {
  const updateSettings = useUpdateSettings()

  const save = (patch: SettingsPatch, savedTitle?: string): void =>
    updateSettings.mutate(patch, {
      onSuccess: () => savedTitle && toast({ title: savedTitle, variant: 'success' }),
      onError: (error) =>
        toast({
          title: t('settings.settingsNotSaved'),
          description: error.message,
          variant: 'error'
        })
    })

  const { currency, locale, weekStart } = settings
  const sampleAmount = formatMoney(123456, { currency, locale })
  const sampleDate = formatDate(today(), locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const weekEnd = weekdayName((weekStart + 6) % 7)

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader className="block">
          <CardTitle id="setting-language-label">{t('settings.language')}</CardTitle>
          <CardDescription>{t('settings.languageHint')}</CardDescription>
        </CardHeader>
        <SegmentedControl
          name="language"
          aria-labelledby="setting-language-label"
          value={settings.language}
          options={languageOptions}
          onValueChange={(language) => save({ language })}
        />
      </Card>

      <Card>
        <CardHeader className="block">
          <CardTitle>{t('settings.moneyAndDates')}</CardTitle>
          <CardDescription>
            {t('settings.formatHint', { amount: sampleAmount, date: sampleDate })}
          </CardDescription>
        </CardHeader>
        <div className="divide-y divide-line">
          <SettingRow
            id="setting-currency"
            label={t('settings.currency')}
            description={t('settings.theCurrencyAllYour')}
            footer={
              <p className="mt-3 flex gap-2.5 rounded-control bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {t('settings.currencyHint', { amount: formatMoney(10000, { currency, locale }) })}
              </p>
            }
          >
            <SettingSelect
              id="setting-currency"
              value={currency}
              options={currencyOptions(currency)}
              onValueChange={(value) =>
                save({ currency: value }, t('settings.currencyChanged', { currency: value }))
              }
            />
          </SettingRow>

          <SettingRow
            id="setting-locale"
            label={t('settings.numberAndDateFormat')}
            description={t('settings.decimalSeparatorDigitGrouping')}
          >
            <SettingSelect
              id="setting-locale"
              value={locale}
              options={localeOptions(locale)}
              onValueChange={(value) => save({ locale: value }, t('settings.numberAndDateFormat2'))}
            />
          </SettingRow>

          <SettingRow
            id="setting-week-start"
            label={t('settings.firstDayOfThe')}
            description={t('settings.weeksRun', { from: weekdayName(weekStart), to: weekEnd })}
          >
            <SettingSelect
              id="setting-week-start"
              value={String(weekStart)}
              options={weekStartOptions().map((o) => ({ ...o, value: String(o.value) }))}
              onValueChange={(value) =>
                save(
                  { weekStart: Number(value) },
                  t('settings.weeksStart', { day: weekdayName(Number(value)) })
                )
              }
            />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader className="block">
          <CardTitle id="setting-theme-label">{t('settings.appearance')}</CardTitle>
          <CardDescription>{t('settings.systemFollowsTheWindows')}</CardDescription>
        </CardHeader>
        <SegmentedControl
          name="theme"
          aria-labelledby="setting-theme-label"
          value={settings.theme}
          options={themeOptions()}
          onValueChange={(theme) => save({ theme })}
        />
      </Card>

      <Card>
        <CardHeader className="block">
          <CardTitle>{t('settings.remindersAndStartup')}</CardTitle>
          <CardDescription>{t('settings.remindersArriveWhileFinancije')}</CardDescription>
        </CardHeader>
        <div className="divide-y divide-line">
          <ToggleRow
            id="setting-notifications"
            label={t('settings.paymentReminders')}
            description={t('settings.aWindowsNotificationBefore')}
            checked={settings.notificationsEnabled}
            onCheckedChange={(on) =>
              save(
                { notificationsEnabled: on },
                on ? t('settings.remindersTurnedOn') : t('settings.remindersTurnedOff')
              )
            }
          />
          <ToggleRow
            id="setting-tray"
            label={t('settings.keepRunningInThe')}
            description={t('settings.closingTheWindowLeaves')}
            checked={settings.closeToTray}
            onCheckedChange={(on) => save({ closeToTray: on })}
          />
          <ToggleRow
            id="setting-start"
            label={t('settings.startWithWindows')}
            description={
              settings.closeToTray ? t('settings.startsInTheTray') : t('settings.startsWhenYouSign')
            }
            checked={settings.startWithWindows}
            onCheckedChange={(on) => save({ startWithWindows: on })}
          />
        </div>
      </Card>

      <section className="rounded-panel border border-dashed border-line p-5">
        <h2 className="font-semibold">{t('settings.moreSettingsOnThe')}</h2>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-ink-muted marker:text-primary">
          {laterSettings().map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const settings = useSettings()

  return (
    <>
      <PageHeader
        title={t('screen.settings')}
        description={t('settings.currencyFormatsThemeAnd')}
      />
      {settings.data ? (
        <SettingsForm settings={settings.data} />
      ) : settings.isError ? (
        <Card className="max-w-3xl">
          <CardTitle>{t('settings.settingsCouldNotBe')}</CardTitle>
          <CardDescription className="mt-1">
            {t('settings.restartToRetry', { error: settings.error.message })}
          </CardDescription>
        </Card>
      ) : null}
    </>
  )
}

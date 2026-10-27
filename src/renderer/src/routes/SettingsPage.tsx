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
import type { Settings, SettingsPatch, ThemeMode } from '@shared/settings'

const themeOptions: SegmentedOption<ThemeMode>[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
]

const laterSettings = ['Backup and restore, CSV export and reset data (step 38)']

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
        toast({ title: 'Settings not saved', description: error.message, variant: 'error' })
    })

  const { currency, locale, weekStart } = settings
  const sampleAmount = formatMoney(123456, { currency, locale })
  const sampleDate = formatDate(today(), locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const weekEnd = weekdayName((weekStart + 6) % 7)

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader className="block">
          <CardTitle>Money and dates</CardTitle>
          <CardDescription>
            How amounts and dates look throughout the app: {sampleAmount} · {sampleDate}
          </CardDescription>
        </CardHeader>
        <div className="divide-y divide-line">
          <SettingRow
            id="setting-currency"
            label="Currency"
            description="The currency all your accounts use."
            footer={
              <p className="mt-3 flex gap-2.5 rounded-control bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                Changing the currency only changes the symbol. Amounts are not converted, so{' '}
                {formatMoney(10000, { currency, locale })} stays 100 in the new currency.
              </p>
            }
          >
            <SettingSelect
              id="setting-currency"
              value={currency}
              options={currencyOptions(currency)}
              onValueChange={(value) => save({ currency: value }, `Currency changed to ${value}`)}
            />
          </SettingRow>

          <SettingRow
            id="setting-locale"
            label="Number and date format"
            description="Decimal separator, digit grouping and date order."
          >
            <SettingSelect
              id="setting-locale"
              value={locale}
              options={localeOptions(locale)}
              onValueChange={(value) => save({ locale: value }, 'Number and date format changed')}
            />
          </SettingRow>

          <SettingRow
            id="setting-week-start"
            label="First day of the week"
            description={`Weeks run ${weekdayName(weekStart)} to ${weekEnd} in weekly views and the calendar.`}
          >
            <SettingSelect
              id="setting-week-start"
              value={String(weekStart)}
              options={weekStartOptions.map((o) => ({ ...o, value: String(o.value) }))}
              onValueChange={(value) =>
                save(
                  { weekStart: Number(value) },
                  `Weeks now start on ${weekdayName(Number(value))}`
                )
              }
            />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader className="block">
          <CardTitle id="setting-theme-label">Appearance</CardTitle>
          <CardDescription>System follows the Windows light or dark mode.</CardDescription>
        </CardHeader>
        <SegmentedControl
          name="theme"
          aria-labelledby="setting-theme-label"
          value={settings.theme}
          options={themeOptions}
          onValueChange={(theme) => save({ theme })}
        />
      </Card>

      <Card>
        <CardHeader className="block">
          <CardTitle>Reminders and startup</CardTitle>
          <CardDescription>
            Reminders arrive while Financije is open or running in the tray.
          </CardDescription>
        </CardHeader>
        <div className="divide-y divide-line">
          <ToggleRow
            id="setting-notifications"
            label="Payment reminders"
            description="A Windows notification before bills and subscriptions are due. Set how many days before on each one under Recurring."
            checked={settings.notificationsEnabled}
            onCheckedChange={(on) =>
              save(
                { notificationsEnabled: on },
                on ? 'Reminders turned on' : 'Reminders turned off'
              )
            }
          />
          <ToggleRow
            id="setting-tray"
            label="Keep running in the tray"
            description="Closing the window leaves Financije in the tray, so reminders still arrive. Quit from the tray icon’s menu."
            checked={settings.closeToTray}
            onCheckedChange={(on) => save({ closeToTray: on })}
          />
          <ToggleRow
            id="setting-start"
            label="Start with Windows"
            description={
              settings.closeToTray
                ? 'Starts in the tray when you sign in, so reminders arrive without opening it.'
                : 'Starts when you sign in, so reminders arrive without opening it.'
            }
            checked={settings.startWithWindows}
            onCheckedChange={(on) => save({ startWithWindows: on })}
          />
        </div>
      </Card>

      <section className="rounded-panel border border-dashed border-line p-5">
        <h2 className="font-semibold">More settings on the way</h2>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-ink-muted marker:text-primary">
          {laterSettings.map((item) => (
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
      <PageHeader title="Settings" description="Currency, formats, theme and reminders." />
      {settings.data ? (
        <SettingsForm settings={settings.data} />
      ) : settings.isError ? (
        <Card className="max-w-3xl">
          <CardTitle>Settings could not be loaded</CardTitle>
          <CardDescription className="mt-1">
            {settings.error.message} Restart Financije to try again.
          </CardDescription>
        </Card>
      ) : null}
    </>
  )
}

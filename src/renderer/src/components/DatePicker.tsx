import { useState } from 'react'
import { DayPicker, type ClassNames } from 'react-day-picker'
import { CalendarDays } from 'lucide-react'
import { addDays, formatDate, parseIsoDate, toIsoDate, today, type IsoDate } from '@shared/dates'
import { defaultSettings } from '@shared/settings'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useSettings } from '@renderer/features/settings/queries'
import { cn } from '@renderer/lib/utils'

const calendarClasses: Partial<ClassNames> = {
  root: 'relative',
  months: 'flex',
  month: 'grid gap-2',
  month_caption: 'flex h-9 items-center px-2 font-display font-semibold',
  nav: 'absolute top-0 right-0 flex gap-1',
  button_previous:
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40',
  button_next:
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40',
  chevron: 'size-4 fill-current',
  month_grid: 'border-collapse',
  weekday: 'size-9 text-xs font-semibold text-ink-muted',
  day: 'p-0 text-center',
  day_button:
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-sm tabular-nums transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary',
  selected:
    '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-on-primary [&>button]:hover:bg-primary-hover',
  today: 'font-bold [&:not([data-selected])>button]:text-primary',
  outside: '[&>button]:text-ink-muted/50',
  disabled: '[&>button]:pointer-events-none [&>button]:opacity-40',
  hidden: 'invisible'
}

interface DatePickerProps {
  id?: string
  value: IsoDate
  onChange: (value: IsoDate) => void
  /** Earliest selectable date. */
  min?: IsoDate
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  className?: string
}

/**
 * A date field that shows the date in the app's locale ("Mon, 26 Oct 2026" or
 * "pon, 26. lis 2026.") and opens a calendar starting on the chosen first day of the week.
 * The native date input can't do this: it follows the Windows language instead.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  className,
  ...aria
}: DatePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { data: settings } = useSettings()
  const locale = settings?.locale ?? defaultSettings.locale
  const weekStart = settings?.weekStart ?? defaultSettings.weekStart
  const selected = parseIsoDate(value)
  const now = today()

  const pick = (date: IsoDate): void => {
    onChange(date)
    setOpen(false)
  }
  const shortcuts = [
    { label: 'Today', date: now },
    { label: 'Yesterday', date: addDays(now, -1) }
  ].filter((s) => !min || s.date >= min)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            'flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 text-left text-body text-ink transition-colors hover:border-ink-muted/40 focus-visible:border-primary focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary aria-invalid:border-expense',
            className
          )}
          {...aria}
        >
          <span className="truncate">
            {formatDate(value, locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
          <CalendarDays className="size-4 shrink-0 text-ink-muted" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Choose a date">
        <DayPicker
          mode="single"
          required
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => date && pick(toIsoDate(date))}
          weekStartsOn={weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6}
          disabled={min ? { before: parseIsoDate(min) } : undefined}
          showOutsideDays
          fixedWeeks
          autoFocus
          classNames={calendarClasses}
        />
        <div className="mt-2 flex gap-2 border-t border-line pt-3">
          {shortcuts.map((s) => (
            <Button key={s.label} variant="secondary" size="sm" onClick={() => pick(s.date)}>
              {s.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

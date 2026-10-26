import { PenLine } from 'lucide-react'
import { subscriptionPresets } from '@shared/subscription-presets'
import { Button } from '@renderer/components/ui/button'
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

const tile =
  'flex h-11 w-full cursor-pointer items-center gap-2 rounded-control border px-3 text-left font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary'

/** First step of "Add subscription": a common service fills in the name, or "Custom". */
export function PresetPicker({ onPick }: { onPick: (title: string) => void }): React.JSX.Element {
  return (
    <>
      <DialogHeader>
        <DialogTitle>New subscription</DialogTitle>
        <DialogDescription>
          Pick the service to fill in its name. You enter the price and billing date next.
        </DialogDescription>
      </DialogHeader>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Services">
        {subscriptionPresets.map((name, index) => (
          <li key={name}>
            <button
              type="button"
              autoFocus={index === 0}
              onClick={() => onPick(name)}
              className={`${tile} border-line bg-surface hover:border-ink-muted/40 hover:bg-surface-2`}
            >
              <span className="truncate">{name}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onPick('')}
            className={`${tile} border-dashed border-line text-primary hover:bg-primary-soft`}
          >
            <PenLine className="size-4 shrink-0" aria-hidden />
            Custom
          </button>
        </li>
      </ul>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
      </DialogFooter>
    </>
  )
}

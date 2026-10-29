import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  side = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** A panel along the window's right edge, full height, instead of a centred dialog. */
  side?: boolean
}): React.JSX.Element {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-overlay-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 overflow-y-auto border border-line bg-surface p-6 text-ink shadow-float has-data-[slot=dialog-footer]:pb-0 focus:outline-none',
          side
            ? 'inset-y-0 right-0 w-[min(32rem,100vw)] rounded-l-panel border-r-0 data-[state=open]:animate-sheet-in'
            : 'top-1/2 left-1/2 max-h-[calc(100vh-4rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel data-[state=open]:animate-dialog-in',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute top-4 right-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('mb-5 flex flex-col gap-1 pr-8', className)} {...props} />
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Sticks to the bottom of a dialog that scrolls, so its actions stay in reach. It
        // supplies the dialog's bottom padding (see DialogContent) so nothing shows below it.
        'sticky bottom-0 z-10 -mx-6 mt-2 flex justify-end gap-2 bg-surface px-6 pt-4 pb-6',
        className
      )}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element {
  return <DialogPrimitive.Title className={cn('text-title font-semibold', className)} {...props} />
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-ink-muted', className)} {...props} />
  )
}

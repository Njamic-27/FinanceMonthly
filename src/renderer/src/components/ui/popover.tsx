import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@renderer/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>): React.JSX.Element {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-panel border border-line bg-surface p-3 text-ink shadow-float outline-none data-[state=open]:animate-dialog-in',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

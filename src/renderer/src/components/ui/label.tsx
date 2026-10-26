import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@renderer/lib/utils'

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>): React.JSX.Element {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-semibold text-ink select-none', className)}
      {...props}
    />
  )
}

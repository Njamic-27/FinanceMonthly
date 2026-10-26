import { useSyncExternalStore } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { dismissToast, getToasts, subscribeToasts, type ToastVariant } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

const icons: Record<ToastVariant, React.JSX.Element> = {
  default: <Info className="size-5 text-primary" />,
  success: <CircleCheck className="size-5 text-income" />,
  error: <CircleAlert className="size-5 text-expense" />
}

export function Toaster(): React.JSX.Element {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts)

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          onOpenChange={(open) => !open && dismissToast(t.id)}
          className={cn(
            'relative flex items-start gap-3 rounded-control border border-line bg-surface p-4 pr-10 text-ink shadow-float data-[state=open]:animate-toast-in data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)',
            t.variant === 'error' && 'border-expense/40'
          )}
        >
          <span className="mt-0.5 shrink-0">{icons[t.variant]}</span>
          <div className="grid gap-0.5">
            <ToastPrimitive.Title className="font-semibold">{t.title}</ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="text-sm text-ink-muted">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            aria-label="Dismiss"
            className="absolute top-3 right-3 inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed right-5 bottom-5 z-[60] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  )
}

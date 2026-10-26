import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge our custom tokens so e.g. `text-ink` and `text-amount` don't cancel out.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'canvas',
        'surface',
        'surface-2',
        'ink',
        'ink-muted',
        'line',
        'primary',
        'primary-hover',
        'on-primary',
        'primary-soft',
        'primary-soft-hover',
        'banner',
        'on-banner',
        'income',
        'income-soft',
        'expense',
        'expense-soft',
        'savings',
        'savings-soft',
        'loan',
        'loan-soft',
        'overlay'
      ],
      text: ['body', 'title', 'amount', 'hero'],
      radius: ['control', 'panel'],
      font: ['display']
    }
  }
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

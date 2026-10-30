export type ToastVariant = 'default' | 'success' | 'error'

export interface ToastItem {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  /** A button in the toast, e.g. Undo; such a toast stays longer. */
  action?: { label: string; run: () => void }
}

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function toast(input: {
  title: string
  description?: string
  variant?: ToastVariant
  action?: ToastItem['action']
}): void {
  items = [...items, { id: nextId++, variant: 'default', ...input }]
  emit()
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToasts(): ToastItem[] {
  return items
}

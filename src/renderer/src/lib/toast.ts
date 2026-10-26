export type ToastVariant = 'default' | 'success' | 'error'

export interface ToastItem {
  id: number
  title: string
  description?: string
  variant: ToastVariant
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

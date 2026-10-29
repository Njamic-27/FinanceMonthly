/** Whether there's a screen to go back to in this session (the router counts its entries). */
export function canGoBack(): boolean {
  const state: unknown = window.history.state
  const idx =
    state && typeof state === 'object' && 'idx' in state ? (state as { idx: unknown }).idx : 0
  return typeof idx === 'number' && idx > 0
}

export type ThemeMode = 'system' | 'light' | 'dark'

const media = window.matchMedia('(prefers-color-scheme: dark)')
let current: ThemeMode = 'system'

function sync(): void {
  const dark = current === 'dark' || (current === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

media.addEventListener('change', sync)
sync()

export function setTheme(mode: ThemeMode): void {
  current = mode
  sync()
}

export function getTheme(): ThemeMode {
  return current
}

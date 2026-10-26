// The theme setting is applied by the main process (nativeTheme.themeSource), which drives
// prefers-color-scheme. The renderer only mirrors that media query onto the `dark` class.
const media = window.matchMedia('(prefers-color-scheme: dark)')

function sync(): void {
  document.documentElement.classList.toggle('dark', media.matches)
}

media.addEventListener('change', sync)
sync()

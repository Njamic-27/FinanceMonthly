import { app, BrowserWindow, Menu, nativeImage, Notification, Tray } from 'electron'
import type { IpcEvent, IpcEvents } from '@shared/ipc'
import type { Settings } from '@shared/settings'

// The window, the tray icon and start-with-Windows: how Financije sits in Windows. With
// "close to tray" on, closing the window only hides it, so reminders keep arriving.

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let trayIcon = ''
let closeToTray = false
/** Set once the user really quits (tray menu, or the last window closing without the tray). */
let quitting = false
/** The "still running" notice shows the first time the window hides in each session. */
let hintShown = false

/** Launched by Windows at sign-in: start in the tray instead of opening the window. */
export const startedHidden = process.argv.includes('--hidden')

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

/** Sends one of main's events to the renderer, if the window is there. */
export function sendToRenderer<E extends IpcEvent>(
  event: E,
  ...args: Parameters<IpcEvents[E]>
): void {
  getMainWindow()?.webContents.send(event, ...args)
}

/** Brings the window back from the tray or the taskbar, optionally on a screen (`/recurring`). */
export function showMainWindow(path?: string): void {
  const window = getMainWindow()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  if (path) sendToRenderer('app:navigate', path)
}

/** Takes charge of the main window: closing it hides it while "close to tray" is on. */
export function manageWindow(window: BrowserWindow, icon: string): void {
  mainWindow = window
  trayIcon = icon
  window.on('close', (event) => {
    if (quitting || !closeToTray) return
    event.preventDefault()
    window.hide()
    if (!hintShown && Notification.isSupported()) {
      hintShown = true
      new Notification({
        title: 'Financije is still running',
        body: 'It stays in the tray to remind you of payments. Right-click the icon to quit.',
        icon: trayIcon,
        silent: true
      }).show()
    }
  })
}

app.on('before-quit', () => {
  quitting = true
})

function createTray(): Tray {
  // The app icon is large; the tray shows it at 16 px (32 on high-DPI screens).
  const created = new Tray(nativeImage.createFromPath(trayIcon).resize({ width: 32, height: 32 }))
  created.setToolTip('Financije')
  created.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Financije', click: () => showMainWindow() },
      { label: 'Due now and coming up', click: () => showMainWindow('/recurring') },
      { type: 'separator' },
      { label: 'Quit Financije', click: () => app.quit() }
    ])
  )
  created.on('click', () => showMainWindow())
  return created
}

/** Applies the settings that live outside the window: the tray icon and start-with-Windows. */
export function applySystemSettings(settings: Settings): void {
  closeToTray = settings.closeToTray
  if (closeToTray && !tray && trayIcon) tray = createTray()
  if (!closeToTray && tray) {
    tray.destroy()
    tray = null
  }

  // Only the installed app registers itself: in development it would register the bare
  // Electron binary. Windows starts it with --hidden, so it opens in the tray.
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, args: ['--hidden'] })
  }
}

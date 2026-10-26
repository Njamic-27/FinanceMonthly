import { app, shell, BrowserWindow, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { closeDatabase, databasePath, getDb, initDatabase } from './db'
import { getSettings } from './db/repositories/settings'
import { registerIpcHandlers } from './ipc'
import { startScheduler } from './app/scheduler'
import { applySystemSettings, manageWindow, showMainWindow, startedHidden } from './app/shell'

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    // Match the renderer canvas colour so there is no white flash before first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1a24' : '#f3f6f8',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Started by Windows at sign-in: stay in the tray, or at least stay out of the way.
    if (!startedHidden) mainWindow.show()
    else if (!getSettings(getDb()).closeToTray) mainWindow.showInactive()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

// Only one copy of the app may run, so the database is never opened twice.
// Launching it again brings the existing window to the front instead.
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) app.quit()

app.on('second-instance', () => showMainWindow())

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!isPrimaryInstance) return

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.financije.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    initDatabase()
    nativeTheme.themeSource = getSettings(getDb()).theme
  } catch (error) {
    dialog.showErrorBox(
      'Financije could not open its data',
      `${error instanceof Error ? error.message : String(error)}\n\nDatabase file: ${databasePath()}`
    )
    app.quit()
    return
  }

  await registerIpcHandlers()
  manageWindow(createWindow(), icon)
  applySystemSettings(getSettings(getDb()))
  // Posts payments that fell due while the app was closed, shows due reminders, and keeps
  // doing so every hour.
  startScheduler(icon)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})

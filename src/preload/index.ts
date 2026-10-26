import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { isIpcChannel, isIpcEvent, type PreloadApi } from '@shared/ipc'

// The renderer can call channels from the IPC contract and listen for main's events; nothing
// else from Electron (the raw event object included) reaches it.
const api: PreloadApi = {
  invoke(channel, ...args) {
    if (!isIpcChannel(channel)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on(event, listener) {
    if (!isIpcEvent(event)) throw new Error(`Unknown IPC event: ${String(event)}`)
    const forward = (_event: IpcRendererEvent, ...args: unknown[]): void =>
      (listener as (...a: unknown[]) => void)(...args)
    ipcRenderer.on(event, forward)
    return () => {
      ipcRenderer.removeListener(event, forward)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

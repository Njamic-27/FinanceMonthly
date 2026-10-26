import { contextBridge, ipcRenderer } from 'electron'
import { isIpcChannel, type PreloadApi } from '@shared/ipc'

// The renderer gets exactly one capability: calling channels from the IPC contract.
const api: PreloadApi = {
  invoke(channel, ...args) {
    if (!isIpcChannel(channel)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('api', api)

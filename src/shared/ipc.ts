import type { SerializedError } from './errors'
import type { Settings, SettingsPatch } from './settings'

/**
 * Every call the renderer can make to the main process. Main registers a handler per
 * channel (src/main/ipc), the preload only forwards these channels, and the renderer
 * calls them through `invoke` (src/renderer/src/lib/api.ts).
 */
export interface IpcContract {
  'settings:get': () => Settings
  'settings:update': (patch: SettingsPatch) => Settings
}

export type IpcChannel = keyof IpcContract
export type IpcArgs<C extends IpcChannel> = Parameters<IpcContract[C]>
export type IpcResult<C extends IpcChannel> = ReturnType<IpcContract[C]>

/** Handlers never throw across IPC; they resolve to one of these. */
export type IpcResponse<T> = { ok: true; data: T } | { ok: false; error: SerializedError }

/** Runtime allowlist for the preload. Typed as a Record so a missing channel fails to compile. */
const channels: Record<IpcChannel, true> = {
  'settings:get': true,
  'settings:update': true
}

export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === 'string' && Object.hasOwn(channels, value)
}

/** The API the preload exposes as `window.api`. */
export interface PreloadApi {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResponse<IpcResult<C>>>
}

import { ipcMain, type WebFrameMain } from 'electron'
import type { IpcArgs, IpcChannel, IpcResponse, IpcResult } from '@shared/ipc'
import { AppError, toSerializedError } from '../errors'

type Handler<C extends IpcChannel> = (...args: IpcArgs<C>) => IpcResult<C> | Promise<IpcResult<C>>

/** Only our own renderer — the bundled page or the dev server — may call the main process. */
function isTrustedSender(frame: WebFrameMain | null): boolean {
  const url = frame?.url ?? ''
  const devServer = process.env['ELECTRON_RENDERER_URL']
  return url.startsWith('file://') || (!!devServer && url.startsWith(devServer))
}

/**
 * Registers a handler for a channel from the IPC contract. The handler's return value is
 * wrapped as `{ ok: true, data }`; anything it throws becomes `{ ok: false, error }`.
 */
export function handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResponse<IpcResult<C>>> => {
    try {
      if (!isTrustedSender(event.senderFrame)) {
        throw new AppError('internal', `Rejected ${channel} from an untrusted page`)
      }
      return { ok: true, data: await handler(...(args as IpcArgs<C>)) }
    } catch (error) {
      return { ok: false, error: toSerializedError(error) }
    }
  })
}

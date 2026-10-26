import type { ErrorCode } from '@shared/errors'
import type { IpcArgs, IpcChannel, IpcResult } from '@shared/ipc'

/** A failed main-process call. `message` is written for the user. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Calls a main-process handler; resolves with its result or rejects with an ApiError. */
export async function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcArgs<C>
): Promise<IpcResult<C>> {
  const response = await window.api.invoke(channel, ...args)
  if (!response.ok) throw new ApiError(response.error.code, response.error.message)
  return response.data
}

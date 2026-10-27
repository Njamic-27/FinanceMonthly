import { today } from '@shared/dates'
import { getDb } from '../db'
import { buildProjection } from '../services/projection'
import { handle } from './handle'

export function registerProjectionHandlers(): void {
  handle('projection:get', (query) => buildProjection(getDb(), query, today()))
}

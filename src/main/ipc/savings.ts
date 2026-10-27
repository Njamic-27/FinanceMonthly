import { z } from 'zod'
import { today } from '@shared/dates'
import { getDb } from '../db'
import {
  addSavingsMovement,
  createSavingsGoal,
  deleteSavingsGoal,
  deleteSavingsMovement,
  getSavingsSeries,
  listSavingsGoals,
  listSavingsMovements,
  setSavingsGoalArchived,
  updateSavingsGoal,
  updateSavingsMovement
} from '../db/repositories/savings'
import { handle } from './handle'

export function registerSavingsHandlers(): void {
  handle('savings:list', () => listSavingsGoals(getDb()))
  handle('savings:create', (input) => createSavingsGoal(getDb(), input))
  handle('savings:update', (id, input) => updateSavingsGoal(getDb(), id, input))
  handle('savings:archive', (id, archived) =>
    setSavingsGoalArchived(getDb(), id, z.boolean().parse(archived))
  )
  handle('savings:delete', (id) => deleteSavingsGoal(getDb(), id))
  handle('savings:movements', (goalId) => listSavingsMovements(getDb(), goalId))
  handle('savings:addMovement', (input) => addSavingsMovement(getDb(), input))
  handle('savings:updateMovement', (id, input) => updateSavingsMovement(getDb(), id, input))
  handle('savings:deleteMovement', (id) => deleteSavingsMovement(getDb(), id))
  handle('savings:series', (goalId) => getSavingsSeries(getDb(), goalId, today()))
}

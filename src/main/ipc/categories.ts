import { getDb } from '../db'
import {
  createCategory,
  deleteCategory,
  listCategories,
  mergeCategory,
  updateCategory
} from '../db/repositories/categories'
import { handle } from './handle'

export function registerCategoryHandlers(): void {
  handle('categories:list', () => listCategories(getDb()))
  handle('categories:create', (input) => createCategory(getDb(), input))
  handle('categories:update', (id, patch) => updateCategory(getDb(), id, patch))
  handle('categories:delete', (id) => deleteCategory(getDb(), id))
  handle('categories:merge', (sourceId, targetId) => mergeCategory(getDb(), sourceId, targetId))
}

import { getDb } from '../db'
import { getCategoryTotals, getLargest, getSeries, getTotals } from '../db/repositories/stats'
import { handle } from './handle'

export function registerStatsHandlers(): void {
  handle('stats:totals', (range) => getTotals(getDb(), range))
  handle('stats:series', (query) => getSeries(getDb(), query))
  handle('stats:categories', (query) => getCategoryTotals(getDb(), query))
  handle('stats:largest', (query) => getLargest(getDb(), query))
}

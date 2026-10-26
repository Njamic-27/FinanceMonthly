import type { Migration } from '../migrate'
import { migration001 } from './001_initial'

/** All migrations in order. Never edit a released migration — add a new one. */
export const migrations: Migration[] = [migration001]

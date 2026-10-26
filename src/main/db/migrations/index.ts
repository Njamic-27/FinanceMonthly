import type { Migration } from '../migrate'
import { migration001 } from './001_initial'
import { migration002 } from './002_default_categories'

/** All migrations in order. Never edit a released migration — add a new one. */
export const migrations: Migration[] = [migration001, migration002]

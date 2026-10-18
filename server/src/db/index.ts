/**
 * Barrel re-exporting every db module. Handy for `getDb`/`initDb`; routes that
 * only need one aggregate import it directly (`../db/entries`, `../db/tags`,
 * `../db/users`) so changes to another aggregate do not recompile them.
 */
export * from './connection'
export * from './entries'
export * from './errors'
export * from './tags'
export * from './users'

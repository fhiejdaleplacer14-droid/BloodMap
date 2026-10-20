import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { E2E_ENV } from '../playwright.config'

const backend = resolve(import.meta.dirname, '../../backend')

/**
 * Fresh, demo-seeded database for every run. Refuses to touch anything whose
 * name doesn't end in "_e2e" — a wrong DB_DATABASE must never wipe dev data.
 */
export default function globalSetup() {
  const env = { ...process.env, ...E2E_ENV }
  if (!/_e2e$/.test(env.DB_DATABASE)) throw new Error(`Refusing to reset "${env.DB_DATABASE}": the e2e database name must end in _e2e.`)

  const actual = execFileSync('php', ['artisan', 'tinker', '--execute=echo DB::connection()->getDatabaseName();'], { cwd: backend, env })
    .toString()
    .trim()
  if (actual !== env.DB_DATABASE) throw new Error(`Expected to reset "${env.DB_DATABASE}" but Laravel is connected to "${actual}".`)

  execFileSync('php', ['artisan', 'migrate:fresh', '--seed', '--force'], { cwd: backend, env, stdio: 'inherit' })
}

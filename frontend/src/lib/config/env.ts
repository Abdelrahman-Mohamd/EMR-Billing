import { z } from 'zod'

/**
 * Environment is parsed once, at startup, and the app reads `env` instead of
 * `import.meta.env`. A missing or misspelled variable fails immediately and
 * loudly instead of turning into `undefined` three screens later.
 *
 * Nothing here is secret: every VITE_* value is compiled into the bundle.
 * See docs/SECURITY.md "Environment variables".
 */
const envSchema = z.object({
  /**
   * The Billing API, e.g. https://api.example.test/api/v1 (set
   * in `.env`). Empty means no backend: every request is refused as
   * `unavailable` without being sent — what the tests use (`test.env` in vite.config.ts).
   */
  VITE_API_BASE_URL: z.union([z.url(), z.literal('')]).default(''),
  VITE_ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']).default('development'),
})

export type Env = {
  apiBaseUrl: string
  environment: 'development' | 'test' | 'staging' | 'production'
  /** True when the app is talking to a real backend. */
  isLive: boolean
}

export function parseEnv(raw: unknown): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    // Field names only — never the values, which may be pasted into a ticket.
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid environment configuration: ${fields}`)
  }
  const parsed = result.data
  return {
    apiBaseUrl: parsed.VITE_API_BASE_URL,
    environment: parsed.VITE_ENVIRONMENT,
    isLive: parsed.VITE_API_BASE_URL !== '',
  }
}

export const env: Env = parseEnv(import.meta.env)

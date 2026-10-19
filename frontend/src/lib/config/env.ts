import { z } from 'zod'

/**
 * Environment is parsed once, at startup, and the app reads `env` instead of
 * `import.meta.env`. A missing or misspelled variable fails immediately and
 * loudly instead of turning into `undefined` three screens later.
 *
 * Two sources, the first that is there wins:
 * - **At run time**, `window.__APP_CONFIG__`, written by the container into
 *   `/config.js` when it starts (`docker/40-app-config.sh`, from its
 *   `API_BASE_URL` and `APP_ENVIRONMENT`), so one image runs in any
 *   environment (docs/DEPLOYMENT.md);
 * - **At build time**, the `VITE_*` values (`.env`) — `npm run dev`, the tests.
 *
 * Nothing here is secret: both are readable by anyone using the app.
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

/** What `/config.js` sets in a container; absent in development and the tests. */
declare global {
  interface Window {
    __APP_CONFIG__?: { apiBaseUrl?: string; environment?: string }
  }
}

/** The container's run-time values, when it wrote some; else the build's. */
function rawEnv(): unknown {
  const runtime = typeof window === 'undefined' ? undefined : window.__APP_CONFIG__
  if (runtime === undefined) return import.meta.env
  return { VITE_API_BASE_URL: runtime.apiBaseUrl, VITE_ENVIRONMENT: runtime.environment }
}

export const env: Env = parseEnv(rawEnv())

import { fileURLToPath, URL } from 'node:url'
// `vitest/config` re-exports Vite's defineConfig with the `test` block typed,
// so the build config and the test config stay in one file.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // Generates routeTree.gen.ts from src/routes and splits every route's
    // component into its own chunk (docs/PERFORMANCE.md "Code splitting").
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // A route's test file sits next to it and is not a route.
      routeFileIgnorePattern: '\\.test\\.tsx?$',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Hidden source maps: uploadable to an error tracker, not served to the
    // browser. See docs/SECURITY.md "Source maps".
    sourcemap: 'hidden',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // No `globals: true` — `describe`/`it`/`expect` are imported explicitly so
    // a test file type-checks like any other module.
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // No backend in tests: an empty API address makes every request be refused
    // as "unavailable" without being sent, so no test can reach staging (which
    // `.env` points at). Tests fake what they need — the api module, or `fetch`
    // for the http client itself.
    env: { VITE_API_BASE_URL: '', VITE_ENVIRONMENT: 'test' },
    // Screen tests drive the real router, forms and dialogs key by key; 5 s
    // (the default) is too tight for them on a busy machine.
    testTimeout: 15_000,
  },
})

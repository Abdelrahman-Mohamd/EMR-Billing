import { fileURLToPath, URL } from 'node:url'
// `vitest/config` re-exports Vite's defineConfig with the `test` block typed,
// so the build config and the test config stay in one file.
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig(({ command, mode }) => ({
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
  define: {
    // Whether features may answer from their in-memory mocks (ADR 0006): on in
    // the dev server and tests ("serve"), and in a build made explicitly with
    // VITE_DATA_SOURCE=mock (a demo). A constant replaced in every module, so
    // in any other build the `if (__MOCK_DATA__)` branch is dead code before
    // bundling and the mock modules are never emitted. Declared in
    // src/lib/api/mock-data.d.ts.
    __MOCK_DATA__: JSON.stringify(
      command === 'serve' || loadEnv(mode, process.cwd(), 'VITE_').VITE_DATA_SOURCE === 'mock',
    ),
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
  },
}))

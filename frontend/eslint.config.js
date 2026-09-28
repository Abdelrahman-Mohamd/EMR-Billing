import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * Lint is where the architecture is enforced, not just where style is checked.
 * The rules below encode three things the docs would otherwise only ask nicely
 * for: dependency direction, the API boundary, and the "no PHI in the browser"
 * rules. See docs/FRONTEND_ARCHITECTURE.md and docs/SECURITY.md.
 */

/** Shared code must not know that features exist. */
const SHARED_CANNOT_IMPORT = [
  {
    group: ['@/features/*', '@/features/*/**', '@/routes/*', '@/routes/*/**', '@/app/*', '@/app/*/**'],
    message:
      'Dependency direction: routes -> features -> shared. Shared code (components, lib, stores, types, hooks) must not import a feature, a route or app wiring. Move the shared piece down, or keep it inside the feature.',
  },
]

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/routeTree.gen.ts'] },

  // ---------------------------------------------------------------- app source
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ---- type safety (docs/FRONTEND_ENGINEERING_STANDARDS.md)
      '@typescript-eslint/no-explicit-any': 'error',
      // A leading underscore marks a value that is destructured only to keep it
      // out of a rest spread — e.g. an aria prop a div must not receive.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // ---- security (docs/SECURITY.md)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'dangerouslySetInnerHTML is banned. If HTML from a server must be rendered, sanitize it in a reviewed module and disable this rule there with a comment explaining the source.',
        },
        {
          selector:
            'CallExpression[callee.object.name="JSON"][callee.property.name="parse"] > MemberExpression[object.name="localStorage"]',
          message:
            'Reading structured data back out of localStorage is a sign that server data is being cached in the browser. See docs/SECURITY.md.',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Browser storage may not hold patient, claim or payment data, and is off limits outside src/lib/storage. See docs/SECURITY.md "Browser storage".',
        },
        {
          name: 'sessionStorage',
          message:
            'Browser storage may not hold patient, claim or payment data, and is off limits outside src/lib/storage. See docs/SECURITY.md "Browser storage".',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // ---------------------------------------------------------------- boundaries
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/stores/**/*.{ts,tsx}',
      'src/types/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
    ],
    rules: { 'no-restricted-imports': ['error', { patterns: SHARED_CANNOT_IMPORT }] },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/**'],
              message:
                'Cross-feature imports may only use another feature\'s public surface: import from "@/features/<name>", never into its files. Inside your own feature use relative paths.',
            },
            {
              group: ['@/routes/*', '@/routes/*/**'],
              message:
                'A feature must not import a route. Routes depend on features, never the other way round.',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------- API boundary
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/api/**', 'src/test/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Call the API through src/lib/api (http client -> feature api module -> query hook), never fetch() from a component or hook.',
        },
        { name: 'localStorage', message: 'See docs/SECURITY.md "Browser storage".' },
        { name: 'sessionStorage', message: 'See docs/SECURITY.md "Browser storage".' },
      ],
    },
  },

  // ---------------------------------------------------------------- ui kit
  {
    files: ['src/components/**/*.tsx', 'src/stores/**/*.ts'],
    // A primitive legitimately exports its helpers beside it (useFieldControl,
    // buttonClass, applyServerErrors). The cost is a coarser hot reload, not a bug.
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // ---------------------------------------------------------------- routes
  {
    files: ['src/routes/**/*.tsx'],
    // A route file exports `Route` beside its component by design; fast refresh
    // is handled by the router plugin, not by this heuristic.
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // ---------------------------------------------------------------- tests
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  // ---------------------------------------------------------------- config files
  {
    files: ['*.{ts,js}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
)

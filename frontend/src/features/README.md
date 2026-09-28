# Features

One folder per business module. A feature owns its screens, its data access, its business rules and its
types. This folder is empty until the first feature is built — there is no scaffolding to fill in.

## Creating a feature

Create only the parts you actually need. A feature with four files is four files.

```
features/claims/
├── index.ts          public surface — the only file other features may import
├── api/
│   ├── claims-api.ts       request functions + Zod response schemas
│   └── claims-api.mock.ts  mock implementation, same signatures (no backend yet)
├── queries/
│   ├── claim-keys.ts       the key factory — every key for this domain
│   └── use-claims.ts       query and mutation hooks
├── components/
│   ├── ClaimsScreen.tsx
│   └── ClaimStatusBadge.tsx
├── schemas/          Zod form schemas
├── model/            pure business rules, no React, heavily unit-tested
├── store.ts          feature-local Zustand (rare)
└── types.ts          types inferred from schemas, plus domain unions
```

## The rules that matter

- **Imports:** relative inside the feature (`./model/hold`), `@/features/<name>` across features — never
  deeper than another feature's root. Lint enforces both.
- **No route imports.** Routes depend on features; features never depend on routes.
- **Business rules go in `model/`** as pure functions. If a rule is hard to unit-test, it is in the wrong file.
- **`index.ts` is a decision, not a dump.** Export the few things other features legitimately need.
- **Promote on the second consumer.** A component another feature needs moves to `components/shared`; a
  helper two features need moves to `lib`. Not before.

Full reference: [../../docs/FRONTEND_ARCHITECTURE.md](../../docs/FRONTEND_ARCHITECTURE.md) §3.

# Test support

`packages/test-utils` contains the test support shared by the microfrontends.
It is an internal directory, resolved through the TypeScript and Vitest aliases,
not a published workspace. Application code must not import it.

## Where to put test support

| Location                        | Purpose                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/test-utils/index.tsx` | Shared render, router and DOM helpers.                                                               |
| `packages/test-utils/mocks/`    | Reusable synthetic fixtures, such as patients, sessions and visits.                                  |
| `packages/test-utils/stubs/`    | Replacements for modules such as i18n, charts and framework exports.                                 |
| `<app>/test-utils/`             | Fixtures and helpers owned by one app. Ward, OCL and Stock Management keep their specific data here. |
| Local `__mocks__/` directories  | Existing module mocks used by the adjacent tests, such as Styleguide's location-picker fixtures.     |

Keep a fixture near its tests when it has one owner. Promote it to the shared
directory when another workspace needs the same contract, and migrate the
consumers instead of copying it. Prefer shared public types for shared fixtures;
data tied to an app's internal types belongs with that app. Existing shared
fixtures that still depend on app internals should be localized with their
consumers when that area is changed.

`mocks/` retains the existing fixture filenames. These are imported test data;
the separate `stubs/` directory replaces module behavior. The old shared
`packages/__mocks__` directory has been removed.

## Imports and configuration

```tsx
import { renderWithSwr } from "test-utils";
import { mockPatientAlice } from "test-utils/mocks/patient.mock";
```

The root entry point continues to export shared fixtures for existing tests.
Prefer a fixture's direct path for new imports. Import app-local helpers and
fixtures by relative path; do not add another `@mocks`, `__mocks__` or `@tools`
alias for them.

TypeScript aliases and test globals come from `packages/tsconfig.json` and
`packages/declarations.d.ts`. App configs extend
`packages/tooling/tsconfig.app.json`. A config that overrides `paths` must retain
the `test-utils` mappings if its tests use them, because TypeScript replaces the
inherited map.

Vitest apps use `defineAppVitestConfig` from
`packages/tooling/configs/vitest-config.ts`. Its shared runtime setup is
`packages/tooling/scripts/setup-tests.ts`; apps do not need an additional
TypeScript-only setup shim. Framework package mocks remain owned by their
libraries. The lightweight framework stubs are an explicit opt-in for libraries
whose tests target that contract.

Vitest, its UI, and the coverage provider use version 5 together. Every
workspace that declares Vitest also declares its Vite peer dependency; the app
template follows the same rule. Dependabot groups the runner, UI, and coverage
provider together, including major updates, to preserve their matching peers.

`packages/declarations.d.ts` adapts the existing jest-dom matcher types to
Vitest 5's `Matchers<R, T>` interface. This preserves the matcher return type
for synchronous assertions and awaited `resolves`/`rejects` assertions. The
runtime setup continues to register jest-dom's matchers through `expect.extend`.

Test globals come from `vitest/globals`; do not redeclare `vi` manually.
`packages/types/vi-namespace/index.d.ts` keeps legacy `vi.Mock` and related type
names as aliases to Vitest's types. Prefer `vi.mocked(fn)` or types imported
from `vitest` in new tests. Specialize generic hooks before mocking them, and
use `vi.importActual<typeof import('module')>('module')` for partial module mocks.
An unparameterized `vi.Mock` retains Vitest's broad function signature; migrating
those casts to inferred mocks remains incremental.

## Validation and caching

Changes to shared test support trigger repository-wide `verify:changed`
validation and invalidate the shared test and typecheck inputs in `turbo.json`.
App-local `test-utils/` files are inputs to that app's test, coverage, lint and
typecheck tasks. Keep these inputs aligned when relocating test support.

Run the affected app's tests and TypeScript check when moving fixtures. For
shared changes, follow the root tooling validation matrix in
[`CONTRIBUTING.md`](../../CONTRIBUTING.md). Use synthetic data only; local tests
do not establish clinical acceptance against a deployed backend.

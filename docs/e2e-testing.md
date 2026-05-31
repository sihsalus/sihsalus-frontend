# E2E Testing (Playwright)

The repo has **two** independent Playwright setups. Know which one you are running.

## System A — root smoke suite

- Config: `playwright.config.ts` (repo root)
- Specs: `e2e/tests/` (smoke, accessibility, critical-paths, …)
- Auth: `e2e/global-setup.ts` logs in via REST and writes `e2e/storage-state.json`
- Web server: auto-started via `webServer.command` (defaults to `yarn start`,
  override with `E2E_WEB_SERVER_COMMAND`)
- Run:

  ```bash
  yarn test:e2e
  ```

- `E2E_BASE_URL` **includes** `/spa` (e.g. `http://localhost:8080/openmrs/spa`).
  The setup derives the API base by stripping `/spa`.

## System B — per-module suites

- Configs: `e2e/<module>/playwright.config.ts` (laboratory, billing, dispensing,
  cohort-builder, form-builder, patient-imaging, stock-management, dyaku,
  fast-data-entry, user-onboarding) built from the shared factory
  `packages/tooling/configs/playwright-suite.ts`
- Each suite is self-contained: own `specs/`, `core/global-setup`, `fixtures/`,
  `pages/`, and own `storageState.json`
- These assume a server is **already running** (no `webServer` block)
- There is no aggregate runner; invoke each config explicitly:

  ```bash
  E2E_BASE_URL=http://localhost:8080/openmrs \
    yarn playwright test --config e2e/laboratory/playwright.config.ts
  ```

## ⚠️ Known issue — conflicting `E2E_BASE_URL` `/spa` convention

System A and System B disagree on whether `E2E_BASE_URL` includes `/spa`, while
sharing the same env var:

| | Expects `E2E_BASE_URL` | Reason |
|---|---|---|
| System A (root) | **with** `/spa` | `.env.template` default; setup strips `/spa` for the API |
| System B (modular) | **without** `/spa` | configs append `/spa/` to `baseURL`; global-setups hit `${E2E_BASE_URL}/ws/rest/v1` |

With the documented `.env.template` value (`…/openmrs/spa`), the modular suites
break:

- `baseURL` becomes `…/openmrs/spa/spa/` (double `/spa`)
- modular auth hits `…/openmrs/spa/ws/rest/v1/session` (wrong API path)

Running a modular suite today therefore requires overriding
`E2E_BASE_URL=http://localhost:8080/openmrs` (no `/spa`) on the command line.

**Not yet fixed** — pending a decision on which convention to standardize.

## CI

E2E is **not** wired into any GitHub Actions workflow; it runs manually only
(it needs a reachable OpenMRS backend).

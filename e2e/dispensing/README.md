# Dispensing E2E tests

This directory preserves the Playwright scenarios for
`@sihsalus/esm-dispensing-app`. Read the [E2E guide](../README.md),
[development setup](../../docs/development/README.md), and
[contribution requirements](../../CONTRIBUTING.md) before changing it.

## Execution status

**Quarantined.** Dispensing is not in the central runner's allowlist and is not
part of the browser CI matrix. Its previous catalog entry recorded unresolved
type errors and unvalidated order/visit mutations. The catalog itself is now
missing in this branch; see the [current tooling status](../../docs/development/tooling-status.md).
Neither a documentation change nor a passing root typecheck promotes this suite.

Do not invoke its Playwright config directly to bypass the runner, point it at
a public demo backend, or use real patients. The root `yarn test:e2e` command
selects the clinical suite; it does not run Dispensing. The root E2E TypeScript
configuration also excludes this suite, so its success does not validate these
files.

## Scenarios and ownership

| Scenario             | Spec                                                               |
| -------------------- | ------------------------------------------------------------------ |
| Active prescriptions | [active-prescriptions.spec.ts](specs/active-prescriptions.spec.ts) |
| Dispense medication  | [dispense-medication.spec.ts](specs/dispense-medication.spec.ts)   |
| Close a prescription | [close-prescription.spec.ts](specs/close-prescription.spec.ts)     |
| Pause a prescription | [pause-prescription.spec.ts](specs/pause-prescription.spec.ts)     |

- `commands/` contains the patient, provider, visit, encounter and drug-order operations.
- `core/` contains the runner fixtures and global setup.
- `fixtures/` contains shared setup helpers and the API fixture.
- `pages/` contains UI locators and actions.
- `specs/` contains the scenarios listed above.
- `types/` contains suite-local types.

## Requirements before promotion

Resolve the type errors and validate each mutating contract, including partial
setup and cleanup failure. Coordinate an explicit non-production target,
authorized test account, synthetic fixtures and required privileges. Follow the
[fixture recovery contract](../../docs/development/synthetic-fixtures.md) and
retain recoverable state until cleanup is verified.

Then review the catalog, runner allowlist, typecheck and CI changes together.
Passing discovery or local mocks is not evidence of clinical acceptance against
an OpenMRS backend. Credentials belong in the existing local secret mechanism
or CI secrets, never in a committed `.env` file.

## Dependencies and evidence

Playwright is managed through the root [package manifest](../../package.json)
and [lockfile](../../yarn.lock). There is no Bamboo Dockerfile at the location
referenced by the previous guide. Follow the repository's immutable installation
and validation procedure when changing the runner version.

The [Playwright configuration](playwright.config.ts) retains traces and videos
on failure and uses authentication state. Those artifacts can contain sensitive
data; review and sanitize evidence before sharing. No browser execution or
successful clinical cleanup is claimed by this documentation.

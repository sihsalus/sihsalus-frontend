# Laboratory E2E tests

This Playwright suite exercises laboratory requests, results, completion, and
rejection. Follow [CONTRIBUTING](../../CONTRIBUTING.md), the
[root README](../../README.md), and the [E2E gate](../README.md).
Use coordinated DEV/QLTY with authorized test accounts and synthetic patients
only. Never use production, real patients, or an arbitrary public demo backend.

## Running the suite

Prepare Node 24 / Yarn 4.13.0 and the SPA as described in the root README.
Provide credentials through the local secret mechanism or CI secrets, never
command-line password examples or committed configuration. Configure
`E2E_GATE_TARGET`, `E2E_API_BASE_URL`, `E2E_BASE_URL`, and
`E2E_LOGIN_DEFAULT_LOCATION_UUID` for the exact authorized target. Local execution
also requires `E2E_LABORATORY_SUPERVISED_TARGET` equal to `E2E_GATE_TARGET`, the
full `E2E_FIXTURE_EXPECTED_SHA`, and an environment-reviewed
`E2E_FIXTURE_REQUIRED_PRIVILEGES` JSON array containing the minimum core
permissions listed in `core/fixture-config.ts`, plus the applicable laboratory
UI/OMOD permissions. A missing or incomplete configuration fails before requests.

Identifier source `8549f706-7e85-4c1d-9424-217d50a2988b`, identifier type
`05a29f94-c0ed-11e2-94be-8c13b969e334` and the visit type below are explicit
content pins. Their optional `E2E_FIXTURE_*_UUID` settings must match exactly;
they cannot redirect fixture creation to another metadata catalogue.

**Browser CI is deliberately blocked** while a private durable handoff of the
recovery journals remains unavailable. Any `CI` setting or
`GITHUB_ACTIONS=true` fails before metadata requests, login or fixture creation.
The ordinary local contracts still run in CI. Do not remove this guard, set an
`e2e` label or dispatch remote browser CI until journal retention is resolved.

```sh
# Safe local contracts: no browser, credentials, or backend calls
yarn test:e2e:contracts

# Discovery only; not evidence that the clinical workflow passed
yarn test:e2e:suite laboratory --list --reporter=list

# Only after coordination, metadata checks and synthetic cleanup readiness
yarn test:e2e:suite laboratory --headed

# Focus one title without overriding the catalogued configuration
yarn test:e2e:suite laboratory --headed -g "View test orders"
```

The base preflight rejects an unapproved target, inactive location, or session
without an active clinical provider. Unlike the main clinical suite, laboratory
does not consume `E2E_PATIENT_UUID` or `E2E_APPOINTMENTS_PATIENT_UUID`: its
test fixture creates a synthetic patient/visit pair per case and retry. This does not relax
the main clinical preflight or remove CI's configured fixture requirements.

Laboratory global setup also checks the exact provider resource and requires
explicitly active provider/location metadata. Before writing login state or
starting any patient fixture, it reads the explicit SIHSALUS fixtures shared in
`core/fixture-config.ts`: AST/TGO (`18730e4e-0a5f-40cf-8c19-474276f5e9d7`),
Atención Ambulatoria (`b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09`) and Test Order.
The concept must be active, class `Test`, and datatype `Numeric`; the visit type
must be explicitly active and match its UUID. The order type must be active,
use `org.openmrs.TestOrder`, and admit that concept class. Missing, incompatible
or incomplete metadata blocks the suite with a safe error code. No concept or
visit type is discovered as a substitute, and no synthetic data is created
during these checks.

These identities were verified against
[content 1.25.19](https://github.com/sihsalus/sihsalus-content/tree/f038c0840d1c616e584a1cf7fd73d97d8429d179).
The bundled AST/TGO numeric metadata uses `IU/L` and permits the existing
synthetic result `35`. The three
cases retain their workflow assertions: listing, picking and completing a
numeric result, and rejection. They do not validate a clinical reference
interval, a method-specific interpretation or the legacy `887…` concept.

Global setup and the browser use the same absolute
`e2e/laboratory/storageState.json` path. It contains authentication state, is
ignored by Git, and must never be published as evidence.

## Data and assertions

The existing commands depend on the configured login location, provider,
identifier source/type, visit/encounter types, care setting and a numeric
orderable laboratory concept. Coordinate that metadata before running: an
available endpoint does not prove the content contract.

These metadata checks validate prerequisites for the API-created test order.
They do not validate membership in the patient-chart order picker, authorize a
catalogue replacement, or prove that result entry and cleanup will succeed.

Row selection matches an exact, whitespace-normalized synthetic patient cell,
not a regular expression built from the patient's name. Test labels come from
the created order's concept, must be nonempty, and are checked exactly where
the UI displays the test name. No concept default is substituted by this
selector recovery.

The adapter uses one `PrivateFixtureJournal` and `SyntheticFixtures` instance
per test attempt, preserving the existing target binding, ownership checks,
lost-response recovery and paginated cleanup. It configures the exact session
location and the browser suite's English locale; the foundation then verifies the served SHA and the account,
provider, identifier metadata and permissions before IDGen or patient creation.
The three specs reuse that one patient/visit pair and retain their encounter,
order and UI assertions. Cleanup visits observations, orders, encounters and
visits before the patient/person, including resources whose POST response was
lost. Partial setup still attempts cleanup; 401/403 stops dependent writes
and retains recovery state. A failed cleanup fails the case, also preserving
any original assertion failure.

Journals remain in the ignored `e2e/.synthetic-fixtures/` directory, outside
Playwright's disposable output. They use private files and an exclusive writer
lock and remain after success or failure; they are never uploaded as reports.
Keep this local worktree and directory available until cleanup is verified.
Each retry has a separate journal and does not erase the previous attempt.
If any cleanup fails, stop the run and recover that attempt before accepting
a retry or starting another run.

For interrupted runs, follow [the foundation recovery contract](../SYNTHETIC_FIXTURES.md):
confirm no writer remains, preserve the original environment binding, reopen
the specific journal with `PrivateFixtureJournal`, and call
`SyntheticFixtures.cleanup()` with an authorized API context. `close()` releases
only the lock. Do not delete pending state or automatically remove stale locks.
The adapter's local regressions cover setup failure, retries, authorization and
cleanup failure; the shared suite covers lost responses and dependent-resource
ownership/pagination. Supervised DEV/QLTY execution and recovery remain pending.

## Organization and evidence

Commands construct API fixtures, `core/` owns setup and test fixtures,
`pages/` owns UI locators, and `specs/` owns the acceptance scenarios.
All are included in `e2e/tsconfig.json`; the suite is registered in
[the catalog](../suite-catalog.json). Do not bypass its runner or add an
uncatalogued configuration.

CI's local contracts run for every PR. The workflow still lists laboratory in
its opt-in browser matrix, but its explicit retention guard blocks that job
until durable private recovery is available. Record the exact tested SHA,
target, role, assertions and verified cleanup; listing, cached tasks, or
typechecking are not clinical evidence. Inspect reports before sharing:
authentication state, response bodies, screenshots and videos must not expose
credentials or identifiable data.

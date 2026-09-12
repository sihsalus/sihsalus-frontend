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
`E2E_LOGIN_DEFAULT_LOCATION_UUID` for the exact authorized target.

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
existing test fixture creates a synthetic patient per case. This does not relax
the main clinical preflight or remove CI's configured fixture requirements.

Laboratory global setup also checks the exact provider resource and requires
explicitly active provider/location metadata. Before writing login state or
starting any patient fixture, it reads the concept and order type shared in
`core/fixture-config.ts`. The existing concept
`887AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` must be active, class `Test`, and datatype
`Numeric`. The existing order type must be active, use `org.openmrs.TestOrder`,
and admit that concept class. Missing, incompatible or incomplete metadata
blocks the suite with a safe error code; there is no search or fallback to
another concept and no synthetic creation during these checks.

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

The existing fixture setup/cleanup is not a newly validated transactional
harness. Do not use these selector/typecheck changes as evidence that partial
creation, lost responses, dependent resources or interrupted cleanup have been
covered. A new provisioning harness must keep a private, target-bound cleanup
journal, verify ownership and pagination, retain unresolved state, and pass
partial-failure regression tests before remote execution. Keep browser
validation BLOCKED until the target and cleanup procedure are coordinated.

## Organization and evidence

Commands construct API fixtures, `core/` owns setup and test fixtures,
`pages/` owns UI locators, and `specs/` owns the acceptance scenarios.
All are included in `e2e/tsconfig.json`; the suite is registered in
[the catalog](../suite-catalog.json). Do not bypass its runner or add an
uncatalogued configuration.

CI's local contracts run for every PR. Browser suites are opt-in through the
`e2e` label or manual workflow dispatch, with coordinated synthetic fixtures.
They do not run automatically on every commit. Record the exact tested SHA,
target, role, assertions and verified cleanup; listing, cached tasks, or
typechecking are not clinical evidence. Inspect reports before sharing:
authentication state, response bodies, screenshots and videos must not expose
credentials or identifiable data.

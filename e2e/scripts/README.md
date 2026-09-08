# Clinical flow verification scripts

Most scripts exercise state-changing workflows against an explicit OpenMRS
environment. Use only synthetic patients and test appointments.

## Read-only O3 Forms environment preflight

`o3forms-environment-preflight.mjs` is a separate GET-only technical inventory,
not a clinical smoke test. It requires explicit `O3FORMS_READONLY_PREFLIGHT=true`,
`E2E_GATE_TARGET=DEV`, `O3FORMS_PREFLIGHT_ORIGIN=https://gidis-hsc-dev.inf.pucp.edu.pe`,
`E2E_IGNORE_HTTPS_ERRORS=true|false`, and the existing `E2E_USER_ADMIN_*` secrets.
TLS exceptions are restricted to that exact DEV HTTPS origin. The workflow runs
only when `o3forms-dev-preflight` is explicitly added to a same-repository PR;
it has no dispatch, release, deployment or backend-write step and does not install
dependencies. A later push does not rerun this secret-bearing check. Review each
new head SHA first, then remove and re-add that exact label to authorize one
inventory of the reviewed SHA. Adding another label does not trigger the inventory.

It inventories authenticated-session privileges, frontend build SHA, O3 Forms
version/start state, REST and Patient Documents version/start state from the same
module inventory request, the exact configured Anamnesis/SOAP form metadata, identifier
sources/types, visit types and encounter types. It never reads patients, persons
or global providers, generates identifiers, creates fixtures, follows redirects,
or saves credentials/cookies/screenshots/raw responses. Authentication failures
stop subsequent requests. Output is restricted to allowlisted technical fields;
`clinicalValidation` remains `NOT_RUN`, including when the inventory succeeds.
Missing module/start metadata is reported as unknown, not healthy. An inventory
success does not prove all modules started: inspect each reported state. O3 can
start while Patient Documents fails its minimum-version dependency, even when
the general OpenMRS health endpoint succeeds.

REST 3.5.0's `/session` controller ignores `v` and uses a fixed user representation
without retirement flags. The inventory still requires `authenticated: true` and
rejects explicit retirement; omitted flags are reported as `retired: null` and
`privilegesRetirementKnown: false`, never as proof of an active account or privilege.
Missing authentication metadata, an unauthenticated session and an explicitly
retired account have separate fixed error codes. These read-only observations do
not relax the supervised clinical/fixture write gates.

## Credentials and target environment

Credentials are mandatory and must be provided through environment variables.
Do not commit passwords or production patient data.

```sh
export E2E_BASE_URL="https://example.test/openmrs/spa"
export E2E_USERNAME="..."
export E2E_PASSWORD="..."
export E2E_IGNORE_HTTPS_ERRORS="true"
```

If `E2E_USERNAME`/`E2E_PASSWORD` are not set, the scripts fall back to
`E2E_USER_ADMIN_USERNAME`/`E2E_USER_ADMIN_PASSWORD`, the variables already
used by the Playwright suite, so a single `.env` works for both.

`E2E_IGNORE_HTTPS_ERRORS` is only appropriate for controlled environments
using a self-signed certificate.

## Verify patient registration

```sh
node e2e/scripts/create-patient-registration-full-info.mjs
```

The script creates a synthetic patient through the UI, reports form and API
errors, and fails if the patient cannot be found after submission.

## Verify appointment arrival and queue persistence

The target appointment must be scheduled and must have one configured
service–UPSS arrival route.

```sh
export E2E_PATIENT_UUID="..."
export E2E_PATIENT_NAME="Synthetic Patient"
export E2E_APPOINTMENT_UUID="..."
export E2E_QUEUE_UUID="..."
export E2E_LOCATION_UUID="..."
export E2E_VISIT_TYPE_UUID="..."
node e2e/scripts/verify-appointment-arrival-queue.mjs
```

The script verifies all four persisted outcomes:

1. the appointment changes to `CheckedIn`;
2. an active visit exists in the required UPSS and visit type;
3. the visit contains the appointment correlation attribute;
4. an active queue entry links the configured queue and visit.

Override `E2E_APPOINTMENT_VISIT_ATTRIBUTE_TYPE_UUID` only when the target
environment uses a nonstandard appointment correlation attribute type.

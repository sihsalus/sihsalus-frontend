# Supervised O3 Forms acceptance

This adapter is opt-in, not a promoted Playwright suite or a replacement for the
existing clinical gate. It never enables `clinical-recovery`. Local unit tests
are not DEV/QLTY acceptance evidence. Run DEV first; QLTY requires successful DEV
acceptance and a separate coordinated invocation. Never target production.

## Preconditions and configuration

Use a dedicated authorized synthetic test account through the existing
`E2E_USER_ADMIN_USERNAME` / `E2E_USER_ADMIN_PASSWORD` secret mechanism. No dotenv,
credential fallback, first-available provider, role changes, or account creation
is provided. `E2E_GATE_TARGET`, `E2E_API_BASE_URL`, `E2E_BASE_URL`, and
`E2E_LOGIN_DEFAULT_LOCATION_UUID` follow the existing exact DEV/QLTY allowlist.
Unlike the general gate, this acceptance requires the **deployed** SPA on the
same origin as its backend. TLS verification is enabled by default. An explicit
`SIHSALUS_ALLOW_SELF_SIGNED_TLS=true` permits a coordinated self-signed certificate
only in this adapter's API/browser contexts after the exact DEV/QLTY allowlist
passes. It does not set a global TLS bypass; `NODE_TLS_REJECT_UNAUTHORIZED=0` is
rejected. The broader `E2E_IGNORE_HTTPS_ERRORS` flag is not used here. Record the
exception in that environment's evidence. Do not use a local SPA as evidence
that a release is deployed.

Read [the fixture foundation contract](../SYNTHETIC_FIXTURES.md) before use.
Configure all five `E2E_FIXTURE_*` settings documented there, with a reviewed
complete create/read/void privilege list. The adapter also requires:

OpenMRS REST `SessionController1_9` uses a fixed session representation, so this
adapter verifies authentication and canonical user/provider identities first,
then reads only those exact resources using `user/{uuid}` and `provider/{uuid}`.
Both must return the same UUID and explicit `retired: false`; omitted states are
not treated as active. The account's reviewed privilege list must include
`Get Users` and `Get Providers`. No user/provider collection or first-available
fallback is permitted. These checks and the fixture preflight must pass before
any clinical `run`; local mocks alone are not activation evidence.

| Variable                          | Required value                                         |
| --------------------------------- | ------------------------------------------------------ |
| `E2E_O3FORMS_SUPERVISED_TARGET`   | The same explicitly coordinated `DEV` or `QLTY` target |
| `E2E_O3FORMS_EXPECTED_VERSION`    | `2.3.1-sihsalus.1`                                     |
| `E2E_O3FORMS_ENCOUNTER_TYPE_UUID` | Reviewed deployed Consulta Externa encounter type      |
| `E2E_O3FORMS_JOURNAL_DIRECTORY`   | Absolute canonical private directory, unique per run   |

Metadata must be verified against deployed content before fixture creation:
IDGen source/type correspondence, required identifier types, active visit type,
login location, provider, session privileges, published unique forms, encounter
type, and active schema concepts. Form UUIDs are resolved from exact stable names,
not assumed from content JSON UUIDs. The current supported Anamnesis contract
uses the required `motivoConsulta` textarea. Unknown contracts fail closed.

The frontend SHA is verified through `build-info.json` and the exact installed
O3 Forms version and `started: true` through REST. The same inventory must also
contain exactly one REST and one Patient Documents module, each with explicit
`started: true`, before loading schemas or creating fixtures. Missing, duplicate
or stopped module states fail closed. This protects the observed regression in
which `2.3.0-sihsalus.1` started but Patient Documents did not; that rejected patch
cannot be used for acceptance. `2.3.1-sihsalus.1` still requires publication,
deployment and successful environment-specific validation before acceptance can
be claimed. Backend image digest/core version and rollback readiness must
additionally be recorded by the deployment operator; this script does not prove
those from the module version alone.

## Local preparation

Use this worktree's own immutable dependency installation. Compile with the
existing TypeScript compiler, without installing a new runner:

```sh
set -e
yarn test:e2e:contracts
O3_COMPILED_DIR=$(mktemp -d /private/tmp/sihsalus-o3-smoke.XXXXXX)
yarn tsc --ignoreConfig --module NodeNext --moduleResolution NodeNext \
  --target ES2022 --strict --skipLibCheck --esModuleInterop --types node \
  --rootDir e2e --outDir "$O3_COMPILED_DIR" \
  e2e/scripts/verify-o3forms-supervised.ts
NODE_PATH="$PWD/node_modules" node "$O3_COMPILED_DIR/scripts/verify-o3forms-supervised.js" preflight
```

`preflight` authenticates a test session in Spanish and checks deployed build,
module, account and schemas; it does not create patients or journal state. A
passed preflight is **not** passed browser or persistence acceptance. Metadata
needed by the fixture foundation is additionally rechecked before creation.

After supervision, reviewed metadata and recovery storage are ready, invoke the
same compiled script with `run`. It creates one owned synthetic patient/visit,
performs three Anamnesis close/reopen cycles, consecutive Anamnesis / physical
exam / Anamnesis launches, then saves, reloads, edits and reloads. REST assertions
verify exact patient, visit, form, encounter type, provider, the same encounter
UUID after edit, and exactly one active persisted chief-complaint observation.
Only two explicit owned Anamnesis encounter POSTs are permitted by the browser;
other writes fail closed. No schemas or persistence responses are mocked.

The actual Anamnesis card uses `Registrar Anamnesis` for creation **and** editing:
its `one-per-visit` launcher resolves the single matching encounter before opening.
There is no separate edit action on its accordion rows. After reloading, the
adapter uses that same clinical entry point and forbids a second create POST.

Observation concepts are restricted to the preflight-verified Anamnesis schema.
No observation UUID is allowed on the initial create. Before an edit, the adapter
reads back this newly created fixture's observations and verifies each UUID,
concept, person and encounter; only those UUIDs may be submitted subsequently.
The write gate recursively validates `groupMembers`, partial edits and voids,
rejects foreign or repeated UUIDs, concept reassignment and unsupported group
references, and never permits orders or diagnoses within the encounter payload.

The browser uses a fresh in-memory session, blocks service workers to require
network responses, and never records screenshots, traces, videos, console
messages or raw errors. This does not validate offline behavior or the full
negative-role matrix. Unexpected writes or browser errors fail acceptance.

## Durable recovery and cleanup

Before `run`, ensure the private 0700 journal directory is on **persistent**
storage accessible to the operator after cancellation or runner loss. An
ephemeral GitHub-hosted runner without an approved private recovery handoff is
not sufficient. Do not upload the journal, authentication state, or clinical
response bodies as GitHub artifacts. Preflight alone is safe on an ephemeral
runner because it creates no clinical fixtures.

The fixture foundation journals intent before patient/visit writes. This adapter
rejects a `run` when state already exists: never repeat an uncertain Save or
replay an interrupted browser run. After verifying no writer/browser remains,
coordinate stale-lock recovery as described by the foundation, keep the original
configuration, and invoke `cleanup`. That mode does not require the old frontend
SHA or patched module to remain deployed, so rollback does not prevent cleanup.
It still requires target binding, authorization and metadata verification.

The browser closes before dependency-ordered verified cleanup. Authentication
failure or unverified browser shutdown stops dependent writes and retains the
journal. Other acceptance failures trigger cleanup, but remain failed tests even
if cleanup succeeds. A cleanup failure also fails the command and retains state.
The foundation voids observations, orders, encounters and visits before its
owned synthetic patient/person and verifies each outcome. Journals remain even
after successful cleanup; do not delete them as routine CI cleanup.

HTTP 401/403 from direct API persistence verification is treated identically to
an authorization failure seen by the browser: close the browser, retain the
journal, and stop cleanup writes until authorized recovery is coordinated.

Record statuses separately: preflight, browser flow, create/edit persistence,
cleanup, frontend SHA, backend image digest and module version, for **each**
environment. No merge, release, deployment, or clinical acceptance is authorized
by merely adding or invoking this adapter.

# Recoverable synthetic fixture foundation

Status: **draft; supervised adapters exist, browser CI remains blocked**.
The [laboratory adapter](laboratory/README.md) reuses this foundation for one
patient/visit pair per local test attempt, with private retained journals.
The separate [supervised O3 Forms adapter](scripts/O3FORMS_SUPERVISED.md) provides
an explicit opt-in CLI and retains the requirements below; it has not passed
remote clinical acceptance. Importing these utilities does not run a remote
test, promote a suite, or create accounts in DEV/QLTY.

Follow [CONTRIBUTING](../CONTRIBUTING.md) and the [E2E gate](README.md). Local
tests use an in-memory API double and private temporary files only:

```sh
yarn test:e2e:contracts
```

## Configuration and scope

`SyntheticFixtures` receives an authorized Playwright API context, a journal,
and an explicit environment. It reuses the exact DEV/QLTY base gate; it does not
invent credentials, fall back to another target, or create a provider. Absolute
REST URLs remain bound to the configured target regardless of the supplied
context's base URL. Every request, including build-info, explicitly uses
`maxRedirects: 0` and `maxRetries: 0` regardless of context defaults. Each request
is a single attempt to its approved destination; non-success responses retain
the existing safe failure and journal behavior. Recovery is an explicit caller
action, never an automatic transport replay.

In addition to the base gate's connection/account/location settings, require:

| Setting                              | Contract                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_FIXTURE_IDENTIFIER_SOURCE_UUID` | Reviewed, active IDGen source for the exact identifier type                                                                       |
| `E2E_FIXTURE_IDENTIFIER_TYPE_UUID`   | Active type; only `REQUIRED` or `NOT_USED` location behavior; no additional unhandled required types                              |
| `E2E_FIXTURE_VISIT_TYPE_UUID`        | Exact reviewed active visit type; no first-available fallback                                                                     |
| `E2E_FIXTURE_EXPECTED_SHA`           | Full 40-character SHA matching the SPA's build-info before creation                                                               |
| `E2E_FIXTURE_REQUIRED_PRIVILEGES`    | Nonempty JSON array of the complete, environment-reviewed create/read/void permissions; no guessed role names or privilege bypass |

The authenticated session must have the exact login location, an active
clinical provider, and the configured permissions. Backend authorization remains
authoritative. A configurable privilege list is not proof that its contents are
complete: the environment/domain reviewer must approve that list before any
adapter is enabled.

The REST session endpoint returns reference representations and ignores `v`;
absence of `retired` there is not proof that an account or provider is active.
Before creation and cleanup, the foundation validates the authenticated session's
user/provider UUIDs, then reads only `user/{current-test-user-uuid}` and
`provider/{current-test-provider-uuid}` with `custom:(uuid,retired)`; the user
representation also includes `roles:(name,retired)`. Both exact
identities must match and explicitly return `retired: false`. An active core
`System Developer` role on that freshly read user satisfies configured privileges
according to OpenMRS `User.hasPrivilege`, even when the session lists only
explicit grants. Other role names, display labels, retired roles or incomplete
metadata do not qualify. No global user or
provider list is queried. Review permission to read these two technical records
as part of the environment's complete privilege configuration. Missing,
mismatched or retired metadata blocks writes; HTTP 401/403 stops subsequent
requests and retains the journal for authorized recovery.

At most one patient/visit pair exists for each label, `outpatient` and
`appointments`, in a journal. Creation uses an official generated identifier and
an inline synthetic person, without DNI, addresses, or separate person creation.
The alphabetic run marker stays within the existing name-length boundary.
This foundation does not choose drugs/concepts, create users or roles, sign
orders. The laboratory adapter retains its own encounter/order commands and
uses the foundation for patient/visit provisioning and dependent cleanup.

## Recovery guarantees and limits

`PrivateFixtureJournal` requires a canonical private directory, uses an exclusive
writer lock, writes state with mode 0600, and atomically replaces/fsyncs the state
file. Its directory is mode 0700. Keep it under the ignored
`e2e/.synthetic-fixtures/` directory, as the laboratory adapter does.
The journal is sensitive recovery material: do not upload it as a CI artifact,
commit it, paste it into a PR, or expose it in logs. It contains only binding,
run marker, generated identifiers, synthetic UUIDs and progress flags, not
credentials or patient/response bodies.

An intent is persisted before IDGen, patient and visit POSTs. A missing patient
or visit response does not trigger a second blind POST: recovery must find the
exact identifier/name or patient/location/type. An unresolved/ambiguous attempt
retains the journal and blocks further provisioning. A failed pre-write journal
operation prevents its POST; a failed post-response save is recoverable using
the previous intent. One instance also rejects overlapping create/cleanup calls.

Cleanup verifies the exact synthetic patient identifier/name and dependent
patient/person associations, collecting every page before voiding that resource
level. It does not follow backend-provided pagination URLs. Observations, orders,
encounters and visits precede the patient, then any separately active owned
person. A failed child blocks parent voiding; unrelated fixture labels can still
be checked. HTTP 401/403 stops subsequent cleanup writes. A successful DELETE is
not sufficient: the same resource UUID must be verified voided (or absent during
that immediate resource verification). A patient missing when ownership must be
revalidated remains unresolved, rather than being taken as proof that all
dependencies disappeared. Voided patient representations can recover their
markers through `includeAll` names/identifiers.

State is retained even after complete cleanup. `close()` releases only the
writer lock, not the journal. An interrupted process may leave a lock: a human
must establish that no writer is alive and coordinate recovery; there is no
automatic stale-lock deletion. Preserve the original configuration binding when
resuming. Cleanup does not require the old SPA to remain deployed, but still
requires the target, metadata and authorization checks. Unsupported/changed
metadata deliberately blocks cleanup for review rather than guessing a new one.

## Required before activation

- Coordinate the exact target, account, provider, metadata, permissions and
  tested build. A reachable page or passing unit test is not clinical evidence.
- Review the returned REST representations, identifier behavior, visit
  timestamps, patient/person voiding and dependent-resource pagination against
  that environment. The local API double is not backend contract validation.
- Exercise partial creation, lost responses, interrupted process recovery and
  verified cleanup remotely with synthetic data only, using a supervised plan.
- Add the setup/teardown adapter, explicit opt-in, process/worker isolation and
  a private durable journal handoff before browser CI can use this foundation.
  Do not erase CI's required synthetic-patient variables merely because this
  draft exists. Retain the existing medication acceptance criteria.
- Treat the recovered notification/account-creation smoke and actual signed
  clinical orders as separate, still-unapproved workflows. This journal does
  not cover temporary users, roles, or concurrent runtime notification captures.

No current-SHA DEV/QLTY clinical validation is claimed by this foundation.
The laboratory adapter requires explicit local supervision and rejects CI before
requests because a runner's destruction would lose its local journal. The
supervised O3 Forms adapter does not activate global setup/teardown or a browser
CI suite. Neither adapter waives CONTRIBUTING or durable recovery requirements.
Keep any activation or adapter PR in draft until an accountable owner has reviewed
the activation contract above and the required environment-specific evidence.

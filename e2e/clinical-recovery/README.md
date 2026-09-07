# Recovered clinical proposals — quarantined

These proposals preserve useful coverage from the local clinical E2E recovery:
signing a medication and a laboratory order in Consulta Externa, and runtime
notifications across laboratory/pharmacy roles and facility boundaries. They
are **not runnable clinical tests** and are not evidence that either workflow
passes. The original recovery snapshot remains unchanged.

## Execution boundary

The central suite catalog marks `clinical-recovery` as `quarantined`, without
a remote gate or browser CI. Its runner rejects this suite before launching
Playwright. A shared unconditional exception also protects global setup, the
test hooks, the order configuration loader, and the exported notification smoke
entry point. There is no environment variable or CLI flag to enable it. Direct
notification CLI invocation fails before reading configuration, opening a
browser, authenticating, or writing a recovery file.

Removing quarantine is a separate reviewed change, not a deployment operation
or an instruction to bypass these guards. Do not add the `e2e` label to run
these proposals. Existing approved suites and their CI matrix are unchanged.

## Coverage retained for review

- `specs/signed-orders.spec.ts`: prescription and laboratory order forms,
  signing, and REST assertions for the encounter, exact patient/visit, order
  types, laboratory concept, drug, and presence of orderer UUIDs. Proposed
  fixture values are explicit in `config-schema.ts`; there is no arbitrary
  dose, route, frequency, or duration fallback. These assertions occur after
  the proposed write and do **not** replace an ownership preflight.
- `runtime-notifications-dev-smoke.mjs`: proposed `LAB_ORDER_CREATED`,
  `LAB_RESULT_READY`, and `MEDICATION_ORDER_CREATED` delivery over SSE and
  WebSocket, negative role/facility cases, minimal event envelopes, worklist
  refresh, observation preservation, and aggregate delivery metrics.
- The notification draft's historical metadata is isolated in
  `notification-config-schema.mjs` for review, not approved as a future
  environment contract. It retains legacy resource-selection and cleanup
  logic behind the hard guard. Raw page/response diagnostic printing has been
  removed, and the draft no longer deletes its recovery state file.

## Requirements before any activation

1. Coordinate an exclusively synthetic DEV/QLTY environment, the exact
   frontend/backend build, approved metadata, and required privileges. Never
   use production, real patients, real clinical records, or shared accounts.
2. Replace historical notification defaults and first-available resource
   selection with validated, explicit configuration. Match the exact configured
   drug and laboratory concept before signing, and verify the exact synthetic
   visit, provider, privileges, and all intended writes before opening a form.
3. Integrate recoverable fixtures with a private write-ahead journal,
   ownership validation, pagination, interruption/lost-response recovery, and
   dependency-ordered cleanup. The separate synthetic-fixture foundation PR
   is not wired here and does not cover temporary user lifecycle by itself.
4. Establish an approved, isolated account lifecycle for the notification
   proposal. Its temporary users/persons, identifier generation, session
   creation, and cleanup need independent validation. Do not edit existing
   roles, borrow the first active provider, or widen privileges to pass.
5. Review event subscriptions and dashboard access for isolation from unrelated
   data. Removing diagnostic output does not establish privacy safety: the
   historical collector can still receive unrelated events in browser memory.
   Keep traces, screenshots, videos, and authentication state out of reports.
6. Make interrupted cleanup recoverable without deleting evidence. A failed
   child cleanup must block parent deletion; authentication failure must stop
   further writes. The legacy notification implementation does not yet satisfy
   this contract, even though its state file is now retained and ignored.
7. Record actual synthetic E2E assertions and verified cleanup at the final
   SHA, then explicitly review the notification execution adapter and
   catalog/CI promotion. Preparation of this draft
   authorizes none of those remote operations.

## Local validation only

```sh
yarn test:e2e:contracts
yarn test:tooling
node --check e2e/clinical-recovery/runtime-notifications-dev-smoke.mjs
```

Unit regressions exercise the unconditional guards and assert that mocked
browser/API constructors, metadata reads and recovery-file access are never
called. Import checks register the proposals without executing clinical code;
the spec hooks and notification test body are checked independently of global
setup. The configuration contract also keeps authentication state, web servers
and browser artifacts disabled. CLI guard checks must exit nonzero
with a sanitized quarantine message. That expected rejection is a guard test,
not a passed clinical E2E run.

The TypeScript config includes this suite's TypeScript specs/configuration.
The recovered JavaScript notification implementation is **syntax checked,
not typechecked**; its declaration file describes only the exported boundary.
Playwright discovery lists proposals without executing their guarded setup
and does not validate their behavior. No backend, data migration, production
bundle, route, RBAC rule, or existing acceptance criterion changes here.

# Supervised native interconsultation fixtures

The two mutating native specs, `tests/interconsultas-flow.spec.ts` and
`tests/interconsultation-orders.spec.ts`, opt into a Playwright fixture backed by
[the existing recoverable foundation](../docs/development/synthetic-fixtures.md).
The other native specs and global setup do not acquire this fixture. The
configured outpatient/appointments patients remain reserved and are never
cleaned by this fixture.

Each desktop test attempt gets one owned synthetic patient/visit pair and one
`PrivateFixtureJournal` under ignored `e2e/.synthetic-fixtures/native-*`.
Tablet/mobile skip before provisioning. `openmrsRestApi` supplies and disposes
the API context; the foundation validates the exact target, location, active
session user/provider, reviewed metadata, privileges and served SHA before
clinical creation. No first-available location, visit type or provider is used.
Before provisioning, it verifies exact active request encounter type
`e4834799-7f43-4552-a6f3-2656880ca52f` and exact active `Consulta Ambulatoria`
concept `0f819fa7-864f-4f60-a50a-03d0b82daa73`, including membership in
`4bf3f465-ac91-44fa-9b1f-173daf0c89a0`. These pins come from
[content SHA 64fdf166](https://github.com/sihsalus/sihsalus-content/tree/64fdf16642232df5046f1c279e8e7c62a768cab8):
OCL `10_SIHSALUS_sihsalus_concepts_2026-09-09-1.zip`, concept 2152's
`external_id`, and `60_SIHSALUS_sihsalus_mappings_2026-09-09-1.zip`, set
2157 → 2152. QLTY runtime compatibility remains **NOT RUN**. Missing, retired or
nonmember metadata fails before clinical provisioning; no catalogue search or
fallback encounter type is used.
The specs retain their encounter/order fields, fulfiller status and response
assertions. Encounters use the current time because the foundation opens the
visit immediately before the test.

## Local execution

Follow [CONTRIBUTING](../CONTRIBUTING.md) and coordinate DEV/QLTY with the
accountable environment owner before running. Configure the existing clinical
gate settings and all five `E2E_FIXTURE_*` settings in the foundation contract,
including the complete reviewed permissions for IDGen, patient/person,
visit, encounter, order, observation and interconsultation operations. Preserve
these exact settings privately for recovery. Missing or incompatible metadata
and permissions fail closed; the adapter does not choose substitutes.

Also set `E2E_NATIVE_SUPERVISED_TARGET` to the exact `E2E_GATE_TARGET`. This
opt-in is required by the two mutating specs. It does not authorize production,
real patient access or unsigned changes to clinical acceptance criteria.

```sh
# Local contracts: API doubles and private temporary files only.
yarn test:e2e:contracts

# Discovery only; no credentials, opt-in or fixtures required.
yarn test:e2e:suite clinical --list --reporter=list

# Only after coordination and review of target, configuration and recovery.
E2E_NATIVE_SUPERVISED_TARGET="$E2E_GATE_TARGET" yarn test:e2e:suite clinical --workers=1 --retries=0 --max-failures=1
```

Run the last command against the exact assembled build under review. Record
that SHA, target, executed/skipped cases and verified cleanup. Local contracts
or discovery do not establish remote clinical acceptance. Remote execution and
interrupted-run recovery for this adapter remain **NOT RUN** until supervised
evidence is recorded.

## Cleanup and interrupted runs

The foundation retains write intent before identifier, patient and visit
creation. The specs create their encounters/orders only after the patient is
owned and recoverable. Cleanup discovers every page of observations, orders,
encounters and visits by that owned identity, so it also finds resources whose
POST response was lost. It verifies child cleanup before patient/person
cleanup; a failed child prevents parent cleanup. An assertion failure and a
cleanup failure are both reported. Authorization failure stops dependent
cleanup writes and retains the journal.

Journals remain after success and failure; they are not reports or CI artifacts.
Each retry has a separate journal and preserves previous attempts. Stop after
failed cleanup and resolve that attempt before another run. Keep the worktree
and its private journal directory until cleanup is verified; do not upload,
commit or paste their contents into public evidence.

For recovery, first establish that the original process/writer has exited. A
remaining `writer.lock` requires coordinated review; do not automatically delete
stale locks. With the original configuration binding and authorized API context,
reopen the specific directory using `PrivateFixtureJournal`, construct
`SyntheticFixtures`, call `cleanup()`, then `close()` the journal and dispose the
context independently of cleanup success. Do not call `create()` or resume the
clinical workflow during cleanup recovery. The original expected SHA remains
part of the binding, although cleanup does not require that build to remain
served. Retain unresolved state when metadata, ownership or permissions cannot
be verified.

## Browser CI boundary

The mutating fixture rejects `CI` or `GITHUB_ACTIONS=true` before journal,
session or clinical requests with `NATIVE_CI_RECOVERY_RETENTION_UNAVAILABLE`.
This is a failing gate, not a skipped/passing clinical test. The other twelve
native spec files remain selectable in CI; local contracts and `--list` remain
available. The full browser suite cannot pass CI until private durable journal
retention and interrupted-run recovery are implemented and verified. An `e2e`
label does not supply that capability. This change adds no retention service,
artifacts, secrets, alternate runner or CI bypass.

# openmrs-esm-offline

openmrs-esm-offline provides functions supporting offline implementations.

## Offline synchronization queue ownership

The synchronization queue is logically scoped to the authenticated OpenMRS user. Queue row IDs are local database
keys, not authorization tokens. Reading, editing, deleting, synchronizing, and reporting counts or progress must match
the authenticated user's UUID even when a caller knows another row's numeric ID.

- Current-user list functions return only that user's items. The explicit `*For(userId)` read helpers reject requests
  for a different user.
- Enqueue operations also require the authenticated user's UUID. Replacing an item is atomic with adding its successor,
  so a failed write cannot discard the existing pending action.
- A direct item read returns `undefined` for both a missing row and a row owned by another user. Edit and delete
  operations use the same generic failure for missing, inaccessible, or unsupported rows. Storage failures reject
  instead of being reported as an empty queue or a missing item.
- Synchronization captures one authenticated user, counts and processes only that user's rows, and rechecks ownership
  before database updates or deletes. A session-user change aborts the operation, clears visible progress, and leaves
  the original user's remaining rows untouched. Any failed, canceled, or incomplete attempt rejects with the same fixed
  queue-operation error after the started handlers settle; consumers must handle that rejection and refresh the queue.
  Registered handlers must pass `options.abort.signal` to every network request; the queue checks ownership before and
  after a handler but cannot preempt arbitrary handler code that ignores its abort controller.
- Synchronization also requires an exclusive Web Lock for the origin. A second tab, an unavailable Web Locks API,
  or a browser lock failure rejects before processing rows. There is no in-memory-only fallback. The lock lasts until
  all started handlers settle and is released by the browser when the tab closes.
- An item with an explicit dependency cannot run while a matching row for that user, type, and descriptor ID remains
  queued. Failed parents retain their children; unrelated successful parents can still release their own children.
  A parent removed by an earlier completed run need not return a result again. Consumers must continue to tolerate
  an absent dependency result on retry, including handlers that deliberately return no value.
- A handler may use its item-scoped `options.updateContent(updater)` capability to persist a durable partial-progress
  checkpoint. The update runs atomically against the latest stored content, so concurrent suboperations merge instead
  of overwriting one another. The capability can modify only the row currently owned by that synchronization and
  rejects with the fixed queue error after cancellation or an owner-session change. Consumers that require durable
  checkpoints must fail closed before external writes when the capability is unavailable.
- A producer that replaces same-descriptor rows may pass `reconcileContent(existing, proposed)`. The callback runs in
  the same IndexedDB transaction as replacement, receives the latest stored content, and may preserve checkpoints or
  throw to keep the existing row unchanged. Errors are exposed only as the fixed queue-operation error. This is the
  supported guard for edits that must not erase an in-flight or ambiguous clinical-write state.
- The database remains on schema version 4 for rollback compatibility. Before queued operations proceed on each open,
  an idempotent transaction replaces every malformed or legacy `lastError` while preserving the row and its clinical
  content. New failures persist only a fixed non-identifying error, and reads also mask malformed details defensively.
  Consumers must treat the field as an opaque status and must not depend on backend messages, URLs, UUIDs, response
  bodies, names, or exception causes. Close or restart older open tabs during rollout so they cannot write a legacy raw
  error after the new client's opening scrub.

The queue and downloaded responses have separate ownership checks, described below. Continue using one managed
browser/OS profile per clinical user: this is logical application isolation, not encryption or protection against
local browser administration, older clients, or arbitrary same-origin scripts.

Roll out the queue and service worker together and close all older tabs before resuming synchronization. Older clients
do not acquire the origin lock or understand new consumer checkpoints. Preserve pending queues during upgrades and
rollback; uncertain writes made by an older client require backend reconciliation before retrying with either version.

## Consumer compatibility

Existing arguments remain compatible; `SyncProcessOptions.updateContent` is additive and optional. Synchronization
requires a secure context and a managed browser with Web Locks (the coordinated offline acceptance gate targets Chrome and Edge). Consumers already
using the current-user helpers require no database migration. Code using `getFullSynchronizationItemsFor` or the internal
`queueSynchronizationItemFor` helper must request only the authenticated user. Callers of `runSynchronization` must
handle its fixed rejection and refresh the current-user list. UIs should also refresh after a generic edit/delete
failure instead of using local IDs to infer whether another row exists.

## Dynamic offline data synchronization

`syncDynamicOfflineData` waits for every handler, persists the complete success/error state, and then rejects with an
`AggregateError` when any handler failed. Batch callers that need to continue synchronizing other entries should use an
all-settled strategy and must not treat a resolved handler invocation as proof that its asynchronous work finished.
`syncAllDynamicOfflineData` applies that strategy to every selected entry and rejects once, after all entries settle,
with the fixed non-sensitive error `Offline data synchronization failed.` when any entry or initial lookup fails.

Persisted handler failures contain only a fixed, non-sensitive message because handler exceptions can include URLs,
UUIDs, or clinical data. The rejected `AggregateError` also contains only sanitized errors that identify the failed
handler; original handler exceptions never cross the public synchronization boundary.

## Confirmed offline cache refreshes

`refreshOfflineCacheEntry` fetches a unique, non-cacheable URL using the service worker's network-only strategy and
writes the response under the stable offline URL only after receiving a successful network response. A failed,
non-successful, or canceled request rejects with a fixed non-sensitive error and leaves any existing cached response
untouched. Callers remain responsible for registering the stable URL as a dynamic offline route.

The repository worker handles responses outside the SPA before upstream fallback routing. Compiled SPA assets and
navigation retain the upstream lifecycle. Protected fetches bypass the HTTP cache; a failed fresh read (`no-store`,
explicit credentials, or a mutation) cannot fall back to downloaded data. Only successful network responses selected
by the existing dynamic routes or network-first header are downloaded automatically. External origins cannot establish
the clinical owner or use clinical fallback; deployments requiring external offline assets need separate acceptance.

## Download ownership and verified cleanup

`EsmOfflineProfile` stores one assigned owner, the last observed authenticated user, a monotonic generation, and a
cleanup phase. The separate metadata database leaves the existing `EsmOffline` v4 queue format unchanged. A confirmed
same-origin OpenMRS session assigns the initial owner. Logout or a credentialed request invalidates the active user;
a later different user cannot read or refresh that owner's downloads. Online responses remain available. No owner
transfer or automatic queue deletion occurs. Same-profile account switching remains outside the supported clinical
operating procedure.

Clinical responses use `omrs-clinical-cache-v1`. Legacy clinical entries in `omrs-spa-cache-v1` never establish
readiness or supply clinical fallback. An initial profile with legacy downloads requires verified cleanup before new
preparation. `areOfflineResourcesCached` checks successful responses under the current ownership boundary. Explicit
refreshes capture the generation before HTTP and recheck it before storing; a late response after logout/login cannot
replace a stable download. Shared browser storage locks serialize writes with identity changes and purge.

The Offline Tools **Clear downloaded copies** action requires confirmation, connectivity, a fresh session matching
the assigned owner, an exclusive storage lock, an idle synchronization lock, and an empty queue across all owners.
It preserves selected patient/form membership, clears synchronization evidence, deletes clinical and legacy data
responses, and verifies removal while retaining SPA shell files. It never deletes queued content. A failed or partial
purge stays in the `clearing` phase and blocks cache use and new enqueue operations until an explicit cleanup retry
succeeds. It does not reassign the profile to another user. A profile reassignment still requires operational
reconciliation and authorized reprovisioning, including storage outside this library.

Ship the worker and consumers together, close older tabs before upgrading, and confirm the new worker controls the
page. Old workers/clients do not enforce these ownership rules. Preserve the managed profile and pending queues on
rollback; an older client may read the legacy cache again and cannot be treated as equivalent protection.

## Preparation evidence

`getOfflineReadiness` checks a secure controlled worker, Web Locks, the current owner, valid storage estimates, selected
patients/forms, the recorded synchronization owner/time/handlers, and current handler cache checks. Missing downloads,
failed or absent handlers, invalid/future dates, unknown storage, or a check exceeding ten seconds cannot report ready.
It reports the oldest verified download, incomplete selections and persistence grant separately. The 10 MiB free-space
reserve is an operational minimum, not a prediction of the next photo/form size. There is no invented clinical expiry
period. The interface says **Selected downloads verified**, not that all clinical workflows have been accepted.

Storage persistence is requested only by an explicit button. A grant is not a backup and does not prevent an operator
from clearing site data; see the [Storage Standard](https://storage.spec.whatwg.org/). Keep the contingency and
reconciliation procedures even when all preparation checks succeed.

Local regressions use `yarn workspace @openmrs/esm-offline test`. The real-worker browser harness and deployed
acceptance boundaries are documented in [the offline laptop runbook](../../../docs/runbooks/offline-laptop-acceptance.md).

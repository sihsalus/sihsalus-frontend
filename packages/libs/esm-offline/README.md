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
- Database schema version 5 transactionally replaces every legacy `lastError` during upgrade. New failures persist only
  a fixed non-identifying error, and reads also mask malformed details defensively. Consumers must treat the field as an
  opaque status and must not depend on backend messages, URLs, UUIDs, response bodies, names, or exception causes.

This contract does not partition CacheStorage, service-worker routes, the app shell, or other origin-wide browser data.
It therefore does not make account switching in one browser profile safe and does not remove the operational
requirement for one managed browser/OS profile per clinical user while broader offline storage isolation remains open.

## Consumer compatibility

The public function signatures are unchanged, but the failure contract is stricter. Consumers already using the
current-user helpers require no data migration. Code using `getFullSynchronizationItemsFor` or the internal
`queueSynchronizationItemFor` helper must request only the authenticated user. Callers of `runSynchronization` must
handle its fixed rejection and refresh the current-user list. UIs should also refresh after a generic edit/delete
failure instead of using local IDs to infer whether another row exists.

## Dynamic offline data synchronization

`syncDynamicOfflineData` waits for every handler, persists the complete success/error state, and then rejects with an
`AggregateError` when any handler failed. Batch callers that need to continue synchronizing other entries should use an
all-settled strategy and must not treat a resolved handler invocation as proof that its asynchronous work finished.

Persisted handler failures contain only a fixed, non-sensitive message because handler exceptions can include URLs,
UUIDs, or clinical data. The original causes exist only in the in-memory `AggregateError`; callers must not render or
log them directly.

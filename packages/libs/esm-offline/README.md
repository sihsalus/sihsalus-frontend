# openmrs-esm-offline

openmrs-esm-offline provides functions supporting offline implementations.

## Offline synchronization queue ownership

The synchronization queue is logically scoped to the authenticated OpenMRS user. Queue row IDs are local database
keys, not authorization tokens. Reading, editing, deleting, synchronizing, and reporting counts or progress must match
the authenticated user's UUID even when a caller knows another row's numeric ID.

- Current-user list functions return only that user's items. The explicit `*For(userId)` read helpers reject requests
  for a different user.
- A direct item read returns `undefined` for both a missing row and a row owned by another user. Edit and delete
  operations use the same generic failure for missing, inaccessible, or unsupported rows.
- Synchronization captures one authenticated user, counts and processes only that user's rows, and rechecks ownership
  before database updates or deletes. A session-user change aborts the operation, clears visible progress, and leaves
  the original user's remaining rows untouched.
- Persisted `lastError` values contain only a fixed non-identifying error. Reads also replace legacy error details with
  that fixed value. Consumers must treat the field as an opaque status and must not depend on backend messages, URLs,
  UUIDs, response bodies, names, or exception causes being present.

This contract does not partition CacheStorage, service-worker routes, the app shell, or other origin-wide browser data.
It therefore does not make account switching in one browser profile safe and does not remove the operational
requirement for one managed browser/OS profile per clinical user while broader offline storage isolation remains open.

## Consumer compatibility

The public function signatures are unchanged. Consumers already using the current-user helpers require no migration.
Code using `getFullSynchronizationItemsFor` must request only the authenticated user. UIs should refresh their own
current-user list after a generic edit/delete failure instead of using local IDs to infer whether another row exists.

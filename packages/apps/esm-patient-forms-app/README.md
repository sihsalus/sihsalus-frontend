# esm-patient-forms-app

The forms widget. It provides a tabular overview of the clinical forms available for use in the system. Presently, the forms widget is configured to use forms built using the AMPATH form engine. Read the docs [here](https://ampath-forms.vercel.app).

## Offline contract

Queued encounter and person updates are synchronized only for the queue owner's authenticated session. Both writes
receive the queue synchronization abort signal, are started safely, and are allowed to settle before one fixed failure
is returned to the queue. Each confirmed write is checkpointed in the queue row, so a later retry skips that write and
cannot blindly repeat a partially successful form submission.

New encounter payloads contain a canonical client-generated UUID before they enter the queue. If a legacy payload gets
its effective datetime from the queued visit dependency, that datetime is first materialized into the form row so the
same request can be recovered after the visit row is removed. Before creating an encounter, the consumer performs a
fresh, network-only lookup of its UUID. A matching, non-voided encounter is accepted only when its patient, encounter
type, location, visit, form, and effective datetime match the queued payload. Only an explicit 404 permits the create
request; authentication, network, and server errors remain unknown outcomes. A resolved create is checkpointed only
when the response contains the expected UUID.

Each external write requires an atomic, unique attempt claim in the queue row. This prevents separate tabs from both
starting the same write and makes checkpoint state monotonic. Person recovery requires a fresh exact read with exactly
one active attribute for every queued type/value, including after a successful POST. Duplicate active attributes fail
closed without another write. Because an aborted request can still commit on the server, a claimed operation is never
blindly replayed while its fresh server state remains absent or different; it remains pending for manual reconciliation.

The encounter UUID create support and person attribute behavior are verified in the pinned upstream sources:
[creatable UUID contract](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod-common/src/main/java/org/openmrs/module/webservices/rest/web/resource/impl/BaseDelegatingResource.java#L871-L886)
and [person attribute setter](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/resource/openmrs1_8/PersonResource1_8.java#L262-L293).
If a recovered encounter contains providers, observations, orders, or diagnoses, those children cannot yet be compared
canonically by this client. The item therefore remains pending for manual reconciliation instead of inferring success
from the encounter UUID and top-level fields alone.

The `_syncState` checkpoint is optional for queued-data compatibility and requires no IndexedDB migration. Historical
rows whose encounter payload already has the same UUID as their stable queue content ID can resume normally. A
historical row without that matching recovery key may already represent a committed server-generated-UUID encounter
after a lost response; assigning a new UUID could duplicate clinical data. Such a row therefore fails closed without
either clinical write or queue mutation and requires manual reconciliation/re-entry. Editing or requeueing cannot
erase an attempt checkpoint or upgrade an ambiguous historical row into a new create.

A form is marked as available offline only after every registered form-data handler completes successfully.
Service-worker route registration is mandatory: a controlled `{ success: false }` response fails the download, rolls
back a new selection, and produces fixed translated feedback without rendering technical errors or form identifiers.
Form data refreshes require confirmed fresh network responses; a stale cached success cannot complete synchronization,
and the previous stable cache entry remains available when the refresh fails.

Form-membership updates and background form-refresh batches use one identifier-free Web Lock across cooperating browser
contexts, with a same-page FIFO fallback where Web Locks are unavailable. A background snapshot and all of its entry
refreshes settle inside that boundary, so an earlier refresh cannot re-add membership after a serialized removal or
first-download rollback. The membership is re-read inside each toggle operation, and a failed first download rolls back
only the membership added by that attempt. The lock is not an authenticated-session owner epoch: an account transition
during an in-flight download can still change the session used by downstream handlers. Until owner-epoch cancellation
is implemented, let offline-form updates settle before switching accounts.

Previously cached forms remain available when a background refresh fails, but the user is warned that they may be
outdated. Clinical cache content remains origin-wide; shared devices require an isolated OS/browser profile per
authorized user until cache partitioning or verified purge behavior exists.

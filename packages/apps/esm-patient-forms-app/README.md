# esm-patient-forms-app

The forms widget. It provides a tabular overview of the clinical forms available for use in the system. Presently, the forms widget is configured to use forms built using the AMPATH form engine. Read the docs [here](https://ampath-forms.vercel.app).

## Offline contract

Queued encounter and person updates are synchronized only for the queue owner's authenticated session. Both writes
receive the queue synchronization abort signal, are started safely, and are allowed to settle before one fixed failure
is returned to the queue. An interrupted or failed item remains pending for review and retry.

A form is marked as available offline only after every registered form-data handler completes successfully.
Service-worker route registration is mandatory: a controlled `{ success: false }` response fails the download, rolls
back a new selection, and produces fixed translated feedback without rendering technical errors or form identifiers.
Form data refreshes require confirmed fresh network responses; a stale cached success cannot complete synchronization,
and the previous stable cache entry remains available when the refresh fails.

Form-membership updates use one identifier-free Web Lock across cooperating browser contexts, with a same-page FIFO
fallback where Web Locks are unavailable. The membership is re-read inside that serialized operation, and a failed
first download rolls back only the membership added by that attempt. The lock is not an authenticated-session owner
epoch: an account transition during an in-flight download can still change the session used by downstream handlers.
Until owner-epoch cancellation is implemented, let offline-form updates settle before switching accounts.

Previously cached forms remain available when a background refresh fails, but the user is warned that they may be
outdated. Clinical cache content remains origin-wide; shared devices require an isolated OS/browser profile per
authorized user until cache partitioning or verified purge behavior exists.

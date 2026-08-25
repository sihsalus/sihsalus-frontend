# esm-patient-vitals-app

The vitals widget provides tabular and chart-based overviews, a form for
recording vitals and biometrics, and a header with the most recent values.

## Clinical write contract

- A new record requires an active visit, its verified location, a configured
  encounter type, and at least one measurement. A note alone is not a record.
- Every custom-form submission receives a client-generated encounter UUID and
  measurement datetime before it can leave the browser.
- The session provider is attributed only when both provider and configured
  encounter-role UUIDs are available. The visit location always wins over the
  login location unless a workspace supplies an explicit clinical override.
- A fresh network-only patient read blocks writes for a deceased patient.
  Synchronization repeats that guard and receives the queue cancellation
  signal.
- Values outside configured clinical ranges remain recordable after explicit
  confirmation; failure to load ranges is visible and never silently presented
  as validated.
- For patients under five, the custom form shows a temporary WHO
  weight-for-age +3 SD data-quality warning for extreme weights. It asks the
  user to verify the unit, decimal point, and measurement without diagnosing
  overweight or blocking a verified value.

## Offline contract

The custom vitals form is queue-first. Pressing **Save and close** writes an
immutable encounter intent to the authenticated user's IndexedDB queue before
any REST request. The queue row contains a stable UUID, visit dependency,
effective datetime, observations, provider attribution, and monotonic
attempt/completion checkpoints.

When the backend is reachable, the same queued intent is attempted immediately.
An exact response removes it. An unavailable or ambiguous response leaves the
same UUID pending and tells the user that the values are stored only on that
device and are not yet part of the clinical record. A later synchronization:

1. waits for any queued visit;
2. revalidates that the patient is alive using a fresh network-only request;
3. reads the stable encounter UUID without cache fallback;
4. accepts an existing encounter only when patient, type, location, visit,
   datetime, observations, and providers match exactly; and
5. never blindly replays an attempted write whose outcome remains ambiguous.

Transient concept/reference-range revalidation no longer replaces an already
interactive form with a skeleton, so entered values remain mounted during a
backend outage. This is not autosave: values entered before **Save and close**
remain in component memory and can still be lost if the tab or browser itself
is closed or reloaded.

Post-save callbacks, including triage queue routing, run only after the
encounter is confirmed on the server. A triage saved only on the device stays
in its current queue; after synchronization, refresh the queue and use
**Enviar a atención**. This avoids presenting a locally queued measurement as a
completed server-side triage.

Offline clinical data remains scoped to one authenticated queue owner but is
stored in the browser profile. Use one managed OS/browser profile per clinical
user, do not switch accounts with pending actions, and do not clear site data
to hide a failed item.

## Known limits

- The existing automated offline-laptop gate does not yet exercise vitals or
  triage; coordinated DEV/QLTY validation must use a synthetic patient.
- An ambiguous attempted write that cannot be matched exactly requires manual
  reconciliation; deleting its queue row is not reconciliation.
- Editing, voiding, retrospective measurement time entry, and durable autosave
  before submission are separate clinical workflows.
- The Form Engine path keeps its own `patient-form` offline contract; the
  queue-first contract above describes the custom vitals form used when
  `vitals.useFormEngine=false`.
- Pediatric reference ranges still need to be regularized in
  `sihsalus-content`; that coordinated follow-up is tracked in
  `docs/clinical/vitals-triage-encounter-contracts.md`.

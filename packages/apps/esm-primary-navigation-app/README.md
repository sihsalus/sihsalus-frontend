# openmrs-esm-primary-navigation-app

openmrs-esm-primary-navigation is responsible for rendering the top navbar.

It also owns the global clinical-activity heartbeat used by the server's
guarded poweroff policy. While the document is visible and the operator has
interacted within 30 minutes, it sends a bodyless, credential-free POST to
`/_sihsalus/clinical-activity` every 30 seconds. The signal must never include
patient, user, route, form, or queue context. A failed heartbeat is intentionally
silent because the gateway may be unavailable; the host policy fails closed
when it cannot observe a current signal.

## Type checking and validation

Source and tests use the [strict TypeScript options](tsconfig.json) declared in this package.
Language changes require an authenticated user and a selected locale that is still
allowed and differs from the current one.
Dashboards pass extension context only when mounted within an extension.

From the repository root, run `yarn workspace @sihsalus/esm-primary-navigation-app typescript`
and the same workspace's `lint`, `test`, and `build` scripts. Keep coverage for
language changes and retries, incomplete or expired sessions, stale locale selections,
dashboard configuration with and without extension context, and authenticated
navigation with a redacted person.

## Proposed physician result inbox

`enableDoctorResultNotifications` is off by default. Enable it only after the
matching `sihsalusnotifications` OMOD 1.3.0 is installed and validated. The proposal
reuses the existing notifications header panel, the Carbon bell and the existing
`completed-lab-order-results-slot`; it introduces no second result renderer.

The bell shows the count of the authenticated physician's own laboratory results
pending review at the selected facility. The panel lists patient, test and time,
in pages of 20, and opens the selected result. Merely opening the panel or result
never marks it read. `Marcar como revisado` confirms only this user's notification
review, not approval, amendment or signature of the clinical result. A failed
review remains pending. A confirmed review remains successful even when the
subsequent list refresh fails; that refresh failure is shown separately.

The backend persists these pending states in the existing OpenMRS Alert and
AlertRecipient tables. No patient data or notification history is saved to browser
storage. The authenticated inbox API is `GET /ws/sihsalus/notifications/results`
and `POST /ws/sihsalus/notifications/results/{id}/review`. Both enforce current
user and facility; the review endpoint also requires exact same-origin JSON.
The read response contains authorized patient and test names; it must never be
cached or logged. Both frontend and backend require `app:hoja.clinica.ordenes`, `Get Orders`,
`Get Patients` and `Get Observations`. Existing clinical read permissions remain
authoritative.

A single navbar subscription listens to the user-targeted `clinical-results` SSE
topic. It groups events within one second into one refresh and retains the current
list during revalidation. A 60-second polling fallback and refresh on window focus
recover missed signals. Sessions, users and locations have distinct memory cache
keys, and the panel remounts when the session location changes. Anonymous users,
missing locations and denied privileges do not fetch or subscribe. HTTP failures
remain visible with a retry action; they never masquerade as an empty inbox.

This first proposal covers new completed laboratory orders only. It does not
backfill older completed orders, redistribute orders to covering clinicians,
notify amendments, or define institutional clinical sign-off. A result with no
matching persisted observation is not notified. Missing or ambiguous user links
for the requesting Provider fail closed. The OMOD's transport replay is ephemeral;
the database inbox is the source of truth across F5 and server restarts.

Before enabling in DEV/QLTY, validate with synthetic data: completion by Laboratorio,
receipt by the requesting physician while another chart is open, isolation from
another physician/facility, F5 and backend restart, explicit review and retry,
missing result consumer, offline recovery and a burst of 100 results. Preserve the
fixture cleanup journal until orders/results/encounters are voided. Local mocks
and Java service tests do not establish deployed clinical validation.

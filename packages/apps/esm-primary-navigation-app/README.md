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

Source and tests use the shared [strict TypeScript preset](../../tooling/tsconfig.strict.json).
Language changes require an authenticated user and a selected locale that is still
allowed and differs from the current one.
Dashboards pass extension context only when mounted within an extension.

From the repository root, run `yarn workspace @sihsalus/esm-primary-navigation-app typescript`
and the same workspace's `lint`, `test`, and `build` scripts. Keep coverage for
language changes and retries, incomplete or expired sessions, stale locale selections,
dashboard configuration with and without extension context, and authenticated
navigation with a redacted person.

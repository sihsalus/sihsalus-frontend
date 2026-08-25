# openmrs-esm-primary-navigation-app

openmrs-esm-primary-navigation is responsible for rendering the top navbar.

It also owns the global clinical-activity heartbeat used by the server's
guarded poweroff policy. While the document is visible and the operator has
interacted within 30 minutes, it sends a bodyless, credential-free POST to
`/_sihsalus/clinical-activity` every 30 seconds. The signal must never include
patient, user, route, form, or queue context. A failed heartbeat is intentionally
silent because the gateway may be unavailable; the host policy fails closed
when it cannot observe a current signal.

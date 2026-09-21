# openmrs-esm-login-app

openmrs-esm-login-app is responsible for rendering the loading page,
the login page, and the location picker.

## Password-change response handling

The normal modal and page submit to the authenticated REST `POST /password`
endpoint. Empty successful responses (HTTP 200 or 204) are valid. Authentication
failures must reject the operation even when the API configuration redirects to
login: a redirect must not become a success notification or leave the form
permanently submitting. The shared request uses `rejectOnAuthFailure` from the
local `@openmrs/esm-api` transport while preserving its configured redirect.
Deploy this microfrontend with the matching SIHSalus framework/app shell.

`change-password-auth-failure.test.tsx` exercises the local transport with
synthetic HTTP responses for both authentication-redirect promise modes,
empty success, forbidden access and network failure. These tests do not change
or validate the backend's password policy or session-revocation behavior.
Acceptance of consecutive password changes and expired sessions still requires
an authorized synthetic account in DEV/QLTY.

## Forced password changes

For the `basic` authentication provider, the app treats the authenticated
session property `user.userProperties.forcePassword` as OpenMRS does: the
boolean `true` or the case-insensitive string `"true"` requires a password
change. Before restoring a post-login route, and on every already-authenticated
SPA route, a global guard first moves to the isolated
`login/forced-password` route so clinical pages are unmounted, then performs a
top-level, same-origin navigation to
`<openmrsBase>/admin/users/changePassword.form`. OAuth2 does not use this Legacy
flow because the coordinated backend disables its local filter. A custom
provider remains fail-closed when the OpenMRS flag is present.

The backend forced-password filter is authoritative. The frontend guard blocks
interaction while redirecting and fails closed with a non-technical message if
the browser is offline or navigation fails. The Legacy change and the normal
change-password entry point are online-only; logout remains available from the
blocking state. Rollout and rollback must keep this frontend coordinated with
the backend filter; disabling only the backend does not disable this guard for
a session whose `forcePassword` property is still true.

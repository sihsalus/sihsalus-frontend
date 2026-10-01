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

## Password recovery from O3

The basic login's recovery view reads `GET /ws/rest/v1/passwordreset`.
Only `{ "enabled": true }` activates email requests. Unavailable, disabled or
older backends retain the administrator-assisted instructions. This capability
must only be enabled with the coordinated SIHSalus Core/REST recovery changes,
SMTP acceptance, and gateway throttling; it is not a frontend-only feature.

`POST /passwordreset` accepts `{ usernameOrEmail }`; only HTTP 202 confirms
queue acceptance, never delivery. Existing and nonexistent accounts have the
same public response. The input allows 255 Unicode code points after trimming
outer whitespace: OpenMRS Core 2.8.9's versioned Liquibase schema defines
`users.username VARCHAR(50)` and `users.email VARCHAR(255)` (schema snapshot
`liquibase-schema-only-2.7.x.xml`). This search input must accommodate either
stored identifier. It does not modify historical identifiers. The shared
`RECOVERY_IDENTIFIER_MAX_LENGTH` drives validation and the visible counter;
pasted input is preserved, including when it exceeds the limit. Tests cover
254/255/256 code points and supplementary Unicode characters.

Configure the native `security.passwordResetUrl` to the installation's HTTPS
O3 route `/openmrs/spa/login/reset-password#token={activationKey}`. The reset
page moves the token into component memory and removes the fragment from the
current history entry. Refreshing that page requires reopening the email link.
Tokens/passwords are sent in the JSON body of `POST /passwordreset/confirm`,
never in a path, query string or browser storage. The gateway rejects the old
key-in-path endpoint. The server owns password strength requirements and token
expiry/one-time consumption; the client checks presence and confirmation only.
Recovery does not automatically sign in or bypass a forced-password-change
flag. Existing authenticated sessions are **not revoked** by this change.

Tests use synthetic accounts and mocked delivery: they establish request,
validation and response behavior, not SMTP deliverability or QLTY acceptance.
Before activation, verify email delivery to a controlled synthetic mailbox,
expiry, reuse rejection and subsequent login in DEV/QLTY. Never use a real user
or production to perform this acceptance.

## Logout lifecycle

Logout clears the local session after the backend confirms deletion. It does
not refetch the anonymous session immediately before leaving the document, and
session/language rerenders cannot initiate a second redirect. Implementer tools
abort abandoned module-inventory requests while keeping real service failures
visible. Carbon's opt-in v12 informational notices do not enable those flags.

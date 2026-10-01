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

## Shared notification inbox proposal

`enableNotificationInbox` is off by default. Enable only after notifications OMOD
1.3.0 and the relevant domain adapters have passed coordinated synthetic DEV/QLTY
validation. This proposal replaces the earlier, unreleased doctor-specific flag/API;
it requires the matching frontend/backend pair and no historical migration.

The header owns one generic bell, unread count, paginated list, loading/empty/error
states, refresh and SSE subscription. It knows no clinical order, result viewer,
department privilege, or clinical sign-off rule. Modules contribute a detail
extension to `notification-inbox-detail-slot`, with a unique
`meta.notificationType` matching their trusted backend type. Existing notification
slots remain available. Unknown, missing or duplicate detail renderers cannot
acknowledge an item; it remains unread. Extension privilege filtering and each
domain component's guards remain authoritative in the frontend; the backend
rechecks access for every list and acknowledgement.

The shared `NotificationDetailState` exported by the local framework fork contains
`notification`, `sessionKey`, `markRead()` and `back()`. The notification contains
`id`, `type`, `subjectUuid`, `createdAt`, and authorized `content` with a title and
subtitle plus optional domain context. No HTML, arbitrary action URLs or executable
browser-defined policies are accepted by the host. The domain extension decides
how to open authoritative details and when acknowledgement is available. Reading a
notification is not clinical review, approval, signature or a clinical action.

The authenticated API is `GET /ws/sihsalus/notifications/inbox?offset=0` and
`POST /ws/sihsalus/notifications/inbox/{id}/read`. Core Alert/AlertRecipient stores
only type, facility and subject identifiers; domain content is resolved under current access
on each read. Responses use no-store. Users/facilities have distinct memory cache
keys; nothing is stored in local/session storage. Merely opening never marks read.
Confirmed acknowledgement remains successful if its subsequent refresh fails.

One navbar subscription receives privacy-free `NOTIFICATION_CREATED` signals on
`notifications`, plus resync hints. Signals are grouped over one second and
refreshes serialized. A 60-second poll and focus refresh recover missed signals;
cached items remain visible during refresh. Errors stay visible, never masquerading
as an empty inbox. Session/location changes remount the panel and replace the
subscription.

The laboratory package supplies the first detail adapter. A simulated second
module in regression tests proves that adding a type/extension does not require
editing the host. No other clinical module is integrated by this change.

Before activation, validate synthetic completion, recipient/facility isolation,
permission revocation, F5/backend restart, explicit acknowledgement, missing
adapters, offline recovery, burst updates and fixture cleanup against the installed
OMOD. Local mocks and component previews are not deployed clinical evidence.

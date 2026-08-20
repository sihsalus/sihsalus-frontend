# Runbook: offline laptop browser acceptance

Use this runbook to accept the branded browser runtime on one SIH Salus laptop
against an explicitly selected, coordinated non-production environment. Prefer
DEV; use QLTY only when the validation owner selects it. Playwright launches an
isolated test profile, so the automated result must be paired with the
operational-profile checks below. The gate uses only data that it creates with
the selected target plus a `SYNTHETIC` marker and voids that patient and its
visit at the end.

This is not a production test, a general clinical sign-off, or proof that every
offline workflow works. It covers the cached chart for a patient created online
and one supported queued action: a closed offline visit created through the
patient chart's deployed offline API and synchronized through the real Offline
Tools UI. It does not cover offline patient registration, forms, vital signs,
orders, or every field in the interactive start-visit form.

## Browser policy

- Primary browser: managed Microsoft Edge Stable on the hospital Windows
  profile.
- Fallback browser: managed Google Chrome Stable, tested separately on the same
  laptop if it is part of the local contingency plan.
- Keep automatic browser and OS security updates enabled. Re-run this gate
  after a browser major update, laptop reimage, security-policy change, or SIH
  Salus service-worker change.
- Do not use InPrivate, Incognito, Guest, or a profile that clears site data on
  exit. Allow service workers, Cache Storage, cookies, and IndexedDB for the
  selected DEV/QLTY origin. This gate never opens or requires production.
- A pending offline queue belongs to one browser profile. Never switch to the
  fallback browser while the primary profile still has pending actions; first
  reconnect and synchronize, or follow the incident reconciliation procedure.

Installing the SIH Salus PWA from the primary browser is optional. If installed,
the PWA and its originating browser profile are one acceptance target; do not
assume that a second browser can see its offline queue.

Before recording acceptance, open the selected DEV/QLTY target once in the
staff member's normal managed profile (not Playwright) and confirm that it is
not private/guest, storage is not cleared on exit, and the site is not blocked
by browser policy. The automated gate does not inspect that profile or validate
a PWA installation.

## Preconditions

1. Coordinate the window with the selected DEV/QLTY owner. Prefer DEV and do
   not run during another clinical validation campaign.
2. Confirm that the laptop clock is synchronized, the selected target opens
   over HTTPS, and the intended browser Stable channel is installed and
   current.
3. Use a dedicated test account with the minimum permissions needed to create
   and void a patient and visit, generate an identifier, read the patient chart,
   open Offline Tools, and synchronize offline actions. Never use a personal or
   production account.
4. Record the full deployed SHA from the selected target before testing. For
   the preferred DEV target:

   ```sh
   curl -fsS https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa/build-info.json
   ```

5. Ask the selected environment's metadata owner for the isolated login
   location, identifier source, matching identifier type, and offline visit
   type UUIDs. Do not choose an arbitrary clinical location or metadata record.
6. From a clean checkout of the test branch, use Node 24 and Yarn 4.13.0:

   ```sh
   corepack enable
   yarn install --immutable
   ```

## Gate configuration

Set these values only in the current shell or an ignored `.env`. The preflight
has no target or metadata defaults. It accepts only the exact known DEV or QLTY
origin selected by `E2E_OFFLINE_GATE_TARGET`, and rejects non-HTTPS or mismatched
origins, skipped auth, malformed metadata, and a deployed SHA mismatch. The DEV
example is preferred; to use QLTY, change the target and all three origins to
`https://gidis-hsc-qlty.inf.pucp.edu.pe`.

```sh
export E2E_OFFLINE_GATE_ENABLED=true
export E2E_OFFLINE_GATE_TARGET=DEV
export E2E_OFFLINE_GATE_ALLOWED_ORIGIN=https://gidis-hsc-dev.inf.pucp.edu.pe
export E2E_OFFLINE_GATE_EXPECTED_SHA=<full-40-character-deployed-sha>

export E2E_BASE_URL=https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa
export E2E_API_BASE_URL=https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs
export E2E_LOGIN_DEFAULT_LOCATION_UUID=<isolated-dev-location-uuid>
export E2E_OFFLINE_IDENTIFIER_SOURCE_UUID=<dev-identifier-source-uuid>
export E2E_OFFLINE_IDENTIFIER_TYPE_UUID=<matching-identifier-type-uuid>
export E2E_OFFLINE_VISIT_TYPE_UUID=<dev-offline-visit-type-uuid>

export E2E_USER_ADMIN_USERNAME=<dedicated-test-account>
export E2E_USER_ADMIN_PASSWORD=<secret>
```

Use `SIHSALUS_ALLOW_SELF_SIGNED_TLS=true` only if the coordinated DEV/QLTY
endpoint still uses a controlled self-signed certificate. It does not change
the gate's HTTPS and exact-origin checks.

Validate the local fail-closed configuration contract without contacting a
backend:

```sh
yarn test:e2e:offline-laptop:config
```

## Run each accepted browser channel

Close other browser windows on the laptop. Run the applicable branded project
headed so the operator can confirm the correct installed browser opens:

```sh
# Primary browser
yarn test:e2e:offline-laptop --project="Microsoft Edge Stable" --headed

# Fallback browser, when locally supported
yarn test:e2e:offline-laptop --project="Google Chrome Stable" --headed
```

Running `yarn test:e2e:offline-laptop --headed` requires both branded browsers
and executes both projects serially. The normal `yarn test:e2e` command does
not discover this state-changing gate.

For each project the gate must prove all of the following without soft skips or
retries:

1. the installed branded channel matches the selected project and the target
   serves the explicitly expected SHA;
2. the SIH Salus service worker activates, controls the page, and has the shell
   plus the synthetic patient's FHIR response in Cache Storage;
3. the patient chart reloads successfully while the browser is offline and the
   response comes from the service worker;
4. one supported `visit` action is stored in the `EsmOffline.syncQueue` and
   survives another offline reload;
5. reconnecting does not erase the queued action, and the operator-facing
   Offline Tools button performs the synchronization;
6. the queue drains without a stored error and the backend contains exactly one
   visit with the queued UUID, location, and visit type;
7. cleanup voids every visit found for the generated patient and then voids the
   patient. A cleanup failure fails the test.

## Evidence and decision

Record the laptop asset tag, OS build, browser project and version, deployed
SHA, command, result, and operator. Playwright writes an HTML report under
`playwright-report/offline-laptop` and attaches an early context file plus a
final JSON evidence file containing the browser version, service-worker scope,
cache keys, synthetic UUIDs, and deployed SHA. Failure traces, screenshots, and
videos remain under the normal Playwright artifact directories; they contain
only the gate-created synthetic patient.

Use these result labels exactly:

- `PASSED`: the selected branded project completed and cleanup succeeded.
- `FAILED`: an assertion, synchronization, backend uniqueness check, browser
  launch, or cleanup failed.
- `BLOCKED`: the selected DEV/QLTY target, approved metadata, the dedicated
  account, or the installed branded browser was unavailable. Do not translate
  a blocked run into a pass.
- `NOT RUN`: that browser profile was deliberately outside this laptop's test
  matrix.

If the run fails after creating data, use the synthetic patient UUID from the
Playwright evidence to confirm that the patient and all visits are voided in
the selected target before retrying. Do not delete or reconcile any
non-synthetic record.

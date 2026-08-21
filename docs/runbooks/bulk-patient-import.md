# One-time bulk patient import

This runbook controls a state-changing clinical migration. It is not a normal registration workflow and must remain
disabled except for one approved window. Never use production or real patient data for qualification.

## Safety boundary

- The import supports adults with an eight-digit DNI only. Minors, existing persons found by DNI, duplicate
  demographics within the approved workbook, missing metadata, and ambiguous matches require manual registration or
  reconciliation. DNI is the authoritative backend lookup; records without their correct DNI must be reconciled before
  approval by a separate authorized duplicate-review process.
- The browser performs sequential REST writes; there is no database transaction or automatic rollback for the whole
  file. The importer therefore stops on the first unverified outcome.
- The exact workbook bytes, frontend build, origin, operator UUID, session location UUID, approval expiry, and
  `DOMICILIO` mapping must be approved in configuration. Any mismatch fails before IdGen or patient creation.
- A deterministic patient UUID is derived from the exact file hash, Excel row, and normalized DNI. Re-selecting the
  same approved file reconciles that UUID rather than inventing a new identity.
- A cross-tab Web Lock is mandatory. This does not coordinate separate devices, so schedule one operator/device and
  rely on exact-file approval plus backend identifier uniqueness as additional controls.
- The downloaded reconciliation report contains clinical identifiers. Store it only in the approved encrypted
  location, never attach it to public issues or pull requests, and delete it according to the migration retention plan.

## Prepare and approve

1. Reserve a DEV window first. Use QLTY only after DEV passes and the environment owner approves it. Do not use PROD.
   Freeze patient-identifier types, the primary-identifier mapping, IdGen sources/options, and session-location changes
   for the whole window.
2. Use a dedicated account with `Manage Patients` and the backend privileges needed to read Patient/Person metadata,
   allocate IdGen identifiers, and create patients. Use one dedicated browser profile and one approved session location.
3. Freeze the exact deployed frontend SHA from `build-info.json` and record the exact origin.
4. Decide with Admisión whether `DOMICILIO` means free-text street/direction (`address4`) or centre/community
   (`cityVillage`). Do not enable the importer until that choice is explicit.
5. Reconcile the source against existing Patient and Person records using an authorized backend duplicate-review
   process, including exact demographic matches whose DNI is absent or wrong. Resolve those records manually before
   approval. Then review the workbook offline: it must contain no formulas, hidden patient rows, duplicate logical
   columns, duplicate DNI, or duplicate name/birthdate/sex tuples. Confirm every row is an adult and belongs to the
   approved migration.
6. Hash the exact bytes without reopening or resaving the workbook:

   ```sh
   shasum -a 256 approved-patient-import.xlsx
   ```

7. Configure `@sihsalus/esm-patient-registration-app.bulkPatientImport` with:

   ```yaml
   enabled: true
   approvedOrigin: https://approved-non-production-origin.example
   approvalExpiresAt: "<replace-with-a-short-canonical-UTC-instant>"
   approvedBuildSha: 40-lowercase-hex-characters
   approvedFileSha256: 64-lowercase-hex-characters
   approvedUserUuid: 00000000-0000-4000-8000-000000000001
   approvedLocationUuid: 00000000-0000-4000-8000-000000000002
   domicilioTarget: address4 # or cityVillage, after clinical approval
   ```

8. Keep the approval window as short as operationally practical. Have a second person approve its UTC expiry together
   with the source hash, row count, target, build, operator, location, and address mapping.

## Dry-run and execute

1. Open the importer online in the approved profile. Independently verify the configured approval values and current
   `build-info.json`; confirm the page shows the approved file hash after upload.
2. Upload the exact file. Local parsing and the live preflight must finish before the Create action is enabled.
3. Confirm from browser/network evidence that preflight issued only fresh GET requests: no Patient POST and no IdGen
   request is allowed during preflight.
4. Review every blocked/reconciled row. Any error blocks the whole batch; do not edit the workbook and continue under
   the old approval.
5. Start the import once. Do not navigate, reload, change location, log out, upload another file, or open a second tab.
6. After each row, require a fresh exact-UUID/DNI reconciliation before advancing. The first uncertain response stops
   the run; do not click through or blindly retry.
7. Download the reconciliation report and record its SHA-256 in the private migration evidence.

## Failure and resume

- If a response is lost, first query the deterministic patient UUID and exact DNI from a fresh network response.
- Exact UUID plus the approved identity payload is recorded as `reconciled`; it must not be POSTed again. The `created`
  result is reserved for a successful Patient POST response confirmed during the current run.
- A conflicting UUID, a different DNI/person, multiple matches, or an unverifiable response is `ambiguous`. Stop and
  escalate to the environment owner. Never automatically delete or merge a patient.
- Resume only by re-selecting the byte-identical approved file, rerunning all live checks, and reacquiring the lock.
- IdGen values allocated before a failed Patient POST may remain unused. Record the gap; do not reuse identifiers.

## Close the one-time window

1. Independently reconcile each approved row against the backend: deterministic UUID, exact DNI/type, names, sex,
   birthdate, configured address field, and generated identifiers.
2. Prove there is exactly one active patient per approved DNI and no unexpected Person-only record.
3. Set `bulkPatientImport.enabled` to `false`, remove all approval values, and verify the admin card and direct route are
   unavailable.
4. Delete the local workbook/report copies according to the approved retention plan. Keep only sanitized hashes,
   counts, build/digest, environment, operator/approver, and PASS/FAILED/BLOCKED evidence.
5. A DEV/QLTY synthetic test is `PASSED` only if creation, reconciliation, disablement, and authorized cleanup all pass.
   Otherwise record `FAILED`, `BLOCKED`, or `NOT RUN`. Never infer PROD readiness from a synthetic run.

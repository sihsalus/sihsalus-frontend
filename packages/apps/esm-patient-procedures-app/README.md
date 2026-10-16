# @sihsalus/esm-patient-procedures-app

SIH Salus microfrontend for [OpenMRS 3](https://o3-docs.openmrs.org) that records, displays, and manages clinical procedures in the patient chart. This package is adapted from the upstream OpenMRS procedures app and kept as a separate SIH Salus package to avoid colliding with the existing conditions-based procedures view.

Jira: [O3-5077](https://openmrs.atlassian.net/browse/O3-5077)

---

## Features

- **Procedure overview widget** — compact table in the patient summary that lists each procedure with its date, paginated according to the configured page size.
- **Procedures detailed summary** — full-page table that adds procedure type, body site, start/end timestamps, status, and inline notes. Rows are expandable to show additional detail without leaving the page.
- **Record & edit form** — a side-panel workspace for creating and updating procedures. Supports:
  - Fuzzy concept search for procedure name, body site, status, and duration unit — all driven by configurable concept UUIDs.
  - Exact start date/time or estimated start date (year + optional month) for procedures where the precise date is not known.
  - End date/time and duration with unit.
  - Procedure type selection from the OpenMRS procedure type registry.
  - Free-text notes.
- **Void confirmation** — requires a reason and voids a procedure record without purging its history.

---

## Backend

This app requires the [openmrs-module-emrapi](https://github.com/openmrs/openmrs-module-emrapi) module, which exposes the `/ws/rest/v1/procedure` REST endpoints used for all CRUD operations.

---

## Running locally

From the monorepo root:

```bash
yarn start --sources 'packages/apps/esm-patient-procedures-app'
```

---

## Configuration

The app is configured through the [OpenMRS config system](https://o3-docs.openmrs.org/docs/frontend-modules/loading-modules#module-configuration). All keys live under `@sihsalus/esm-patient-procedures-app`.

| Key                             | Type   | Default                    | Description                                                                                        |
| ------------------------------- | ------ | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `overviewPageSize`              | Number | `5`                        | Rows per page in the procedures overview widget.                                                   |
| `detailedViewPageSize`          | Number | `10`                       | Rows per page in the procedures detailed summary view.                                             |
| `procedureConceptUuid`          | UUID   | `8d490bf4-…`               | Scopes the procedure concept search.                                                               |
| `procedureConceptSourceType`    | String | `Concept class`            | How `procedureConceptUuid` filters results: `Concept class`, `Concept set`, `Answer to`, or `any`. |
| `bodySiteConceptUuid`           | UUID   | `8d491c7a-…` (Anatomy)     | Scopes the body-site concept search.                                                               |
| `bodySiteConceptSourceType`     | String | `Concept class`            | Same options as above.                                                                             |
| `statusConceptUuid`             | UUID   | `f0d47b45-…` (CIEL 170800) | Scopes the status concept search to the Procedure status question.                                 |
| `statusConceptSourceType`       | String | `Answer to`                | Same options as above.                                                                             |
| `durationUnitConceptUuid`       | UUID   | `1732AAAAA…`               | Scopes the duration-unit concept search.                                                           |
| `durationUnitConceptSourceType` | String | `Concept set`              | Same options as above.                                                                             |

---

## Required clinical content

The default status field uses [CIEL 170800 — Procedure status](https://app.openconceptlab.org/#/orgs/CIEL/sources/CIEL/concepts/170800/), whose OpenMRS UUID is `f0d47b45-8303-4cdc-a9f2-c37135a3700f`. The concept and its answers must be imported into the OpenMRS backend. They are included in version 11 or later of the OpenMRS `procedures` OCL collection used by the [Reference Application demo content](https://github.com/openmrs/openmrs-content-referenceapplication-demo/tree/main/configuration/backend_configuration/ocl).

Do not use CIEL 167157 (`Medication dispense status`) for this field. It was the original temporary upstream default and does not represent procedure status.

After importing the content, an authenticated request to the backend should return the configured status answers:

```text
GET /openmrs/ws/rest/v1/concept?answerTo=f0d47b45-8303-4cdc-a9f2-c37135a3700f&v=custom:(uuid,display)
```

The expected CIEL answers are Preparation, In progress, On hold, Completed, Not done, Discontinued, Entered in error, and Unknown.

Before querying members or answers, the frontend verifies that the configured source exists. This prevents OpenMRS REST implementations that ignore an unknown `answerTo` filter from returning unrelated concepts as clinical options.

SIH Salus imports `1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` as a concept set named `Unidad de Tiempo`, so `Concept set` is the default. Its members provide seconds, minutes, hours, days, weeks, months, years, and number of times. This eight-member set is shared with `order.durationUnitsConceptUuid`; choosing clinically appropriate units remains the recording professional’s responsibility.

Procedure types are OpenMRS metadata, not concepts. The backend must also seed at least one `/ws/rest/v1/proceduretype`; the Reference Application demo content provides Diagnostic, Surgical, Laboratory, Imaging, Therapeutic, Nursing, Dental, Obstetric, Emergency, Vaccination, Referral, and Other.

---

## Form fields

| Field                | Required                 | Notes                                            |
| -------------------- | ------------------------ | ------------------------------------------------ |
| Procedure            | Yes                      | Fuzzy concept search                             |
| Procedure type       | Yes                      | Dropdown from `/ws/rest/v1/proceduretype`        |
| Body site            | Yes                      | Fuzzy concept search                             |
| Start date known?    | —                        | Toggle between exact datetime and estimated date |
| Start date/time      | Yes (if date is known)   | Full date + time picker                          |
| Estimated start date | Yes (if date is unknown) | Year required, month optional                    |
| End date/time        | No                       | Must be on or after start date                   |
| Duration             | No                       | Positive integer; requires a unit when set       |
| Duration unit        | Conditional              | Required when duration is provided               |
| Status               | Yes                      | Concept search                                   |
| Notes                | No                       | Free text                                        |

---

## Estimated start date

When the exact start date of a procedure is not known — common for historical procedures — clinicians can switch the start date toggle to **No** and enter a year (required) and month (optional). The stored value is an ISO partial date string (`YYYY` or `YYYY-MM`). In the UI, estimated dates are shown with a trailing `*` to distinguish them from precise timestamps.

---

## Related

- Ticket: [O3-5077](https://openmrs.atlassian.net/browse/O3-5077)
- Requirements: [Procedure History — Confluence](https://openmrs.atlassian.net/wiki/spaces/projects/pages/589267006/Procedure+History)
- Architecture discussion: [OpenMRS Talk](https://talk.openmrs.org/t/procedures-app-architecture-questions/47948/19)
- Backend module: [openmrs-module-emrapi](https://github.com/openmrs/openmrs-module-emrapi/)

## Persistence and review boundaries

The supported contract was checked against EmrApi `3.5.1-sihsalus.2`
(`0f872b717c627178adf45f92092a610faa9e4b03`): `ProcedureResource`,
`ProcedureValidator`, `ProcedureServiceImpl`, and `api/src/main/resources/liquibase.xml`.
Procedures are longitudinal records. `encounter` is optional in that backend
contract; this workspace does not require an active visit or automatically create
an order, result, encounter, or billing record. Orders and results have separate
owners and workflows. A procedure status does not change those resources.

Creating uses the open patient chart. Editing requires an existing procedure
belonging to that patient and sends only editable fields, leaving patient,
encounter, outcomes, and external form references unchanged. Inconsistent
workspace inputs are rejected. This is an identity safeguard, not backend
authorization: read and edit privileges remain enforced by the platform and
EmrApi (`Get Procedures` / `Manage Procedures`).

Voiding sends `DELETE /procedure/{uuid}?reason=...`. EmrApi requires a nonblank
reason; omission is rejected. The procedure is voided, not purged. The reason is
stored in `procedure.void_reason VARCHAR(255)`, so this field alone permits at most
255 Unicode code points, including spaces and newlines. Combining marks count
separately; a supplementary emoji counts as one. The counter, submit validation,
and complete URL-encoded payload use the same unmodified string. Text beyond the
limit remains visible for correction. Native HTML/Carbon UTF-16 `maxLength` is
not used, because it would count supplementary characters differently. See the
[MySQL VARCHAR contract](https://dev.mysql.com/doc/refman/8.0/en/char.html).
This limit does not apply to clinical notes (`TEXT`), does not shorten historical
records, and does not migrate existing reasons.

A confirmed write followed by a failed list refresh is reported as saved,
updated, or voided with a refresh warning; it must not invite a duplicate write.
An unconfirmed write retains the entry and asks the user to check the record
before retrying. Backend errors are normalized with the shared safe helper.
Pagination restarts at the first page when the patient changes, including the
first request for the new patient.

Local regressions cover required reason, 254/255/256 code points, accented text,
combining marks, emoji, newlines, unmodified encoding, patient mismatch, missing
edit context, partial updates, error privacy, and confirmed-write/refresh failure.
They do not certify a clinical CRUD round trip, deployed permissions, or order /
result integration. Those require a separately authorized synthetic backend
acceptance test. Catalogue adequacy and the shared “number of times” unit require
domain review; the frontend does not substitute clinical metadata.

The procedure type selector is controlled by the form's UUID, including when
options refresh or the responsive wrapper remounts the control. A production
browser regression in `yarn test:form-builder-browser` covers selection followed
by blur, creating and editing payloads, and clearing then replacing a required
type. The visible label and submitted UUID must agree; typing a label alone is
not a metadata selection. This local fixture makes no backend writes.

The time control follows changes to its actual timestamp, including clearing or
rehydrating a record. A partial time remains editable when a parent rerenders an
equivalent timestamp; an incomplete time does not replace the last valid model
value. When a date is present, an empty or incomplete visible time blocks native form
submission and shows an inline format error. This prevents saving a hidden prior
hour; it does not coerce the draft or infer a new timestamp. Existing 12-hour /
AM-PM parsing remains in place. No historical timestamp is migrated or inferred by this UI correction.

Carbon 1.117 `TimePicker` exposes its native input ref but does not declare a
`required` prop in `TimePickerProps`. The existing 12-hour pattern and supported
`invalid` / `invalidText` props describe the same field constraint; the input ref
uses native `setCustomValidity` so an empty draft cannot submit a hidden prior
hour. This does not bypass component types, coerce a timestamp, or introduce a
clinical time rule. Revisit this integration if Carbon exposes the equivalent
native constraint directly through its typed props.

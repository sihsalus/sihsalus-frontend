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
- **Delete confirmation** — modal that voids a procedure record.

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

| Key | Type | Default | Description |
|---|---|---|---|
| `overviewPageSize` | Number | `5` | Rows per page in the procedures overview widget. |
| `detailedViewPageSize` | Number | `10` | Rows per page in the procedures detailed summary view. |
| `procedureConceptUuid` | UUID | `8d490bf4-…` | Scopes the procedure concept search. |
| `procedureConceptSourceType` | String | `Concept class` | How `procedureConceptUuid` filters results: `Concept class`, `Concept set`, `Answer to`, or `any`. |
| `bodySiteConceptUuid` | UUID | `8d491c7a-…` (Anatomy) | Scopes the body-site concept search. |
| `bodySiteConceptSourceType` | String | `Concept class` | Same options as above. |
| `statusConceptUuid` | UUID | `f0d47b45-…` (CIEL 170800) | Scopes the status concept search to the Procedure status question. |
| `statusConceptSourceType` | String | `Answer to` | Same options as above. |
| `durationUnitConceptUuid` | UUID | `1732AAAAA…` | Scopes the duration-unit concept search. |
| `durationUnitConceptSourceType` | String | `Concept set` | Same options as above. |

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

SIH Salus imports `1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` as a concept set named `Unidad de Tiempo`, so `Concept set` is the default. Its members provide seconds, minutes, hours, days, weeks, months, and years.

Procedure types are OpenMRS metadata, not concepts. The backend must also seed at least one `/ws/rest/v1/proceduretype`; the Reference Application demo content provides Diagnostic, Surgical, Laboratory, Imaging, Therapeutic, Nursing, Dental, Obstetric, Emergency, Vaccination, Referral, and Other.

---

## Form fields

| Field | Required | Notes |
|---|---|---|
| Procedure | Yes | Fuzzy concept search |
| Procedure type | Yes | Dropdown from `/ws/rest/v1/proceduretype` |
| Body site | Yes | Fuzzy concept search |
| Start date known? | — | Toggle between exact datetime and estimated date |
| Start date/time | Yes (if date is known) | Full date + time picker |
| Estimated start date | Yes (if date is unknown) | Year required, month optional |
| End date/time | No | Must be on or after start date |
| Duration | No | Positive integer; requires a unit when set |
| Duration unit | Conditional | Required when duration is provided |
| Status | Yes | Concept search |
| Notes | No | Free text |

---

## Estimated start date

When the exact start date of a procedure is not known — common for historical procedures — clinicians can switch the start date toggle to **No** and enter a year (required) and month (optional). The stored value is an ISO partial date string (`YYYY` or `YYYY-MM`). In the UI, estimated dates are shown with a trailing `*` to distinguish them from precise timestamps.

---

## Related

- Ticket: [O3-5077](https://openmrs.atlassian.net/browse/O3-5077)
- Requirements: [Procedure History — Confluence](https://openmrs.atlassian.net/wiki/spaces/projects/pages/589267006/Procedure+History)
- Architecture discussion: [OpenMRS Talk](https://talk.openmrs.org/t/procedures-app-architecture-questions/47948/19)
- Backend module: [openmrs-module-emrapi](https://github.com/openmrs/openmrs-module-emrapi/)

# openmrs-esm-laboratory-app

An O3 frontend module for managing laboratory requests and queues.

For more information, please refer to the [O3 Frontend Documentation](https://o3-docs.openmrs.org/).

## Dashboard

![Laboratory dashboard](assets/screenshots/labs_general_dashboard.png)

## Adding results

Lab technicians can enter test results by expanding an in-progress order and clicking "Add lab results". This opens a workspace where results can be recorded for each test.

![Adding lab results](assets/screenshots/labs_enter_results.png)

## Editing and printing saved results

The completed-orders menu opens registered `edit-lab-results-modal` and
`print-lab-results-modal` destinations. Amendment from the order detail uses the
same edit selector. Editing requires `app:home.laboratorio.editar`; printing
requires `app:home.laboratorio`. Backend authorization remains authoritative.

Editing selects one completed or pending-review order, rereads its persisted
order, encounter and result, and opens the existing v2
`lab-app-test-results-form-workspace` with that patient's encounter and visit.
Missing, ambiguous or mismatched results block opening. The shared form retains
its observation-revision and one-panel-result-per-save rules. A result pending
order completion stays read-only until that completion succeeds.

Printing rereads only the selected completed orders for one patient, independent
of patient-chart context. Every selected order must have exactly one active root
result with matching patient, encounter, order and concept. Nested active panel
members preserve their recorded values and comments; zero is a result. Missing
results, read failures and inconsistent associations block the entire report.
The preview has no write operations and does not print supplemental PDFs or an
unselected patient's history. It does not assert clinical approval or provide a
new institutional report template.

Reads use OpenMRS REST `order`, `encounter` and `obs` resources. The `full`
observation representation supplies nested members and, on Core 2.7+, the saved
observation reference range. Only saved ranges are printed; a missing range is
shown as a dash, never replaced by a current catalog range. Units are explicitly
identified as coming from the test catalog. No content migration is required.

These verification reads request `cache: no-store`; the matching frontend
worker requires a current server response. A downloaded offline snapshot cannot
authorize an amendment or establish the current report. Network failures leave
the existing blocking error state visible. Activate the matching worker and
refresh existing tabs when releasing this change.

Before rollout, validate in coordinated DEV/QLTY with synthetic patients and
minimum laboratory roles: single tests, panels, zero/coded/text results,
reopening after correction, failures/retries, denied access, patient isolation,
and browser print preview on desktop/tablet. Local component tests do not replace
that authenticated clinical smoke test. Follow the laboratory E2E README's
recovery-journal restriction before enabling any remote browser CI.

## Supplemental PDF documents

Every persisted laboratory order renders `lab-order-pdf-attachments-slot` directly, so existing PDFs remain readable
in every order state. The completed structured-result consumer passes `hideSupplementalPdf` to its shared detail
component only to prevent a duplicate slot. PDFs are supplementary documents only. Uploading one must not enter
structured results, complete or approve the order, or replace an existing document. Upload is available only while
the order is `IN_PROGRESS`.

## Customizing tab panels and summary tiles

Implementers can add or remove laboratory tab panels and summary tiles via extension configuration in the [routes.json](https://github.com/openmrs/openmrs-esm-laboratory-app/blob/main/src/routes.json) file.

## Configuration

The module supports the following configuration options:

| Property                                  | Type            | Default                                           | Description                                                                                                            |
| ----------------------------------------- | --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `laboratoryOrderTypeUuid`                 | `string`        | `52a447d3-a64a-11e3-9aeb-50e549534c5e`            | UUID for the laboratory order type                                                                                     |
| `labTableColumns`                         | `Array<string>` | `['name', 'age', 'sex', 'totalOrders', 'action']` | Columns to display in the lab table. Allowed values: `name`, `age`, `dob`, `sex`, `totalOrders`, `action`, `patientId` |
| `patientIdIdentifierTypeUuid`             | `UUID`          | `05a29f94-c0ed-11e2-94be-8c13b969e334`            | Identifier type UUID for the patient ID column. Only needed if `patientId` is included in `labTableColumns`            |
| `enableReviewingLabResultsBeforeApproval` | `boolean`       | `false`                                           | When enabled, lab results are submitted for review before being approved and finalized                                 |
| `enableRealtimeLabResultNotifications`    | `boolean`       | `false`                                           | Refresh the dashboard for new laboratory orders and completed results after the compatible OMOD is validated           |

## Realtime laboratory notifications

Realtime delivery is fail-safe off by default. When `enableRealtimeLabResultNotifications` is explicitly enabled, the dashboard subscribes to the authenticated
`laboratory` SSE topic provided by `sihsalusnotifications` OMOD 1.2.0 or newer.
`LAB_ORDER_CREATED` and `LAB_RESULT_READY` events invalidate the existing laboratory-order queries
and show generic in-app notices. Each event contains only an order UUID; the browser retrieves
authoritative data through the normal OpenMRS REST API and never receives test names, result values,
or patient demographics in the notification.

The laboratory workflow remains usable if realtime delivery is interrupted because SSE is only a
refresh hint. Deploy and validate the compatible notifications OMOD before enabling the flag;
deployments without it keep the default disabled to avoid unnecessary reconnect attempts.

Delivery is restricted to events whose encounter location and the user's current OpenMRS session
location resolve to the same nearest ancestor tagged `Facility Location`. Standard SSE
`Last-Event-ID` replay recovers short network interruptions. If the backend no longer recognizes
the cursor, the dashboard silently refetches the authoritative worklist without showing a duplicate
notice. The frontend does not persist order UUIDs or notification history in browser storage.

## Getting Started

```sh
# Clone the repository
git clone git@github.com:openmrs/openmrs-esm-laboratory-app.git

# Install dependencies
yarn

# Run the dev server
yarn start

# Or start on a specified port, e.g. 5000
yarn start --port 5000
```

Once it is running, a browser window should open with O3 running. Log in and then navigate to `/openmrs/spa/home/laboratory`.

## Running tests

```sh
yarn test
```

# openmrs-esm-laboratory-app

An O3 frontend module for managing laboratory requests and queues.

For more information, please refer to the [O3 Frontend Documentation](https://o3-docs.openmrs.org/).

## Dashboard

![Laboratory dashboard](assets/screenshots/labs_general_dashboard.png)

## Adding results

Lab technicians can enter test results by expanding an in-progress order and clicking "Add lab results". This opens a workspace where results can be recorded for each test.

![Adding lab results](assets/screenshots/labs_enter_results.png)

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
| `enableRealtimeLabResultNotifications`    | `boolean`       | `true`                                            | Refresh the dashboard for new laboratory orders and completed results                                                  |

## Realtime laboratory notifications

When `enableRealtimeLabResultNotifications` is enabled, the dashboard subscribes to the authenticated
`laboratory` SSE topic provided by `sihsalusnotifications` OMOD 1.2.0 or newer.
`LAB_ORDER_CREATED` and `LAB_RESULT_READY` events invalidate the existing laboratory-order queries
and show generic in-app notices. Each event contains only an order UUID; the browser retrieves
authoritative data through the normal OpenMRS REST API and never receives test names, result values,
or patient demographics in the notification.

The laboratory workflow remains usable if realtime delivery is interrupted because SSE is only a
refresh hint. Deployments without the notifications OMOD must set
`enableRealtimeLabResultNotifications` to `false` to avoid unnecessary reconnect attempts.

Delivery is restricted to the order encounter's location matching the user's current OpenMRS
session location. Standard SSE `Last-Event-ID` replay recovers short network interruptions. If the
backend no longer recognizes the cursor, the dashboard silently refetches the authoritative
worklist without showing a duplicate notice. The frontend does not persist order UUIDs or
notification history in browser storage.

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

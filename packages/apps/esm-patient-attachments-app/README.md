# esm-patient-attachments-app

The attachments widget. It shows a gallery of attachments uploaded for the patient as well as a file uploader for uploading new attachments.

## Required upload allowlist

Before enabling uploads, configure the OpenMRS global property
`attachments.allowedFileExtensions` with a non-empty, comma-separated
allowlist, for example:

```text
pdf,jpg,jpeg,png
```

Generic attachment flows deliberately disable file and camera uploads when this
property is missing, empty, unavailable, or contains no valid extensions.
Values are normalized to lowercase alphanumeric extensions; wildcards and
malformed values are rejected. Camera capture requires `png` in the allowlist.
A workflow can explicitly opt in to a scoped allowlist to avoid a duplicate
frontend configuration request. Existing callers continue to intersect their
requested types with the configured allowlist. Neither mode replaces backend
validation or configuration.

This browser-side check is defense in depth. The attachments backend remains
responsible for enforcing the same allowlist and validating the uploaded
content rather than trusting the filename or browser MIME type. PDF previews
are rendered in a fully sandboxed iframe with no referrer information.

## Supplemental PDFs for laboratory orders

The `lab-order-pdf-attachments-slot` shows additive PDF documents associated with one persisted laboratory order.
Each upload is linked to the order encounter and stored with namespace `sihsalus-laboratory` and path
`sihsalus-laboratory-order-<orderUuid>-supplemental-pdf`. Reads verify the encounter patient, filter both metadata
values exactly, and reject non-PDF attachment payloads. The component never records a structured result, changes an
order fulfiller status, approves a result, or offers delete/replace actions.

Online reading is available in patient orders and laboratory workflows. The extension declares `online: true` and
`offline: false`, so the route does not mount in offline mode. Uploading is limited to one PDF of at most 5 MiB per
operation and is exposed only while the order is `IN_PROGRESS`. The UI also requires the laboratory
edit application privilege plus `Create Attachments` and `Add Observations`; reads require `View Attachments`.

The runtime feature flag `enableLabOrderPdfAttachments` defaults to `false`. Do not enable it in deployment
configuration until the compatible backend and role contract have been rolled out together.

### Backend compatibility requirement

The declared backend dependency is `attachments >=4.0.0 <5.0.0`, which is what the always-mounted surfaces of this
module need: the chart attachments dashboard, the patient photo widget, and reading supplemental laboratory PDFs all
work on a stock upstream Attachments 4.x.

**Uploading** a supplemental laboratory PDF is the only part that needs the SIH Salus release
`>=4.0.1-sihsalus.1 <5.0.0`, because it posts `formFieldNamespace` and `formFieldPath` alongside the attachment and
upstream 4.0.0 ignores them. That path is gated by the `enableLabOrderPdfAttachments` runtime flag, which defaults to
`false`; if it is enabled against an upstream backend the upload fails with a visible error while reads keep working.

The requirement is deliberately not expressed as a hard `backendDependencies` range. Doing so reported the entire
module as version-incompatible on any upstream 4.0.0 deployment — a permanent false alarm in Implementer Tools for a
feature that ships disabled. Configure `pdf` in `attachments.allowedFileExtensions` and validate the complete workflow
contract in a coordinated non-production environment before enabling the feature.

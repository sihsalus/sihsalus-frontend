# esm-patient-label-printing-app

The Patient label printing frontend module provides a flexible and extensible printing mechanism that integrates easily into various parts of the application. Its core architecture supports print actions across diverse contexts—such as patient management apps like queues, clerical views, and billing interfaces—enabling fast, standardized printing of documents like patient records, receipts, and other critical materials.

## Patient identification from appointments

The registered `print-patient-identity-modal` accepts a `patientUuid`,
`context` (`appointments` or `patient-chart-appointments`) and `closeModal`.
It requires the context's appointment-read privilege, `Get Patients` and the
existing `App: Can generate a Patient Identity Sticker` privilege. Invalid
contexts, missing identity and denied access do not load patient data or PDFs.
The modal verifies the loaded patient's ID before enabling Print. Its entry is
independent of `showPrintIdentifierStickerButton`, which still controls only
the patient banner action.

An explicit Print click requests the existing
`/ws/rest/v1/patientdocuments/patientIdSticker?patientUuid=…` resource with
session cookies and no browser-cache storage. HTTP errors, login HTML, empty
responses and non-PDF content cannot be sent to the printer. Backend details
are not displayed. A pending request is cancelled when the modal closes,
identity/account/location changes or permission is lost; late responses are
ignored and object URLs are revoked. No patient data is added to browser
storage, logs or a new document template.

Both entry points use the existing iframe printer. It prevents duplicate
requests synchronously, reports frame/load/print failures, limits load waiting
and cleans up timers/listeners/frames. Closing a print dialog or its completion
timeout does not certify physical printing. The backend PDF controls layout and
content; clinical instructions and appointment editing are separate workflows.

Dependencies remain the existing `patientdocuments` OMOD and patient-read API;
the SWR peer dependency supports patient-read retry through the shared cache.
Local synthetic tests cover both menus, allowed/denied direct modal access,
loading/error/mismatched identities, HTTP/content failures, retries, duplicate
clicks, cancellation and printer cleanup. Before deployment, verify the actual
OMOD version, role, generated PDF and native browser/physical print behavior in
coordinated DEV/QLTY using synthetic data. No remote patient was used here.

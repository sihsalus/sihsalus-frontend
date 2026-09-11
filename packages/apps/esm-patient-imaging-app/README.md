# SIHSALUS medical imaging

The patient imaging app manages DICOM study metadata and procedure requests through
OpenMRS `imaging`. Orthanc stores DICOM files; the SIHSALUS OHIF viewer reads them
through the distribution's authenticated DICOMweb proxy. This app has no FTP
importer and does not implement clinical reporting, PACS backup or modality setup.

Read the root [CONTRIBUTING.md](../../../CONTRIBUTING.md) before changing this app.
The SIHSALUS backend implementation is maintained in
[openmrs-module-imaging](https://github.com/sihsalus/openmrs-module-imaging).

## Required services and browser mapping

The route registry declares `imaging`, `webservices.rest` and `fhir2`. The upload
response contract below was inspected in imaging **1.2.8**, source
`f50c540e57820ee5d40e141dc41c04260d4d935c`; a dependency declaration alone does not
prove that the deployed module or PACS provides these capabilities.

An administrator configures each Orthanc connection in the imaging backend:

- `orthancBaseUrl` is the server address reachable from OpenMRS, for example the
  distribution's internal service `http://orthanc:8042`.
- `orthancProxyUrl` is the explicit absolute browser URL. It must use HTTP(S)
  without embedded credentials, query parameters or fragments.
- In the standard SIHSALUS distribution, `orthancProxyUrl` must equal the external
  browser origin plus `/orthanc` for the local OHIF viewer at `/imaging`.

The frontend never substitutes a different PACS for an absent or unmatched public
mapping. OHIF buttons are disabled for configurations that do not map to the
Orthanc served by that viewer. Explorer and Orthanc preview links use the explicit
proxy of the selected study. Local instance preview uses the authenticated
`/openmrs/ws/rest/v1/imaging/previewinstance` API, preserving a different OpenMRS context when configured.

Connection credentials remain on the server. This app does not distribute
Orthanc credentials or perform infrastructure deployment. The backend owns server
configuration; the unused starter greeting configuration has been removed.

## Upload and recovery contract

Only non-empty **`.dcm` files** are accepted, with a maximum of 200 MB per file.
Server and proxy limits may be lower and must be aligned operationally. Selected
files are controlled by the workspace, so successive selections and removals
match exactly what will be sent.

Each file is uploaded sequentially to `POST imaging/instances`, with
`configurationId`, `patient` and multipart `file`. A successful patient upload
must return a `DicomStudyResponse` with a positive study ID, StudyInstanceUID, the
requested patient UUID and the selected configuration ID. An HTTP 200 without
that association is not a confirmed upload.

**ZIP upload is unavailable.** Imaging 1.2.8 can store a ZIP's instances in Orthanc
and then fail to associate them, because its upload implementation expects one
`ParentStudy` object. The frontend rejects archive extensions before sending them; the filename is not proof of DICOM content. Backend
hardening prepared alongside this change is not a deployed artifact; server-side
archive rejection, ownership checks and transport limits require its own release.

If a batch stops, confirmed files and the uncertain file are removed from the
send queue. The message identifies the uncertain file and asks the operator to
check it before selecting it again. Files not yet attempted remain available.
There is no automatic retry or destructive rollback. A successful upload followed
by a failed refresh is reported separately and does not offer the same file for
resubmission. Closing/changing patient aborts pending browser requests and ignores
late callbacks; aborting does not undo a write already accepted by the server.
For the same patient, losing connectivity or changing the session still reconciles
attempted files out of the upload queue before another submission is possible.
Changing the patient discards that queue entirely.

## Patient association and worklists

- Candidate matching scores are decision support, not patient ownership.
  Associations are not written optimistically into shared SWR objects. Each write
  is serialized and confirmed through a fresh candidate read before showing success.
- A study already assigned to another patient must be reviewed and explicitly
  unlinked in the original chart before assignment here. Backend authorization
  and ownership enforcement remain authoritative.
- Sorted/expanded tables resolve studies and procedure requests by stable IDs,
  preserving their patient/resource context across sorting and pagination. When
  a collection shrinks, the framework paginator moves to an existing page; changing
  a filter returns to page one.
- Future procedure dates are allowed. `stepStartDate` uses DICOM DA `yyyyMMdd`,
  `stepStartTime` uses TM `HHmmss`, AET values are at most 16 printable ASCII
  characters, and generated accession numbers fit DICOM SH's 16-character limit.
  Physician and description fields allow at most 64 characters; optional station
  and procedure location fields allow 16. Inputs are rejected rather than truncated.
- A procedure workspace rejects a request belonging to a different patient.
  These are imaging-module worklists, not OpenMRS encounter/order creation; the
  existing backend patient/request relationship remains the write contract.
- Worklist completion through Orthanc callbacks requires separately configured
  and validated infrastructure. It is not established by saving a frontend request.

Reading studies, series, instances or steps distinguishes loading, empty and error
states. Metadata reads request fresh network data; imaging writes are not queued
for offline replay. User errors are translated and do not expose backend messages.

## Permissions

Patient-chart reading requires `app:hoja.clinica.imagenes`; write workspaces and
confirmation modals declare `app:hoja.clinica.imagenes.editar`. The framework
checks these registrations when launching an entry point. Write controls also
require an authenticated editing session and network connectivity. Pending browser
operations are aborted when the user, permissions or connectivity change; already
accepted server writes still require reconciliation. Read-only users can open
images online, and offline viewer controls are disabled. Server-side privileges
are separate and must be assigned and tested for the intended role:

| Operation | Backend privilege |
| --- | --- |
| Read images | `Task: View Image Data` |
| Upload | `Task: Upload Image Data` |
| Associate/synchronize | `Task: Link Image Studies` |
| Modify | `Task: Modify Image Data` |
| Delete image data | `Task: Delete Image Data` |
| Edit worklist | `Task: Edit Worklist` |
| Receive Orthanc callback | `Task: Receive Orthanc Updates` |

## Validation and remaining operational gates

Regression tests have been written for upload acknowledgement/partial failure, queue selections,
failed revalidation, stale callbacks and duplicate writes, sorted request identity,
expanded study configuration, failed-delete recovery, malformed comparison data,
DICOM values, proxy mapping and read-error states. The package scripts are `test`,
`lint`, `typescript` and `build`; relevant repository route/error contracts and
consumer checks apply as documented in CONTRIBUTING.

**Validation of this changed implementation has NOT RUN:** the user explicitly
requested no local tests. No typecheck, lint, build, browser or remote test has
been executed for this diff. Earlier tests of the original code are not evidence
for these changes. Synthetic DEV/QLTY acceptance remains required before calling
this integration operational.

The [legacy imaging E2E suite](../../../e2e/patient-imaging/README.md) is explicitly
quarantined before authentication/fixture creation. Its unsafe global cleanup is
retired. A target-bound synthetic DICOM journal with verified cleanup must replace
the old fixtures before enabling it. No production or real-patient testing is allowed.

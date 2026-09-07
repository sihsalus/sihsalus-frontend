# openmrs-esm-emr-api

openmrs-esm-emr-api exports functions that reflect shared EMR concerns. Things here are separated out from emr-api
to remove circular dependencies within the framewok.

See the [Retrieving and posting data](https://o3-docs.openmrs.org/docs/recipes/retrieve-and-post-data)
page of the Developer Documentation.

Attachment creation accepts an optional `AbortSignal`. Long-running or session-bound flows must pass their active
signal so logout, account change, navigation, or explicit cancellation can stop the upload request.

Callers that associate a document with a clinical record may also pass an `AttachmentUploadContext` containing a
persisted encounter UUID plus a deterministic form-field namespace and path. The patient UUID, encounter UUID, and
form-field metadata must be validated by the owning workflow; omitting the context preserves the existing
patient-level attachment behavior.

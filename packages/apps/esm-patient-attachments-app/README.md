# esm-patient-attachments-app

The attachments widget. It shows a gallery of attachments uploaded for the patient as well as a file uploader for uploading new attachments.

## Required upload allowlist

Before enabling uploads, configure the OpenMRS global property
`attachments.allowedFileExtensions` with a non-empty, comma-separated
allowlist, for example:

```text
pdf,jpg,jpeg,png
```

The frontend deliberately disables file and camera uploads when this property
is missing, empty, unavailable, or contains no valid extensions. Values are
normalized to lowercase alphanumeric extensions; wildcards and malformed
values are rejected. Camera capture requires `png` in the allowlist.

This browser-side check is defense in depth. The attachments backend remains
responsible for enforcing the same allowlist and validating the uploaded
content rather than trusting the filename or browser MIME type. PDF previews
are rendered in a fully sandboxed iframe with no referrer information.

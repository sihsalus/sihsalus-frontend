# Clinical flow verification scripts

These scripts exercise state-changing workflows against an explicit OpenMRS
environment. Use only synthetic patients and test appointments.

## Credentials and target environment

Credentials are mandatory and must be provided through environment variables.
Do not commit passwords or production patient data.

```sh
export E2E_BASE_URL="https://example.test/openmrs/spa"
export E2E_USERNAME="..."
export E2E_PASSWORD="..."
export E2E_IGNORE_HTTPS_ERRORS="true"
```

`E2E_IGNORE_HTTPS_ERRORS` is only appropriate for controlled environments
using a self-signed certificate.

## Verify patient registration

```sh
node e2e/scripts/create-patient-registration-full-info.mjs
```

The script creates a synthetic patient through the UI, reports form and API
errors, and fails if the patient cannot be found after submission.

## Verify appointment arrival and queue persistence

The target appointment must be scheduled and must have one configured
service–UPSS arrival route.

```sh
export E2E_PATIENT_UUID="..."
export E2E_PATIENT_NAME="Synthetic Patient"
export E2E_APPOINTMENT_UUID="..."
export E2E_QUEUE_UUID="..."
export E2E_LOCATION_UUID="..."
export E2E_VISIT_TYPE_UUID="..."
node e2e/scripts/verify-appointment-arrival-queue.mjs
```

The script verifies all four persisted outcomes:

1. the appointment changes to `CheckedIn`;
2. an active visit exists in the required UPSS and visit type;
3. the visit contains the appointment correlation attribute;
4. an active queue entry links the configured queue and visit.

Override `E2E_APPOINTMENT_VISIT_ATTRIBUTE_TYPE_UUID` only when the target
environment uses a nonstandard appointment correlation attribute type.

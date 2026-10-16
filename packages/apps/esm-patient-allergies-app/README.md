# esm-patient-allergies-app

The allergies widget. It provides a tabular overview of the allergies recorded for a patient as well as a form for recording allergies.

## Read contract

`useAllergies` reads `patient/:uuid/allergy?v=full` from OpenMRS REST and waits
for every page before exposing the list. An incomplete page sequence or HTTP
204 (allergy status unknown) is reported as an error; neither means that the
patient has no known allergies. The chart route protects the allergies section
with `app:hoja.clinica.alergias`.

The clinical search still needs a separate allergies provider, exact-record
navigation, and synthetic DEV/QLTY acceptance before its flag can be enabled.
Check pagination with more than one page, missing or repeated pages, unknown
status, and a restricted role using synthetic patients only.

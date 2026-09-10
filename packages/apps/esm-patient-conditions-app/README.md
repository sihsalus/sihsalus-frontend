# esm-patient-conditions-app

The conditions widget. It provides a tabular overview of the conditions recorded for a patient as well as a form for recording new conditions.

The history reader tolerates missing optional FHIR coding arrays. When a coded display is unavailable, it shows the recorded `code.text`, or `--` if neither is present, without crashing the patient dashboard. It does not infer a concept UUID or clinical status from free text; existing form validation and permissions still govern writes.

## Consulta Externa consumer

`conditions-details-widget` also supplies `consulta-externa-antecedents-slot`, owned by
`@sihsalus/esm-atencion-ambulatoria-app`. It reuses the same tables, FHIR Condition
reader and Workspace2 forms as **Antecedentes y problemas** at `/chart/Antecedentes`.
The independent dashboard keeps its original `patient-chart-conditions-dashboard-slot`;
separate slot names preserve each module's registration and configuration ownership.

The consumer passes the current FHIR `patient` and matching `patientUuid` in slot
state. The extension requires `app:hoja.clinica.condiciones`; registering, editing or
removing a condition additionally requires `app:hoja.clinica.condiciones.editar`.
Consulta Externa permissions do not substitute for those privileges. The existing
FHIR2 `>=2.8.0`, REST, concept configuration and backend authorization requirements
apply to both entry points.

New antecedents remain Condition records. Historical encounter observations are not
converted, rewritten or used as a separate destination for the same form submission.
Validate the shared view and form entry from both pages, denied read/edit access,
patient changes and the consumer's unavailable-extension state. Saving and reloading
in both pages still requires a smoke test with synthetic data in coordinated QLTY.

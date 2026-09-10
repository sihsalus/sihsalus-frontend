# esm-patient-conditions-app

The conditions widget. It provides a tabular overview of the conditions recorded for a patient as well as a form for recording new conditions.

The history reader accepts optional REST descriptions and dates without inventing a
concept, date or clinical status. The recorded concept synonym takes precedence
when available; a native non-coded description is also supported. Missing text is
shown as `--`, while malformed responses produce an error.

## Longitudinal history contract

The data contract lives in `@openmrs/esm-patient-common-lib/src/antecedents` and is
also consumed by the concept-set views in Consulta Externa, CRED and Salud Materna.
Reads follow every REST page with `patientUuid`, `includeInactive=true` and `v=full`.
A failed or malformed page is an error, never an empty or complete history. This
API preserves all six supported clinical statuses; the configured FHIR2 translator
would collapse recurrence, relapse, remission and resolved to inactive.

An edit requires the original resource from the current patient's history and a
matching fresh read. REST corrections use OpenMRS's versioned ConditionService:
the previous revision retains its original author/date, while the new revision is
attributed to the authenticated editor. The form submits only changed clinical
fields, never creator, registration date or verification status during a correction.
Unchanged dates retain their precision and timezone. Existing dates can be corrected;
the form requires a replacement and does not offer date removal.

An explicitly non-coded antecedent uses native `condition.nonCoded`. It does not
create a diagnosis code or use a question/text concept as a placeholder. Historical
records without a supported coded or narrative description remain readable but
cannot be edited as though they had a valid representation.

Saving and refreshing are separate outcomes. A confirmed write is never retried
because its subsequent refresh failed. The complete refresh also covers a newly
introduced page and a backend that replaces the original condition UUID.

Clinical meaning, content provenance, official references and backend limitations
are documented in [the antecedents data contract](../../../docs/clinical/antecedents-data-contract.md).
This frontend change does not establish auditable amendment reasons or concurrent
write protection in the backend; those remain acceptance requirements in DEV/QLTY.

## Consulta Externa consumer

`conditions-details-widget` also supplies `consulta-externa-antecedents-slot`, owned by
`@sihsalus/esm-atencion-ambulatoria-app`. It reuses the same tables, REST Condition
reader and Workspace2 forms as **Antecedentes y problemas** at `/chart/Antecedentes`.
The independent dashboard keeps its original `patient-chart-conditions-dashboard-slot`;
separate slot names preserve each module's registration and configuration ownership.

The consumer passes the current FHIR `patient` and matching `patientUuid` in slot
state. The extension requires `app:hoja.clinica.condiciones`; registering, editing or
removing a condition additionally requires `app:hoja.clinica.condiciones.editar`.
Consulta Externa permissions do not substitute for those privileges. The REST Condition API, concept configuration and backend authorization requirements
apply to both entry points. The audited distribution pins OpenMRS core 2.8.9 and
REST 3.5.0; see the shared contract for exact source references.

New antecedents remain Condition records. Historical encounter observations are not
converted, rewritten or used as a separate destination for the same form submission.
Validate the shared view and form entry from both pages, denied read/edit access,
patient changes and the consumer's unavailable-extension state. Saving and reloading
in both pages still requires a smoke test with synthetic data in coordinated QLTY.

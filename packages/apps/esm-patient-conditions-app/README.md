# esm-patient-conditions-app

The conditions widget. It provides a tabular overview of the conditions recorded for a patient as well as a form for recording new conditions.

The history reader tolerates missing optional FHIR coding arrays. When a coded display is unavailable, it shows the recorded `code.text`, or `--` if neither is present, without crashing the patient dashboard. It does not infer a concept UUID or clinical status from free text; existing form validation and permissions still govern writes.

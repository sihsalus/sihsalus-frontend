# esm-patient-programs-app

The programs widget. It provides a tabular overview of the programs a patient is enrolled into as well as a form for enrolling the patient into new programs.

## Program eligibility

The enrollment selector supports `programEligibilityRules` in module config. Each rule targets a `programUuid` and can define optional `minAgeYears`, `maxAgeYears`, and `genders`.

Programs without a rule remain visible. Current SIH Salus defaults keep Tuberculosis and VIH/SIDA visible for all patients, show Adulto Mayor for patients who are at least 60 years old, show Control de Niño Sano and Programa de Vacunación Infantil for children, and show pregnancy-related programs only for female patients in the configured age range.

This is a frontend guard for UX. The backend/content package should eventually expose eligibility metadata per program so all clients share the same rules.

## Program navigation

The program tables support `programNavigationTargets` in module config. Each target maps a `programUuid` to a patient chart `chartPath` and renders an "Ir a" / "Go to" link for active or historical enrollments.

The link only appears when a target is configured. This keeps generic programs such as Tuberculosis or VIH/SIDA visible without inventing module routes that do not exist yet.

# esm-patient-programs-app

The programs widget. It provides a tabular overview of the programs a patient is enrolled into as well as a form for enrolling the patient into new programs.

## Program eligibility

The enrollment selector supports `programEligibilityRules` in module config. Each rule targets a `programUuid` and can define optional `minAgeYears`, `maxAgeYears`, and `genders`.

Programs without a rule remain visible. Current SIH Salus defaults keep Tuberculosis and VIH/SIDA visible for all patients, show Adulto Mayor for patients who are at least 60 years old, show Control de Niño Sano and Programa de Vacunación Infantil for children, and show pregnancy-related programs only for female patients in the configured age range.

Age rules use completed years, so a maximum age of 11 includes the day before the twelfth birthday. A valid birth date after the reference day is unavailable for age-based eligibility, even when an age fallback exists. Missing or invalid birth dates retain the finite, non-negative age fallback; a birth on the reference day remains eligible. Programs without age rules keep their existing behavior.

This is a frontend guard for UX. The backend/content package should eventually expose eligibility metadata per program so all clients share the same rules.

## Program navigation

The program tables support `programNavigationTargets` in module config. Each target maps a `programUuid` to a patient chart `chartPath` and renders an "Ir a" / "Go to" link. An enrollment with `dateCompleted` uses the optional `historicalChartPath`; if it is not configured, the link keeps using `chartPath`.

The Control de Niño Sano and Madre Gestante defaults open the integrated CRED and Gestantes screens for active enrollments. Completed enrollments retain their previous chart screens so recorded care remains accessible when the active-program entry is unavailable. Vaccination and family-planning destinations are unchanged.

The link only appears when a target is configured. This keeps generic programs such as Tuberculosis or VIH/SIDA visible without inventing module routes that do not exist yet.

## Editing enrollment records

An editing workspace waits for the patient's enrollment record before showing dates or allowing Save. React Hook Form's reactive values populate the existing program, enrollment date, completion date and status when the request resolves; refreshing the record preserves fields the user is editing. Changing the patient or enrollment resets the form so edited fields cannot carry into another record. A missing enrollment shows an unavailable message and cannot fall through to creating a new enrollment.

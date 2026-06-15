# esm-patient-programs-app

The programs widget. It provides a tabular overview of the programs a patient is enrolled into as well as a form for enrolling the patient into new programs.

## Program eligibility

The enrollment selector supports `programEligibilityRules` in module config. Each rule targets a `programUuid` and can define optional `minAgeYears`, `maxAgeYears`, and `genders`.

Programs without a rule remain visible. Current SIH Salus defaults keep Tuberculosis and VIH/SIDA visible for all patients and only show Adulto Mayor for patients who are at least 60 years old.

This is a frontend guard for UX. The backend/content package should eventually expose eligibility metadata per program so all clients share the same rules.

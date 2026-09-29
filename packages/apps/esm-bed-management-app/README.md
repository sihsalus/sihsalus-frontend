# Bed Management App

A frontend module for managing beds in a facility. It allows creating
wards and beds in those wards. It does not provide any functionality
related to patients, such as assigning patients to beds.

Requires [openmrs-module-bedmanagement](https://github.com/openmrs/openmrs-module-bedmanagement)
to be installed on the OpenMRS server.

## Local regression tests

`src/bed-administration/bed-administration-table.test.tsx` adapts the
[OpenMRS table tests](https://github.com/openmrs/openmrs-esm-patient-management/blob/df9d1478f6786ca65541f1a6b6ffdb91f8223fb2/packages/esm-bed-management-app/src/bed-administration/bed-administration-table.test.tsx)
under MPL-2.0. It covers loading, fetch errors, empty results, occupancy filters,
bed/location rendering, refresh state and pagination across real rows.

This fork opens `NewBedForm`/`EditBedForm` modals instead of upstream Workspace v2.
Tests verify the modal selection and selected bed with those form boundaries
mocked; they do not claim to validate saving a bed. The table and Carbon controls
are rendered normally. Fixtures are synthetic and no backend is contacted.

```sh
yarn workspace @sihsalus/esm-bed-management-app test
yarn workspace @sihsalus/esm-bed-management-app typescript
yarn workspace @sihsalus/esm-bed-management-app lint
yarn workspace @sihsalus/esm-bed-management-app build
```

The test script now fails if no tests are discovered. Backend persistence and
patient admission/transfer remain separate acceptance checks against coordinated
DEV/QLTY; they are not established by these component tests.

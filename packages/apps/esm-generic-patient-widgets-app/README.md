# esm-generic-patient-widgets-app

This is a proof-of-concept for a generic widget that can be added to the patient chart using configuration. It can be made to display any obs in either a tabular view or a chart view. It's intended as a pathway to creating reusable widgets across the application.

## Development

From the root of the project, run:

```bash
yarn run --sources 'packages/esm-generic-patient-widgets-app'
```

This should fire up a development server on port `8081`. You can use `--port` to specify an alternative port.

## Observation rendering contract

The widget reads FHIR observations through `useObs`, using the configured concept
and encounter-type filters. Encounter references are optional: observations
without one remain visible in separate table rows, and missing encounter names
use the table's existing empty-cell display. Adding a display name to an
observation must not mutate the original FHIR resource in the SWR cache. This is
a read-only rendering contract; these widgets do not persist observations.

## Recovered upstream tests

The `obs-switchable` and `resources/useObs` tests adapt cases from
[OpenMRS patient-chart at 54e48e8](https://github.com/openmrs/openmrs-esm-patient-chart/tree/54e48e8f97ee116b97829f2b9df66c699d27dd4d/packages/esm-generic-patient-widgets-app/src)
under MPL-2.0. The local hook returns a flat observation array and labels numeric
data as `Number`, while the upstream tests expect a nested response and `Numeric`.
This fork renders one selected concept graph; multi-graph and horizontal editing
tests were not imported because those implementations are absent here.

The adapted cases exercise real table rendering, table/graph switching, graph
defaults/order, text-only data, loading/empty/error states, observations without
encounters and cache immutability. The hook tests use an isolated SWR cache and a
mocked fetcher; the graph tests replace only the external chart renderer and data
hook. All fixtures are synthetic. The absent-encounter and cache-mutation cases
failed against the previous implementation before the corresponding fixes.

```sh
yarn workspace @sihsalus/esm-generic-patient-widgets-app test
yarn workspace @sihsalus/esm-generic-patient-widgets-app typescript
yarn workspace @sihsalus/esm-generic-patient-widgets-app lint
yarn workspace @sihsalus/esm-generic-patient-widgets-app build
```

The test script now fails when no tests are discovered. These tests do not verify
deployed FHIR content, clinical interpretation or browser integration against a
real backend. Coordinated synthetic DEV/QLTY acceptance remains separate.

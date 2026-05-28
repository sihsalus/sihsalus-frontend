# esm-patient-registration-app

## Configuring the Registration App to collect custom observations

[PR-221](https://github.com/openmrs/openmrs-esm-patient-management/pull/221) made it possible to configure the registration app to include obs, as demoed in the gif video below, using fieldDefinitions:

![Peek 2022-07-13 15-14](https://user-images.githubusercontent.com/1031876/178846444-ac4da88a-073f-4ed2-bf00-a07cf3ab6d2f.gif)

## Resource loading behavior

Patient registration depends on metadata loaded at runtime: address template, relationship types, and patient identifier types.

- New registrations must wait for patient identifier types before submission, because the form cannot safely create the required identifiers without that metadata.
- Editing an existing patient may continue when identifier types are temporarily unavailable, as long as the form already has existing identifiers. The existing identifiers remain visible, but adding or changing identifier types is disabled until the metadata loads.
- Relationship controls are shown only after relationship types are available. If they cannot be loaded, the section shows an error state instead of an endless skeleton so the rest of the edit flow can still be used.
- Address quick search is rendered only after the address template is available. This prevents a search-only address section where the user can find an address but cannot see or edit the address fields.

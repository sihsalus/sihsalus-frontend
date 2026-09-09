# @sihsalus/esm-epidemiological-surveillance

Starter OpenMRS 3 microfrontend for SIH Salus epidemiological surveillance.

This package intentionally contains only the basic OpenMRS ESM structure:

- startup/config registration
- one dashboard route
- one homepage dashboard link extension
- translations in English and Spanish
- a starter regression test

It does not define clinical forms, backend endpoints, concepts, workspaces,
modals, or patient chart actions yet. Add those contracts explicitly when the
module scope is defined.

## Local Development

```sh
yarn workspace @sihsalus/esm-epidemiological-surveillance start
yarn workspace @sihsalus/esm-epidemiological-surveillance build
```

## Validation

```sh
yarn workspace @sihsalus/esm-epidemiological-surveillance lint
yarn workspace @sihsalus/esm-epidemiological-surveillance typescript
yarn workspace @sihsalus/esm-epidemiological-surveillance test
```

## Backend And Content

No backend or content dependency is currently implemented beyond the baseline
OpenMRS REST webservices dependency declared in `src/routes.json`.

Before adding functional surveillance workflows, document required OMODs,
REST/FHIR endpoints, concepts, encounter types, forms, privileges, fallback
behavior, and synthetic QA coverage here.

# Frontend clinical domains

This repository separates frontend modules by clinical responsibility, not only by disease name.

## Domain rules

- Use `esm-tamizajes-app` for cross-cutting screening workflows and initial screening results.
- Use `esm-seguimiento-casos-app` for longitudinal case follow-up workflows.
- Use specialized apps for care domains that are clinical services by themselves, such as psychology, dentistry, vaccination, or physical therapy.
- Create disease-specific apps only when the disease has a complete normative workflow that is larger than screening or generic follow-up.
- Use epidemiology/vigilance terminology only for notification, outbreak, investigation, and surveillance workflows, not for ordinary clinical follow-up screens.
- Clinical vocabulary and backend identifiers must be configurable. Do not introduce new clinical concept, form, encounter type, order type, location, provider, or attribute UUIDs directly in components, hooks, resources, or shared libraries.
- Put deployment defaults in the owning app's `config-schema.ts`, or resolve them from content/backend metadata. Components and hooks should receive those values through config or typed arguments.
- Shared libraries may define types, mappers, and protocol-level constants, but they must not own deployment-specific clinical UUID defaults.
- Delete unused clinical maps instead of keeping future hardcoded placeholders.

## Current apps

### `@sihsalus/esm-seguimiento-casos-app`

Covers longitudinal follow-up in the first level of care:

- case owner / follow-up responsible person
- active and closed follow-ups
- follow-up encounters
- missed-visit follow-up
- configurable follow-up forms

It can track VIH, TB, diabetes, hypertension, metaxenic diseases, or other prioritized conditions when the workflow is a longitudinal follow-up case. The app should not own screening-only flows or specialized care services.

### `@sihsalus/esm-tamizajes-app`

Covers transversal screening workflows:

- HIV/HTS screening and initial result review
- future TB screening
- future diabetes or cardiovascular-risk screening
- future anemia, mental health, syphilis, hepatitis B, or other initial screenings

A positive or clinically relevant screening can later create or feed a follow-up case, but the screening workflow itself belongs here.

### `@sihsalus/esm-terapia-fisica-app`

Covers physical therapy and rehabilitation as a specialized care service:

- functional assessment
- physical therapy encounters
- rehabilitation plan follow-up inside the therapy service

It should not live under VIH or generic case follow-up.

## Deferred apps

Do not create these until their workflows are explicit enough:

- `esm-vih-its-app`: only if VIH/ITS includes confirmatory workflows, TAR linkage, TAR follow-up, PEP/PrEP, or ITS care beyond screening.
- `esm-tb-app`: only if TB includes DOT, bacteriology follow-up, contact control, treatment phases, abandonment, or TB/VIH comorbidity workflows.
- `esm-cronicas-app`: only if diabetes/HTA/renal disease need their own clinical control dashboards beyond generic follow-up.
- `esm-vigilancia-epidemiologica-app`: only for notification, epidemiological investigation, outbreaks, metaxenic surveillance, and reporting workflows.

## TODO: normative alignment with MINSA Peru

- TODO(NTS): Confirm the official terminology for "seguimiento de casos" against the applicable MINSA technical standards for first-level care before final user-facing labels are frozen.
- TODO(NTS): Map each screening workflow in `esm-tamizajes-app` to its governing NTS, directive, or clinical guideline, including VIH/ITS, TB, diabetes, cardiovascular risk, anemia, mental health, and maternal screenings.
- TODO(NTS): Define when a positive or high-risk screening must create a longitudinal case in `esm-seguimiento-casos-app`, and document the normative trigger for each condition.
- TODO(NTS): Validate whether TB requires a standalone `esm-tb-app` based on DOT, bacteriological follow-up, contact control, treatment phase tracking, and loss-to-follow-up requirements.
- TODO(NTS): Validate whether VIH/ITS requires a standalone `esm-vih-its-app` based on confirmatory testing, linkage to TAR, TAR follow-up, PEP/PrEP, ITS care, and reporting requirements.
- TODO(NTS): Validate whether diabetes and HTA should remain configurable follow-up cases or move to `esm-cronicas-app` when periodic control, targets, complications, and chronic treatment workflows are implemented.
- TODO(NTS): Separate epidemiological surveillance workflows from clinical follow-up workflows before creating any `esm-vigilancia-epidemiologica-app` screens.
- TODO(NTS): Review metaxenic disease workflows with the epidemiology team to decide whether they belong to screening, case follow-up, or epidemiological surveillance.
- TODO(NTS): Replace placeholder labels such as "Planificado" in Home screens with condition-specific labels once the corresponding normative flow is implemented.
- TODO(NTS): Add traceability comments or documentation links for every default form UUID and encounter type UUID used by screening and follow-up modules.

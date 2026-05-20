# SIH Salus frontend master plan

## Goal

Build a reliable clinical frontend baseline for SIH Salus, reducing ad-hoc fixes and moving critical workflows toward explicit contracts, testable forms, and stable workspaces.

## Current baseline

- Patient chart workspaces can open from the pre-assembled SPA.
- The SPA package builds and validates with `yarn package:spa` after typing the shared `esm-state` store registry.
- Remaining duplicate-store console warnings are known technical debt, not a current blocker for opening workspaces.
- Clinical form coverage and backend contracts are uneven across modules.

## Engineering principles

- Prefer reliable contracts over pragmatic patches.
- Avoid mock-only flows for clinical data that should come from backend state.
- Migrate by vertical slices: UI, form, concepts, backend contract, tests, and smoke validation together.
- Keep legacy workspace support only where required; new or actively refactored flows should target Workspace2.
- Every clinical workflow should define its source of truth: global patient chart state, backend REST/FHIR, form state, session/provider metadata, or config.

## Target architecture

### Workspaces

- Use Workspace2 for new or actively migrated workspaces.
- Keep legacy workspace adapters only for compatibility with existing OpenMRS widgets.
- Document each workspace name, owning app, launch path, required props, and whether it is legacy or Workspace2.
- Add smoke coverage for high-risk launchers: vitals, conditions, allergies, visit notes, orders, clinical forms, appointments, and mark deceased.

### Forms

- Treat `sihsalus-content` as the source repository for clinical form content.
- Keep form definitions aligned with frontend launchers and backend concepts.
- Avoid hidden required clinical fields unless they are explicitly populated from global state or backend metadata.
- For each form, document concepts, encounter type, visit dependency, provider metadata, and save destination.

### State and backend contracts

- Patient chart global state should provide patient, patientUuid, active visit, visit mutation hook, and patient context needed by workspaces.
- Backend should provide durable clinical facts, patient flags, visit metadata, provider identity, and printed-document metadata.
- Provider signature, stamp, and colegiatura should resolve from provider/session metadata, not manual duplicate fields unless regulations require explicit confirmation.

### Validation

- Local validation tiers:
  - Package build for touched apps/libs.
  - Unit tests for changed logic.
  - `yarn package:spa` before integration branches.
  - Playwright smoke for critical clinical flows.
- CI validation must stay green before merging any slice.

## Clinical inventory workstreams

### CRED

- Review compliance against Peruvian technical norm.
- Confirm required forms in `sihsalus-content`.
- Validate visit notes capture all required CRED process data.
- Ensure data that belongs to patient/global state is prefilled instead of manually duplicated.
- Identify missing concepts and backend endpoints.

### Madre gestante

- Verify required prenatal workflows and forms.
- Add or update tests around maternal forms and summaries.
- Confirm risk flags, obstetric history, provider metadata, and visit summaries are represented.

### Nino sano

- Map forms and workflows against current child health requirements.
- Identify overlap with CRED and avoid duplicated forms where one structured form can serve both.

### Visit notes and consultation summary

- Visit notes are critical clinical records.
- Diagnosis summary must show status/type clearly, for example presumptive, confirmed, chronic, or ruled out depending on the configured clinical vocabulary.
- Consultation summary should render saved backend data, not mock data.
- Text display should be resilient to long diagnosis names and metadata labels.

### Triage and vitals

- Keep vitals launcher reliable in patient chart and active visit contexts.
- Use active visit from patient chart global state as fallback when widget-local visit context is missing.
- Add smoke coverage for opening and saving vitals when backend concepts are available.

### Patient banner

- Remove redundant information.
- Add missing patient facts that are captured and clinically useful.
- Define which values come from patient resource, identifiers, attributes, active visit, queue state, or programs.

### Patient flags

- Define what flags should display: clinical risks, administrative blockers, care-program alerts, follow-up alerts, and safety warnings.
- Confirm backend support for creating, querying, and resolving flags.
- Add frontend creation and display flows only after backend contract is clear.

## Technical debt backlog

- Resolve duplicate global store registration warnings.
- Finish Workspace2 migration plan and deprecate legacy adapters by module.
- Replace unmaintained or vulnerable libraries, including `xlsx`, with maintained alternatives.
- Continue reducing CodeQL reliability warnings.
- Harden TypeScript and Biome gradually without blocking clinical delivery.
- Remove dead config keys and stale local dev assumptions.
- Standardize patient chart sidebar navigation behavior.

## Execution phases

### Phase 0: Baseline

Exit criteria:

- `main` is pulled and a new branch is created from current `origin/main`.
- `yarn install --immutable` passes.
- `yarn package:spa` passes.
- Critical workspace smoke passes for vitals.
- No uncommitted changes remain except intentional next-slice work.

### Phase 1: Inventory

Exit criteria:

- Module inventory exists for CRED, madre gestante, nino sano, visit notes, triaje, patient banner, and patient flags.
- Form inventory exists for `sihsalus-content` with missing forms listed.
- Backend TODO list exists with endpoints, concepts, and metadata requirements.

### Phase 2: CRED slice

Exit criteria:

- CRED process gaps are documented against the norm.
- Missing content forms are added or updated.
- Visit notes are updated to capture required CRED data.
- Tests and smoke validations cover the changed flows.

### Phase 3: Maternal and child health slice

Exit criteria:

- Madre gestante and nino sano forms are aligned with required workflows.
- Shared concepts and form sections are reused where safe.
- Tests cover maternal and child health changes.

### Phase 4: Workspace and state migration

Exit criteria:

- High-risk patient chart workspaces have clear Workspace2 or legacy adapter ownership.
- Launch behavior is consistent from sidebar, widgets, and summary cards.
- Duplicate store warnings are eliminated or reduced to known harmless cases with documentation.

### Phase 5: Backend contract hardening

Exit criteria:

- Patient flags creation and display flow is backed by real backend APIs.
- Provider metadata is available for clinical document signatures.
- Missing concepts are added to content/backend and referenced by frontend config.

## Immediate next steps

1. Commit and push this baseline plan.
2. Inventory `sihsalus-content` forms for CRED, madre gestante, and nino sano.
3. Create a CRED compliance checklist from the Peruvian technical norm.
4. Start with visit notes because it is the most important clinical record dependency.

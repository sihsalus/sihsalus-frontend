# SIH Salus Frontend Web — Documentation

This directory contains architecture documentation and decision records for the SIH Salus frontend monorepo.

## Contents

- `adrs/` — Architecture Decision Records
- `forms/` — Form stack migration and ownership docs
- `operations/` — Repository operations and maintainer runbooks
- `operations/dependency-bots.md` — Renovate and Dependabot setup, ownership, and verification guide
- `operations/monorepo-discipline-rfc.md` — Repo discipline policy for TypeScript, tests, fixtures, and merge criteria
- `operations/manual-usuario-consulta-externa-nino-sano-madre-gestante.md` — Manual de usuario para Consulta Externa, paquetes complementarios, Niño Sano y Madre Gestante
- `operations/workspace-quality-registry.md` — Package ownership, test model, and warning budget registry
- `operations/week-1-tsconfig-inventory.md` — Week 1 inventory of `tsconfig` patterns across apps and libs

## Architecture Overview

SIH Salus is a Hospital Information System built as a **Turborepo monorepo** with **single-spa** microfrontend architecture on top of **OpenMRS 3.x**, using **Rspack** as the bundler.

### Key Design Decisions

- **Framework as dependency**: The OpenMRS framework (`@openmrs/esm-framework`) and app shell (`@openmrs/esm-app-shell`) are consumed as npm packages, not vendored. This simplifies upgrades and reduces maintenance burden.
- **Yarn Berry with node-modules linker**: PnP is disabled (`nodeLinker: node-modules`) for compatibility with the OpenMRS toolchain and Rspack Module Federation.
- **Import map overrides**: SIH Salus modules (`@sihsalus/*`) override their upstream OpenMRS counterparts at runtime via the import map, allowing customization without forking.
- **Offline-first**: Service worker caching and a sync queue (`esm-dyaku-app`) ensure the app works in low-connectivity environments (satellite link, 3G).
- **Rspack over Webpack**: All app bundles use Rspack for faster build times; the shared config lives in `packages/tooling/rspack-config/`.

### Package Organization

| Directory                    | Contents                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/apps/`             | 57 frontend ESM modules (upstream forks + SIH Salus custom)                                        |
| `packages/libs/`             | 5 shared libraries (RBAC, audit logger, shared UI, patient-common-lib, styleguide)                 |
| `packages/tooling/`          | Build scripts and local dev tooling (import map assembly, dev server, i18n parser)                 |
| `packages/__mocks__/`        | Shared Jest mocks                                                                                  |
| `packages/declarations.d.ts` | Global TypeScript declarations                                                                     |
| `packages/jest.config.js`    | Root Jest config                                                                                   |
| `packages/tsconfig.json`     | Root TypeScript config                                                                             |
| `e2e/`                       | Playwright E2E tests                                                                               |

### Module Types

**SIH Salus overrides** — custom modules that replace upstream OpenMRS equivalents:
- `esm-patient-registration-app`
- `esm-patient-search-app`
- `esm-billing-app` (upstream removed)
- `esm-vacunacion-app` (MINSA vaccination schedule, replaces upstream `esm-patient-immunizations-app`)

**SIH Salus custom** — modules with no upstream equivalent:
- `esm-admission-app` — Libro de Atenciones (operational visit/UPS registry; not patient admission to hospitalization)
- `esm-atencion-ambulatoria-app` — Outpatient consultation (consulta externa)
- `esm-coststructure-app` — Cost structure management (MINSA tariff tables)
- `esm-cred-app` (`packages/apps/esm-crecimiento-desarrollo-app`) — CRED (control de crecimiento y desarrollo del niño, neonatal care, immunization)
- `esm-dyaku-app` — FHIR sync queue for low-connectivity remote communities
- `esm-emergency-app` — Emergency queue and triage
- `esm-ficha-familiar-app` — Family health record (Ficha Familiar)
- `esm-fua-app` — FUA (Formato Único de Atención) SIS insurance integration
- `esm-indicadores-app` — MINSA reporting indicators dashboard
- `esm-odontologia-app` (`packages/apps/esm-odontologia-app`) — Dental chart (odontogram)
- `esm-reports-app` — Clinical and administrative reports
- `esm-salud-materna-app` — Maternal health (prenatal, parto, puerperio, planificación familiar, prevención de cáncer)
- `esm-vih-app` — HIV/AIDS care and follow-up

### Data Access Strategy

- **FHIR R4** (`/ws/fhir2/R4/`) is the preferred API for all new development
- **REST** (`/ws/rest/v1/`) is used where FHIR endpoints don't exist (visits, form engine, concept dictionary, queue management, stock management, billing)
- Typed wrappers are provided by `@sihsalus/fhir-client`

### Security (HIPAA)

- `@sihsalus/esm-rbac` — Role-based access control with `<RequirePrivilege>` component and `useRequirePrivilege()` hook
- `@sihsalus/esm-audit-logger` — Client-side PHI access audit trail with offline fallback
- 15-minute session timeout with warning dialog
- Break-the-glass emergency access with clinical justification

## Contributing

See the root [README.md](../README.md) for setup instructions and development commands.

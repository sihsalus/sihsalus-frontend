# Arquitectura y organización del código

[Documentación](README.md) · [Inicio](../README.md)

## Repository Structure

```
packages/
  declarations.d.ts                     # Global declarations for TS
  tsconfig.json                         # Root TypeScript configuration
  test-utils/                           # Shared fixtures, test wrappers and stubs
  tooling/
    configs/                            # Shared Jest/Vitest/TS config helpers (including vitest-config.ts)
    openmrs/                            # CLI (openmrs develop, build, assemble)
    rspack-config/                      # Shared Rspack configuration
  apps/                                 # 66 frontend modules (esm-*-app)
  libs/
    esm-rbac/                           # @sihsalus/esm-rbac — Role-based access control
    esm-audit-logger/                   # @sihsalus/esm-audit-logger — Client-side PHI audit logging
    esm-api/                            # @openmrs/esm-api — Local API/session utilities and privilege aliases
    esm-framework/                      # @openmrs/esm-framework — local workspace fork
    esm-patient-common-lib/             # @openmrs/esm-patient-common-lib — Shared patient utilities
    esm-styleguide/                     # @openmrs/esm-styleguide — Carbon-based component library
packages/tooling/scripts/
  assemble-importmap.js                 # Import map assembly for SPA build
  start-dev.js                          # Local dev server entrypoint
  i18next-parser.config.js              # i18n extraction config
e2e/                                    # Playwright E2E tests
```

> **Note:** OpenMRS core packages are mixed: `@openmrs/esm-framework` is provided by the local workspace at `packages/libs/esm-framework`, while `@openmrs/esm-app-shell` is resolved from npm and patched through Yarn (`.yarn/patches/openmrs-esm-app-shell-npm-9.0.2-source-build.patch`).

## Architecture

- **Turborepo** orchestrates builds across 90 workspace packages with caching
- **Yarn 4 (Berry)** manages dependencies through `node_modules`, as configured in [`.yarnrc.yml`](../.yarnrc.yml). See the [configuration contracts](development/tooling-status.md).
- **single-spa** orchestrates microfrontend modules at runtime via import maps
- **Rspack** (Webpack-compatible) is the bundler; Module Federation enables shared deps
- **Carbon Design System** (v11) is the primary UI framework
- **FHIR R4** preferred for data access (`/ws/fhir2/R4/`)
- **Service worker** enables offline-first operation

## SIH Salus Module Overrides

| SIH Salus Module (`@sihsalus/*`) | Replaces Upstream (`@openmrs/*`)         |
| -------------------------------- | ---------------------------------------- |
| `esm-patient-registration-app`   | `@openmrs/esm-patient-registration-app`  |
| `esm-patient-search-app`         | `@openmrs/esm-patient-search-app`        |
| `esm-billing-app`                | `@openmrs/esm-billing-app`               |
| `esm-patient-immunizations-app`  | `@openmrs/esm-patient-immunizations-app` |

Selected custom modules with no upstream equivalent: `esm-atencion-ambulatoria-app`, `esm-care-logbook-app`, `esm-coststructure-app`, `esm-cred-app` (`packages/apps/esm-crecimiento-desarrollo-app`), `esm-dyaku-app`, `esm-emergency-app`, `esm-ficha-familiar-app`, `esm-fua-app`, `esm-indicadores-app`, `esm-interconsultas-app`, `esm-odontologia-app`, `esm-psicologia-app`, `esm-reports-app`, `esm-salud-materna-app`, `esm-seguimiento-casos-app`, `esm-tamizajes-app` and `esm-terapia-fisica-app`.

## Security and compliance direction

This repository includes frontend building blocks for security and compliance, but final compliance depends on backend configuration, infrastructure, roles, audit policy, operational procedures and deployment evidence.

- **RBAC** (`@sihsalus/esm-rbac`): Role-based access control at component and route level.
- **Audit logging** (`@sihsalus/esm-audit-logger`): PHI access event logging with offline fallback.
- **Session timeout**: configurable idle timeout with warning.
- **Break the glass**: emergency access pattern with mandatory clinical justification where enabled.
- **TLS 1.2+**: expected at the infrastructure layer.

Consulta el [índice de módulos](modules.md) para localizar cada README junto a
su código y los [contratos clínicos](clinical/README.md) antes de cambiar flujos.

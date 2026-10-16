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
  apps/                                 # 67 frontend modules (66 included in delivery)
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

> **Note:** OpenMRS core packages use version 10.0.0. `@openmrs/esm-framework` is provided by the local workspace at `packages/libs/esm-framework`, while `@openmrs/esm-app-shell` is resolved from npm and patched through Yarn (`.yarn/patches/openmrs-esm-app-shell-npm-10.0.0-source-build.patch`).

## Architecture

- **Turborepo** orchestrates builds across 91 workspace packages with caching
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

## Revisión de ablación del frontend, 2026-10-15

La comparación usa `main` de SIH Salus `c122fa48965ce973cb38900bbcd464fe28d0c977`
y el código de OpenMRS que corresponde al `gitHead` publicado de
`@openmrs/esm-framework@10.0.0`:
[`401e227eaf324ce8d2eb6332a411a6b8e5f86067`](https://github.com/openmrs/openmrs-esm-core/tree/401e227eaf324ce8d2eb6332a411a6b8e5f86067/packages/framework).
Se compararon fuentes y contratos de las 18 bibliotecas forzadas a `workspace:*`.
Todas tienen diferencias funcionales o contratos adicionales; ninguna se cambia
por npm en esta revisión. El número de archivos distintos incluye formato y no
es una medida de deuda ni demuestra por sí solo que un fork sea necesario.

| Biblioteca (`esm-`)  | Diferencia que impide una sustitución directa                                             |
| -------------------- | ----------------------------------------------------------------------------------------- |
| api                  | Aliases de privilegios y protección frente a respuestas de sesión fuera de orden.         |
| config               | Configuración de extensiones con carga diferida y estado de traducciones.                 |
| dynamic-loading      | Integración del share scope y recuperación de import maps/rutas.                          |
| emr-api              | Asociación de adjuntos a atención/campo y lectura de paciente con fuentes online/offline. |
| error-handling       | Mensajes seguros y traducidos usados por los consumidores.                                |
| expression-evaluator | Restricciones del evaluador y sus objetos globales.                                       |
| extensions           | Contratos de permisos y comportamiento de modales/workspaces.                             |
| feature-flags        | Recuperación de metadatos corruptos sin impedir el arranque.                              |
| framework            | Exportación de contratos locales para detalles de notificaciones.                         |
| globals              | Tipos de privilegios de modales/workspaces y configuración de ventanas.                   |
| navigation           | Navegación dentro del mismo origen y recuperación del historial corrupto.                 |
| offline              | Propiedad por usuario, bloqueos, checkpoints y limpieza verificada.                       |
| react-utils          | Montaje de extensiones, permisos y hooks de acceso a datos compartidos.                   |
| routes               | Propagación de privilegios, inicialización y overrides de rutas.                          |
| state                | Registro compartido de stores cuando se carga más de una copia del módulo.                |
| styleguide           | Permisos de componentes, fechas, notificaciones y presentación clínica.                   |
| translations         | Defaults y claves locales consumidos por el shell y aplicaciones.                         |
| utils                | Edad exacta, identidad, fechas, números y mensajes compartidos.                           |

Dos pruebas aisladas ejecutaron las fuentes oficiales y locales con las mismas
entradas sintéticas. Con metadatos inválidos en localStorage, `feature-flags`
oficial lanzó `SyntaxError` y la versión local inició correctamente. Al evaluar
`state` dos veces en el mismo contexto, la versión oficial creó stores separados;
la local mantuvo la misma instancia y sus actualizaciones. Son pruebas acotadas,
no aceptación clínica ni evidencia de un fallo en un ambiente desplegado.

El registro npm también publica 11.0.0, cuyo `gitHead` es
[`5473276ce7e70c460e15b43a27f500dc452e6aa4`](https://github.com/openmrs/openmrs-esm-core/tree/5473276ce7e70c460e15b43a27f500dc452e6aa4/packages/framework).
Se repitieron esas dos pruebas con sus fuentes y persistieron ambas diferencias.
No se afirma que las otras 16 bibliotecas hayan sido validadas contra 11.0.0.
Además, 11.0.0 requiere bibliotecas hermanas 11 y declara peers i18next 25 /
react-i18next 16; esta distribución usa 26 / 17. Su adopción requiere una migración
coordinada y no se incorpora como reemplazo individual en esta ablación.

Para retirar una biblioteca, primero identificar qué diferencias ya incorpora una
versión oficial compatible y ejecutar sus contratos y consumidores sobre el
sustituto. Extraer cada parche a otra biblioteca sin eliminar su necesidad solo
trasladaría el mantenimiento. Los cambios de sesión, permisos, formularios y
sincronización requieren además aceptación sintética coordinada.

Banco de Sangre permanece como prototipo privado, fuera de los import maps,
rutas y archivos de entrega. El ensamblador ya excluye workspaces privados,
aunque exista un `dist` anterior; no se agrega un selector de despliegue.
Su código y pruebas se conservan. La extracción de traducciones utiliza el CLI
mantenido descrito en [configuración del repositorio](development/tooling-status.md#extracción-de-traducciones).

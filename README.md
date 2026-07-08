# SIH Salus Frontend

Turborepo-powered monorepo for the **SIH Salus Hospital Information System** — an offline-oriented, FHIR-aware and compliance-oriented frontend serving ~30,000 inhabitants across 112 native Amazonian communities along 500+ km of the Napo River (Peru).

Built on [OpenMRS 3.x](https://openmrs.org/) with the single-spa microfrontend architecture.

This repository was developed by the **Pontificia Universidad Catolica del Peru (PUCP)** through the **Grupo de Investigacion y Desarrollo de Ingenieria de Software (GIDIS)**.

Contact: `sihsalus@pucp.edu.pe`

## Prerequisites

- **Node.js** 24 LTS
- **Yarn** 4.13.0 (via Corepack: `corepack enable && corepack prepare yarn@4.13.0 --activate`)
- **Docker** (for containerized deployment)

## Quick Start

```bash
# 1. Clonar e instalar
git clone https://github.com/sihsalus/sihsalus-frontend.git
cd sihsalus-frontend
corepack enable          # activa la versión de Yarn incluida en .yarn/releases/
nvm use                  # usa la versión definida en .nvmrc
yarn install

# 2. Configurar entorno (recomendado)
cp .env.template .env    # editar si se necesita apuntar a otro backend

# 3. Levantar el dev server
yarn clean && yarn build && yarn assemble
SIHSALUS_DEV_APPS=esm-login-app,esm-home-app yarn start
# → http://localhost:8080/openmrs/spa/

# Para usar un puerto distinto:
yarn start --port 3000
# → http://localhost:3000/openmrs/spa/
```

El dev server hace proxy de las peticiones de API al backend definido en `SIHSALUS_BACKEND_URL` (ver [.env.template](.env.template)). Si no se define, usa el backend dev por defecto y lo advierte al arrancar.

## Repository Structure

```
packages/
  declarations.d.ts                     # Global declarations for TS
  vitest.config.js                      # Root Vitest configuration
  tsconfig.json                         # Root TypeScript configuration
  test-utils/                           # Shared fixtures, test wrappers and stubs
  tooling/
    configs/                            # Shared Jest/Vitest/TS config helpers
    openmrs/                            # CLI (openmrs develop, build, assemble)
    rspack-config/                      # Shared Rspack configuration
  apps/                                 # 57 frontend modules (esm-*-app)
  libs/
    esm-rbac/                           # @sihsalus/esm-rbac — HIPAA role-based access control
    esm-audit-logger/                   # @sihsalus/esm-audit-logger — Client-side PHI audit logging
    esm-sihsalus-shared/                # @sihsalus/esm-sihsalus-shared — Shared UI components and hooks
    esm-framework/                      # @openmrs/esm-framework — local workspace fork
    esm-patient-common-lib/             # @openmrs/esm-patient-common-lib — Shared patient utilities
    esm-styleguide/                     # @openmrs/esm-styleguide — Carbon-based component library
packages/tooling/
  assemble-importmap.js                 # Import map assembly for SPA build
  start-dev.js                          # Local dev server entrypoint
  i18next-parser.config.js               # i18n extraction config
e2e/                                    # Playwright E2E tests
```

> **Note:** OpenMRS core packages are mixed: `@openmrs/esm-framework` is provided by the local workspace at `packages/libs/esm-framework`, while `@openmrs/esm-app-shell` is resolved from npm and patched through Yarn (`.yarn/patches/openmrs-esm-app-shell-npm-9.0.2-form-stack-sharing.patch`).

## Commands

### Development

```bash
yarn install                                # Instalar dependencias
yarn start                                  # Dev server → proxy a SIHSALUS_BACKEND_URL
SIHSALUS_BACKEND_URL=http://... yarn start  # Apuntar a otro backend en esta sesión
```

### Qué comando usar (`start` vs `serve` vs `serve:prod`)

- `yarn start` (**recomendado para desarrollo diario**) usa [packages/tooling/scripts/start-dev.js](packages/tooling/scripts/start-dev.js), que lanza `openmrs develop` con `--importmap` y `--routes`, y además sirve assets/chunks desde `dist/spa` mediante proxy.
- `yarn serve` ejecuta `openmrs start` directo (ver [package.json](package.json)) después de compilar apps. En esta base, `openmrs start` hace descubrimiento local de módulos compilados (`packages/apps/*/dist`) y genera importmap/rutas en memoria (ver [packages/tooling/openmrs/src/commands/start.ts](packages/tooling/openmrs/src/commands/start.ts)).
- `yarn serve:prod` compila todo + ejecuta `assemble-importmap.js` y luego `openmrs start`. El `dist/spa` generado queda como fallback estático durante el servido (también en [packages/tooling/openmrs/src/commands/start.ts](packages/tooling/openmrs/src/commands/start.ts)).

Resumen práctico:

- Para desarrollo local con hot-reload/control de módulos: `yarn start`.
- Para validar comportamiento de `openmrs start` con artefactos compilados: `yarn serve` / `yarn serve:prod`.

### Building

```bash
yarn build                                  # Build all packages
yarn build:apps                             # Build only app packages
yarn assemble                               # Assemble import map
yarn turbo run build --filter=<package>     # Build single package
```

### Testing

```bash
yarn test                                   # Run all unit tests
yarn turbo run test --filter='@sihsalus/*' # Test SIH Salus packages only
yarn test:e2e                               # Run Playwright E2E tests
```

### Quality

```bash
yarn lint                                   # ESLint all packages
yarn typecheck                              # TypeScript check all packages
yarn verify                                 # lint + typecheck + test
yarn verify:changed --base origin/main      # Verify changed workspaces plus workspace dependents
```

Repository discipline and workspace ownership expectations should stay close to the touched package README and the relevant quality commands.

### TODO RBAC, auditoria y permisos

Estado QLTY actualizado el 2026-07-04: ver [QLTY frontend hardening audit](docs/audits/2026-07-04-qlty-frontend-hardening.md).

- Definir una matriz transversal de permisos por modulo y flujo, usando [@sihsalus/esm-rbac](packages/libs/esm-rbac/README.md) como punto de integracion frontend.
- Agregar guards de RBAC en rutas, extensiones, botones, workspaces y modales de los modulos clinicos y administrativos.
- Definir privilegios backend/content para lectura, creacion, edicion, eliminacion y acciones especiales por modulo.
- Integrar [@sihsalus/esm-audit-logger](packages/libs/esm-audit-logger/README.md) en eventos sensibles: busqueda de paciente, apertura de historia, formulario clinico, ordenes, dispensing, FUA, billing, stock, ward y emergency.
- Probar roles reales contra backend actualizado: usuario clinico, admision, farmacia, laboratorio, caja, administrador y solo lectura.
- Documentar feature flags o fallback cuando un modulo no tenga permisos/content/backend listos para produccion.

### TODO hardening transversal

- Auditar `routes.json` de todos los paquetes que usan `fhirBaseUrl`, `useFhirFetchAll` o `useFhirPagination` y declarar `fhir2` como dependencia backend cuando el flujo dependa de FHIR.
- Revisar paquetes con endpoints `/ws/module/*` y documentar si requieren OMOD obligatorio, OMOD opcional con feature flag, o si deben ocultarse cuando el backend no lo tenga.
- Agregar pruebas smoke por workspace contra backend actualizado: carga de ruta, carga de datos inicial, apertura de workspace principal y accion de guardado cuando aplique.
- Identificar configs con `_default: ''` que representan conceptos, forms, encounter types o endpoints obligatorios, y convertirlos en defaults reales o feature flags.
- Validar que cada app SIHSALUS custom tenga README propio con limites funcionales, dependencias backend/content, permisos y eventos auditables.
- Agregar owners reales y warning budget a los workspaces custom prioritarios: atencion ambulatoria, CRED, salud materna, vacunacion, orders, dispensing, FUA, indicadores, ward, emergency, stock y billing.
- Validar en QLTY el flujo end-to-end de vacunas: FHIR2 `Immunization` ya responde `200` para una busqueda vacia validada el 2026-07-04, pero falta probar guardado/recarga con paciente real, content y permisos.
- Corregir el formulario de visita/consulta: revisar apertura del workspace, dependencia de visita activa, guardado de `visit`/`encounter`, validaciones obligatorias y manejo de errores backend.
- Corregir/ocultar campos semisoportados del formulario de inicio de visita en QLTY: el endpoint de tipos recomendados `/etl-latest/etl/patient/...` responde `404`; mantener `showRecommendedVisitTypeTab=false` o implementar backend/config real antes de mostrar `Program` y `Recommended`.
- Revisar si `Upcoming appointments` y campos de cola (`Queue location`, `Service`, `Priority`) deben mostrarse en inicio de visita para QLTY; los endpoints responden, pero el flujo debe validarse con datos reales y sin crear entradas huerfanas.
- Revisar Consulta Externa / Atencion ambulatoria end-to-end: entrada desde home, busqueda de paciente, inicio de consulta, cola, formularios clinicos, guardado de encounter, ordenes y mensajes de error.
- Auditar formularios clinicos con el mismo patron de riesgo (vacunacion, visita/consulta, CRED, salud materna, procedimientos y FUA) para detectar `501`, workspace no registrado, rutas rotas, payloads incompletos y mensajes de error sin traducir.
- Repetir smoke real de guardado de signos vitales/Glasgow en QLTY; los UUIDs `glasgowEyeOpeningUuid`, `glasgowVerbalResponseUuid`, `glasgowMotorResponseUuid` y `glasgowTotalUuid` ya resuelven `200` desde el 2026-07-04.
- Validar nuevo content package.
- Revisar cambios RBAC doctor.

### Cleaning

```bash
yarn clean                                  # Remove generated monorepo artifacts
yarn clean:dry-run                          # Preview what would be removed
```

`yarn clean` is a repo-wide clean for generated artifacts only. It removes workspace outputs such as `dist/`, `coverage/`, `.turbo/`, `storybook-static/`, Playwright reports, and TypeScript build info files without touching `node_modules/` or source directories.

Use `yarn clean:dry-run` first when you want to inspect what will be deleted.

### Concurrency

This monorepo has 50+ packages. Avoid high concurrency on resource-constrained machines:

```bash
yarn turbo run build --concurrency=4
yarn turbo run test --filter=@openmrs/esm-login-app   # Single package
```

### Docker

```bash
docker build -t ghcr.io/sihsalus/sihsalus-frontend:dev .
```

Nginx / reverse proxy configuration is managed in the infra repo (`sihsalus-distro-referenceapplication`).

Para levantar la imagen publicada (branch `main`) en un servidor:

```bash
# 1) Traer la etiqueta latest y resolver el digest exacto
docker pull ghcr.io/sihsalus/sihsalus-frontend:latest
DIGEST=$(docker inspect --format '{{ index .RepoDigests 0 }}' ghcr.io/sihsalus/sihsalus-frontend:latest)
echo "$DIGEST"

# 2) Redeploy con ese digest (recomendado para reproducibilidad)
docker rm -f sihsalus-frontend || true
docker run -d --name sihsalus-frontend -p 8080:8080 "$DIGEST"
```

## Architecture

- **Turborepo** orchestrates builds across ~50 packages with caching
- **Yarn 4 (Berry)** manages dependencies with `node-modules` linker
- **single-spa** orchestrates microfrontend modules at runtime via import maps
- **Rspack** (Webpack-compatible) is the bundler; Module Federation enables shared deps
- **Carbon Design System** (v11) is the primary UI framework
- **FHIR R4** preferred for data access (`/ws/fhir2/R4/`)
- **Service worker** enables offline-first operation

## Contexto operativo SIH Salus

SIH Salus es un frontend OpenMRS 3 adaptado al contexto peruano. No es un ERP completo ni un reemplazo del backend OpenMRS: la capa frontend orquesta microfrontends, pantallas, workspaces, validaciones de UI y configuracion clinica; la persistencia clinica sigue dependiendo de OpenMRS, FHIR2, OMODs instalados y paquetes de contenido.

Terminologia practica usada en este repositorio:

- `person`: datos de filiacion, identidad, atributos personales y direccion.
- `patient`: persona registrada como paciente, con identificadores clinicos y administrativos.
- `visit`: episodio/consulta o ingreso operativo. En UI se traduce normalmente como `consulta` o `atencion`, segun contexto.
- `encounter`: atencion clinica registrada dentro de una visita.
- `obs`: dato clinico observado dentro de un encounter.
- `order`: orden medica, laboratorio, radiologia, inmunizacion, interconsulta u otro pedido clinico.
- `appointment`: cita o turno programado.
- `queue entry`: posicion del paciente en cola de atencion.
- `workspace`: panel lateral/modal de OpenMRS 3 usado para crear o editar datos.
- `extension slot`: punto de extension del shell donde otro microfrontend inyecta UI.

### Contrato de identidad del paciente

El flujo de identidad no debe depender solo del DNI. En registro, emergencia, busqueda y Libro de Atenciones, un paciente debe poder ubicarse por identificadores, codigo temporal, nombre, fecha/hora de atencion, visita/cola, responsable, servicio, ubicacion y estado de identificacion.

Reglas transversales:

- `@sihsalus/esm-care-logbook-app` se presenta como `Libro de Atenciones`; la ruta historica `/admission` se conserva por compatibilidad.
- Pacientes no identificados o incapaces de comunicarse pueden registrarse sin DNI, telefono, direccion o fecha exacta de nacimiento.
- Cuando el paciente no puede aportar datos o consentimiento, se debe capturar responsable, institucion o autoridad responsable.
- `zipcode/postcode` y telefono no son filtros avanzados por defecto en Patient Search. Pueden existir como datos demograficos/contacto, pero no como pivotes principales de busqueda.

### Contratos que no deben romperse

- No agregar UUIDs clinicos hardcodeados si pueden vivir en `config-schema`. Conceptos, encounter types, visit types, forms, order types, identifiers y care settings deben ser configurables.
- No mostrar claves crudas de i18n en UI. Si aparece algo como `caseMonitoringEncounters`, el modulo tiene una brecha de traduccion o namespace.
- No registrar workspaces, modales o extension slots con strings sueltos cuando exista una constante reutilizable. Los nombres magicos son una fuente recurrente de pantallas blancas.
- No asumir que FHIR2 soporta un recurso solo porque el endpoint existe. Algunos backends responden `501 Not Implemented` hasta que el OMOD/content este alineado.
- No guardar datos clinicos sin visita/consulta activa salvo que el flujo documente explicitamente otra semantica.
- No mezclar nombres tecnicos de OpenMRS con lenguaje de usuario final. El personal de salud debe ver terminos operativos claros.
- Los titulos de rutas, dashboards y sidebars son contrato de producto: deben usar keys traducibles y estar alineados con el nombre funcional del modulo. Ejemplo: `esm-care-logbook-app` se presenta como `Libro de Atenciones`, no como `Admisiones`, porque lista atenciones/consultas por UPSS y no ingresos hospitalarios.

### Dependencias backend/content

Cada modulo funcional deberia documentar:

- OMODs obligatorios u opcionales.
- Endpoints REST OpenMRS usados.
- Recursos FHIR2 usados.
- Conceptos, formularios, tipos de visita, tipos de encounter y tipos de identificador requeridos.
- Privilegios/permisos esperados.
- Comportamiento cuando una capacidad no existe en backend.

Si una app falla con `501`, `workspace not registered`, `modal not registered`, key i18n visible o pantalla en blanco, normalmente falta uno de esos contratos.

### Zonas de alto riesgo

- `esm-patient-chart-app`: layout principal, left sidebar, right sidebar, banner, visitas, workspaces y extension slots.
- `esm-styleguide`: componentes compartidos y sistemas de workspace; cambios pequenos impactan muchas apps.
- `esm-patient-orders-app`: depende de visita activa, workspaces, conceptos de ordenes, stock/billing/FHIR opcional.
- `esm-patient-immunizations-app`: depende de FHIR2 `Immunization`, conceptos/mappings de inmunizacion y contenido MINSA.
- `esm-service-queues-app`: depende de configuracion de colas, ubicaciones, servicios, rooms y conceptos de prioridad/estado.
- `esm-home-app`: rutas y accesos rapidos; no debe esconder errores de registro de extensiones ni dejar paneles huerfanos.

## SIH Salus Module Overrides

| SIH Salus Module (`@sihsalus/*`) | Replaces Upstream (`@openmrs/*`)         |
| -------------------------------- | ---------------------------------------- |
| `esm-patient-registration-app`   | `@openmrs/esm-patient-registration-app`  |
| `esm-patient-search-app`         | `@openmrs/esm-patient-search-app`        |
| `esm-billing-app`                | `@openmrs/esm-billing-app`               |
| `esm-patient-immunizations-app`  | `@openmrs/esm-patient-immunizations-app` |

Custom modules with no upstream equivalent: `esm-atencion-ambulatoria-app`, `esm-care-logbook-app`, `esm-coststructure-app`, `esm-cred-app` (`packages/apps/esm-crecimiento-desarrollo-app`), `esm-dyaku-app`, `esm-emergency-app`, `esm-ficha-familiar-app`, `esm-fua-app`, `esm-indicadores-app`, `esm-odontologia-app` (`packages/apps/esm-odontologia-app`), `esm-reports-app`, `esm-salud-materna-app`, `esm-seguimiento-casos-app`.

## Calidad esperada antes de agregar features

Antes de sumar funcionalidad clinica nueva, revisar:

- `config-schema`: campos clinicos configurables, sin UUIDs nuevos escondidos.
- `translations`: keys en `en.json` y `es.json`; ninguna key cruda visible.
- `routes.json`: rutas, extension slots y dependencias de backend declaradas.
- `README.md` del paquete: limite funcional, integraciones, backend/content requerido y QA minimo.
- Smoke manual o Playwright si toca patient chart, workspaces, sidebars, ordenes, colas, vacunacion o flujos de guardado.
- CodeQL/Biome: unused code, useless conditionals y template syntax no son cosmetica; suelen indicar copy-paste o ramas muertas.

## Environment Variables

Crea un archivo `.env` en la raíz del repo (ver [.env.template](.env.template)):

| Variable                         | Default                                | Descripción                                                            |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `SIHSALUS_BACKEND_URL`           | `https://gidis-hsc-dev.inf.pucp.edu.pe` | Backend OpenMRS al que se hace proxy en dev y se descarga el importmap |
| `SIHSALUS_REQUIRE_BACKEND_URL`   | `false`                                | Si es `true`, `yarn start` falla cuando falta `SIHSALUS_BACKEND_URL`   |
| `SIHSALUS_BACKEND_FETCH_TIMEOUT_MS` | `5000`                              | Timeout para descargar importmap/rutas del backend en `openmrs start`  |
| `SIHSALUS_AUTH_MODE`             | `openmrs`                              | Modo de auth: `openmrs` (básico) o `keycloak` (OIDC)                   |
| `SIHSALUS_ALLOW_SELF_SIGNED_TLS` | `true` para DEV/QLTY internos; `false` para otros backends | Activa TLS "insecure" para backends internos con certificados auto-firmados en desarrollo. Usa `false` para forzar validación estricta |
| `SIHSALUS_FHIR_BASE`             | *(derivado del backend)*               | URL base de FHIR R4                                                    |
| `SIHSALUS_PUBLIC_SPA_URL`        | *(opcional)*                           | URL pública absoluta del SPA para Open Graph/Twitter previews          |
| `SPA_PATH`                       | `/openmrs/spa`                         | Base path para los assets del SPA                                      |
| `API_URL`                        | `/openmrs`                             | Base path de la API de OpenMRS                                         |

## Security and compliance direction

This repository includes frontend building blocks for security and compliance, but final compliance depends on backend configuration, infrastructure, roles, audit policy, operational procedures and deployment evidence.

- **RBAC** (`@sihsalus/esm-rbac`): Role-based access control at component and route level.
- **Audit logging** (`@sihsalus/esm-audit-logger`): PHI access event logging with offline fallback.
- **Session timeout**: configurable idle timeout with warning.
- **Break the glass**: emergency access pattern with mandatory clinical justification where enabled.
- **TLS 1.2+**: expected at the infrastructure layer.

## License

[MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/)

Copyright (c) Pontificia Universidad Catolica del Peru (PUCP), Grupo de Investigacion y Desarrollo de Ingenieria de Software (GIDIS).

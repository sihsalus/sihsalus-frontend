# SIH Salus Frontend

Turborepo-powered monorepo for the **SIH Salus Hospital Information System** — an offline-oriented, FHIR-aware and compliance-oriented frontend serving ~30,000 inhabitants across 112 native Amazonian communities along 500+ km of the Napo River (Peru).

Built on [OpenMRS 3.x](https://openmrs.org/) with the single-spa microfrontend architecture.

This repository was developed by the **Pontificia Universidad Catolica del Peru (PUCP)** through the **Grupo de Investigacion y Desarrollo de Ingenieria de Software (GIDIS)**.

Contact: `sihsalus@pucp.edu.pe`

Before proposing changes, read [CONTRIBUTING.md](CONTRIBUTING.md). Automated
coding agents must also follow [AGENTS.md](AGENTS.md).

## Documentación

<!-- Preserve links to sections moved into the documentation index. -->

<a id="development"></a>
<a id="qué-comando-usar-start-vs-serve-vs-serveprod"></a>
<a id="building"></a>
<a id="testing"></a>
<a id="quality"></a>
<a id="todo-rbac-auditoria-y-permisos"></a>
<a id="todo-hardening-transversal"></a>
<a id="cleaning"></a>
<a id="concurrency"></a>
<a id="docker"></a>
<a id="contrato-de-identidad-del-paciente"></a>
<a id="dependencias-backendcontent"></a>
<a id="zonas-de-alto-riesgo"></a>
<a id="sih-salus-module-overrides"></a>
<a id="calidad-esperada-antes-de-agregar-features"></a>
<a id="environment-variables"></a>

El [índice de documentación](docs/README.md) organiza las guías y contratos.

| Tema                         | Referencia                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Entorno, arranque y comandos | [Desarrollo local](docs/development/README.md)                                             |
| Variables y backend          | [Configuración](docs/development/configuration.md)                                         |
| Pruebas, tipos y CI          | [Pruebas y calidad](docs/development/testing.md), [E2E](e2e/README.md)                     |
| Código y módulos             | [Arquitectura](docs/architecture.md), [índice de módulos](docs/modules.md)                 |
| Flujos y contratos clínicos  | [Contratos](docs/clinical/README.md), [diagramas](docs/workflows/README.md)                |
| Imágenes y operación         | [Imágenes](docs/runbooks/frontend-images.md), [go-live](docs/runbooks/frontend-go-live.md) |
| Trabajo pendiente            | [Estado de configuración](docs/development/tooling-status.md), [backlog](docs/backlog.md)  |

## Prerequisites

- Node.js 24.
- Yarn 4.13.0, fijado en `packageManager` de `package.json`, mediante Corepack.
- Docker para los procedimientos de imágenes, una vez resueltas sus recetas.

## Quick Start

Sigue [desarrollo local](docs/development/README.md#preparación-y-arranque) para
instalar, configurar `.env`, ensamblar el SPA y levantar el servidor.
La rama de limpieza tiene [pendientes de Yarn, Docker y catálogos](docs/development/tooling-status.md):
los ajustes locales documentados no equivalen a una instalación estándar o CI
aprobados.

`yarn start` requiere un SPA válido en `dist/spa` y usa el backend configurado
en [.env.template](.env.template). Revisar el destino antes de arrancar; las
pruebas clínicas solo usan datos sintéticos en un ambiente coordinado.

## Repository Structure

- `packages/apps/`: aplicaciones clínicas y administrativas.
- `packages/libs/`: bibliotecas compartidas y forks locales de OpenMRS.
- `packages/tooling/`: CLI, build y herramientas de validación.
- `packages/test-utils/`: helpers, fixtures sintéticos y stubs de pruebas.
- `e2e/`: suites, gates y utilidades Playwright.
- `docs/`: guías, contratos, diagramas y auditorías.

El [mapa de arquitectura](docs/architecture.md) explica los entry points,
dependencias compartidas y reemplazos de módulos upstream.

## Commands

Consulta los comandos de [desarrollo y build](docs/development/README.md),
[pruebas y calidad](docs/development/testing.md) e
[imágenes](docs/runbooks/frontend-images.md). El alcance y la evidencia requerida
para cada cambio se definen en [CONTRIBUTING](CONTRIBUTING.md#proportional-validation).

## Architecture

El monorepo utiliza single-spa, TypeScript, Turborepo, Rspack, Carbon y FHIR R4.
La [guía de arquitectura](docs/architecture.md) describe la organización y los
forks locales; el [índice de módulos](docs/modules.md) dirige a cada README.

## Contexto operativo SIH Salus

El frontend orquesta flujos clínicos; OpenMRS, FHIR2, OMODs y contenido conservan
la responsabilidad de persistencia y autorización backend. La terminología y
los contratos transversales están en [contexto clínico](docs/clinical/README.md).

### Contratos que no deben romperse

Antes de modificar una aplicación, leer los
[contratos clínicos y de configuración](docs/clinical/README.md#contratos-que-no-deben-romperse)
y el README del paquete. Mantienen los requisitos de contexto de consulta,
identidad, permisos, UUIDs configurables, traducciones y navegación.

## Security and compliance direction

Los controles frontend no sustituyen la autorización backend, la configuración
de infraestructura ni la aceptación clínica. Consultar
[CONTRIBUTING](CONTRIBUTING.md#non-negotiable-rules) y el
[canal privado de seguridad](https://github.com/sihsalus/sihsalus-frontend/security/advisories/new).

## License

[MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/)

Copyright (c) Pontificia Universidad Catolica del Peru (PUCP), Grupo de Investigacion y Desarrollo de Ingenieria de Software (GIDIS).

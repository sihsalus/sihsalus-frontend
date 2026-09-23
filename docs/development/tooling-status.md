# Configuración y validación del repositorio

[Documentación](../README.md) · [Desarrollo local](README.md)

La limpieza conserva las configuraciones que todavía tienen consumidores
activos. La simplificación de TypeScript y la migración a tipos nativos de
Vitest no requieren retirar estos contratos.

| Área                  | Fuente                                                                                                                                     | Consumidores y contrato                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Yarn                  | [`.yarnrc.yml`](../../.yarnrc.yml), [`package.json`](../../package.json)                                                                   | Instalación inmutable con Yarn 4.13.0 y `node_modules`; los scripts de Turbo, Biome y TypeScript dependen de esa estructura. |
| Node                  | [`.nvmrc`](../../.nvmrc)                                                                                                                   | Selección de Node 24 para desarrollo, alineada con el entorno de CI.                                                         |
| Telemetría            | [`.env.yarn`](../../.env.yarn)                                                                                                             | Yarn inyecta los opt-outs; Turbo los propaga según `globalPassThroughEnv`. No contiene credenciales ni sustituye `.env`.     |
| Imágenes              | [Dockerfile](../../Dockerfile), [`.dockerignore`](../../.dockerignore), [Nginx](../../nginx.spa.conf), [Compose](../../docker-compose.yml) | Targets de CI, contexto de build, fallback SPA, caché de assets y entorno local.                                             |
| Gobernanza de pruebas | [Registro de deuda](../../config/test-governance.json)                                                                                     | El validador conserva responsables, riesgos y vencimientos; restaurar el registro no crea ni prorroga excepciones.           |
| E2E                   | [Catálogo](../../e2e/suite-catalog.json)                                                                                                   | El runner, typecheck y CI mantienen la misma pertenencia, cuarentena y gates de las suites.                                  |
| Código sin uso        | [Knip](../../knip.json)                                                                                                                    | Conserva los entry points y el alcance del análisis del monorepo.                                                            |

## Cómo validar cambios a estos contratos

Ejecutar la instalación y los scripts según [desarrollo](README.md) y
[pruebas](testing.md). No se requieren overrides de `YARN_NODE_LINKER`,
`YARN_NM_MODE` ni `TURBO_ENV_MODE` para usar la configuración del repositorio.

Las pruebas existentes del catálogo, gobernanza, Nginx y contexto Docker deben
seguir activas. Una prueba de contrato del Dockerfile no sustituye construir
la imagen; un typecheck E2E tampoco ejecuta escenarios clínicos. No saltar el
runner, retirar aserciones ni desactivar controles para obtener un resultado
aprobado.

Registrar comandos, SHA, entorno, pruebas ejecutadas y caché según
[CONTRIBUTING](../../CONTRIBUTING.md#proportional-validation). La evidencia de
cada PR debe distinguir validación local, CI, imágenes y aceptación del ambiente.
Mantener pendientes los chequeos que todavía no se hayan ejecutado; una auditoría
de dependencias o CodeQL no demuestra ausencia de regresiones funcionales.

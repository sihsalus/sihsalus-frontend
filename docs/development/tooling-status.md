# Configuración y validación del repositorio

[Documentación](../README.md) · [Desarrollo local](README.md)

La limpieza conserva las configuraciones que todavía tienen consumidores
activos. La simplificación de TypeScript y la migración a tipos nativos de
Vitest no requieren retirar estos contratos.

La [migración al compilador nativo](typescript-native.md) documenta TypeScript 7,
la compatibilidad de API que aún se necesita y el benchmark reproducible.

| Área                  | Fuente                                                                                                                                            | Consumidores y contrato                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Yarn                  | [`.yarnrc.yml`](../../.yarnrc.yml), [`package.json`](../../package.json)                                                                          | Instalación inmutable con Yarn 4.18.1 y `node_modules`; los scripts de Turbo, Biome y TypeScript dependen de esa estructura. |
| Node                  | [`.nvmrc`](../../.nvmrc)                                                                                                                          | Selección de Node 24 para desarrollo, alineada con el entorno de CI.                                                         |
| Telemetría            | [`.env.yarn`](../../.env.yarn)                                                                                                                    | Yarn inyecta los opt-outs; Turbo los propaga según `globalPassThroughEnv`. No contiene credenciales ni sustituye `.env`.     |
| Imágenes              | [Dockerfile](../../Dockerfile), [`.dockerignore`](../../.dockerignore), [Nginx](../../config/nginx.spa.conf), [Compose](../../docker-compose.yml) | Targets de CI, contexto de build, fallback SPA, caché de assets y entorno local.                                             |
| Gobernanza de pruebas | [Registro de deuda](../../config/test-governance.json)                                                                                            | El validador conserva responsables, riesgos y vencimientos; restaurar el registro no crea ni prorroga excepciones.           |
| E2E                   | [Catálogo](../../e2e/suite-catalog.json)                                                                                                          | El runner, typecheck y CI mantienen la misma pertenencia, cuarentena y gates de las suites.                                  |
| Código sin uso        | [Knip](../../knip.json)                                                                                                                           | Conserva los entry points y el alcance del análisis del monorepo.                                                            |

## Ubicación de configuraciones

Las configuraciones de infraestructura sin descubrimiento automático, como
`config/nginx.spa.conf`, viven en `config/`. El Dockerfile, el filtro del workflow
de imágenes y sus pruebas apuntan a esa misma ruta. Los archivos convencionales
de Yarn, Turbo, Biome, TypeScript y Playwright permanecen en la raíz; moverlos
exigiría mantener argumentos o rutas adicionales en sus consumidores.

## Rspack y servidor de desarrollo

El compilador y la CLI usan Rspack 2.2.8; `@rspack/dev-server` 2.2.1 requiere
un compilador de la misma generación. Actualizar las declaraciones de los
workspaces, la plantilla y las resoluciones juntos: una resolución de Rspack 1
con un servidor 2 puede compilar sin errores y fallar en el navegador al iniciar
el cliente de hot reload (`log.setLogLevel`). La prueba del runtime verifica
el peer del servidor y la exportación que consume su cliente.

La configuración conserva `ModuleFederationPluginV1`, compatible con el host
Webpack del app-shell. Este plugin no necesita el runtime adicional de Module
Federation; actualizar el compilador no implica migrar ese protocolo.

## Orden de compilación de workspaces

Los consumidores de `@openmrs/esm-framework` mantienen su contrato de
`peerDependencies` para el host y declaran además `workspace:*` en
`devDependencies` para compilar y probar dentro del monorepo. El peer por sí solo
no establece el orden local de compilación observado con Turbo 2.11.
`workspace-build-order.test.js` comprueba el plan real de Turbo: los tipos y el
build del framework deben preceder al typecheck de cada consumidor. No se deben
compartir instalaciones entre worktrees ni depender de un `dist` de otra rama.

## Versiones compartidas en el navegador

Los peers de traducción siguen las versiones de runtime del monorepo:
`i18next 26` y `react-i18next 17`. El parche existente del app-shell usa las
versiones instaladas para esos singletons y para `react-router-dom`; las
resoluciones del shell evitan compilar copias de las generaciones anteriores.
Las bibliotecas `@openmrs/esm-*`, el app-shell, el CLI local `openmrs` y
`@openmrs/rspack-config` usan 10.0.0. Los dos paquetes de tooling conservan
CommonJS y Rspack 2 por los contratos del monorepo; upstream 10.0.0 usa ESM y
Rspack 1. El fork porta la espera de compilación inicial, validación de
import maps/rutas, SVG como fuente y compilación diferida del servidor local.
El SVG sigue siendo texto para el registro de iconos y pictogramas; los imports
con `?url` de Inicio y Herramientas offline emiten archivos para `<img src>`.
El servidor de desarrollo sirve los módulos desde
memoria como upstream 10.0.0; el build de producción sigue escribiendo en `dist`.

Los consumidores con un peer comodín del framework usan la versión exacta
instalada al generar Module Federation. El app-shell 10.0.0 conserva un build
Webpack controlado por el repositorio para generar el service worker clínico:
su configuración Rspack de npm no emite ese artefacto. No sustituir el contrato
por `requiredVersion: false` ni suprimir advertencias de consola.
Las pruebas de build verifican los rangos con el evaluador del runtime y
comprueban que los peers de los workspaces acepten las dependencias instaladas.

## Parches temporales de dependencias

`braces` 3.0.3 y `http-cache-semantics` 4.2.0 tienen avisos de severidad alta
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) y
[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
respectivamente. Mientras no haya versiones corregidas compatibles, Yarn aplica
parches locales a todos los rangos transitivos presentes en `yarn.lock`. El
primero limita la profundidad de patrones anidados; el segundo impide que
`max-stale` reutilice respuestas que requieren revalidación por `Set-Cookie`,
`proxy-revalidate`, `no-cache` o una entrada no almacenable.

`yarn security:audit` ejecuta la auditoría completa de dependencias directas y
transitivas de severidad alta. Solo acepta estos dos avisos exactos después de
comprobar las resoluciones y el comportamiento instalado; cualquier otro aviso
o error de auditoría falla. Retirar los parches y esta excepción cuando existan
versiones corregidas compatibles y las pruebas confirmen su comportamiento.

## Cómo validar cambios a estos contratos

`yarn validate:workspaces` también comprueba que los módulos que importan
`fhirBaseUrl`, `useFhirFetchAll` o `useFhirPagination` del framework declaren
FHIR2 en `routes.json`. La verificación inspecciona imports TypeScript para no
confundir un servidor FHIR externo configurado por el módulo (como DYAKU) con
FHIR2 de OpenMRS. La lista de tareas declara FHIR2 porque lee `PlanDefinition`
para sus plantillas. Declarar la dependencia no valida por sí mismo los recursos
ni los permisos del backend en DEV/QLTY.

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

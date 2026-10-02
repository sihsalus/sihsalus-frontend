# Configuración de entorno

[Documentación](../README.md) · [Inicio](../../README.md)

Crea un archivo `.env` en la raíz del repo (ver [.env.template](../../.env.template)). `yarn start` carga ese archivo directamente. Los comandos de ensamble leen `SPA_PATH`, `API_URL`, `SIHSALUS_PUBLIC_SPA_URL` y, como respaldo para los metatags sociales, `SIHSALUS_BACKEND_URL` del entorno del proceso; expórtalas en la shell cuando deban afectar `yarn assemble`. Yarn inyecta los opt-outs de telemetría de [`.env.yarn`](../../.env.yarn) según [`.yarnrc.yml`](../../.yarnrc.yml); ese archivo no carga la configuración clínica de `.env`.

| Variable                                         | Ámbito y valor por defecto                                                                          | Descripción                                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIHSALUS_BACKEND_URL`                           | Dev server; la plantilla usa HTTPS y el fallback interno es `http://gidis-hsc-dev.inf.pucp.edu.pe`  | Backend OpenMRS al que `yarn start` redirige API y sesión                                                                                                                                |
| `SIHSALUS_REQUIRE_BACKEND_URL`                   | Dev server; `false`                                                                                 | Si es `true`, `yarn start` falla en vez de usar el fallback                                                                                                                              |
| `SIHSALUS_BACKEND_FETCH_TIMEOUT_MS`              | `openmrs start`; `5000`                                                                             | Timeout para intentar descargar import map/rutas del backend al usar `yarn serve`                                                                                                        |
| `SIHSALUS_DEV_APPS`                              | Dev server; lista principal integrada                                                               | Apps con hot reload; usa una lista separada por comas o `none` para servir solo el SPA ensamblado                                                                                        |
| `SIHSALUS_DEV_TYPECHECK`                         | Build dev; `true`                                                                                   | Usa `false` para evitar un worker TypeScript residente por app y valida el paquete editado con su script `typescript`                                                                    |
| `SIHSALUS_AUTH_MODE`                             | Dev server; `openmrs`                                                                               | Modo de autenticación: `openmrs` o `keycloak`                                                                                                                                            |
| `SIHSALUS_ALLOW_SELF_SIGNED_TLS`                 | Dev/E2E; la plantilla usa `true`; si se omite, es automático solo para los hosts DEV/QLTY conocidos | `true` desactiva la verificación TLS para el backend configurado; usa un override explícito solo en entornos controlados                                                                 |
| `SIHSALUS_FHIR_BASE`                             | Dev server; derivado de `SIHSALUS_BACKEND_URL`                                                      | URL base de FHIR R4 mostrada y propagada al proceso de desarrollo                                                                                                                        |
| `SIHSALUS_PUBLIC_SPA_URL`                        | Ensamble; vacío                                                                                     | URL pública absoluta usada para metatags Open Graph/Twitter; si falta, el ensamble deriva el origen de `SIHSALUS_BACKEND_URL` + `SPA_PATH` y advierte cuando el resultado no es absoluto |
| `SIHSALUS_DEV_LOCAL_CONFIG_RATE_LIMIT_WINDOW_MS` | `openmrs develop`; `60000`                                                                          | Ventana del límite por IP para leer configuración local                                                                                                                                  |
| `SIHSALUS_DEV_LOCAL_CONFIG_RATE_LIMIT_MAX`       | `openmrs develop`; `300`                                                                            | Máximo de lecturas por IP y ventana; cero no desactiva esta protección                                                                                                                   |
| `SPA_PATH`                                       | Ensamble/contenedor; `/openmrs/spa`                                                                 | Ruta base de los assets del SPA                                                                                                                                                          |
| `API_URL`                                        | Ensamble/contenedor; `/openmrs`                                                                     | Ruta base de la API OpenMRS                                                                                                                                                              |

## Backend y proxy local

`SIHSALUS_BACKEND_URL` acepta el origen o la base de API terminada en `/openmrs`;
el proxy normaliza esta última para no enviar `/openmrs/openmrs/...`. La URL debe
usar HTTP(S), sin credenciales, query ni fragmento. Las rutas de contexto
personalizadas se conservan. Esta normalización no cambia el backend elegido ni
la política TLS.

`yarn start` también reenvía el heartbeat de actividad clínica al endpoint
`/_sihsalus/clinical-activity` del gateway configurado, con la misma política TLS
y un límite de tres segundos. Solo admite POST a esa ruta exacta, sin query,
cuerpo, cookies, autorización ni referer; no reenvía cabeceras del navegador.
Devuelve 204 únicamente si el gateway confirma 204. Conserva sus errores 4xx/5xx
sin cuerpos ni cabeceras, devuelve 502 ante redirecciones u otros fallos y 504
ante timeout. Así la señal real de presencia sigue llegando a la política de
apagado seguro sin incluir contexto clínico.

La configuración de instalación y los consumidores de sus archivos se
detallan en [estado de configuración](tooling-status.md).

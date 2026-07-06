![Node.js CI](https://github.com/PROYECTO-SANTACLOTILDE/sihsalus-esm-modules/workflows/Node.js%20CI/badge.svg)

# @pucp-gidis-hiisc/esm-fua-app — Formato Único de Atenciones (FUA)

Microfrontend para OpenMRS 3.x que implementa la UI del Formato Único de Atenciones (FUA) para el contexto peruano. Permite listar, filtrar y visualizar solicitudes FUA, así como abrir el visor HTML del documento generado por el backend.

## Características

- Dashboard FUA con tiles por estado (solicitados, en progreso, completados, rechazados).
- Tabs/tablas con filtros de fecha y estado de solicitud FUA.
- Visor HTML del FUA (integrado con el microservicio generador).
- Link de acceso desde el panel izquierdo de OpenMRS 3.

## Instalación

Instalar desde npm (tag `next`):

```bash
npm install @pucp-gidis-hiisc/esm-fua-app@next
# o
yarn add @pucp-gidis-hiisc/esm-fua-app@next
```

Agregar a tu import map (OpenMRS 3 SPA):

```json
{
	"imports": {
		"@pucp-gidis-hiisc/esm-fua-app": "https://unpkg.com/@pucp-gidis-hiisc/esm-fua-app@next/dist/pucp-gidis-hiisc-esm-fua-app.js"
	}
}
```

Con eso, el módulo registra sus rutas y extensiones automáticamente.

## Rutas y Extensiones

- Rutas registradas:
	- `#/fua-request` (dashboard principal FUA)
	- `#/fua-viewer` (visor de FUA)
- Extensiones principales (slots):
	- `homepage-dashboard-slot` → enlace “Formato Único de Atención”.
	- `fua-tiles-slot` → tiles de resumen por estado.
	- `fua-panels-slot` → paneles/tablas por estado.

## Configuración

Puedes sobreescribir la configuración vía SPA config de OpenMRS:

```json
{
	"@pucp-gidis-hiisc/esm-fua-app": {
		"enableFuaApprovalWorkflow": false,
		"fuaGeneratorEndpoint": "https://<tu-host>/services/fua-generator/demo"
	}
}
```

Campos soportados:
- `enableFuaApprovalWorkflow` (boolean): habilita el flujo de aprobación (WIP según backend).
- `fuaGeneratorEndpoint` (string): URL del microservicio que genera el HTML del FUA.

## Requisitos de Backend

Este microfrontend espera que el backend (OMOD FUA) exponga endpoints compatibles, por ejemplo:

- `GET /ws/module/fua/solicitudes` — listado/paginado y filtrado por estado/fechas.
- `PUT /ws/module/fua/estado/update/{fuaId}` — actualización de estado.
- `POST /ws/module/fua/visitInfo/{visitUuid}/generator/{format}` — render del HTML del FUA.
- `GET /ws/module/fua/estado/list` — catálogo de estados disponibles.

Consulta la documentación del OMOD para detalles de parámetros y autenticación.

## Estado QLTY 2026-07-04

- QLTY tiene el OMOD FUA instalado y levantado como `fua` `1.0.80`.
- `GET /ws/module/fua/estado/list` y `GET /ws/module/fua/solicitudes` respondieron una excepcion de privilegios: `Read Fua Privilege` es requerido para lectura.
- La presencia del OMOD no alcanza para considerar listo el flujo FUA; falta seed/alineamiento de privilegios backend y guards frontend por rol.

## TODO backend/integración

- Mantener validacion de version/estado del OMOD FUA antes de habilitar la app en el import map.
- Seedear y probar privilegios de lectura/escritura FUA, empezando por `Read Fua Privilege`, contra usuarios reales de QLTY.
- Probar generación/render de FUA con `POST /ws/module/fua/visitInfo/{visitUuid}/generator/{format}` usando una consulta real.
- Definir comportamiento cuando el OMOD no esté disponible: ocultar link, mostrar error de integración o usar feature flag.

## Desarrollo local

Desde el monorepo:

```bash
# levantar en modo desarrollo (desde la raíz)
yarn start

# build de este paquete
yarn workspace @pucp-gidis-hiisc/esm-fua-app build
```

Estructura relevante:
- `src/` componentes, extensiones, rutas y workspaces.
- `src/routes.json` define rutas y extensiones.
- `src/config-schema.ts` define la configuración soportada.

## Compatibilidad

Peer deps clave:
- `@openmrs/esm-framework` 8.x
- `react` 18.x
- `react-router-dom` 6.x

## Licencia

MPL-2.0

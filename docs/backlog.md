# Pendientes documentados

[Documentación](README.md) · [Inicio](../README.md)

Este inventario conserva los pendientes y referencias del README anterior.
Las observaciones de QLTY de julio de 2026 son evidencia histórica: cada tarea
requiere comprobar el código y el ambiente actuales antes de ejecutarla o
declararla resuelta. La reorganización no cierra ninguna de estas tareas.

Para los fallos concretos de la limpieza de configuración, consultar
[estado de configuración](development/tooling-status.md).

## RBAC, auditoría y permisos

Estado QLTY actualizado el 2026-07-04: ver [QLTY frontend hardening audit](../docs/audits/2026-07-04-qlty-frontend-hardening.md).

- Definir una matriz transversal de permisos por modulo y flujo, usando [@sihsalus/esm-rbac](../packages/libs/esm-rbac/README.md) como punto de integracion frontend.
- Agregar guards de RBAC en rutas, extensiones, botones, workspaces y modales de los modulos clinicos y administrativos.
- Definir privilegios backend/content para lectura, creacion, edicion, eliminacion y acciones especiales por modulo.
- Integrar [@sihsalus/esm-audit-logger](../packages/libs/esm-audit-logger/README.md) en eventos sensibles: busqueda de paciente, apertura de historia, formulario clinico, ordenes, dispensing, FUA, billing, stock, ward y emergency.
- Probar roles reales contra backend actualizado: usuario clinico, admision, farmacia, laboratorio, caja, administrador y solo lectura.
- Documentar feature flags o fallback cuando un modulo no tenga permisos/content/backend listos para produccion.

## Hardening transversal

- Auditar `routes.json` de todos los paquetes que usan `fhirBaseUrl`, `useFhirFetchAll` o `useFhirPagination` y declarar `fhir2` como dependencia backend cuando el flujo dependa de FHIR.
- Revisar paquetes con endpoints `/ws/module/*` y documentar si requieren OMOD obligatorio, OMOD opcional con feature flag, o si deben ocultarse cuando el backend no lo tenga.
- Agregar pruebas smoke por workspace contra backend actualizado: carga de ruta, carga de datos inicial, apertura de workspace principal y accion de guardado cuando aplique.
- Identificar configs con `_default: ''` que representan conceptos, forms, encounter types o endpoints obligatorios, y convertirlos en defaults reales o feature flags.
- Validar que cada app SIHSALUS custom tenga README propio con limites funcionales, dependencias backend/content, permisos y eventos auditables.
- Agregar owners reales y warning budget a los workspaces custom prioritarios: atencion ambulatoria, CRED, salud materna, vacunacion, orders, dispensing, FUA, indicadores, ward, emergency, stock y billing.
- Validar en QLTY el flujo end-to-end de vacunas: FHIR2 `Immunization` ya responde `200` para una busqueda vacia validada el 2026-07-04, pero falta probar guardado/recarga con un paciente sintetico y el content y permisos desplegados.
- Corregir el formulario de visita/consulta: revisar apertura del workspace, dependencia de visita activa, guardado de `visit`/`encounter`, validaciones obligatorias y manejo de errores backend.
- Corregir/ocultar campos semisoportados del formulario de inicio de visita en QLTY: el endpoint de tipos recomendados `/etl-latest/etl/patient/...` responde `404`; mantener `showRecommendedVisitTypeTab=false` o implementar backend/config real antes de mostrar `Program` y `Recommended`.
- Revisar si `Upcoming appointments` y campos de cola (`Queue location`, `Service`, `Priority`) deben mostrarse en inicio de visita para QLTY; los endpoints responden, pero el flujo debe validarse con datos sinteticos representativos y sin crear entradas huerfanas.
- Revisar Consulta Externa / Atencion ambulatoria end-to-end: entrada desde home, busqueda de paciente, inicio de consulta, cola, formularios clinicos, guardado de encounter, ordenes y mensajes de error.
- Auditar formularios clinicos con el mismo patron de riesgo (vacunacion, visita/consulta, CRED, salud materna, procedimientos y FUA) para detectar `501`, workspace no registrado, rutas rotas, payloads incompletos y mensajes de error sin traducir.
- Repetir el smoke end-to-end de guardado de signos vitales/Glasgow en QLTY con un paciente sintetico; los UUIDs `glasgowEyeOpeningUuid`, `glasgowVerbalResponseUuid`, `glasgowMotorResponseUuid` y `glasgowTotalUuid` ya resuelven `200` desde el 2026-07-04.
- Validar nuevo content package.
- Revisar cambios RBAC doctor.

## CRED: pendientes clínicos al 23/09/2026

Las curvas escolares y el alta neonatal están integradas en los PR
[frontend #1093](https://github.com/sihsalus/sihsalus-frontend/pull/1093) y
[content #241](https://github.com/sihsalus/sihsalus-content/pull/241). El
[contrato conjunto](https://github.com/sihsalus/sihsalus-content/blob/main/docs/contracts/cred-clinical-completion.md)
es la referencia para su alcance, pruebas, versiones y aceptación en QLTY.

Continúan abiertos [#58](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/58)
(persistencia antropométrica), [#98](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/98)
(aceptación neonatal y casos pendientes), [#99](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/99)
(Hb ajustada), [#93](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/93)
(EDI), [#94](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/94)
(Huanca) y [#96](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/96)
(M-CHAT-R/F). Completar terminología y versiones aprobadas, implementar los
resultados/capturas faltantes y verificar guardado, recarga y permisos con datos
sintéticos en QLTY antes de cerrar cada alcance.

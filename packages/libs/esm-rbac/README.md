# @sihsalus/esm-rbac

Libreria compartida para UI de autorizacion en los microfrontends SIHSalus.

La evaluacion real de privilegios debe delegarse al framework de OpenMRS (`UserHasAccess`/`userHasAccess`). Este paquete solo agrega wrappers y estados visuales comunes, como `RequirePrivilege` y `UnauthorizedState`.

## Semántica de autorización

- Un arreglo de privilegios significa AND: deben cumplirse todos sus elementos.
- Un OR entre capacidades debe expresarse de forma explícita; no se obtiene pasando un arreglo.
- Los nombres no forman una jerarquía. Un privilegio `.editar` no concede automáticamente el privilegio base.
- La compatibilidad entre nombres actuales y heredados usa únicamente los pares exactos documentados por [`@openmrs/esm-api`](../esm-api/README.md#evaluación-de-privilegios).
- Un guard de UI oculta o bloquea una superficie, pero el backend sigue siendo la autoridad para cada lectura o mutación.

## TODO RBAC/permisos

- Definir una matriz oficial de permisos por modulo y por flujo clinico/administrativo.
- Usar guards `RequirePrivilege` en los puntos de entrada de cada modulo habilitado: rutas, extensiones, botones de accion, workspaces y modales sensibles.
- Alinear los nombres de privilegios frontend con los privilegios/roles reales del backend OpenMRS y el content reference application.
- Definir permisos minimos para lectura, creacion, edicion, eliminacion y acciones especiales por dominio: CRED, salud materna, vacunacion, ordenes, dispensing, FUA, indicadores, odontologia, VIH, billing, stock, ward y emergency.
- Agregar estados `UnauthorizedState` consistentes en pantallas donde el usuario pueda llegar sin permisos suficientes.
- Agregar pruebas unitarias para componentes protegidos y pruebas e2e con usuarios de roles distintos.
- Documentar el comportamiento esperado cuando el backend no expone un privilegio requerido: ocultar accion, bloquear accion o mostrar acceso denegado.

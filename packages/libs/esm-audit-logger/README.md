# @sihsalus/esm-audit-logger

Libreria compartida para auditoria frontend de eventos sensibles y acceso a informacion clinica.

## Sesión y transporte

`useAuditLogger`, montado por la navegación principal, activa el logger con una
sesión autenticada y el UUID del usuario. No necesita que `/session` publique un
identificador de autenticación. El SDK no obtiene ni incorpora cookies, tokens
ni identificadores de sesión a sus eventos; `setSession` recibe solo el UUID.
El receptor determina el actor a partir de la sesión autenticada del servidor.

El endpoint relativo `/ws/rest/v1/sihsalus/audit` debe aceptar un array JSON y
exigir `Record Clinical Audit Events`. El SDK serializa explícitamente cada lote:
`openmrsFetch` no convierte arrays automáticamente. Los campos de autenticación
de entradas antiguas se excluyen al enviarlas. Un envío fallido conserva el evento
en la cola cifrada para reintento; esto no garantiza que cada flujo clínico esté
instrumentado ni reemplaza los eventos generados por el servidor.

La cola mantiene el cifrado y la selección por usuario. Al cerrar sesión se
retira la atribución y se liberan las claves en memoria; los eventos pendientes
permanecen para ese usuario. Un cambio de actor detiene el replay después de
una lectura asíncrona y antes del siguiente lote. Al autenticarse con conexión,
el logger intenta recuperar la cola del usuario actual. No cambia la política de
retención, el límite local ni la elección de eventos que deben bloquear acciones.

## Validación mínima

Ejecutar `lint`, `typescript`, `test` y `build` de este workspace, además de
`yarn verify:changed --base origin/main --head HEAD` y las pruebas de la navegación
principal. Las regresiones cubren sesión sin identificador, cierre y cambio de
usuario, aislamiento de la cola, JSON válido y exclusión de identificadores
heredados. Antes de desplegar, comprobar también login, envío y reconexión contra
el receptor autorizado de DEV con cuentas y eventos de prueba.

## TODO auditoria

- Definir el catalogo de eventos auditables por modulo: vista de paciente, busqueda, apertura de historia, creacion/edicion/eliminacion, descarga/impresion, cambios de permisos y errores de integracion.
- Integrar `useAuditLogger` en los flujos con PHI o acciones clinicas sensibles: registro de paciente, CRED, salud materna, vacunacion, ordenes, dispensing, FUA, VIH, ward, emergency, billing y stock.
- Alinear el payload de auditoria con el backend definitivo: usuario, paciente, visita/consulta, encounter, modulo, accion, timestamp, resultado y contexto offline.
- Definir politica de persistencia offline y reintento: cola local, cifrado, flush al reconectar y manejo de duplicados.
- Agregar pruebas de que los eventos sensibles se registran y de que no se filtra PHI innecesaria en payloads de auditoria.
- Documentar que eventos deben bloquear la accion si la auditoria falla y cuales pueden continuar con reintento posterior.

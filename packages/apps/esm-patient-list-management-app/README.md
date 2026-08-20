# esm-patient-list-management-app

App para crear y administrar listas de pacientes.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 29733, Ley de Protección de Datos Personales (Perú).

## Límites funcionales

- Crea, edita y elimina listas de pacientes.
- Agrega o remueve pacientes, y muestra el detalle de cada lista.
- No sustituye la búsqueda global de pacientes ni el registro demográfico.
- No ejecuta workflows clínicos; su foco es la gestión operativa de listas.

## Integraciones

- APIs de listas de pacientes y relaciones con pacientes individuales.
- Componentes de dashboard, tablas, overlays y formularios de edición.
- Modo offline y sincronización cuando el entorno lo requiere.

## Offline contract

A failed first download removes only the current user's newly-created offline-list membership, so an incomplete patient is not presented as available offline. A failed refresh preserves a membership that existed before the attempt and marks its synchronization as failed so the user can retry without discarding previously downloaded data.

Clinical responses are still stored in the origin-wide OpenMRS cache. Shared devices must use a dedicated OS/browser profile per authorized user until cache partitioning or verified logout/removal purging is implemented.

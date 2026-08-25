# esm-patient-common-lib

This is a library of components and utilities shared across widgets in the patient chart. These include:

- Custom components for card headers, error and empty states and pagination.
- Custom hooks for managing workspaces, concept metadata and pagination.

## Financiador de persona a visita

`src/financiador/financiador.resource.ts` es el punto compartido para copiar la afiliación administrativa
de la persona a la cobertura efectiva de una visita. El contrato es:

| Financiador efectivo | Atributos de visita                                                        |
| -------------------- | -------------------------------------------------------------------------- |
| SIS                  | financiador, número de afiliación, estado SIS y fecha/hora de consulta SIS |
| Otra IAFAS           | financiador y número de póliza                                             |
| Autofinanciamiento   | solo financiador                                                           |
| Ausente              | ningún atributo dependiente; se devuelve una razón de revisión             |

La clasificación compartida distingue la ausencia de financiador de un
financiador no-SIS registrado explícitamente. El contrato de elegibilidad para
triaje es:

| Estado SIS      | Significado                                 | Triaje       | FUA            |
| --------------- | ------------------------------------------- | ------------ | -------------- |
| `active`        | SIS vigente con bundle completo             | permitido    | candidato      |
| `notApplicable` | Financiador explícito distinto de SIS       | permitido    | no corresponde |
| `missing`       | Financiador ausente o bundle SIS incompleto | revisar/Caja | no corresponde |
| `inactive`      | SIS no vigente                              | revisar/Caja | no corresponde |
| `pending`       | Acreditación SIS pendiente                  | revisar/Caja | no corresponde |
| `notConsulted`  | Acreditación SIS todavía no consultada      | revisar/Caja | no corresponde |

`notApplicable` nunca representa un financiador nulo o vacío. La función
`isTriageFinancingEligible` centraliza este criterio para Citas, Hoja Clínica y
Colas; no modifica la barrera propia de FUA, que continúa exigiendo SIS vigente.

La copia normaliza productos SIS legacy al concepto SIS, nunca usa DNI/CE/pasaporte como afiliación,
elimina complementos incompatibles y es idempotente para poder reparar una escritura parcial sobre la
misma visita. Con `onlyFillMissing`, el financiador elegido manualmente en la visita prevalece y no se
mezclan los complementos de una afiliación distinta. Si la visita no tiene financiador pero conserva número,
estado o fecha huérfanos, esos valores se eliminan antes de adoptar el financiador de la persona; nunca se
reclasifican como datos de la nueva IAFAS.

En una sincronización explícita (`onlyFillMissing: false`), cambiar de financiador invalida primero el estado
SIS y los complementos anteriores. Al salir de SIS conserva el financiador previo como marcador recuperable
mientras prepara número/fecha y persiste el nuevo financiador al final. Al entrar a SIS confirma primero ese
financiador, antes de retirar los complementos de la IAFAS anterior, de modo que un fallo del commit conserve el
bundle original y cualquier fallo posterior quede visible como SIS pendiente. El estado SIS se escribe
siempre al final como marcador de commit. Si el financiador SIS no cambia pero cambia número, fecha o estado,
el estado anterior se elimina antes de cualquier modificación y se recrea al final. Así, un fallo parcial deja
una visita incompleta y visible para reintento, no una acreditación aparentemente válida.

Los UUID canónicos de atributos de visita son:

- Financiador: `3a988e33-a6c0-4b76-b924-01abb998944b`.
- Número de Seguro: `aac48226-d143-4274-80e0-264db4e368ee`.
- Estado de Acreditación SIS: `5e13e902-2030-4f65-b9d5-9a4810c9a603`.
- Fecha y Hora de Consulta SIS: `e3a66f60-4abe-4948-b323-7c4935d8eb8a`.

Estos cuatro tipos de atributo de visita y sus cuatro fuentes de persona son un
contrato canónico entre Hoja Clínica, Visitas Activas y FUA; no deben
sobreescribirse en un solo consumidor. La copia requiere conjuntamente `Get
People`, `Get Patients`, `Get Visits`, `Edit Visits` y `Get Visit Attribute
Types`. `canCopyFinanciadorToVisit` expone ese preflight y
`isFinanciadorCopyAuthorizationError` evita tratar 401/403 como fallos
transitorios reintentables.

La función segura no revierte ni bloquea la atención si falla una escritura administrativa: devuelve el
resultado para que cada flujo muestre recuperación visible. El inicio de consulta ofrece reintento sobre
la misma visita únicamente ante fallos transitorios; 401/403 producen una derivación determinística sin
un botón que volvería a fallar. Emergencia conserva su política no bloqueante.

## Offline visit queue contract

Automatic offline-visit creation refreshes local state only after a successful queue write, preventing rejected writes
from becoming automatic retry loops. Queue write and refresh failures are consumed without rendering session, storage,
endpoint, or patient details. Callers that explicitly create an offline visit remain responsible for handling the
returned promise and presenting fixed, non-technical feedback.

## Fresh patient vital-status guard

`fetchFreshPatientVitalStatus` and `assertFreshPatientIsAlive` always use a
unique, network-only REST request so a service-worker patient cache cannot
authorize a clinical write. Both accept an optional `AbortSignal`; offline
synchronization handlers must pass their item-scoped signal so an owner/session
change or cancellation cannot leave an untracked guard request running.

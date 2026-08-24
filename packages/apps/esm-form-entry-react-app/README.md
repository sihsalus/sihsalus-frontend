# esm-form-entry-react-app

App base para la captura y renderizado de formularios clínicos.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Renderiza formularios, secciones, controles y lógica de entrada de datos de la atención.
- Centraliza la experiencia de captura para otros módulos que reutilizan el motor de formularios.
- No define reglas clínicas específicas de un dominio ni casos de negocio de alto nivel.
- No implementa flujos del paciente por sí misma; actúa como capa de presentación y entrada.
- Las ediciones fallan de forma cerrada si la atención indicada no puede cargarse: se muestra un error genérico y no
  se habilita el guardado ni se crea una atención nueva como alternativa.

## Integraciones

- Fuentes de datos, esquema de formularios y almacenamiento local/remoto.
- Hooks, store y componentes de renderizado compartidos.
- Módulos consumidores que montan formularios clínicos sobre este motor.

## Offline contract

Before a new encounter payload is queued, the producer copies the client-generated, stable queue content UUID into the
encounter create payload and persists both as part of the same queue insertion. Concurrent replacements of the same
queue item therefore retain the same recovery key. A matching UUID already supplied by the form pipeline is preserved;
a conflicting or non-canonical UUID is rejected before queue mutation. The producer does not mutate its caller's
object. This identifier is the consumer's recovery key after an interrupted create or a lost response and must never
change after the first possible encounter POST.

Same-ID replacement is guarded inside the queue transaction. Durable attempt/completion checkpoints are preserved and
their clinical payloads cannot be changed. An existing row without a checkpoint is also immutable because older code
did not record whether a write had already started. In particular, an ambiguous historical encounter without the
stable recovery UUID cannot be converted into a new create by editing or requeueing it.

Form schemas and definitions are considered synchronized only when service-worker route registration and a confirmed
fresh network fetch both succeed. Refresh requests cannot fall back to an existing cached response; the stable cache
entry is replaced only after a successful response, and a failed refresh preserves the previous offline copy. The
service worker reports controlled failures as `{ success: false }`; callers must treat that result as a failed download
rather than as a fulfilled synchronization.

The location and provider metadata required by offline form entry is refreshed as one all-settled batch. Every route
registration is checked and every resource attempt finishes. An expected offline transition neither starts a refresh
nor produces a global error notification; the previous cache remains available. An incomplete batch while the client
is still online produces fixed translated warning feedback without exposing URLs, identifiers, or backend error details.

Clinical cache content remains origin-wide. Shared devices require an isolated OS/browser profile per authorized user until cache partitioning or verified logout/removal purging is implemented.

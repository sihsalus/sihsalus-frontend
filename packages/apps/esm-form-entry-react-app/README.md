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

## Integraciones

- Fuentes de datos, esquema de formularios y almacenamiento local/remoto.
- Hooks, store y componentes de renderizado compartidos.
- Módulos consumidores que montan formularios clínicos sobre este motor.

## Offline contract

Form schemas and definitions are considered synchronized only when service-worker route registration and a confirmed
fresh network fetch both succeed. Refresh requests cannot fall back to an existing cached response; the stable cache
entry is replaced only after a successful response, and a failed refresh preserves the previous offline copy. The
service worker reports controlled failures as `{ success: false }`; callers must treat that result as a failed download
rather than as a fulfilled synchronization.

The location and provider metadata required by offline form entry is refreshed as one all-settled batch. Every route
registration is checked, every resource attempt finishes, and any incomplete batch produces fixed translated feedback
without exposing URLs, identifiers, or backend error details.

Clinical cache content remains origin-wide. Shared devices require an isolated OS/browser profile per authorized user until cache partitioning or verified logout/removal purging is implemented.

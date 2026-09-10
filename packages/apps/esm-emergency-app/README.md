# esm-emergency-app

App para flujos de urgencias y triage.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Administra la experiencia operativa del servicio de emergencia.
- Incluye triage, paneles de urgencias, flujos de atención y vistas de seguimiento clínico.
- No gestiona camas de hospitalización ni el ciclo completo de admisión/egreso.
- No sustituye módulos especializados como laboratorio, farmacia o facturación.
- Permite iniciar atención de pacientes no identificados o incapaces de comunicarse sin bloquear por falta de DNI.

## Identidad en emergencia

El flujo de emergencia puede registrar o seleccionar un paciente y luego crear visita/cola. Para pacientes no identificados o incapaces, debe capturar:

- condición de comunicación,
- estado de identificación,
- responsable, institución o autoridad,
- vínculo o tipo de responsable cuando se conoce,
- servicio/ubicación y contexto operativo de ingreso.

La tabla de emergencia debe permitir ubicar al paciente por HCE/código temporal, responsable, estado de identificación, condición de comunicación, servicio, ubicación y estado de cola. No debe depender del DNI como identificador principal.

## Búsqueda y filtros de la cola

La búsqueda y los filtros se aplican conjuntamente a las entradas cargadas.
La búsqueda ignora mayúsculas y espacios al inicio o al final. `Limpiar filtros`
restablece tanto el texto buscado como las selecciones visibles. Si una
actualización deja sin coincidencias un filtro activo, su selección permanece
visible y puede limpiarse.

Cambiar la búsqueda, un filtro o el tamaño de página vuelve a la primera página.
La actualización de datos conserva la página actual mientras siga existiendo;
si desaparece, muestra la última página disponible. Estos controles afectan la
vista, sin modificar la prioridad clínica ni guardar cambios en las entradas.

Cuando se solicita una cola concreta, primero se valida contra el catálogo de
colas de la ubicación. Un fallo de ese catálogo se muestra como error de carga,
incluidos los errores de sesión o permisos; no se presenta como una cola vacía
ni se consulta otra cola como alternativa. La revalidación permite recuperar la
cola solicitada cuando vuelve a estar disponible el catálogo. La consulta sin
una cola concreta conserva su comportamiento independiente del catálogo.

Las regresiones locales están en
`src/emergency-dashboard/emergency-queue-table/emergency-queue-table.component.test.tsx`
y `src/resources/emergency-queue-loading.test.tsx`.
La aceptación del flujo requiere un smoke con datos sintéticos en DEV/QLTY:
combinar filtros, limpiar selecciones y comprobar la paginación mientras cambia
la cola. Las pruebas locales no sustituyen esa validación del backend desplegado.

## Integraciones

- APIs y recursos de urgencias, triage y contexto clínico.
- Componentes de panel, home de emergencia y flujos modales.
- Dependencias compartidas para estado, navegación y errores.
- Registro de pacientes, Patient Search y Libro de Atenciones para continuidad administrativa.

## Recuperación al abrir una atención

El inicio desde la cola confirma primero el estado en el servidor y espera el
resultado del formulario de triaje compartido. Si su apertura falla o se
cancela, el modal conserva el estado confirmado y ofrece reintentar solamente
la apertura. No revierte la cola ni vuelve a enviar una actualización ya
confirmada. Las peticiones repetidas mientras se abre el formulario se ignoran.

Un error al actualizar la vista de la cola se comunica por separado y no se
interpreta como fallo del cambio guardado. El launcher de atención v1 conserva
su contrato sin valor de retorno: se recuperan sus excepciones síncronas; no
proporciona una confirmación asíncrona equivalente al formulario v2 de triaje.
La aceptación en DEV/QLTY debe comprobar apertura cancelada, apertura fallida,
reintento y el estado final de una entrada sintética.

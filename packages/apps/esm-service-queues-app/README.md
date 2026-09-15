# Service Queues / Colas de atencion

The `Service Queues` app is a frontend module that enables users to track a patient's progress as they move through a clinic. Users can see an overview of various clinic metrics such as:

- The number of active visits.
- The number of patients waiting for a particular service.
- The average number of minutes spent by patients waiting for a service.

The key component of the service queue app is the `Active Visits` table. It displays a tabular overview of the active visits ongoing in a facility and the wait time of patients. Users can add patients to the service queue by starting visits for them. They can also view information from the current active visits as well as the previous visit on each queue entry by clicking the table extension slot. Users can also change the priority and status of an entry in the queue from the UI, effectively moving a patient from one point in the queue to another. In order to indicate that a patient is currently attending service, click on the bell icon. In order to edit an entry, click the pencil icon.

Amend the following concepts in the configuration schema to get started using the module:

- `defaultPriorityConceptUuid` - concept UUID for `not urgent`.
- `defaultStatusConceptUuid` - concept UUID for `waiting`.
- `finishedServiceStatusConceptUuid` - concept UUID for `service finished`; se usa al completar y derivar el triaje.
- `emergencyPriorityConcept` - concept UUID for `emergency`.

After configuring the concepts, add the services according to the facility setup by clicking the `Add new service` button.

In order to configure rooms that provide different services, click the `Add new room` button. To view patients attending service in different rooms, click the `Queue screen` button.

You should now be able to leverage the service queues module 🎉

## Terminologia SIH Salus

- `Service queues` se traduce como `Colas de atencion`.
- `Queue screen` debe mostrarse como `Pantalla de colas` o un nombre operativo mejor definido por el establecimiento.
- `Queue entry` es la posicion/registro del paciente en la cola.
- `Room` puede mapear a ambiente, consultorio o sala segun configuracion local.
- `Service` debe mapear a servicio/UPS cuando aplique.

## Dependencias backend/content

- Conceptos de prioridad y estado configurados en `config-schema`.
- `appointmentTriage` replica únicamente el contrato de enrutamiento que Colas necesita para operar sin cargar el microfrontend de Citas. `config-schema.test.ts` exige que permanezca idéntico al contrato canónico de `@sihsalus/esm-appointments-app`.
- Servicios, rooms y ubicaciones configurados para el establecimiento.
- Visitas activas para pacientes en cola.
- Providers/usuarios asociados cuando se usa asignacion por prestador o room.

La configuración `appointmentTriage` pertenece a Colas y replica únicamente el contrato de enrutamiento necesario; no
carga el microfrontend ni exige el permiso `app:home.citas`. Mientras este contrato termina de cargar, la fila muestra
`Verificando` y no ofrece una acción genérica que pueda confundirse con el triaje.

Después de guardar el triaje y recibir la confirmación del encounter, la entrada se mueve a la cola clínica configurada
para la cita, conserva su prioridad y adopta el estado definido por `finishedServiceStatusConceptUuid` (por defecto,
`Servicio Finalizado`). Ya no se reutiliza `defaultStatusConceptUuid` (`Esperando`) para esta transición.

## Contrato RBAC actual

| Capacidad                                                                          | Privilegios frontend acumulativos                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ver Colas de atención                                                              | `app:home.colasAtencion`                                                                                                                                                                      |
| Buscar un paciente y agregarlo con una consulta activa o a una cola administrativa | `app:home.colasAtencion.editar` + `Get Patients` + `Get Locations` + `Get Visits` + `Edit Visits` + `Get Visit Attribute Types` + `Get Queue Entries` + `Get Queues` + `Manage Queue Entries` |
| Crear una consulta nueva para agregar al paciente                                  | Los anteriores + `Add Visits` + `Get Visit Types`                                                                                                                                             |
| Resolver el acompañante de un menor al crear la consulta                           | `Get People` **o** (`app:opciones.registrarAcompanante` + `Add People`)                                                                                                                       |
| Modificar una entrada de cola                                                      | `app:home.colasAtencion.editar` + `Get Queue Entries` + `Get Queues` + `Manage Queue Entries`                                                                                                 |
| Limpiar todas las entradas                                                         | Los anteriores + `app:home.colasAtencion.limpiar`                                                                                                                                             |
| Administrar servicios de cola                                                      | `app:home.colasAtencion.editar` + `Get Queues` + `Manage Queues`                                                                                                                              |
| Administrar ambientes/rooms                                                        | `app:home.colasAtencion.editar` + `Get Queue Rooms` + `Get Queues` + `Manage Queue Rooms`                                                                                                     |
| Mostrar la acción de triaje y registrar signos vitales                             | `app:home.colasAtencion` + `app:hoja.clinica.signosVitales.editar`; no requiere `app:home.colasAtencion.editar`                                                                               |
| Mover automáticamente el triaje guardado a la cola clínica                         | El backend valida `Manage Queue Entries`; este permiso debe formar parte del rol operativo de triaje                                                                                          |
| Ver el resumen de consulta desde Colas                                             | `app:home.colasAtencion` + `app:hoja.clinica.resumenConsulta`                                                                                                                                 |
| Crear o editar el resumen de consulta desde Colas                                  | `app:home.colasAtencion` + `app:hoja.clinica.resumenConsulta.editar`                                                                                                                          |

Los arreglos anteriores tienen semántica AND. La lectura y la modificación del resumen de consulta están separadas: el usuario puede ver los datos con el privilegio de lectura, pero la acción de crear o editar y el workspace requieren el privilegio de edición.

Los privilegios nativos de Queue/Visit siguen siendo obligatorios donde aparecen en `src/routes.json`; el RBAC de la UI no reemplaza las validaciones del backend.

El launcher exige el conjunto común de lectura y escritura de colas. `Add Visits` y `Get Visit Types` se evalúan dinámicamente después de seleccionar al paciente: solo son obligatorios cuando la UPSS exige consulta y no existe una activa. La ruta hija de inicio de consulta conserva el conjunto completo como segunda barrera. Las ramas que reutilizan una consulta o crean una entrada administrativa no reciben permisos clínicos innecesarios.

Antes de abrir esa ruta hija también se valida la edad. La carga, el error o una fecha de nacimiento inválida fallan de forma cerrada y visible. Para un menor se acepta la búsqueda de una persona existente o el par completo que permite registrarla; si no existe ninguna vía, el formulario de consulta no se abre.

Excepción actual: la extensión `visit-form-queue-fields` declara únicamente privilegios nativos de Queue y no exige `app:home.colasAtencion.editar`. Debe conservarse solo si iniciar una consulta está autorizado para crear su entrada de cola; de lo contrario, hay que alinear ese registro y sus pruebas con la política general de edición.

## Contratos de UI

- La tabla de pacientes en cola consulta cambios cada 15 segundos mientras la pestaña está visible y hay conexión, y vuelve a consultar al recuperar el foco o la conexión. Conserva los filtros y la última lista completa durante la actualización; solo reemplaza las filas cuando terminaron de cargar todas las páginas. Si falla una página, mantiene la lista anterior y muestra el error mediante el manejo existente. Es actualización periódica, no una suscripción push del backend.
- El resumen de consulta se identifica por la combinación exacta de Encounter Type y Form configurados. Colas muestra primero los diagnósticos nativos activos y usa las observaciones históricas solo como fallback sin duplicarlas.
- El guardado de triaje que queda pendiente en el equipo no mueve al paciente. La transición automática solo se ejecuta después de una respuesta confirmada del encounter; después de sincronizar un triaje offline, refrescar la cola y usar `Enviar a atención`. No borrar la acción offline para forzar el cambio de cola.
- La entrada y la acción de triaje aceptan SIS vigente con bundle completo o un financiador no-SIS registrado explícitamente. Mientras la cobertura está cargando o no pudo leerse, la acción permanece verificando y no afirma que corresponda Caja. Un financiador ausente, o un SIS incompleto, inactivo, pendiente o no consultado, mantiene el bloqueo y la derivación a Caja.
- La visita obtenida para el panel debe incluir UUID y ubicación verificables antes de habilitar la creación o edición. Al cerrar el workspace, el panel vuelve a consultar la visita.
- La pantalla de colas no debe quedar en blanco si faltan rooms o servicios; debe mostrar una configuracion pendiente accionable.
- Si no hay camas, rooms o servicios configurados, el mensaje debe decir que falta configuracion de ubicacion/servicio, no lanzar error generico.
- Las acciones de cambiar estado/prioridad deben fallar de forma visible si no hay conceptos configurados.
- Los nombres de menu deben usar lenguaje final para usuarios clinicos, no nombres internos del paquete.

## Flujo obstétrico

`obstetricCare.enabled` habilita las acciones en `config/frontend.json`. Los UUIDs
pertenecen al contrato de content; no se deduce la especialidad por nombres:

- Consulta externa: la cita de atención ambulatoria por obstetra pasa por el
  triaje existente y permanece en la cola compartida de Consulta Externa. La
  acción `Atender Obstetricia` requiere el vínculo persistido con esa cita y el
  triaje guardado en el servidor. Las coincidencias aproximadas por fecha no
  habilitan esta acción. Una atención sin cita conserva las acciones generales.
- Centro Obstétrico: usa su cola propia, incluso cuando la consulta proviene de
  Hospitalización o Emergencia. El filtro UPSS usa la ubicación de la cola
  receptora; solo el triaje compartido usa la UPSS de la consulta. No exige una
  cita, el triaje ambulatorio ni su barrera de financiamiento.

`Atender Obstetricia` verifica paciente, consulta activa única y estado antes de
pasar a Atendiéndose y abrir el dashboard materno autorizado. Conserva la cola y
prioridad, y reutiliza la reconciliación existente si se pierde una respuesta.
`Continuar atención obstétrica` no crea otra transición. El acceso necesita
sesión autenticada, lectura de historia y colas, permisos nativos de pacientes,
consultas y edición de entradas, y lectura/edición del panel materno elegido.
La rama ambulatoria también necesita `View Appointments`. Las acciones se
deshabilitan sin conexión; un triaje pendiente de sincronización no las habilita.

`Finalizar en cola` pide confirmación y cierra únicamente la entrada operativa.
El guardado clínico, finalización de la cita, cierre de consulta y egreso materno
conservan sus flujos existentes. El acceso requiere que `esm-salud-materna-app`
esté incluido en el SPA; cada formulario mantiene sus permisos y requisitos.

La validación remota debe cubrir ambos recorridos con pacientes sintéticos:
llegada y triaje, traslado desde Hospitalización/Emergencia, guardar y recargar
el formulario, continuar y finalizar en cola, falta de permisos, consulta
cerrada o múltiple, fallo de red y reintento. La revisión de código no demuestra
que el content, los roles ni los formularios estén instalados en DEV/QLTY.
Para deshabilitar las acciones nuevas, establecer `obstetricCare.enabled=false`;
las entradas y acciones generales de cola se conservan.

## Vista visual de colas

### Pérdida de conexión y recuperación

- La vista indica `Sin conexión` y muestra como referencia las últimas entradas
  completas cargadas para los filtros actuales. Advierte que pueden haber
  cambiado; los contadores quedan sin confirmar. Si todavía no se cargaron
  entradas, la desconexión no se presenta como una cola vacía.
- `Actualizar cola` vuelve a consultar las entradas y la configuración de
  servicios y estados. Se deshabilita sin conexión y durante la actualización.
  Los avisos y el control también aparecen dentro de la pantalla completa.
- La lectura compartida de entradas mantiene activa su consulta SWR para
  recuperar los datos al reconectar. Los errores se eliminan al completar una
  lectura correcta. Servicios y estados también se vuelven a consultar al
  reconectar; si el servidor sigue inaccesible, se puede reintentar con el botón.
- Cada actualización de entradas solicita todas las páginas al servidor con
  `cache: no-store`. Solo sustituye el resultado anterior cuando termina la
  lectura completa. Un fallo en una página no mezcla resultados antiguos con
  nuevos ni conserva entradas de otro servicio al cambiar el filtro.
- La recuperación de lectura beneficia también a las tablas y los indicadores
  que consumen `useQueueEntries`. La vista visual oculta las entradas anteriores
  ante una respuesta de acceso denegado (401/403).
- Esta vista usa la memoria de la sesión abierta; no prepara una descarga
  persistente de la cola para recargarla sin conexión. Las transiciones de
  pacientes y la sincronización del triaje conservan sus contratos existentes.

Validar con datos sintéticos en DEV/QLTY: carga inicial sin conexión, corte
durante una descarga de varias páginas, reconexión, error del servidor con el
navegador conectado, cambio de filtros y actualización desde Emergencia. La
prueba local de recuperación usa SWR real con respuestas sintéticas; no sustituye
la aceptación del worker y el backend del entorno.

### Presentación y pantalla completa

- `Volver a la tabla de colas` está al pie del tablero, después del flujo de
  atención. Conserva los filtros compartidos de UPSS, servicio y estado.
- `Pantalla completa` amplía únicamente el tablero mediante la API de pantalla
  completa del navegador. La cabecera conserva el contador, un resumen de los
  filtros activos y el botón para salir. También se puede salir con `Esc`;
  al cambiar de modo, el foco vuelve al control de pantalla completa.
- La ampliación conserva las entradas y su orden, las actualizaciones, los
  enlaces existentes y las autorizaciones de la ruta. Es una vista para el
  personal autorizado; no convierte el tablero en una pantalla pública ni
  anonimiza los datos que ya muestra.
- Si el navegador no admite pantalla completa, el control queda deshabilitado
  con una explicación. Si rechaza la solicitud, aparece un mensaje seguro dentro
  del tablero y se conserva el modo actual.
- Las columnas muestran completos los nombres de estado y conservan los enlaces
  a pacientes accesibles con teclado. En pantalla completa, las listas usan el alto disponible
  con desplazamiento independiente. El indicador de actualización ocupa su propio
  espacio junto a los controles, sin superponerse al contador.
- Durante la carga o ante un error de entradas o estados, el contador indica que
  no está disponible. Una lectura fallida de estados no se presenta como una cola
  vacía. Se conservan los filtros clínicos y las reglas de transición de colas.
- Validación mínima: pruebas de renderizado, filtros, carga/error, entrada/salida
  de pantalla completa, rechazo del navegador y disponibilidad de la API; smoke
  de navegador con datos sintéticos para dimensiones, desplazamiento, foco y
  salida mediante botón/Escape. La validación contra DEV/QLTY se registra aparte.

Capturas con datos sintéticos en un fixture local del componente:
[vista normal](docs/images/visual-queue-normal.png),
[pantalla completa](docs/images/visual-queue-fullscreen.png) y
[aviso sin conexión](docs/images/visual-queue-offline-fullscreen.png).

## Riesgos conocidos

- Configuracion incompleta de conceptos produce errores dificiles de diagnosticar.
- El modulo mezcla ubicacion, servicio, room y prestador; documentar el modelo usado por cada establecimiento antes de desplegar.
- La pantalla de colas puede depender de datos de backend que no existen en ambientes nuevos.

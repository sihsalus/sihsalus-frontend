# Service Queues / Colas de atencion

The `Service Queues` app is a frontend module that enables users to track a patient's progress as they move through a clinic. Users can see an overview of various clinic metrics such as:

- The number of active visits.
- The number of patients waiting for a particular service.
- The average number of minutes spent by patients waiting for a service.

The key component of the service queue app is the `Active Visits` table. It displays a tabular overview of the active visits ongoing in a facility and the wait time of patients. Users can add patients to the service queue by starting visits for them. They can also view information from the current active visits as well as the previous visit on each queue entry by clicking the table extension slot. Users can also change the priority and status of an entry in the queue from the UI, effectively moving a patient from one point in the queue to another. In order to indicate that a patient is currently attending service, click on the bell icon. In order to edit an entry, click the pencil icon.

Amend the following concepts in the configuration schema to get started using the module:

- `defaultPriorityConceptUuid` - concept UUID for `not urgent`.
- `defaultStatusConceptUuid` - concept UUID for `waiting`.
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
- Servicios, rooms y ubicaciones configurados para el establecimiento.
- Visitas activas para pacientes en cola.
- Providers/usuarios asociados cuando se usa asignacion por prestador o room.

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
| Realizar triaje, registrar signos y mover a la cola clínica                        | `app:home.colasAtencion` + `app:hoja.clinica.signosVitales.editar` + `Get Queue Entries` + `Get Queues` + `Manage Queue Entries`; no requiere `app:home.colasAtencion.editar`                 |
| Crear el resumen de consulta desde Colas                                           | `app:home.colasAtencion` + `app:hoja.clinica.resumenConsulta`                                                                                                                                 |

Los arreglos anteriores tienen semántica AND. El resumen de consulta usa actualmente el mismo privilegio `app:hoja.clinica.resumenConsulta` para mostrar la sección y abrir el workspace de creación; no existe una separación frontend de escritura para esta acción. Si la política exige distinguir lectura y edición, debe implementarse y probarse un privilegio específico en Patient Notes y en esta integración.

Los privilegios nativos de Queue/Visit siguen siendo obligatorios donde aparecen en `src/routes.json`; el RBAC de la UI no reemplaza las validaciones del backend.

El launcher exige el conjunto común de lectura y escritura de colas. `Add Visits` y `Get Visit Types` se evalúan dinámicamente después de seleccionar al paciente: solo son obligatorios cuando la UPSS exige consulta y no existe una activa. La ruta hija de inicio de consulta conserva el conjunto completo como segunda barrera. Las ramas que reutilizan una consulta o crean una entrada administrativa no reciben permisos clínicos innecesarios.

Antes de abrir esa ruta hija también se valida la edad. La carga, el error o una fecha de nacimiento inválida fallan de forma cerrada y visible. Para un menor se acepta la búsqueda de una persona existente o el par completo que permite registrarla; si no existe ninguna vía, el formulario de consulta no se abre.

Excepción actual: la extensión `visit-form-queue-fields` declara únicamente privilegios nativos de Queue y no exige `app:home.colasAtencion.editar`. Debe conservarse solo si iniciar una consulta está autorizado para crear su entrada de cola; de lo contrario, hay que alinear ese registro y sus pruebas con la política general de edición.

## Contratos de UI

- La pantalla de colas no debe quedar en blanco si faltan rooms o servicios; debe mostrar una configuracion pendiente accionable.
- Si no hay camas, rooms o servicios configurados, el mensaje debe decir que falta configuracion de ubicacion/servicio, no lanzar error generico.
- Las acciones de cambiar estado/prioridad deben fallar de forma visible si no hay conceptos configurados.
- Los nombres de menu deben usar lenguaje final para usuarios clinicos, no nombres internos del paquete.

## Riesgos conocidos

- Configuracion incompleta de conceptos produce errores dificiles de diagnosticar.
- El modulo mezcla ubicacion, servicio, room y prestador; documentar el modelo usado por cada establecimiento antes de desplegar.
- La pantalla de colas puede depender de datos de backend que no existen en ambientes nuevos.

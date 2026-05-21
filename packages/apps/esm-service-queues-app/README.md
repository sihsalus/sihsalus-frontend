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

## Contratos de UI

- La pantalla de colas no debe quedar en blanco si faltan rooms o servicios; debe mostrar una configuracion pendiente accionable.
- Si no hay camas, rooms o servicios configurados, el mensaje debe decir que falta configuracion de ubicacion/servicio, no lanzar error generico.
- Las acciones de cambiar estado/prioridad deben fallar de forma visible si no hay conceptos configurados.
- Los nombres de menu deben usar lenguaje final para usuarios clinicos, no nombres internos del paquete.

## Riesgos conocidos

- Configuracion incompleta de conceptos produce errores dificiles de diagnosticar.
- El modulo mezcla ubicacion, servicio, room y prestador; documentar el modelo usado por cada establecimiento antes de desplegar.
- La pantalla de colas puede depender de datos de backend que no existen en ambientes nuevos.

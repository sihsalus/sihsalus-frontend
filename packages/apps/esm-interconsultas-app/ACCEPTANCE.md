# Criterios de aceptacion de interconsultas

Este documento define el contrato funcional que debe cumplir el flujo de interconsultas. Los casos se validan con usuarios distintos para el profesional solicitante y el profesional receptor; una sesion de administrador no sustituye esa separacion.

## Precondiciones

- El paciente tiene una visita activa y una ubicacion de atencion.
- El solicitante tiene un `currentProvider` asociado a su usuario.
- El receptor pertenece al servicio destino y tiene permisos para gestionar interconsultas.
- El catalogo de destinos usa un concept set dedicado y contiene los servicios habilitados, incluida Odontologia General.
- Los privilegios configurados en frontend existen con el mismo nombre en el backend desplegado.

## AC-01 - Solicitar una interconsulta

**Dado** un profesional autenticado dentro de una visita activa

**Cuando** selecciona un servicio permitido, prioridad y motivo clinico, y confirma la solicitud

**Entonces**:

- Se crea una sola orden del tipo Interconsulta.
- La orden referencia al paciente, visita, ubicacion y profesional autenticado.
- La fecha de activacion es valida respecto de la fecha del encuentro.
- Una solicitud programada exige una fecha futura; las demas no guardan `scheduledDate`.
- El encuentro y la orden se guardan de forma atomica: nunca queda un encuentro huerfano.
- Reintentar despues de una respuesta incierta del servidor no duplica la solicitud.
- Un usuario sin `currentProvider` no puede atribuir la orden a otro profesional.

## AC-02 - Enrutar y proteger la solicitud

**Dado** que existe una orden solicitada para un servicio destino

**Cuando** los usuarios consultan la bandeja

**Entonces**:

- El solicitante la ve en el historial del paciente.
- El servicio receptor la ve en Solicitadas.
- Un usuario de otro servicio no puede recibirla, recogerla, rechazarla ni responderla.
- Un usuario con permiso de lectura del home puede abrir el detalle sin necesitar permisos adicionales del chart.
- Un usuario sin permiso de interconsultas no puede abrir la bandeja mediante URL directa.
- Odontologia General es seleccionable desde el formulario y no requiere crear la orden por REST manualmente.

## AC-03 - Recibir y atender

**Dado** una orden en estado Solicitada

**Cuando** un profesional autorizado la recibe y posteriormente la recoge

**Entonces**:

- Las transiciones son `REQUESTED -> RECEIVED -> IN_PROGRESS`.
- Se registra quien y cuando realizo cada transicion.
- Al recogerla queda identificado el profesional receptor.
- Dos usuarios no pueden recoger simultaneamente la misma orden.
- Una transicion basada en una version obsoleta de la orden se rechaza y la bandeja se refresca.
- No se permiten saltos o retrocesos de estado no definidos por el flujo.

## AC-04 - Responder la interconsulta

**Dado** una orden En atencion

**Cuando** el profesional receptor registra la respuesta y recomendaciones

**Entonces**:

- Se crea un encuentro de respuesta con la fecha real de respuesta, ubicacion y profesional receptor.
- Las observaciones quedan ligadas a la orden original.
- La fecha mostrada en el chart corresponde a la respuesta, no a la solicitud.
- La orden pasa a `COMPLETED` solamente despues de guardar la respuesta.
- Guardar la respuesta y completar la orden es atomico o compensable.
- Reintentar no crea observaciones duplicadas.
- El chart muestra respuesta, recomendaciones, autor y fecha.

## AC-05 - Rechazar, cancelar e historial

**Dado** una interconsulta activa

**Cuando** el receptor la rechaza o el solicitante la cancela

**Entonces**:

- El rechazo exige motivo y registra actor y fecha.
- Solo el solicitante o un rol autorizado puede cancelar.
- Una cancelacion crea la discontinuacion de OpenMRS y se muestra una sola vez como Cancelada.
- Una revision o renovacion se presenta como una sola cadena de ordenes, no como solicitudes independientes contradictorias.
- Una orden respondida no puede rechazarse ni cancelarse desde una vista desactualizada.

## AC-06 - Operacion y recuperacion

**Dado** una bandeja con mas de 100 solicitudes y actividad concurrente

**Cuando** el usuario filtra, busca o pagina

**Entonces**:

- Ninguna solicitud queda oculta por un limite fijo del cliente.
- La paginacion es estable y conserva los filtros.
- Las solicitudes urgentes y luego las mas antiguas aparecen primero.
- Un error de catalogo, permisos o red se muestra de forma accionable.
- Al recuperar la conexion se refresca la bandeja sin duplicar mutaciones.
- El chart no ejecuta una solicitud REST adicional por cada acordeon cerrado.

## Matriz de automatizacion

| Caso | Unitarias/componentes | E2E con backend | Estado inicial |
| --- | --- | --- | --- |
| AC-01 | Payload, validacion, errores y atomicidad | Crear desde el workspace | Parcial |
| AC-02 | Privilegios y catalogo visible | Solicitante y receptor con roles distintos | Pendiente |
| AC-03 | Maquina de estados y concurrencia | Recibir y recoger con receptor | Parcial |
| AC-04 | Payload, orden de operaciones e idempotencia | Responder y validar procedencia | Parcial |
| AC-05 | Clasificacion y acciones permitidas | Rechazar y cancelar | Parcial |
| AC-06 | Ordenamiento, paginacion y errores | Volumen y recuperacion | Pendiente |

## Baseline DEV - 2026-07-10

- Aprobado: existen Order Type, Care Setting, Encounter Type, Encounter Role y concept de respuesta activo de tipo texto.
- Fallido: el concept set desplegado no contiene un servicio odontologico.
- Fallido: el backend desplegado aun no contiene los cuatro nombres de privilegio usados por el frontend actual.
- Brecha reproducida: la solicitud usa dos mutaciones y puede dejar un encuentro huerfano.
- Brecha reproducida: un usuario sin `currentProvider` puede seleccionar otro profesional.
- Brecha reproducida: el workspace permite una solicitud sin visita cuando se invoca directamente.
- Brecha reproducida: la respuesta se guarda en el encuentro solicitante.
- Brecha reproducida: los permisos exclusivos del home no permiten lanzar los modales registrados para el chart.
- Brecha reproducida: la URL directa de la bandeja no tiene un guard de privilegio en el componente raiz.
- Brecha reproducida: la consulta global conserva un limite fijo de 100 ordenes.
- Brecha reproducida: la busqueda de destinos no normaliza tildes ni excluye miembros retirados.

Las pruebas unitarias marcadas con `[brecha]` usan `expectKnownGap`: pasan solamente mientras el defecto siga siendo reproducible. Cuando una correccion haga pasar la asercion clinica, el helper falla y obliga a convertir el escenario en una prueba regular.

## Criterio de cierre

Un caso se considera aprobado solo cuando su prueba automatizada pasa sin usar `skip`, `fixme`, credenciales de administrador como reemplazo de los actores clinicos ni creacion manual de la orden para evitar el workspace.

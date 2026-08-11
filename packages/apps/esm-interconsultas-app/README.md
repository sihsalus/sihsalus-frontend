# esm-interconsultas-app

Microfrontend independiente para el flujo de **Interconsultas** (NTS 030-MINSA, NTS 102 — formato de atención de consulta externa), para SIHSALUS / OpenMRS O3.

## Qué hace

- **Item en Home** → `Home > Interconsultas` (slot `homepage-dashboard-slot`).
- **Bandeja global** con tabs por estado: Solicitadas, Recibidas/Pendientes, En atención, Respondidas, Rechazadas/Canceladas; filtros por servicio destino, location origen y búsqueda.
- **Solicitud desde el chart** del paciente / consulta externa: workspace `request-interconsulta-workspace` (botón en `patient-actions-slot` y en el widget del chart).
- **Pickup por otro profesional**: acciones Recibir → Atender → Responder/Rechazar desde la bandeja, sin pasar por el chart del paciente.
- **Widget en el chart** (`patient-chart-dashboard-slot` → Interconsultas) que muestra cada solicitud, su estado y la respuesta.

Los escenarios funcionales y sus criterios verificables están definidos en [ACCEPTANCE.md](./ACCEPTANCE.md). Esa matriz es el contrato para las pruebas unitarias, de componentes y E2E; el flujo no se considera cerrado mientras conserve casos marcados como parciales o pendientes.

## Contrato RBAC actual

| Superficie | Lectura | Edición / acción |
| --- | --- | --- |
| Bandeja de Home y URL directa | `app:home.interconsultas` | `app:home.interconsultas.editar` |
| Widget e historial en la hoja clínica | `app:hoja.clinica.interconsultas` | `app:hoja.clinica.interconsultas.editar` |
| Solicitar una interconsulta desde la hoja clínica | Entrada por la hoja clínica y visita activa | `app:hoja.clinica.interconsultas.editar` |

La URL directa de la bandeja está protegida dentro del componente raíz con `app:home.interconsultas`, además de los guards del manifest. En la tabla, los comandos de mutación se muestran si el usuario tiene **Home edit OR Chart edit**; este OR es explícito y no debe reemplazarse por un arreglo de `userHasAccess`, porque los arreglos se evalúan como AND.

### Brechas RBAC conocidas

- Los modales de recibir, atender, rechazar y responder están registrados solo con `app:hoja.clinica.interconsultas.editar`. Por ello, `app:home.interconsultas.editar` puede hacer visibles los comandos, pero no basta para completar el flujo desde Home.
- El detalle se ofrece desde una bandeja protegida por Home read, pero el modal de detalle exige `app:hoja.clinica.interconsultas`.
- La UI todavía no limita las acciones por el servicio destino del usuario. La pertenencia al servicio descrita en AC-02 sigue siendo un criterio pendiente, no un control implementado.

Hasta alinear esos registros, un rol operativo de la bandeja necesita también los privilegios de la hoja clínica correspondientes. Los guards frontend no sustituyen la autorización de Orders/Encounter del backend.

## Principio de no duplicación

La interconsulta **solo referencia** recursos existentes:

| Dato | Fuente (referencia) |
|---|---|
| Paciente | `order.patient` |
| Visita / encounter origen | `order.encounter` (+ `encounter.visit`) |
| Profesional solicitante | `order.orderer` |
| Location origen | `order.encounter.location` |
| Diagnóstico / contexto clínico | chart del paciente (enlazado, no copiado) |

Los **únicos datos propios** que persisten son: motivo (`instructions`), prioridad (`urgency` + `scheduledDate`), servicio/especialidad destino (`concept`), fecha solicitada (`dateActivated`), estado (`fulfillerStatus`), nota de gestión/motivo de rechazo (`fulfillerComment`) y la respuesta/contrainterconsulta (obs ligadas a la orden).

## Contrato backend (REST estándar, sin módulo nuevo)

Recurso base: **Order** con order type `Interconsulta` (`f3c2e4b6-8b5a-11e5-8e9b-12345678901b`, el mismo que usa el order basket).

| Estado normativo | Representación |
|---|---|
| Solicitada | orden `NEW`, `fulfillerStatus = null` |
| Recibida / Pendiente | `fulfillerStatus = RECEIVED` |
| En atención | `fulfillerStatus = IN_PROGRESS` (POST `order/{uuid}/fulfillerdetails/`) |
| Respondida / Completada | `fulfillerStatus = COMPLETED` + obs de respuesta |
| Rechazada | `fulfillerStatus = DECLINED` + `fulfillerComment` = motivo |
| Cancelada | orden descontinuada (`dateStopped`) por el solicitante |

- **Crear**: `POST encounter` (tipo `Interconsulta — NTS 102`, `e4834799-…`) dentro de la visita activa + `POST order`.
- **Bandeja**: `GET order?orderTypes={uuid}&v=custom:(…)` — filtrado por estado/servicio/location en cliente (el REST API no permite filtrar `fulfillerStatus null` ni combinar DECLINED+canceladas en una consulta).
- **Responder**: `POST encounter/{order.encounter.uuid}` con `obs: [{concept: respuesta, value, order: {uuid}}]` (mismo patrón que los resultados de laboratorio) y luego `fulfillerdetails → COMPLETED`. El profesional que responde queda auditado como creador de las obs y del cambio (`auditInfo`).

Todos los UUIDs son configurables vía `config-schema.ts`.

Los defaults de la distribución SIHSALUS son:

- `interconsultaOrderTypeUuid`: `f3c2e4b6-8b5a-11e5-8e9b-12345678901b`
- `orderableConceptSets`: `4bf3f465-ac91-44fa-9b1f-173daf0c89a0` (`Tipo de Servicio`)

## Ruteo por servicio destino

La interconsulta es **intra-establecimiento** (entre servicios/especialidades del mismo EESS), por lo que el ruteo normativo es por **servicio destino = `order.concept`**. La bandeja permite además filtrar por location origen. La referencia inter-establecimiento (NTS 018-MINSA referencia/contrarreferencia) es un flujo distinto y queda fuera de este módulo (ver `esm-atencion-ambulatoria-app` → CE-8).

## Deuda técnica (capa temporal documentada)

1. **No existe recurso backend propio `interconsulta`**: el estado vive en `fulfillerStatus` de Orders. Si la norma exige más campos estructurados (p. ej. profesional destino *asignado* explícitamente antes del pickup, plazos por prioridad), se necesitará un módulo OMOD propio o atributos de orden; hoy el profesional que atiende queda registrado por auditoría (creador de obs/cambio de estado), no como campo asignable.
2. **Respuesta y recomendaciones**: por defecto la respuesta usa el concept `f0000174` (respuesta de contrarreferencia). Si el diccionario incorpora concepts específicos de interconsulta (respuesta/recomendaciones), configurar `concepts.respuestaConceptUuid` y `concepts.recomendacionesConceptUuid`. Mientras `recomendacionesConceptUuid` esté vacío, las recomendaciones se anexan al texto de la respuesta (sin pérdida de dato, pero sin obs separada).
3. **Filtrado en cliente**: la bandeja trae todas las órdenes del order type y filtra por estado en el navegador. Con volúmenes altos conviene paginación server-side (requiere extender el REST API o un endpoint propio).
4. **RECEIVED es manual**: el estado "Recibida" lo marca el servicio destino desde la bandeja; no hay notificación push.

## Desarrollo

```bash
yarn workspace @sihsalus/esm-interconsultas-app build
yarn workspace @sihsalus/esm-interconsultas-app test
yarn workspace @sihsalus/esm-interconsultas-app typescript
```

E2E: `e2e/tests/interconsultas-flow.spec.ts` (flujo Doctor A solicita → Doctor B recibe/atiende/responde → respuesta visible vía API del chart).

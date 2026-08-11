# esm-appointments-app

Microfrontend para gestionar la agenda y las citas de pacientes en SIH Salus.

Terminología de dominio: `appointment` = cita, `visit` = consulta y `encounter` = atención clínica.

## Alcance funcional

- Consulta la agenda diaria, el calendario, la carga de trabajo y el historial de citas del paciente.
- Crea, edita, reprograma, cancela y marca citas como ausentes.
- Registra la llegada del paciente. Este flujo puede iniciar una consulta, vincularla con la cita y agregar al paciente a una cola, según la configuración de llegada.
- Finaliza la atención vinculada a una cita o permite regularizar una llegada/cierre inconsistente.
- No reemplaza el registro demográfico, la admisión general, la historia clínica ni la autorización del backend.

## Dependencias e integraciones

El manifest `src/routes.json` requiere:

- `appointments >= 2.1.0` para agenda y citas;
- `queue >= 3.0.0` para el ingreso a colas;
- `webservices.rest >= 2.2.0` para pacientes, personas, consultas y recursos OpenMRS.

La llegada reutiliza el workspace de inicio de consulta de `esm-patient-chart-app` y el workspace de creación de entradas de `esm-service-queues-app`. El inicio de consulta y los workspaces de búsqueda o registro de acompañante deben permanecer en `appointments-window`; así el workspace hijo no reemplaza el flujo de llegada que lo abrió.

## Contrato de privilegios

Los arreglos de privilegios se evalúan con semántica **AND**: el usuario debe tener todos los privilegios enumerados. Los privilegios de edición y finalización son capacidades independientes y no conceden por sí solos el privilegio base de lectura.

| Contexto | Capacidad | Privilegios frontend requeridos |
| --- | --- | --- |
| Inicio / Citas | Ver agenda, métricas y detalle | `app:home.citas` |
| Inicio / Citas | Crear, editar, reprogramar, cancelar, marcar ausencia o registrar llegada | `app:home.citas` + `app:home.citas.editar` |
| Inicio / Citas | Finalizar atención o regularizar cierre | `app:home.citas` + `app:home.citas.editar.finalizarAtencion` |
| Hoja clínica | Ver citas del paciente | `app:hoja.clinica.citas` |
| Hoja clínica | Crear, editar o cancelar una cita | `app:hoja.clinica.citas` + `app:hoja.clinica.citas.editar` |
| Hoja clínica | Finalizar la atención | `app:hoja.clinica.citas` + `app:hoja.clinica.citas.editar.finalizarAtencion` |

La finalización no requiere el privilegio general `...editar`; requiere el privilegio base del contexto y la capacidad específica `...finalizarAtencion`.

### Capacidades adicionales

- `app:appointments.startDate.edit`: permite cambiar la fecha de la cita. Sin este privilegio, el campo permanece de solo lectura.
- `app:appointments.issueDate.edit`: permite modificar la fecha de emisión administrativa. Sin este privilegio, el formulario conserva la fecha original también al construir el payload.
- Buscar un acompañante durante la llegada requiere además `Get People`.
- Registrar un acompañante requiere además `app:opciones.registrarAcompanante` y `Add People`.

El frontend reconoce los identificadores heredados equivalentes `app:appointments*` y `app:clinical.chart.appointments*` mediante aliases exactos en `@openmrs/esm-api`. Esta compatibilidad no crea una jerarquía: poseer un privilegio hijo no implica poseer el privilegio base.

Los guards de UI controlan visibilidad y acceso a rutas, modales y workspaces. No sustituyen la autorización del backend: los roles OpenMRS todavía deben incluir los permisos REST necesarios para leer o modificar citas, consultas, colas y personas.

## Configuración operativa

- `appointmentVisitAttributeTypeUuid` vincula la consulta activa con la cita y permite detectar cierres o llegadas que necesitan regularización.
- `appointmentArrivalRules` y `careRoutingContractVersion` determinan el enrutamiento de la llegada.
- `checkInButton` y `checkOutButton` habilitan las acciones o permiten delegarlas a una URL configurada.
- Las notas de una cita no deben superar 255 caracteres, límite del campo `patient_appointment.comments` del backend.

## Desarrollo

```bash
yarn workspace @sihsalus/esm-appointments-app test
yarn workspace @sihsalus/esm-appointments-app typescript
yarn workspace @sihsalus/esm-appointments-app build
```

El flujo operativo completo de citas, consultas y colas se describe en [docs/workflows](../../../docs/workflows/README.md).

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

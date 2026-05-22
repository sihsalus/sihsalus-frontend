# esm-staff-scheduling-app

Microfrontend O3 para Programacion de Turnos/Recursos.

## Alcance

- Registra disponibilidad de ambientes de atencion.
- Registra turnos de personal de salud por fecha, ambiente, servicio y horario.
- Genera cupos derivados por duracion y capacidad.
- Permite publicar o suspender turnos para controlar los cupos ofertables.

## Persistencia

Mientras no exista un `.omod` dedicado de RRHH/turnos, la planificacion se guarda como JSON versionado en el system setting:

`sihsalus.staffScheduling.roster`

La UI consume datos reales de OpenMRS para proveedores, ubicaciones y servicios de cita.

## Brecha backend

Para produccion de alto volumen o interoperabilidad fuerte, este modulo deberia migrar su persistencia a un `.omod` dedicado con entidades de turnos, auditoria, privilegios y endpoints REST.

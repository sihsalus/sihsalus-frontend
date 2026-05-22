# Evidencia funcional: Anexo 14 Programacion de Turnos/Recursos

El microfrontend `@sihsalus/esm-staff-scheduling-app` cubre el flujo operativo base solicitado por el Anexo 14.

| Criterio | Cobertura |
| --- | --- |
| `N1.PRG.01.01` | Usa ubicaciones OpenMRS como ambientes donde se realizan atenciones. |
| `N1.PRG.01.02` | Registra dias y horarios de disponibilidad por ambiente. |
| `N1.PRG.02.01` | Registra programacion de personal de salud, ambiente, servicio, fecha y horario. |
| `N1.PRG.02.02` | Gestiona turnos de atencion del personal de salud con estado borrador/publicado/suspendido. |
| `N1.PRG.02.03` | Muestra cupos resultantes derivados de cada turno publicado o en borrador. |
| `N1.PRG.02.04` | Habilita o suspende la programacion mediante publicacion/suspension de turnos. |

Persistencia actual: `systemsetting` OpenMRS `sihsalus.staffScheduling.roster`.

Recomendacion backend: crear `.omod` dedicado si se requiere auditoria de nivel productivo, integracion externa o reglas complejas de concurrencia.

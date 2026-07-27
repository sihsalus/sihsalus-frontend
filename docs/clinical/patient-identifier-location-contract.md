# Contrato de ubicación de identificadores de pacientes

**Estado:** obligatorio para altas, edición, promociones e importación masiva.

**Última verificación de metadatos:** QLTY, 2026-07-27.

## Regla fuente

`PatientIdentifierType.locationBehavior` es metadato de OpenMRS y determina si
el objeto `PatientIdentifier` usa el campo técnico `location`. La aplicación no
debe inferirlo por el nombre del documento ni por la UPSS seleccionada en la
sesión.

OpenMRS documenta dos valores de núcleo:

| Metadato | Payload REST de `PatientIdentifier` |
| --------- | ----------------------------------- |
| `NOT_USED` | Omitir por completo `location`. |
| `REQUIRED` | Enviar el UUID no vacío de la UPSS/Location de sesión. |

Fuente: [OpenMRS `PatientIdentifierType.LocationBehavior`](https://docs.openmrs.org/doc/org/openmrs/PatientIdentifierType.LocationBehavior.html).

No se asume compatibilidad para valores adicionales. Un tipo activo sin
metadato, inexistente o con un valor desconocido bloquea el guardado antes de
generar identificadores, crear recursos o encolar sincronización offline.

## Decisión para Hospital II-1 Santa Clotilde

La consulta de solo lectura a los tipos de identificador activos en QLTY
registró `NOT_USED` para DNI, CE, CNV, DIE, Historia Clínica, pasaporte y los
tipos SIS activos. Por tanto el frontend no debe enviarles la UPSS en el
payload del identificador.

La UPSS de sesión sigue siendo un requisito operativo visible de Admisión. Esa
regla no autoriza a adjuntarla a un identificador cuyo contrato indica
`NOT_USED`; ambos controles tienen finalidades distintas.

## Implementación y trazabilidad

1. El cliente solicita y conserva `locationBehavior` junto con el tipo de
   identificador.
2. La misma instantánea de metadatos se guarda en la cola offline y se utiliza
   al sincronizar; no se vuelve a inferir desde el estado posterior del
   servidor.
3. Altas, edición, promoción de persona e importación masiva usan un único
   resolvedor de política.
4. Las pruebas cubren `NOT_USED`, `REQUIRED`, metadato desconocido, promoción
   e importación.

Antes de cambiar un tipo a `REQUIRED`, el equipo de metadatos debe validar la
semántica con Admisión y ejecutar la prueba de alta, edición, promoción y cola
offline en QLTY. Un cambio de esa naturaleza es una migración de contrato, no
un cambio visual.

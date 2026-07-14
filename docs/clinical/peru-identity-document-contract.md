# Contrato de documentos de identidad del paciente

## Alcance y fuente de verdad

Los documentos de identidad son datos clínico-administrativos sensibles. El navegador puede impedir errores de
captura, pero la validez definitiva, la unicidad y la prevención de duplicados deben imponerse también en OpenMRS.

La fuente operativa de verdad es el `PatientIdentifierType` desplegado por
[`sihsalus-content`](https://github.com/sihsalus/sihsalus-content/blob/main/configuration/backend_configuration/patientidentifiertypes/patientidentifiertypes.csv).
Registro general consume esos tipos desde el backend. Emergencia todavía recibe sus UUID por configuración, por lo
que usa las mismas reglas compartidas como control preventivo. Una modificación de formato no debe desplegarse solo
en frontend: requiere migración coordinada de content, API, datos existentes y clientes externos.

## Contrato vigente y brechas conocidas

| Tipo      | Regla preventiva del frontend                         | Contrato content actual               | Estado                                                                                                                                                                         |
| --------- | ----------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DNI       | exactamente 8 dígitos                                 | `^[0-9]{8}$`, único                   | Alineado. La plataforma estatal confirma que el número de DNI tiene ocho dígitos.                                                                                              |
| CE        | 6 a 12 caracteres alfanuméricos                       | `^[A-Za-z0-9]{6,12}$`, único          | Se conserva para no romper el backend ni registros históricos. Requiere revisión institucional porque referencias estatales recientes describen CE numérico de 9 a 11 dígitos. |
| Pasaporte | 6 a 9 caracteres alfanuméricos                        | `^[A-Za-z0-9]{6,9}$`, único           | Se conserva para no aceptar en frontend valores que el backend rechazará. T-Registro admite hasta 15 posiciones; la ampliación debe ser coordinada.                            |
| DIE       | 1 a 15 caracteres alfanuméricos                       | sin regex, no único                   | El límite frontend elimina la antigua regla 9–12 sin respaldo. Content debe adoptar una regla aprobada y revisar la unicidad.                                                  |
| CNV       | exactamente 12 dígitos                                | `^[0-9]{12}$`, único                  | Alineado con content. La longitud debe confirmarse formalmente con el responsable de CNV antes de una migración.                                                               |
| Otros     | regex anclada, acotada y longitud máxima configuradas | no existe un tipo canónico en content | Permanece oculto salvo que UUID, regex segura y límite institucional estén configurados explícitamente.                                                                        |

Referencias externas usadas para revisar el contrato:

- La [orientación oficial sobre el dígito verificador del DNI](https://www.gob.pe/13432-encontrar-d-gito-verificador-en-el-dni)
  distingue los ocho dígitos del número de DNI del dígito verificador.
- El [manual de T-Registro de SUNAT consultado](https://www2.sunat.gob.pe/orientacion/pvs/registro/manual/mu-0441-pvs-T-Registro_RM_170_2023_TR.pdf)
  documenta, para interoperabilidad administrativa, DNI de 8 dígitos, CE de hasta 11 dígitos, pasaporte de hasta 15
  posiciones y documento de identidad extranjero de hasta 15 caracteres alfanuméricos.
- La [guía SBS para población refugiada y migrante](https://www.sbs.gob.pe/Portals/3/GuiaPracticaPoblacionRefugiada.pdf)
  muestra el carné de extranjería actual con número de 9 dígitos.
- El [sistema CNV del MINSA](https://www.minsa.gob.pe/cnv/?op=10) confirma que el número del certificado es el dato
  situado bajo el código de barras y que los casos sin documento se registran como ignorados, no con un número
  inventado.

Estas fuentes no sustituyen la aprobación institucional. Sus diferencias con el contenido desplegado son una razón
para no cambiar formatos silenciosamente desde un único formulario.

## Reglas de captura

- Un campo vacío significa que no se declaró ese documento; nunca se genera un número civil ficticio.
- Si se declara un número, el tipo debe corresponder a un UUID configurado sin colisiones.
- Solo se normalizan separadores de presentación (`espacios` y `-`) y mayúsculas. Letras inválidas, puntuación o
  exceso de longitud permanecen visibles y hacen fallar la validación; no se eliminan ni truncan hasta fabricar un
  valor aparentemente válido.
- DNI es el único documento que permite inferir Perú, y solo cuando contiene exactamente ocho dígitos, el paciente
  está identificado y el concepto Perú pertenece al catálogo de nacionalidades cargado.
- CE, pasaporte y DIE no determinan nacionalidad. País emisor y nacionalidad son conceptos diferentes.
- Un paciente no identificado no conserva documento, fecha de nacimiento exacta, nacionalidad, seguro ni dirección
  residencial ocultos de una captura anterior.
- Una respuesta de catálogo ausente o ambigua bloquea el dato afectado; no se acepta un UUID solo porque tenga forma
  de UUID.

## Responsabilidades del backend y content

Antes de considerar cerrado el contrato institucional se debe:

1. inventariar valores activos por tipo, longitud, caracteres y duplicados, sin modificar datos;
2. acordar con admisión, estadística, interoperabilidad y protección de datos los formatos que deben admitir
   documentos vigentes e históricos;
3. versionar los cambios de `PatientIdentifierType` en `sihsalus-content` y desplegarlos antes o junto al frontend;
4. definir unicidad por tipo; en especial, resolver el `NON_UNIQUE` actual de DIE sin fusionar automáticamente
   personas homónimas;
5. rechazar en API los formatos inválidos aun si el cliente no ejecutó JavaScript;
6. implementar búsqueda de duplicados y reconciliación con auditoría antes de crear una persona o paciente;
7. probar altas, edición, promoción persona→paciente y emergencia con los mismos casos de contrato;
8. registrar métricas y una cola de revisión manual para valores históricos que no puedan normalizarse de forma
   inequívoca.

No debe hacerse una actualización masiva de números de documento basándose solo en truncado, eliminación de
caracteres o coincidencia de nombre. Cualquier saneamiento histórico necesita respaldo, trazabilidad y rollback.

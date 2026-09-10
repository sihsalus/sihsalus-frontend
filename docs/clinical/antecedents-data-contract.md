# Contrato de datos de antecedentes

**Revisión:** 2026-09-10. **Alcance:** antecedentes longitudinales de Conditions,
Consulta Externa, CRED y Salud Materna. Este documento distingue evidencia de
código, decisiones frontend y validación clínica pendiente. No acredita el
cumplimiento normativo del sistema desplegado.

## Significado clínico y referencias

La [NTS 139, aprobada por R.M. 214-2018-MINSA](https://cdn.www.gob.pe/uploads/document/file/187992/187487_R.M_214-2018-MINSA2.pdf20180823-24725-1ufma50.pdf),
del 13 de marzo de 2018, establece:

- §5.2.1.1.1.g, página impresa 18/PDF 21: antecedentes personales, familiares
  y alergias separados del diagnóstico. Los personales incluyen antecedentes
  patológicos, quirúrgicos, laborales, terapias y estilos de vida.
- §4.2.9, impresa 10/PDF 13: codificación CIE y calificación P/D/R de los
  diagnósticos. No establece que todo antecedente sea un diagnóstico CIE-10.
- §4.2.1, impresa 9/PDF 12: fecha, hora e identificación del profesional.
- §5.3.3.f/j/r, impresas 49–50/PDF 52–53: datos para auditoría; correcciones
  mediante nuevo registro, conservando original y motivo; recuperación,
  integridad y secuencialidad.

La [R.M. 265-2018-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/187373-265-2018-minsa)
modifica la definición de acto de salud de esa NTS. El
[manual MINSA de Consulta Externa de 2024](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=9)
presenta antecedentes personales, familiares, psicosociales, sexuales/reproductivos
y obstétricos en páginas PDF 9–12; diagnóstico CIE-10 en página 20. Es una
referencia funcional de esa aplicación, no una obligación de copiar sus controles.

La [Ley 29733](https://leyes.congreso.gob.pe/documentos/leyes/29733.pdf), artículos
2.5 y 16–17, exige proteger los datos sensibles de salud y su confidencialidad.
Su reglamento actual es D.S. 016-2024-JUS,
[vigente desde el 31 de marzo de 2025](https://www.gob.pe/institucion/anpd/campa%C3%B1as/128319-nuevo-reglamento-de-proteccion-de-datos-personales).
El reglamento de RENHICE, D.S. 009-2017-SA, fue modificado por
[D.S. 020-2025-SA](https://www.congreso.gob.pe/Docs/DGP/DIDP/files/ds_020-2025-sa.pdf),
publicado el 28 de noviembre de 2025, en definiciones e investigación en salud.

Decisiones de diseño derivadas: conservar conceptos y narraciones sin fabricar
equivalencias CIE-10; no convertir enfermedad de un familiar en enfermedad activa
del paciente; no interpretar ausencia de datos como antecedente negativo. Las
alergias/RAM y los formularios obstétricos o perinatales mantienen sus propietarios
clínicos. La selección de campos obligatorios y las políticas de corrección
requieren revisión del responsable clínico institucional.

## Contenido revisado

Referencia de `sihsalus-content`:
[`1025f7339a98ba2a6837dd0f33ed2c2e14d9a436`](https://github.com/sihsalus/sihsalus-content/tree/1025f7339a98ba2a6837dd0f33ed2c2e14d9a436).
Se inspeccionaron los archivos de `configuration/backend_configuration/ocl`:
`10_SIHSALUS_sihsalus_concepts_2026-07-16-02.zip`,
`60_SIHSALUS_sihsalus_mappings_2026-07-16-02.zip` y
`02_SIHSALUS_diagnosis_concepts_2026-06-30.zip`.

- `162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` es una pregunta de texto para nota de
  encuentro, también documentada en
  [`visit-note-content-contract.json`](https://github.com/sihsalus/sihsalus-content/blob/1025f7339a98ba2a6837dd0f33ed2c2e14d9a436/docs/contracts/visit-note-content-contract.json).
  Su existencia no lo convierte en un diagnóstico ni en un concepto genérico de
  antecedente. No debe utilizarse para nuevos antecedentes narrativos cuando el
  backend admite texto no codificado nativo.
- El conjunto pediátrico incluye conceptos de clases `Finding` y `Misc`. Una
  búsqueda limitada a `Diagnosis` no cubre todos sus miembros. Los conjuntos y
  preguntas con respuestas codificadas son contratos diferentes: no se puede
  tratar una relación `Q-AND-A` como pertenencia `CONCEPT-SET`.
- El catálogo de diagnóstico revisado contiene códigos CIE-10 en nombres cortos;
  no contiene mappings que prueben una codificación FHIR externa. El UUID local
  del concepto y el código CIE-10 son identidades diferentes.
- [`OBST-001-ANTECEDENTES.json`](https://github.com/sihsalus/sihsalus-content/blob/1025f7339a98ba2a6837dd0f33ed2c2e14d9a436/configuration/backend_configuration/ampathforms/OBST-001-ANTECEDENTES.json)
  persiste grupos y observaciones de encuentro, no Conditions. Sus respuestas
  «Otros» no son sustitutos automáticos para un antecedente longitudinal.

Esta revisión no migra observaciones a Conditions ni altera los conceptos
instalados. Se conserva la lectura histórica; una migración exige un contrato
clínico y un procedimiento independiente.

## Backend de referencia y límites comprobados

El [POM de la distribución SIH Salus en `90762a7a`](https://github.com/sihsalus/sihsalus/blob/90762a7ae83bf0218e1efac0b059fb5319fda967/backend/pom.xml)
declara OpenMRS **2.8.9**, REST **3.5.0** y FHIR2 **4.2.0**. Es evidencia de
configuración, no prueba de qué versión está desplegada. Se revisaron fuentes
upstream fijas: core `4dda0f50a60991a5af9a4b36508e69bb3561c8a6`, REST
`69fa31fc157be0b0835e2101a0b0e480e0da4acb` y FHIR2
`40e2918b5a098543359f9fe0672ccf1000497efd`. La aceptación requiere comprobar las
versiones instaladas y sus permisos en DEV/QLTY autorizado.

### Una fuente REST para lectura y escritura

Los cuatro consumidores comparten REST `Condition`. No convierten el transporte
REST a un recurso FHIR intermedio. Ambos endpoints acceden a las mismas entidades
Condition de core; usar REST no migra ni duplica los registros históricos.

El [recurso Condition REST](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/resource/openmrs2_2/ConditionResource2_2.java)
expone estos contratos:

| Operación          | Contrato                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Historial          | `GET /ws/rest/v1/condition?patientUuid={uuid}&includeInactive=true&v=full&limit=100&totalCount=true` |
| Recurso actual     | `GET /ws/rest/v1/condition/{uuid}?v=full`                                                            |
| Creación           | `POST /ws/rest/v1/condition`                                                                         |
| Corrección parcial | `POST /ws/rest/v1/condition/{uuid}`                                                                  |
| Anulación          | `DELETE /ws/rest/v1/condition/{uuid}?reason={motivo}`; nunca `purge=true`                            |

`patientUuid` es el nombre real del filtro; `patient` no lo sustituye.
`includeInactive=true` incluye todos los estados. La representación `full`
contiene identidad/paciente, `condition`, estados, fechas clínicas, `additionalDetail`,
`previousVersion`, `voided` y `auditInfo`. El POST de creación acepta paciente,
condición, estados, fechas y detalle. La corrección omite paciente y datos de
registro; los campos ausentes conservan su valor.

El [convertidor CodedOrFreeText](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/converter/openmrs2_2/CodedOrFreeTextConverter.java)
recibe `condition: { coded: "uuid-local" }` o
`condition: { nonCoded: "narración" }`. Al leer, `coded` y `specificName`, si existen,
son objetos con UUID y representación del concepto/nombre; `nonCoded` es texto.
No debe sustituirse el UUID local por un código CIE-10 ni fabricarse un concepto
para representar texto libre. El tipo de antecedente de SIH Salus se conserva en
el marcador existente de `additionalDetail`; las notas clínicas previas no se
sobrescriben al modificar otro campo.

La [paginación REST](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod-common/src/main/java/org/openmrs/module/webservices/rest/web/resource/impl/BasePageableResult.java)
responde `{ results, links?, totalCount? }`. Cada enlace usa `rel` y `uri`, no
`relation` y `url`. `totalCount=true` solicita el total. El
[contexto de petición](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod-common/src/main/java/org/openmrs/module/webservices/rest/web/RequestContext.java#L166)
conserva los filtros y avanza `startIndex` por `limit` en el enlace siguiente. El
[DAO de core](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/java/org/openmrs/api/db/hibernate/HibernateConditionDAO.java#L100)
excluye registros anulados y ordena por creación descendente. La implementación
[NeedsPaging](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod-common/src/main/java/org/openmrs/module/webservices/rest/web/resource/impl/NeedsPaging.java)
carga la colección en servidor antes de paginar la representación: limitar páginas
reduce payload, pero no convierte la consulta de core en paginación de base de datos.

El [enum clínico de core](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/java/org/openmrs/ConditionClinicalStatus.java)
incluye `ACTIVE`, `INACTIVE`, `RECURRENCE`, `RELAPSE`, `REMISSION`, `RESOLVED` y
`HISTORY_OF`, obsoleto. La fuente REST permite conservar los estados precisos.
No se modifica el estado cuando el usuario solo corrige otro campo.

`verificationStatus` es un dato distinto del estado clínico y de la calificación
P/D/R del diagnóstico de consulta. El
[traductor FHIR anterior](https://github.com/openmrs/openmrs-module-fhir2/blob/40e2918b5a098543359f9fe0672ccf1000497efd/api/src/main/java/org/openmrs/module/fhir2/api/translators/impl/ConditionVerificationStatusTranslatorImpl.java#L33)
devolvía `null` cuando no se enviaba verificación; no asumía `CONFIRMED`. La
[columna de core](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/resources/org/openmrs/liquibase/updates/liquibase-update-to-latest-2.2.x.xml#L156)
permite `null`. Se conserva esa ausencia al crear y el valor existente al editar:
el cambio de transporte no transforma un relato en un antecedente clínicamente
confirmado ni provisional sin intervención profesional.

### Autoría, corrección y permisos

El [servicio Condition de core](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/java/org/openmrs/api/ConditionService.java)
exige `Get Conditions` para leer y `Edit Conditions` para guardar/anular.
La búsqueda del paciente también necesita `Get Patients`. El control UI no
reemplaza estas autorizaciones; el refactor no amplía roles ni privilegios.

El [servicio de guardado](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/java/org/openmrs/api/impl/ConditionServiceImpl.java#L105)
compara el cambio con el original: cuando cambia, anula el anterior y guarda una
nueva condición con otro UUID y `previousVersion`. La
[copia de Condition](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/java/org/openmrs/Condition.java#L130)
conserva los campos clínicos, pero no creador ni fecha de creación. El
[interceptor de auditoría](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/java/org/openmrs/api/db/hibernate/AuditableInterceptor.java)
asigna esos datos a la nueva versión desde la sesión y la hora del servidor.

Por tanto, el original conserva su autor y fecha; la corrección pertenece al
editor y al momento de modificación. El frontend no atribuye una fecha antigua
al nuevo registro ni utiliza el UUID del proveedor como UUID de usuario. Las
tablas muestran la fecha clínica de inicio, que no cambia si no se edita. La
recarga completa sustituye el UUID anterior sin conservar una fila obsoleta.

[`auditInfo`](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod-common/src/main/java/org/openmrs/module/webservices/rest/web/ConversionUtil.java#L518)
expone creador/fecha, editor/fecha y datos de anulación según corresponda. El
[convertidor de usuario](https://github.com/openmrs/openmrs-module-webservices.rest/blob/69fa31fc157be0b0835e2101a0b0e480e0da4acb/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/converter/openmrs1_8/UserConverter1_8.java#L49)
representa el autor ya cargado; no lo vuelve a resolver mediante `FhirUserDao`.
La lectura/edición con el rol clínico sin `Get Users` debe verificarse en el
entorno instalado, además de las pruebas locales del contrato.

REST admite fechas `null`; el frontend conserva una restricción deliberada:
una fecha existente puede corregirse, pero este formulario no permite borrarla.
No es una limitación atribuida a REST. Una política de eliminación de fechas y
su justificación requiere definición clínica; no debe confundirse con una
edición sin cambios.

La anulación conserva el registro en core y exige un motivo escrito por el
profesional. La UI y el transporte rechazan motivos vacíos o mayores de 255
caracteres antes de enviar peticiones. La
[definición de tabla](https://github.com/openmrs/openmrs-core/blob/4dda0f50a60991a5af9a4b36508e69bb3561c8a6/api/src/main/resources/org/openmrs/liquibase/updates/liquibase-update-to-latest-2.2.x.xml#L142)
limita `void_reason`, `condition_non_coded` y `additional_detail` a 255 caracteres;
en el último, el límite incluye el marcador de clasificación. Los textos no se
truncan silenciosamente. El versionado y la anotación
`@Audited` de Condition no certifican conservación normativa, firma digital ni
recuperación: estas dependen de configuración y procedimientos institucionales.

### Por qué no se mantiene el transporte FHIR anterior

El [traductor de estado FHIR2 4.2.0](https://github.com/openmrs/openmrs-module-fhir2/blob/40e2918b5a098543359f9fe0672ccf1000497efd/api/src/main/java/org/openmrs/module/fhir2/api/translators/impl/ConditionClinicalStatusTranslatorImpl.java)
solo conserva `ACTIVE`/`INACTIVE`; al leer, todos los demás estados de core se
reducen a `inactive`, y al escribir todo código distinto de `active` se convierte
en `INACTIVE`. Cambiar únicamente etiquetas o el POST de edición dejaba pérdida
de información en lectura y creación. REST evita ese traductor.

Además, el [traductor Condition FHIR](https://github.com/openmrs/openmrs-module-fhir2/blob/40e2918b5a098543359f9fe0672ccf1000497efd/api/src/main/java/org/openmrs/module/fhir2/api/translators/impl/ConditionTranslatorImpl.java)
ignora `recordedDate` entrante, escribe solo la primera nota y reasigna el creador
desde `recorder`. Omitirlo en un PUT puede dejarlo nulo y reemplazarlo por el editor.
Conservarlo activa una consulta al usuario: [`FhirUserDao.get`](https://github.com/openmrs/openmrs-module-fhir2/blob/40e2918b5a098543359f9fe0672ccf1000497efd/api/src/main/java/org/openmrs/module/fhir2/api/dao/FhirUserDao.java#L21)
exige `Get Users`, autorización aplicada por el
[asesor AOP](https://github.com/openmrs/openmrs-module-fhir2/blob/40e2918b5a098543359f9fe0672ccf1000497efd/api/src/main/java/org/openmrs/module/fhir2/spring/FhirAopConfiguration.java#L44).
El [DAO FHIR](https://github.com/openmrs/openmrs-module-fhir2/blob/40e2918b5a098543359f9fe0672ccf1000497efd/api/src/main/java/org/openmrs/module/fhir2/api/dao/impl/BaseFhirDao.java)
guarda directamente en Hibernate y no ejecuta el versionado de ConditionService.
Estas diferencias justifican una única fuente REST para este flujo.

### Concurrencia

El cliente vuelve a leer el recurso desde la red antes de editar o anular y
comprueba su paciente. Antes de editar compara además con la versión abierta;
un cambio previo requiere recargar y revisar. Se rechaza un registro anulado.
El preflight no hace atómica la secuencia GET/POST ni elimina la ventana entre
ambas peticiones. La conservación de versiones no demuestra exclusión mutua.
No se atribuye a `If-Match` una protección no comprobada en el backend.

## Contrato compartido del frontend

- La lectura sigue todas las páginas REST del paciente, incluyendo estados
  inactivos; distingue historial vacío de carga incompleta o fallida.
  El fetcher compartido reúne y valida todas las páginas antes de publicar el
  resultado en SWR. Así, el refresco tras una escritura también espera las páginas
  nuevas cuando la colección cruza un límite de página. Se reutilizan REST y SWR
  sin cambiar el comportamiento del hook global del framework para otros módulos.
- La transformación tolera campos opcionales ausentes, conserva narraciones,
  fechas, notas y autoría, y no inventa UUID, diagnóstico o estado clínico.
- Las aplicaciones conservan sus conjuntos de conceptos, permisos y decisiones
  de clasificación. Compartir transporte no amplía autorizaciones.
  Familiares, sociales, quirúrgicos, hospitalizaciones previas y otros antecedentes
  permanecen visibles en antecedentes aunque su estado sea activo; no se
  presentan como enfermedad activa del paciente. Los diagnósticos previos
  conservan su sección. Los filtros agrupan `active`/`recurrence`/`relapse` y
  `inactive`/`remission`/`resolved`, manteniendo la etiqueta de estado recibida.
  `HISTORY_OF` se mantiene como estado histórico, sin convertirlo en remisión;
  pertenece al filtro de inactivos. Los estados históricos o desconocidos no se
  editan mediante un formulario que solo admite los seis estados estándar.
- La escritura diferencia creación de edición y valida la identidad del paciente.
  La respuesta del servidor y la recarga son la autoridad sobre los datos
  persistidos; la caché no debe retener el original si el backend devuelve otro ID.
- Una escritura confirmada y una actualización visual fallida son resultados
  distintos. Un fallo de recarga no debe inducir a repetir la creación o anulación.
  La recarga explícita exige red en todas las páginas mediante `no-store`, la
  estrategia offline existente y un parámetro único por recorrido. Si falla,
  conserva el último historial completo e informa el fallo; un snapshot antiguo
  de caché no confirma que la escritura ya sea visible.
- Un fallo de red, timeout o error de servidor puede ocurrir después del commit.
  Si no hay confirmación, el formulario o diálogo no anuncia guardado ni anulación
  y no permite repetir la escritura. Conserva las entradas y permite cerrar y
  recargar el historial antes de realizar más cambios.
  El frontend no presume idempotencia del servidor ni identifica duplicados por
  coincidencia de texto, concepto o fecha. Solo un rechazo inequívoco permite
  reintentar directamente.
- Los identificadores de filtros y controles son únicos por instancia, también
  cuando varias tablas se montan a la vez.

## Validación y límites de entrega

Pruebas locales requeridas: varias páginas, duplicados entre páginas, respuesta
vacía/incompleta, error posterior, campos opcionales y conceptos locales; narración
sin código, concepto no CIE-10, lectura histórica; corrección parcial que conserva
fecha clínica, concepto y notas no editados, sin reescribir auditoría; doble envío,
error de escritura y fallo de recarga posterior;
permisos de lectura/edición y controles independientes.

La aceptación externa permanece **NOT RUN** hasta ejecutar creación, recarga,
edición y anulación con pacientes sintéticos en DEV/QLTY coordinado, identificando
frontend, core, REST y content instalados. Deben verificarse también permisos
backend sin `Get Users`, nota/marcador conservados, autor/fecha de cada versión,
fecha clínica, anulación recuperable con motivo y dos editores simultáneos.
La justificación clínica de correcciones, conservación
de versiones, firma digital y acreditación requieren evidencia backend e
institucional; este refactor no las certifica ni las reemplaza con telemetría UI.

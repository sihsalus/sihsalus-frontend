# esm-atencion-ambulatoria-app

Microfrontend de atención ambulatoria y consulta externa para SIH Salus, una distribución de OpenMRS 3.x adaptada al ecosistema de salud peruano y las directrices del MINSA.

## Contrato RBAC actual

Los permisos de lectura protegen los puntos de entrada y mantienen visibles los datos clínicos. Los permisos de edición ocultan las acciones de registro o modificación cuando el usuario solo puede consultar.

| Superficie                                   | Lectura / entrada                                                   | Modificación                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Consulta externa e historia médica           | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar`                                             |
| Formularios AMPATH de Consulta Externa       | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.formulariosClinicos`    |
| Hoja de Referencia Institucional nativa      | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar`                                             |
| Diagnóstico/plan desde Consulta Externa      | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.resumenConsulta.editar` |
| Pruebas complementarias                      | `app:hoja.clinica.consultaExterna` + `app:hoja.clinica.resultados`  | Solo lectura; las órdenes conservan sus propios permisos                              |
| Antecedentes y problemas en Consulta Externa | `app:hoja.clinica.consultaExterna` + `app:hoja.clinica.condiciones` | `app:hoja.clinica.condiciones.editar`                                                 |
| Historia social                              | `app:hoja.clinica.historiaSocial`                                   | `app:hoja.clinica.historiaSocial.editar`                                              |
| Consultas previas desde Consulta Externa     | `app:hoja.clinica.visitas`                                          | Las acciones históricas conservan sus propios permisos                                |
| Prescripción desde el plan de tratamiento    | Entrada por Consulta Externa                                        | `app:hoja.clinica.canastaOrdenes` + `app:hoja.clinica.ordenes.editar`                 |

En la navegación normal, los guards se acumulan: primero se entra al dashboard con lectura y después se habilita la acción con edición. Los workspaces y modales registrados declaran directamente el privilegio de edición, sin inferir el permiso base; OpenMRS no implementa herencia padre/hijo por el nombre del privilegio.

Las listas y estados vacíos siguen visibles en modo de solo lectura, pero sin botones de registro. Los controles heredados de antecedentes todavía delegan el bloqueo final al workspace o modal registrado. Estos guards frontend no sustituyen los permisos del backend para leer o guardar encounters, condiciones, observaciones u órdenes.

## Contrato de diagnóstico de Consulta Externa

La acción **Registrar Diagnóstico** abre el workspace de Visit Notes, que persiste diagnósticos CIE-10 como diagnósticos nativos del encounter. Requiere una visita ambulatoria activa verificada y los dos privilegios de modificación indicados en la tabla. `CE-001-CONSULTA EXTERNA` no debe volver a capturar diagnósticos mediante observaciones.

El historial obtiene el código desde el mapping estructurado CIE-10/ICD-10. Para el catálogo MINSA importado sin mappings, admite el nombre `SHORT` del concepto como código catalogado; no infiere el código desde el texto visible del diagnóstico.

## Advertencia de financiamiento SIS (opcional)

Con `showSisFinancingWarning: true` (apagada por defecto), el dashboard de consulta externa muestra una advertencia no bloqueante cuando la visita activa no tiene financiador definido o el SIS no está vigente, con la misma semántica que el gating de triaje (`getSisFinancingState` sobre los visit attributes canónicos de `@openmrs/esm-patient-common-lib`). Si el usuario tiene `app:home.facturacion`, la advertencia ofrece la acción "Ir a Caja"; sin ese privilegio solo informa. La atención clínica nunca se bloquea: el hard-stop permanece en el flujo de FUA (ver `docs/clinical/plan-alineamiento-seguros-sis.md`).

La pestaña **Referencia / Contrarreferencia** lee exclusivamente encounters de `encounterTypes.referralCounterReferral` y contiene dos vistas independientes: **Referencias emitidas** y **Contrarreferencias recibidas**. El filtro de cada flujo se aplica antes de la paginación; una respuesta de contrarreferencia permanece asociada al encounter de su referencia y no se crea como un registro suelto. Las interconsultas basadas en órdenes no pertenecen a ese historial; se solicitan y consultan desde `esm-interconsultas-app`.

La pestaña **Antecedentes**, situada antes de **Anamnesis**, monta en **Antecedentes y problemas** la misma extensión `conditions-details-widget` que la página independiente. `consulta-externa-antecedents-slot` pertenece a este módulo y recibe el recurso FHIR `patient` verificado junto con `patientUuid`; no se monta si la identidad no coincide o falla la carga. La lectura requiere `app:hoja.clinica.condiciones` y las acciones canónicas conservan `app:hoja.clinica.condiciones.editar`, sin exigir el permiso de historia social. El formulario, la lectura FHIR Condition, la edición y la actualización de la lista pertenecen a `esm-patient-conditions-app`, declarado como dependencia de este consumidor. Requiere su módulo instalado, FHIR2 >= 2.8.0 y su configuración de conceptos. Si la sección no está disponible, se muestra un aviso seguro y no se ofrece el formulario antiguo como sustituto.

**Registros médicos anteriores** conserva debajo la tabla histórica de encounters, únicamente de lectura dentro de Consulta Externa y protegida por `app:hoja.clinica.historiaSocial`. No se migran ni se reinterpretan observaciones o diagnósticos como Condition. **Historia social** mantiene su formulario y sus permisos originales. La cabecera incluye **Consultas previas** solo para usuarios con `app:hoja.clinica.visitas` y abre el dashboard histórico canónico, sin duplicar ni cambiar la visita activa.

La tabla de antecedentes médicos conserva el resto del historial cuando un diagnóstico antiguo no trae su representación codificada: muestra `--` en esa celda en lugar de bloquear la pantalla. No infiere un diagnóstico ni modifica el registro histórico.

Fuera del registro canónico de Consulta Externa, los formularios históricos de antecedentes médicos y sociales reciben una función que actualiza la consulta del historial al completar el cierre desde el formulario. Abrir el formulario no dispara esa actualización. La X del workspace mantiene su contrato de cierre y no ejecuta ese callback.

Los antecedentes personales cargan todas las páginas del historial FHIR. Para crear o editar exigen que la sesión tenga un proveedor clínico; el backend deriva el registrador desde la sesión autenticada y la edición conserva `recordedDate`. Al abrir un antecedente social nuevo se envía `encounterUuid` vacío: el UUID configurado identifica el tipo de encounter y no debe tratarse como un encounter existente.

El lector de antecedentes personales tolera que falten los arrays `coding`: conserva `code.text` cuando existe y usa `--` si no hay descripción, sin inventar concepto ni estado clínico. Las vistas por conjunto de conceptos mantienen su filtro: un registro sin código no impide mostrar los miembros válidos del conjunto.

La pestaña **Pruebas complementarias** monta `consulta-externa-pruebas-complementarias-slot` con el `patientUuid` activo. `@sihsalus/esm-patient-tests-app` aporta en ese slot la misma tarjeta de resultados recientes que usa la historia clínica, protegida por `app:hoja.clinica.resultados`; Consulta Externa no duplica su consulta FHIR ni su lógica de navegación. La tarjeta es de solo lectura y **Ver todos los resultados** abre el dashboard completo de resultados.

No existe un conector frontend con NetLab 1 o NetLab 2. Una integración futura debe implementarse mediante una interfaz institucional autorizada en backend, asociar paciente, solicitud, resultado y procedencia, y contar con reconciliación y auditoría. No se deben almacenar, compartir ni automatizar credenciales personales de profesionales desde este módulo.

### Orientación para resultados referidos e historia previa

En **Pruebas complementarias → Informes de laboratorios externos** se puede
abrir Netlab 1 o Netlab 2 en otra pestaña. Las direcciones son las publicadas
por el [INS](https://www.gob.pe/ins), verificadas el 2026-09-07. No se envían
identificadores del paciente, parámetros de búsqueda, credenciales ni referrer;
no hay peticiones automáticas, captura de claves, iframe, scraping ni importación.
La guía requiere `app:hoja.clinica.resultados` y solo se monta en esa pestaña.

**Ver informes adjuntos** abre el dashboard existente `Attachments` del mismo
paciente y exige además `app:hoja.clinica.adjuntos`. No inicia una consulta ni
carga un archivo automáticamente. La carga conserva los permisos de edición,
la lista de tipos de archivo permitidos y el contrato backend de
`esm-patient-attachments-app`; este cambio no habilita el flag independiente de
PDF suplementario por orden. El profesional debe verificar paciente, prueba,
muestra y fecha, conservar el informe original e indicar emisor y fecha en el
nombre del adjunto (el PDF no ofrece el campo de descripción de las imágenes).
Un adjunto no equivale a un resultado estructurado, aprobado o a
una orden completada.

El acceso **Consultas previas** se distingue de las acciones de impresión e
incluye una explicación accesible: seleccionar la atención por fecha para
revisar su contenido. Conserva `app:hoja.clinica.visitas`, la ruta `Visits` y
la consulta activa. **Antecedentes** ya estaba antes de **Anamnesis**; se conserva
ese orden y se prueba también la denegación del permiso de lectura.

Pendiente para interoperabilidad real: contrato institucional con INS/laboratorio
referencial, API y autenticación de servicio autorizadas, correspondencia de
pacientes/muestras/órdenes, unidades y métodos, procedencia, deduplicación,
resultados corregidos, revisión clínica y auditoría de recepción. Los proyectos
de [interoperabilidad NOTI-CDC/NETLAB-INS](https://www.gob.pe/institucion/fsnvs/noticias/1309652-pmas-snvsp-impulsa-la-modernizacion-de-la-vigilancia-en-salud-publica-con-avances-clave-en-interoperabilidad-entre-noti-cdc-y-netlab-ins)
no acreditan por sí mismos una interfaz disponible para SIH Salus.

QA de antecedentes: con datos sintéticos en QLTY, agregar desde Consulta Externa y verificar el mismo registro tras recargar y desde la página Antecedentes; repetir con permisos de solo lectura y al cambiar de paciente. Confirmar que los registros anteriores siguen visibles sin acción de registro y que Historia social conserva su flujo. Las pruebas de integración locales montan el componente canónico real con lectores simulados; no validan persistencia contra el backend.

QA mínimo de estos accesos: orden de pestañas/paneles; permisos concedidos y
denegados; navegación tras cambiar de paciente; enlaces externos sin datos ni
referrer; ausencia de escrituras clínicas. Antes de integrar, verificar también
en QLTY con datos sintéticos que la ruta histórica y los adjuntos están disponibles
para los roles previstos. Las pruebas locales con mocks no sustituyen esa revisión.

## TODO content/backend

- Validar en QLTY que `encounterTypes.externalConsultation`, `triage`, `referralCounterReferral` y `consultation` existan y sean los usados por los formularios reales.
- Revisar que `conditionConceptClassUuid`, `conditionConceptSets` y `conditionFreeTextFallbackConceptUuid` resuelvan conceptos válidos para antecedentes y diagnósticos.
- Validar conceptos de anamnesis compartidos desde `ANAMNESIS_DEFAULT_CONCEPT_UUIDS` y los conceptos locales de diagnóstico, tratamiento, financiador, pertenencia étnica y referencia/contrarreferencia.
- Confirmar que los datos de triaje provengan del encounter type correcto y no se mezclen con vitales de otros flujos.
- Documentar qué formularios de consulta externa crean encounter nuevo y cuáles deben editar el encounter clínico actual.

Los valores de `formsList` para consulta externa usan los nombres estables publicados por content (`CE-001-CONSULTA EXTERNA`, `CE-ANAM-001-ANAMNESIS`, el identificador histórico `CE-SOAP-001-NOTA SOAP` para el formulario de examen físico y `CE-REF-001-REFERENCIA-CONTRARREFERENCIA`). No deben reemplazarse por los UUID de los archivos de esquema, porque esos UUID pueden variar entre entornos. El nombre y la clave internos de SOAP se conservan temporalmente para resolver el formulario y los encuentros ya instalados; no se presentan como SOAP en el flujo ambulatorio. Consulta Externa registra nuevas referencias mediante el workspace nativo **Hoja de Referencia Institucional**; el esquema AMPATH se conserva solo como compatibilidad de captura básica y no es el punto de entrada de Consulta Externa.

El dashboard muestra una cabecera compacta propia para garantizar que `Consulta Externa` se traduzca en el namespace del módulo. El orden operativo de las pestañas sigue el flujo clínico: Triajes previos, Antecedentes, Anamnesis, Examen físico, Pruebas complementarias, Diagnóstico, Plan de Tratamiento y Referencia / Contrarreferencia. **Pruebas complementarias** va antes de Diagnóstico porque el clínico lee lo que devolvió el laboratorio antes de clasificar. La pestaña no implementa su propia vista: expone el slot `consulta-externa-pruebas-complementarias-slot`, donde `esm-patient-tests-app` monta el mismo card de resultados (`externalOverview`) que ya usan la hoja clínica y el resumen de visitas, así que las tres superficies comparten una sola implementación y respetan `app:hoja.clinica.resultados`.

Anamnesis y examen físico son únicos por visita ambulatoria: cero coincidencias crea, una edita y más de una bloquea. Referencia es repetible porque cada derivación es un evento clínico independiente; el workspace crea un encounter nuevo adjunto a la visita ambulatoria verificada y persiste únicamente destino, especialidad, prioridad, condición de salida, transporte y motivo. Paciente, visita, triaje, diagnósticos, tratamiento y profesional no se duplican.

El lanzador bloquea clics simultáneos mientras resuelve o abre el formulario, pero
no depende de `mutateForm` para detectar el cierre: la X del workspace y su
reemplazo por otro formulario no ejecutan ese callback. Consulta en modo de solo
lectura el store experimental `workspace2Store` del entrypoint interno del
framework. Si la misma instancia y las identidades de paciente, visita y
formulario siguen vigentes, restaura mediante la API pública `launchWorkspace2`
con los argumentos originales, sin reemplazar cambios sin guardar. Después de un
cierre o reemplazo vuelve a verificar visita, formulario y encounter antes de
abrir. Este contrato no diagnostica ni corrige errores de descarga del esquema.

El catálogo inicial de destinos se configura en `referralDestinations` con nombre y código RENIPRESS; la selección conserva ambos en el encounter histórico. La exportación **Hoja de Referencia Institucional** se genera localmente a partir de la visita y deja vacíos para llenado manual los bloques de responsable de la referencia, responsable del establecimiento, personal que acompaña, personal que recibe, firmas y sellos.

## Resumen de atención ambulatoria

Consulta Externa ofrece una descarga PDF denominada **Resumen de atención ambulatoria** para la visita activa, con identificación del paciente, establecimiento, profesional, signos vitales, anamnesis, examen físico segmentado, diagnósticos nativos CIE-10, plan y órdenes asociadas a los encounters de esa visita. El documento se genera íntegramente en el navegador; los datos no se envían a un servicio de PDF externo.

El responsable documental se resuelve solo desde el encounter canónico configurado por tipo y formulario. Ese encounter queda `canonical-complete` cuando contiene exactamente un diagnóstico principal con mapping estructurado CIE-10/ICD-10 y exactamente un provider activo con `clinicianEncounterRoleUuid`; providers de otros roles no firman el documento. La fecha clínica, el nombre y la colegiatura provienen de ese mismo encounter/provider. La colegiatura usa el Provider Attribute Type exacto configurado, nunca el identificador del provider.

Los formatos antiguos dentro de la visita activa se clasifican explícitamente como `legacy`; un encounter canónico presente pero incompleto o ambiguo se clasifica `canonical-incomplete`. El Resumen y las Indicaciones continúan disponibles como documentos informativos en ambos estados, con advertencia visible y campos manuales para fecha clínica, responsable o colegiatura que no pudieron verificarse. No se infiere un profesional ni una hora desde otro encounter. La firma y el sello son manuales; no se afirma ni implementa firma digital. Este fallback no agrega selección de visitas finalizadas: el dashboard sigue trabajando con la visita ambulatoria activa verificada.

La cabecera ofrece además **Imprimir indicaciones**, una hoja PDF breve para entregar al paciente. Incluye la identificación institucional de la ubicación activa (dirección, teléfono y código IPRESS), identificación del paciente, fecha y responsable de la atención, la próxima cita programada verificable, indicaciones terapéuticas, medicamentos indicados mediante órdenes no anuladas, sustituidas, suspendidas ni vencidas registradas en la visita, incluido el motivo registrado cuando el uso es según necesidad (PRN), la indicación clínica y el número de renovaciones registrado (incluido cero), la fecha de control indicada y un espacio para la firma, el sello y el número de colegiatura manuscritos del profesional responsable. Las órdenes canónicas tienen prioridad; el texto histórico de prescripción se usa únicamente cuando la visita no contiene órdenes canónicas, para evitar duplicados. La hoja debe ser revisada, firmada y sellada antes de entregarse al paciente; sigue siendo informativa y no sustituye una receta médica o electrónica válida para dispensación. El número de renovaciones se muestra como dato registrado y no afirma que el documento sea dispensable.

**Emitir Receta Única** aparece junto a las acciones de documentos solo cuando `recetaUnica.identifierSourceUuid` apunta a una fuente idgen (SequentialIdentifierGenerator) del backend. Pedir el correlativo a idgen (`POST /idgen/identifiersource/{uuid}/identifier`) exige el privilegio nativo **`Edit Patient Identifiers`** en el rol del profesional que emite; sin él el backend responde 403 y la interfaz informa que el servidor no entregó la numeración. El rol `SIHSALUS Consulta Externa` lo incluye desde content (sihsalus-content#221). Antes de solicitar un correlativo, el frontend exige el contrato `canonical-complete`, un diagnóstico principal con CIE-10 y órdenes vigentes cuyo `orderer` sea el mismo provider responsable; un registro legacy/incompleto no consume numeración. La vigencia de las órdenes se verifica con la cabecera HTTP `Date` de la lectura de la visita, no con el reloj del portátil, y al componer el PDF se vuelve a evaluar contra `issuedAt` del servidor. La emisión pide el correlativo al servidor —el log de idgen registra fecha, usuario y un comentario con la visita y el paciente: esa es la auditoría de emisión— y usa la cabecera `Date` de la respuesta como fecha de emisión. La vigencia impresa es `validityDays` días desde esa fecha; confirme el valor con la dirección de farmacia según la directiva SISMED (RM 116-2018). El PDF sale en dos cuerpos con el mismo correlativo: ejemplar de farmacia (diagnósticos CIE-10 y detalle completo de cada orden, incluida la cantidad) y ejemplar del paciente con las indicaciones. Nombre y colegiatura proceden del mismo provider canónico; si falta la colegiatura, la línea queda manuscrita y la firma y el sello siguen validando el documento. Si el servidor no entrega numeración, la receta NO se emite (nunca se degrada a numeración local: dos laptops sin red acuñarían duplicados); la hoja informativa de indicaciones sigue disponible. Fuera de alcance: sustancias controladas (recetario especial) y firma digital.

Cuando un documento no se puede producir —sin visita ambulatoria verificada, sin contenido clínico, sin indicaciones ni medicamentos, o sin el contrato clínico de la Receta Única— la acción abre un modal que enumera los datos pendientes y ofrece ir a la pestaña donde se registra el primero de ellos, en vez de un aviso temporal que se desvanece y deja al botón pareciendo inerte. Las advertencias que **sí** producen el documento —registro histórico o incompleto, colegiatura no registrada— siguen siendo avisos temporales: el PDF se genera con esos campos marcados para completarlos a mano.

La identificación institucional se lee primero de la `Location` activa de la sesión mediante REST. La dirección respeta la jerarquía configurada por content: `address4` es la única fuente de calle/dirección, `countyDistrict` es distrito, `stateProvince` es provincia y `address1` es región; no se inventa una calle cuando `address4` está vacío. El teléfono y el código IPRESS se leen de los Location Attribute Types configurables `outpatientDocumentFacilityPhoneAttributeTypeUuid` y `outpatientDocumentFacilityIpressCodeAttributeTypeUuid`; los atributos anulados o vacíos se ignoran. Las acciones de documento esperan a que termine esa lectura para no imprimir una identidad transitoria.

El content que crea esos Attribute Types y completa la `Location` debe desplegarse antes o junto con este frontend. Durante la transición, los valores verificados de Santa Clotilde en `outpatientDocumentFacilityAddress`, `outpatientDocumentFacilityPhone` y `referralOriginRenaesCode` solo se usan si la ubicación activa coincide exactamente con `outpatientDocumentFacilityLocationUuid`; un error o dato ausente en cualquier otra ubicación deja el campo sin imprimir en vez de combinar instituciones. Este fallback se conserva únicamente para tolerar el orden de despliegue y debe retirarse cuando los entornos tengan el content alineado.

La **Próxima cita programada** proviene de Appointment Scheduling y se muestra con fecha, servicio, lugar y profesional disponibles. La fecha de control, en cambio, es una observación clínica y no demuestra que exista una reserva; por eso aparece por separado como **Fecha de control indicada** y se aclara que debe confirmarse la programación. Si no se puede consultar la agenda, la impresión continúa con medicamentos e indicaciones, pero avisa al usuario y omite la cita no verificada. El PDF se genera localmente, no incluye identificadores del paciente ni de la visita en el nombre del archivo y descarga el mismo documento como respaldo cuando el visor PDF integrado no carga o informa un error.

La lectura de órdenes usa la representación polimórfica `FULL` de REST para respetar las diferencias entre `DrugOrder` y `TestOrder`, y enriquece únicamente la fortaleza de los medicamentos identificados. Una orden de laboratorio en la misma atención no debe impedir la generación de los documentos ni perder el detalle de dosis de los medicamentos.

La Epicrisis pertenece al egreso de hospitalización según la NTS 139. Consulta Externa no abre ni reutiliza `Formulario Epicrisis Médica` ni `(Página 16) Epicrisis`; su documento es únicamente el resumen de la atención ambulatoria.

El formulario identificado históricamente como `CE-SOAP-001-NOTA SOAP` registra el examen general y el examen regional por sistemas mediante campos diferenciados por `formFieldPath`. Ningún campo se completa como “normal” automáticamente. Consulta Externa muestra únicamente esos hallazgos de examen físico; de los registros SOAP históricos solo reutiliza el hallazgo objetivo como compatibilidad de lectura y no presenta Subjetivo, Apreciación ni Plan como secciones ambulatorias.

El historial se implementa en `usePhysicalExam` y `examen-fisico.component.tsx`.
El hook devuelve `physicalExamEntries` y filtra los encuentros sin hallazgos de
examen físico antes de paginar, para que las notas que solo contienen relato,
apreciación o plan no generen páginas vacías. El texto objetivo histórico se
expone como `legacyObjective`. `formsList.soapNoteForm`, `concepts.soapObjectiveUuid`
y el `formFieldPath` histórico se conservan como contratos con el contenido
instalado; no definen un formato SOAP para Consulta Externa.

La generación de ambos documentos falla cerrada si no se puede verificar que la visita, su tipo ambulatorio y el paciente coincidan. La primera versión se limita intencionalmente a la visita activa: los documentos deben generarse antes de finalizarla. Una futura generación histórica necesitará un selector explícito de visita; nunca debe elegir silenciosamente “la última” del paciente.

## TODO QA/QLTY

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que el widget correspondiente lee los datos persistidos.
- Probar en QLTY el flujo end-to-end de consulta externa: abrir dashboard, registrar anamnesis, examen físico, diagnóstico, plan y referencia, y recargar para confirmar persistencia.
- Validar que el dashboard lea correctamente datos de triaje, motivo de consulta, financiador, pertenencia étnica y plan de tratamiento.
- Probar creación y edición de diagnósticos clasificados con CIE/conceptos, incluyendo eliminación o reemplazo si aplica.
- Probar referencia/contrarreferencia con datos completos y confirmar que el encounter se consulta después de recargar.
- Probar la matriz anterior con perfiles de solo lectura y edición, incluyendo apertura directa de workspaces y autorización backend al guardar.
- Mantener pacientes de prueba para consulta sin datos, consulta con triaje, consulta completa y consulta con referencia.

## TODO i18n/UI

- Agregar smoke tests que detecten claves crudas visibles en consulta externa, por ejemplo labels de anamnesis, examen físico, diagnóstico, financiador o referencia.
- Agregar smoke test para estados vacíos duplicados o mal compuestos, por ejemplo `No hay no hay`.
- Revisar componentes que usan `useTranslation()` sin namespace explícito cuando se renderizan desde slots compartidos.
- Validar que los labels largos de diagnóstico, referencia/contrarreferencia y pertenencia étnica no se corten en desktop/tablet.
- Revisar `en.json` y traducciones heredadas para evitar mezcla de español/inglés en pantallas clínicas.

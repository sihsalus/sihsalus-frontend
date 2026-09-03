# esm-atencion-ambulatoria-app

Microfrontend de atención ambulatoria y consulta externa para SIH Salus, una distribución de OpenMRS 3.x adaptada al ecosistema de salud peruano y las directrices del MINSA.

## Contrato RBAC actual

Los permisos de lectura protegen los puntos de entrada y mantienen visibles los datos clínicos. Los permisos de edición ocultan las acciones de registro o modificación cuando el usuario solo puede consultar.

| Superficie                                | Lectura / entrada                                                  | Modificación                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Consulta externa e historia médica        | `app:hoja.clinica.consultaExterna`                                 | `app:hoja.clinica.consultaExterna.editar`                                             |
| Formularios AMPATH de Consulta Externa    | `app:hoja.clinica.consultaExterna`                                 | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.formulariosClinicos`    |
| Hoja de Referencia Institucional nativa   | `app:hoja.clinica.consultaExterna`                                 | `app:hoja.clinica.consultaExterna.editar`                                             |
| Diagnóstico/plan desde Consulta Externa   | `app:hoja.clinica.consultaExterna`                                 | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.resumenConsulta.editar` |
| Pruebas complementarias                   | `app:hoja.clinica.consultaExterna` + `app:hoja.clinica.resultados` | Solo lectura; las órdenes conservan sus propios permisos                              |
| Historia social                           | `app:hoja.clinica.historiaSocial`                                  | `app:hoja.clinica.historiaSocial.editar`                                              |
| Consultas previas desde Consulta Externa  | `app:hoja.clinica.visitas`                                         | Las acciones históricas conservan sus propios permisos                                |
| Prescripción desde el plan de tratamiento | Entrada por Consulta Externa                                       | `app:hoja.clinica.canastaOrdenes` + `app:hoja.clinica.ordenes.editar`                 |

En la navegación normal, los guards se acumulan: primero se entra al dashboard con lectura y después se habilita la acción con edición. Los workspaces y modales registrados declaran directamente el privilegio de edición, sin inferir el permiso base; OpenMRS no implementa herencia padre/hijo por el nombre del privilegio.

Las listas y estados vacíos siguen visibles en modo de solo lectura, pero sin botones de registro. Los controles heredados de antecedentes todavía delegan el bloqueo final al workspace o modal registrado. Estos guards frontend no sustituyen los permisos del backend para leer o guardar encounters, condiciones, observaciones u órdenes.

## Contrato de diagnóstico de Consulta Externa

La acción **Registrar Diagnóstico** abre el workspace de Visit Notes, que persiste diagnósticos CIE-10 como diagnósticos nativos del encounter. Requiere una visita ambulatoria activa verificada y los dos privilegios de modificación indicados en la tabla. `CE-001-CONSULTA EXTERNA` no debe volver a capturar diagnósticos mediante observaciones.

El historial obtiene el código desde el mapping estructurado CIE-10/ICD-10. Para el catálogo MINSA importado sin mappings, admite el nombre `SHORT` del concepto como código catalogado; no infiere el código desde el texto visible del diagnóstico.

## Advertencia de financiamiento SIS (opcional)

Con `showSisFinancingWarning: true` (apagada por defecto), el dashboard de consulta externa muestra una advertencia no bloqueante cuando la visita activa no tiene financiador definido o el SIS no está vigente, con la misma semántica que el gating de triaje (`getSisFinancingState` sobre los visit attributes canónicos de `@openmrs/esm-patient-common-lib`). Si el usuario tiene `app:home.facturacion`, la advertencia ofrece la acción "Ir a Caja"; sin ese privilegio solo informa. La atención clínica nunca se bloquea: el hard-stop permanece en el flujo de FUA (ver `docs/clinical/plan-alineamiento-seguros-sis.md`).

La pestaña **Referencia / Contrarreferencia** lee exclusivamente encounters de `encounterTypes.referralCounterReferral` y contiene dos vistas independientes: **Referencias emitidas** y **Contrarreferencias recibidas**. El filtro de cada flujo se aplica antes de la paginación; una respuesta de contrarreferencia permanece asociada al encounter de su referencia y no se crea como un registro suelto. Las interconsultas basadas en órdenes no pertenecen a ese historial; se solicitan y consultan desde `esm-interconsultas-app`.

La pestaña **Antecedentes**, situada antes de **Anamnesis**, reutiliza las vistas existentes de antecedentes médicos y sociales. La lectura está protegida por `app:hoja.clinica.historiaSocial`; las acciones de registro conservan los permisos de edición originales. La cabecera incluye **Consultas previas** solo para usuarios con `app:hoja.clinica.visitas` y abre el dashboard histórico canónico, sin duplicar ni cambiar la visita activa.

Los antecedentes personales cargan todas las páginas del historial FHIR. Para crear o editar exigen que la sesión tenga un proveedor clínico; el backend deriva el registrador desde la sesión autenticada y la edición conserva `recordedDate`. Al abrir un antecedente social nuevo se envía `encounterUuid` vacío: el UUID configurado identifica el tipo de encounter y no debe tratarse como un encounter existente.

La pestaña **Pruebas complementarias** monta `consulta-externa-pruebas-complementarias-slot` con el `patientUuid` activo. `@sihsalus/esm-patient-tests-app` aporta en ese slot la misma tarjeta de resultados recientes que usa la historia clínica, protegida por `app:hoja.clinica.resultados`; Consulta Externa no duplica su consulta FHIR ni su lógica de navegación. La tarjeta es de solo lectura y **Ver todos los resultados** abre el dashboard completo de resultados.

No existe un conector frontend con NetLab 1 o NetLab 2. Una integración futura debe implementarse mediante una interfaz institucional autorizada en backend, asociar paciente, solicitud, resultado y procedencia, y contar con reconciliación y auditoría. No se deben almacenar, compartir ni automatizar credenciales personales de profesionales desde este módulo.

## TODO content/backend

- Validar en QLTY que `encounterTypes.externalConsultation`, `triage`, `referralCounterReferral` y `consultation` existan y sean los usados por los formularios reales.
- Revisar que `conditionConceptClassUuid`, `conditionConceptSets` y `conditionFreeTextFallbackConceptUuid` resuelvan conceptos válidos para antecedentes y diagnósticos.
- Validar conceptos de anamnesis compartidos desde `ANAMNESIS_DEFAULT_CONCEPT_UUIDS` y los conceptos locales de diagnóstico, tratamiento, financiador, pertenencia étnica y referencia/contrarreferencia.
- Confirmar que los datos de triaje provengan del encounter type correcto y no se mezclen con vitales de otros flujos.
- Documentar qué formularios de consulta externa crean encounter nuevo y cuáles deben editar el encounter clínico actual.

Los valores de `formsList` para consulta externa usan los nombres estables publicados por content (`CE-001-CONSULTA EXTERNA`, `CE-ANAM-001-ANAMNESIS`, el identificador histórico `CE-SOAP-001-NOTA SOAP` para el formulario de examen físico y `CE-REF-001-REFERENCIA-CONTRARREFERENCIA`). No deben reemplazarse por los UUID de los archivos de esquema, porque esos UUID pueden variar entre entornos. El nombre y la clave internos de SOAP se conservan temporalmente para resolver el formulario y los encuentros ya instalados; no se presentan como SOAP en el flujo ambulatorio. Consulta Externa registra nuevas referencias mediante el workspace nativo **Hoja de Referencia Institucional**; el esquema AMPATH se conserva solo como compatibilidad de captura básica y no es el punto de entrada de Consulta Externa.

El dashboard muestra una cabecera compacta propia para garantizar que `Consulta Externa` se traduzca en el namespace del módulo. El orden operativo de las pestañas sigue el flujo clínico: Triajes previos, Antecedentes, Anamnesis, Examen físico, Pruebas complementarias, Diagnóstico, Plan de Tratamiento y Referencia / Contrarreferencia. **Pruebas complementarias** va antes de Diagnóstico porque el clínico lee lo que devolvió el laboratorio antes de clasificar. La pestaña no implementa su propia vista: expone el slot `consulta-externa-pruebas-complementarias-slot`, donde `esm-patient-tests-app` monta el mismo card de resultados (`externalOverview`) que ya usan la hoja clínica y el resumen de visitas, así que las tres superficies comparten una sola implementación y respetan `app:hoja.clinica.resultados`.

Anamnesis y examen físico son únicos por visita ambulatoria: cero coincidencias crea, una edita y más de una bloquea. Referencia es repetible porque cada derivación es un evento clínico independiente; el workspace crea un encounter nuevo adjunto a la visita ambulatoria verificada y persiste únicamente destino, especialidad, prioridad, condición de salida, transporte y motivo. Paciente, visita, triaje, diagnósticos, tratamiento y profesional no se duplican.

El catálogo inicial de destinos se configura en `referralDestinations` con nombre y código RENIPRESS; la selección conserva ambos en el encounter histórico. La exportación **Hoja de Referencia Institucional** se genera localmente a partir de la visita y deja vacíos para llenado manual los bloques de responsable de la referencia, responsable del establecimiento, personal que acompaña, personal que recibe, firmas y sellos.

## Resumen de atención ambulatoria

Consulta Externa ofrece una descarga PDF denominada **Resumen de atención ambulatoria** para la visita activa, con identificación del paciente, establecimiento, profesional, signos vitales, anamnesis, examen físico segmentado, diagnósticos nativos CIE-10, plan y órdenes asociadas a los encounters de esa visita. El documento se genera íntegramente en el navegador; los datos no se envían a un servicio de PDF externo.

El responsable documental se resuelve solo desde el encounter canónico configurado por tipo y formulario. Ese encounter queda `canonical-complete` cuando contiene exactamente un diagnóstico principal con mapping estructurado CIE-10/ICD-10 y exactamente un provider activo con `clinicianEncounterRoleUuid`; providers de otros roles no firman el documento. La fecha clínica, el nombre y la colegiatura provienen de ese mismo encounter/provider. La colegiatura usa el Provider Attribute Type exacto configurado, nunca el identificador del provider.

Los formatos antiguos dentro de la visita activa se clasifican explícitamente como `legacy`; un encounter canónico presente pero incompleto o ambiguo se clasifica `canonical-incomplete`. El Resumen y las Indicaciones continúan disponibles como documentos informativos en ambos estados, con advertencia visible y campos manuales para fecha clínica, responsable o colegiatura que no pudieron verificarse. No se infiere un profesional ni una hora desde otro encounter. La firma y el sello son manuales; no se afirma ni implementa firma digital. Este fallback no agrega selección de visitas finalizadas: el dashboard sigue trabajando con la visita ambulatoria activa verificada.

La cabecera ofrece además **Imprimir indicaciones**, una hoja PDF breve para entregar al paciente. Incluye la identificación institucional de la ubicación activa (dirección, teléfono y código IPRESS), identificación del paciente, fecha y responsable de la atención, la próxima cita programada verificable, indicaciones terapéuticas, medicamentos indicados mediante órdenes no anuladas, sustituidas, suspendidas ni vencidas registradas en la visita, incluido el motivo registrado cuando el uso es según necesidad (PRN), la indicación clínica y el número de renovaciones registrado (incluido cero), la fecha de control indicada y un espacio para la firma, el sello y el número de colegiatura manuscritos del profesional responsable. Las órdenes canónicas tienen prioridad; el texto histórico de prescripción se usa únicamente cuando la visita no contiene órdenes canónicas, para evitar duplicados. La hoja debe ser revisada, firmada y sellada antes de entregarse al paciente; sigue siendo informativa y no sustituye una receta médica o electrónica válida para dispensación. El número de renovaciones se muestra como dato registrado y no afirma que el documento sea dispensable.

**Emitir Receta Única** aparece junto a las acciones de documentos solo cuando `recetaUnica.identifierSourceUuid` apunta a una fuente idgen (SequentialIdentifierGenerator) del backend. Antes de solicitar un correlativo, el frontend exige el contrato `canonical-complete`, un diagnóstico principal con CIE-10 y órdenes vigentes cuyo `orderer` sea el mismo provider responsable; un registro legacy/incompleto no consume numeración. La vigencia de las órdenes se verifica con la cabecera HTTP `Date` de la lectura de la visita, no con el reloj del portátil, y al componer el PDF se vuelve a evaluar contra `issuedAt` del servidor. La emisión pide el correlativo al servidor —el log de idgen registra fecha, usuario y un comentario con la visita y el paciente: esa es la auditoría de emisión— y usa la cabecera `Date` de la respuesta como fecha de emisión. La vigencia impresa es `validityDays` días desde esa fecha; confirme el valor con la dirección de farmacia según la directiva SISMED (RM 116-2018). El PDF sale en dos cuerpos con el mismo correlativo: ejemplar de farmacia (diagnósticos CIE-10 y detalle completo de cada orden, incluida la cantidad) y ejemplar del paciente con las indicaciones. Nombre y colegiatura proceden del mismo provider canónico; si falta la colegiatura, la línea queda manuscrita y la firma y el sello siguen validando el documento. Si el servidor no entrega numeración, la receta NO se emite (nunca se degrada a numeración local: dos laptops sin red acuñarían duplicados); la hoja informativa de indicaciones sigue disponible. Fuera de alcance: sustancias controladas (recetario especial) y firma digital.

Cuando un documento no se puede producir —sin visita ambulatoria verificada, sin contenido clínico, sin indicaciones ni medicamentos, o sin el contrato clínico de la Receta Única— la acción abre un modal que enumera los datos pendientes y ofrece ir a la pestaña donde se registra el primero de ellos, en vez de un aviso temporal que se desvanece y deja al botón pareciendo inerte. Las advertencias que **sí** producen el documento —registro histórico o incompleto, colegiatura no registrada— siguen siendo avisos temporales: el PDF se genera con esos campos marcados para completarlos a mano.

La identificación institucional se lee primero de la `Location` activa de la sesión mediante REST. La dirección respeta la jerarquía configurada por content: `address4` es la única fuente de calle/dirección, `countyDistrict` es distrito, `stateProvince` es provincia y `address1` es región; no se inventa una calle cuando `address4` está vacío. El teléfono y el código IPRESS se leen de los Location Attribute Types configurables `outpatientDocumentFacilityPhoneAttributeTypeUuid` y `outpatientDocumentFacilityIpressCodeAttributeTypeUuid`; los atributos anulados o vacíos se ignoran. Las acciones de documento esperan a que termine esa lectura para no imprimir una identidad transitoria.

El content que crea esos Attribute Types y completa la `Location` debe desplegarse antes o junto con este frontend. Durante la transición, los valores verificados de Santa Clotilde en `outpatientDocumentFacilityAddress`, `outpatientDocumentFacilityPhone` y `referralOriginRenaesCode` solo se usan si la ubicación activa coincide exactamente con `outpatientDocumentFacilityLocationUuid`; un error o dato ausente en cualquier otra ubicación deja el campo sin imprimir en vez de combinar instituciones. Este fallback se conserva únicamente para tolerar el orden de despliegue y debe retirarse cuando los entornos tengan el content alineado.

La **Próxima cita programada** proviene de Appointment Scheduling y se muestra con fecha, servicio, lugar y profesional disponibles. La fecha de control, en cambio, es una observación clínica y no demuestra que exista una reserva; por eso aparece por separado como **Fecha de control indicada** y se aclara que debe confirmarse la programación. Si no se puede consultar la agenda, la impresión continúa con medicamentos e indicaciones, pero avisa al usuario y omite la cita no verificada. El PDF se genera localmente, no incluye identificadores del paciente ni de la visita en el nombre del archivo y descarga el mismo documento como respaldo cuando el visor PDF integrado no carga o informa un error.

La lectura de órdenes usa la representación polimórfica `FULL` de REST para respetar las diferencias entre `DrugOrder` y `TestOrder`, y enriquece únicamente la fortaleza de los medicamentos identificados. Una orden de laboratorio en la misma atención no debe impedir la generación de los documentos ni perder el detalle de dosis de los medicamentos.

La Epicrisis pertenece al egreso de hospitalización según la NTS 139. Consulta Externa no abre ni reutiliza `Formulario Epicrisis Médica` ni `(Página 16) Epicrisis`; su documento es únicamente el resumen de la atención ambulatoria.

El formulario identificado históricamente como `CE-SOAP-001-NOTA SOAP` registra el examen general y el examen regional por sistemas mediante campos diferenciados por `formFieldPath`. Ningún campo se completa como “normal” automáticamente. Consulta Externa muestra únicamente esos hallazgos de examen físico; de los registros SOAP históricos solo reutiliza el hallazgo objetivo como compatibilidad de lectura y no presenta Subjetivo, Apreciación ni Plan como secciones ambulatorias.

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

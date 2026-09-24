# esm-atencion-ambulatoria-app

Antecedentes usa la tabla y el formulario canónicos de `esm-patient-conditions-app`. Se retiran la copia sin consumidores de `ui/conditions-filter`, sus registros y configuración; la entrada de CRED con el mismo nombre de workspace conserva su dueño y contrato. La lectura histórica y los datos persistidos no se eliminan.

Microfrontend de atención ambulatoria y consulta externa para SIH Salus, una distribución de OpenMRS 3.x adaptada al ecosistema de salud peruano y las directrices del MINSA.

## Contrato RBAC actual

Los permisos de lectura protegen los puntos de entrada y mantienen visibles los datos clínicos. Los permisos de edición ocultan las acciones de registro o modificación cuando el usuario solo puede consultar.

| Superficie                                | Lectura / entrada                                                   | Modificación                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Consulta externa e historia médica        | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar`                                                                      |
| Formularios AMPATH de Consulta Externa    | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.formulariosClinicos`                             |
| Hoja de Referencia Institucional nativa   | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar`                                                                      |
| Diagnóstico/plan desde Consulta Externa   | `app:hoja.clinica.consultaExterna`                                  | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.resumenConsulta.editar`                          |
| Pruebas complementarias                   | `app:hoja.clinica.consultaExterna` + `app:hoja.clinica.resultados`  | Solo lectura; las órdenes conservan sus propios permisos                                                       |
| Antecedentes en Consulta Externa          | `app:hoja.clinica.consultaExterna` + `app:hoja.clinica.condiciones` | `app:hoja.clinica.condiciones.editar`                                                                          |
| Historia social                           | `app:hoja.clinica.historiaSocial`                                   | `app:hoja.clinica.historiaSocial.editar`                                                                       |
| Consultas previas desde Consulta Externa  | `app:hoja.clinica.visitas`                                          | Las acciones históricas conservan sus propios permisos                                                         |
| Prescripción desde el plan de tratamiento | Entrada por Consulta Externa                                        | `app:hoja.clinica.canastaOrdenes` + `app:hoja.clinica.ordenes.editar` + `app:hoja.clinica.medicamentos.editar` |

En la navegación normal, los guards se acumulan: primero se entra al dashboard con lectura y después se habilita la acción con edición. Los workspaces y modales registrados declaran directamente el privilegio de edición, sin inferir el permiso base; OpenMRS no implementa herencia padre/hijo por el nombre del privilegio.

Las listas y estados vacíos siguen visibles en modo de solo lectura, pero sin botones de registro. Los controles heredados de antecedentes todavía delegan el bloqueo final al workspace o modal registrado. Estos guards frontend no sustituyen los permisos del backend para leer o guardar encounters, condiciones, observaciones u órdenes.

## Contrato de diagnóstico de Consulta Externa

La acción **Registrar Diagnóstico** abre el workspace de Visit Notes, que persiste diagnósticos CIE-10 como diagnósticos nativos del encounter. Requiere una visita ambulatoria activa verificada y los dos privilegios de modificación indicados en la tabla. `CE-001-CONSULTA EXTERNA` no debe volver a capturar diagnósticos mediante observaciones.

El historial obtiene el código desde el mapping estructurado CIE-10/ICD-10. Para el catálogo MINSA importado sin mappings, admite el nombre `SHORT` del concepto como código catalogado; no infiere el código desde el texto visible del diagnóstico.

## Acceso directo a prescripción

**Prescribir medicamentos** abre el buscador canónico de medicamentos con el paciente y la visita del chart. Conserva el guard de inicio de visita y exige los tres permisos de la tabla antes de ofrecer la acción. Al añadir la receta a las órdenes pendientes o cancelar el formulario, vuelve a la canasta existente para revisar y firmar; no crea una segunda canasta ni envía la receta automáticamente. La X de la ventana conserva su cierre normal.

Si cambia el paciente o la visita durante el cierre, no reabre el contexto anterior. Una denegación al volver a la canasta muestra un aviso seguro y conserva sus órdenes. Registrar medicación previa continúa siendo un alcance distinto ([#14](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/14)); este acceso inicia una prescripción nueva.

Usa los workspaces existentes de Patient Medications y Patient Orders y los mismos servicios OpenMRS: no requiere un OMOD, endpoint ni concepto nuevo. Validar en QLTY con paciente sintético: visita activa/inexistente, permisos permitidos/denegados, orden pendiente previa, añadir/cancelar y regreso a la canasta sin duplicar.

## Advertencia de financiamiento SIS (opcional)

Con `showSisFinancingWarning: true` (apagada por defecto), el dashboard de consulta externa muestra una advertencia no bloqueante cuando la visita activa no tiene financiador definido o el SIS no está vigente, con la misma semántica que el gating de triaje (`getSisFinancingState` sobre los visit attributes canónicos de `@openmrs/esm-patient-common-lib`). Si el usuario tiene `app:home.facturacion`, la advertencia ofrece la acción "Ir a Caja"; sin ese privilegio solo informa. La atención clínica nunca se bloquea: el hard-stop permanece en el flujo de FUA (ver `docs/clinical/plan-alineamiento-seguros-sis.md`).

La pestaña **Referencia / Contrarreferencia** lee exclusivamente encounters de `encounterTypes.referralCounterReferral` y contiene dos vistas independientes: **Referencias emitidas** y **Contrarreferencias recibidas**. El filtro de cada flujo se aplica antes de la paginación; una respuesta de contrarreferencia permanece asociada al encounter de su referencia y no se crea como un registro suelto. Las interconsultas basadas en órdenes no pertenecen a ese historial; se solicitan y consultan desde `esm-interconsultas-app`.

La pestaña **Antecedentes**, situada antes de **Anamnesis**, monta en **Condiciones** la misma extensión `conditions-details-widget` que la página independiente. `consulta-externa-antecedents-slot` pertenece a este módulo y recibe el recurso FHIR `patient` verificado junto con `patientUuid`; no se monta si la identidad no coincide o falla la carga. La lectura requiere `app:hoja.clinica.condiciones` y las acciones canónicas conservan `app:hoja.clinica.condiciones.editar`, sin exigir el permiso de historia social. El formulario, la lectura REST Condition, la edición y la actualización de la lista pertenecen a `esm-patient-conditions-app`, declarado como dependencia de este consumidor. Requiere su módulo instalado, la API REST de condiciones de OpenMRS y su configuración de conceptos. Si la sección no está disponible, se muestra un aviso seguro y no se ofrece el formulario antiguo como sustituto.

**Registros médicos anteriores** conserva debajo la tabla histórica de encounters en un acordeón cerrado inicialmente y cargado al abrirlo, únicamente de lectura y protegida por `app:hoja.clinica.historiaSocial`. No se migran ni se reinterpretan observaciones o diagnósticos como Condition. **Historia social** reutiliza la tarjeta clínica compartida y sus permisos existentes; su formulario específico de alcohol y tabaco requiere content 1.25.23. La cabecera incluye **Consultas previas** solo para usuarios con `app:hoja.clinica.visitas` y abre el dashboard histórico canónico, sin duplicar ni cambiar la visita activa.

El sidebar muestra un solo **Antecedentes**. La ruta `Antecedentes` compone estas mismas dos pestañas mediante `patient-chart-antecedents-slot`, con lectura de condiciones en la entrada y permisos independientes dentro. `social-history-dashboard` conserva su dashboard histórico para enlaces anteriores y perfiles que solo leen historia social, incluidos sus paneles de hospitalización. Su enlace se oculta cuando `conditions-summary-dashboard` está asignado por el framework (incluidos permisos y overrides), sin cambiar el orden canónico de `config/frontend.json`. Si falta Conditions, el enlace de historia social permanece disponible. Los workspaces y formularios de guardado conservan sus contratos.

Las entradas de Historia Social usan `socialHistory.formUuid` y `socialHistory.encounterTypeUuid`, separados del formulario genérico heredado. Verifican paciente, publicación y tipo antes de abrir el workspace AMPATH compartido; la creación requiere una visita ambulatoria activa y recupera un registro existente en ella. La edición conserva la visita original. Las dos tarjetas distinguen registros nuevos y anteriores, estos últimos de solo lectura. Se reutilizan `ClinicalHistoryCard`, controles Carbon y paginación; los UUID heredados conservan su semántica. El [contrato de contenido](../../../docs/clinical/social-history-content-contract.md) documenta conceptos, identidades, límites y validación pendiente en DEV/QLTY.

La tabla de antecedentes médicos conserva el resto del historial cuando un diagnóstico antiguo no trae su representación codificada: muestra `--` en esa celda en lugar de bloquear la pantalla. No infiere un diagnóstico ni modifica el registro histórico.

El lector compartido de Historia Social, anamnesis, examen físico, diagnósticos,
tratamiento y referencias solicita y verifica el paciente y tipo de encuentro
de cada registro antes de mostrarlo. También verifica UUID únicos por fuente,
un total estable y
la coherencia entre el fin de las páginas y ese total. Un enlace `next` exige
continuar, también en páginas cortas; se conservan los filtros originales y no
se sigue la dirección recibida. Las fuentes inconsistentes fallan sin publicar
un historial aparentemente completo. Otras fuentes válidas permanecen visibles
con advertencia; si no aportan registros, se muestra error en lugar de afirmar
que no hay antecedentes. El límite de 20 páginas también informa lectura parcial.
Se conserva la política offline existente del historial; estas comprobaciones
no garantizan una instantánea transaccional frente a cambios concurrentes.

Fuera del registro canónico de Consulta Externa, los formularios históricos de antecedentes médicos y sociales reciben una función que actualiza la consulta del historial al completar el cierre desde el formulario. Abrir el formulario no dispara esa actualización. La X del workspace mantiene su contrato de cierre y no ejecuta ese callback.

Los antecedentes personales comparten con Conditions, CRED y Salud Materna el lector y los payloads de `esm-patient-common-lib`: cargan todas las páginas REST, incluyendo los estados inactivos, antes de publicar el historial. Para crear o editar exigen que la sesión tenga un proveedor clínico; el backend deriva el autor desde la sesión autenticada. Las correcciones conservan la versión anterior con su autor y fecha, y generan una nueva versión atribuida al editor; sólo se envían los campos clínicos modificados. El uso de REST evita la pérdida de estados del traductor FHIR2 y su consulta privilegiada del registrador. Un fallo de recarga posterior no se trata como un fallo de escritura ni permite repetirla. En Historia Social, `encounterUuid` solo identifica un encuentro verificado; nunca se usa el UUID del tipo como UUID del registro.

El lector de antecedentes personales tolera que falten los arrays `coding`: conserva la narración nativa de OpenMRS, `code.text` cuando existe o `--` si no hay descripción, sin inventar concepto ni estado clínico. Las vistas por conjunto de conceptos mantienen su filtro. Los nuevos registros «Otro» utilizan texto no codificado nativo; el antiguo concepto de pregunta de texto se conserva sólo para leer registros históricos. No se migran observaciones obstétricas ni se convierten todos los antecedentes en diagnósticos CIE-10. Véase el [contrato de antecedentes](../../../docs/clinical/antecedents-data-contract.md).

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
- Configurar los conceptos de antecedentes en el módulo canónico `esm-patient-conditions-app`. Los antiguos overrides de `conditionPageSize`, `conditionConceptClassUuid`, `conditionConceptSets` y `conditionFreeTextFallbackConceptUuid` de este módulo dejan de utilizarse.
- Validar conceptos de anamnesis compartidos desde `ANAMNESIS_DEFAULT_CONCEPT_UUIDS` y los conceptos locales de diagnóstico, tratamiento, financiador, pertenencia étnica y referencia/contrarreferencia.
- Confirmar que los datos de triaje provengan del encounter type correcto y no se mezclen con vitales de otros flujos.
- Documentar qué formularios de consulta externa crean encounter nuevo y cuáles deben editar el encounter clínico actual.

Los valores de `formsList` para consulta externa usan los nombres estables publicados por content (`CE-001-CONSULTA EXTERNA`, `CE-ANAM-001-ANAMNESIS`, `CE-EXF-001-EXAMEN FISICO` y `CE-REF-001-REFERENCIA-CONTRARREFERENCIA`). No deben reemplazarse por los UUID de los archivos de esquema, porque esos UUID pueden variar entre entornos. Examen físico usa `formsList.physicalExamForm`; se retiran `soapNoteForm` y cualquier override de ese nombre. El formulario histórico no se usa como alternativa de captura. Consulta Externa registra nuevas referencias mediante el workspace nativo **Hoja de Referencia Institucional**; el esquema AMPATH se conserva solo como compatibilidad de captura básica y no es el punto de entrada de Consulta Externa.

### Captura simplificada de anamnesis y examen físico

Requiere content **1.25.28**, que reúne la anamnesis `1.1.0` y el formulario
independiente `CE-EXF-001-EXAMEN FISICO` `1.0.0`. `anamnesisFormVersion` y
`physicalExamFormVersion` fijan esas versiones respectivamente. La cabecera usa
Anamnesis o Examen físico; SOAP queda únicamente como historia retirada.
El examen contiene estado general y sistemas, sin Subjetivo, Objetivo,
Apreciación ni Plan duplicados. El diagnóstico y tratamiento siguen en sus
secciones canónicas.

Anamnesis conserva motivo, tiempo de enfermedad y un detalle breve opcional.
Inicio, evolución y funciones biológicas usan selectores sin respuesta
predeterminada; las funciones biológicas se presentan contraídas. Las opciones
persisten valores Text existentes mediante el motor compartido, no conceptos
nuevos ni conversiones de registros históricos.

El lanzador exige la versión configurada. Si la visita ya contiene un formulario
de una versión anterior, informa y bloquea otra captura; no duplica encuentros
ni les reasigna el esquema nuevo. El historial mantiene los datos anteriores.
`physicalExamHistoricalFormNames` reconoce el nombre anterior del examen
únicamente para impedir una segunda captura en la misma visita; nunca abre
ese formulario retirado ni lo usa como alternativa.
Probar frontend/content juntos en QLTY: creación, selección, guardado, recarga,
edición, solo lectura, versión faltante y visita abierta durante la actualización.
La aceptación clínica y el despliegue siguen pendientes hasta esa comprobación.

El dashboard muestra una cabecera compacta propia para garantizar que `Consulta Externa` se traduzca en el namespace del módulo. El orden operativo de las pestañas sigue el flujo clínico: Triajes previos, Antecedentes, Anamnesis, Examen físico, Pruebas complementarias, Diagnóstico, Plan de Tratamiento y Referencia / Contrarreferencia. **Pruebas complementarias** va antes de Diagnóstico porque el clínico lee lo que devolvió el laboratorio antes de clasificar. La pestaña no implementa su propia vista: expone el slot `consulta-externa-pruebas-complementarias-slot`, donde `esm-patient-tests-app` monta el mismo card de resultados (`externalOverview`) que ya usan la hoja clínica y el resumen de visitas, así que las tres superficies comparten una sola implementación y respetan `app:hoja.clinica.resultados`.

**Triajes previos** utiliza el slot compartido `consulta-externa-vitals-summary-slot`;
no mantiene un lector local alternativo de encuentros de triaje.

Anamnesis y examen físico son únicos por visita ambulatoria: cero coincidencias crea, una edita y más de una bloquea. Referencia es repetible porque cada derivación es un evento clínico independiente; el workspace crea un encounter nuevo adjunto a la visita ambulatoria verificada y persiste únicamente destino, especialidad, prioridad, condición de salida, transporte y motivo. Paciente, visita, triaje, diagnósticos, tratamiento y profesional no se duplican.

Antes de abrir un formulario, la verificación de su publicación y cada página
de la búsqueda de encounters requieren una respuesta del servidor mediante
`cache: no-store`. Una búsqueda vacía almacenada no autoriza crear otro registro
de anamnesis o examen físico. Si falla cualquiera de esas lecturas, se muestra
el error existente y se permite reintentar al recuperar la conexión. Se reutiliza
el contrato del worker del frontend, que debe estar actualizado y activo; cerrar
las pestañas de versiones anteriores antes de validar en QLTY. Restaurar la misma
instancia ya abierta conserva sus cambios sin guardar. Esto no sustituye los
controles de persistencia o concurrencia del backend.

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

### Servicios de la referencia institucional

La Hoja de Referencia separa visualmente los datos ya registrados, el destino y
las condiciones del traslado. El contenido se desplaza dentro del workspace y
las acciones permanecen al pie. Los campos ocupan el ancho disponible y las
opciones de prioridad, condición y transporte se distribuyen según el espacio
del panel, también cuando se abre estrecho en escritorio. Validar visualmente
panel estrecho, escritorio y tablet, con etiquetas en español e inglés y con
las opciones «Otro» desplegadas.

El formulario nativo exige seleccionar la **UPS destino** por separado de la
especialidad y de la prioridad de la referencia. Persiste la respuesta codificada
bajo `concepts.referralDestinationServiceUuid`. Los valores predeterminados
reutilizan el concepto y las tres respuestas de `FormularioHojaDeReferencia`
(UPS destino, Emergencia, Consulta Externa y Apoyo al Diagnóstico) del contenido
SIHSALUS; no se infiere una UPS desde la especialidad ni desde la prioridad.
Verificar que esos conceptos y sus respuestas estén importados antes de habilitar
esta captura en DEV/QLTY.

El historial muestra la ubicación guardada en el encounter de referencia como
origen y su observación UPS como destino. El PDF vuelve a leer la visita en el
servidor, selecciona exactamente esa referencia y usa su ubicación, sin tomar la
ubicación actual de la sesión ni escribir «Consulta Externa» como valor fijo.
La ubicación guardada debe corresponder al servicio que realmente emitió la
referencia; este cambio no reinterpreta una ubicación institucional como una UPSS
ni reconstruye movimientos que no hayan quedado registrados.

Una referencia ausente, anulada, de otro tipo o con servicios incompletos o
ambiguos bloquea la descarga. Los registros históricos sin UPS siguen visibles;
no se rellenan ni migran automáticamente. La especialidad y prioridad conservan
su significado independiente.

Pendiente de aceptación: guardar, recargar e imprimir con roles sintéticos y
comparar ambos servicios, las asociaciones con paciente/visita y el catálogo
instalado. El lanzador y la composición clínica siguen limitados a visitas
ambulatorias; habilitar el circuito de una visita de Emergencia requiere su
contrato clínico y no se resuelve cambiando el rótulo del PDF. El caso de extremo
a extremo desde Emergencia continúa pendiente; las pruebas locales de un origen
registrado como Emergencia no lo certifican.

## Resumen de atención ambulatoria

La lectura de la visita para generar Resumen, Indicaciones o Receta Única exige
`cache: no-store`. El worker de perfil offline del mismo frontend no sustituye
un fallo de red por una visita descargada previamente. Así, datos o una fecha
HTTP antiguos no se presentan como verificados al generar un documento actual.
La identidad y el resto de requisitos clínicos siguen comprobándose antes de
producirlo; la información del catálogo de medicamentos conserva su función de
enriquecimiento opcional. Validar guardado, recarga, impresión y reconexión en
DEV/QLTY con el worker actualizado y cuentas sintéticas autorizadas.

Consulta Externa ofrece una descarga PDF denominada **Resumen de atención ambulatoria** para la visita activa, con identificación del paciente, establecimiento, profesional, signos vitales, anamnesis, examen físico segmentado, diagnósticos nativos CIE-10, plan y órdenes asociadas a los encounters de esa visita. El documento se genera íntegramente en el navegador; los datos no se envían a un servicio de PDF externo.

El responsable documental se resuelve solo desde el encounter canónico configurado por tipo y formulario. Ese encounter queda `canonical-complete` cuando contiene exactamente un diagnóstico principal con mapping estructurado CIE-10/ICD-10 y exactamente un provider activo con `clinicianEncounterRoleUuid`; providers de otros roles no firman el documento. La fecha clínica, el nombre y la colegiatura provienen de ese mismo encounter/provider. La colegiatura usa el Provider Attribute Type exacto configurado, nunca el identificador del provider.

Los formatos antiguos dentro de la visita activa se clasifican explícitamente como `legacy`; un encounter canónico presente pero incompleto o ambiguo se clasifica `canonical-incomplete`. El Resumen y las Indicaciones continúan disponibles como documentos informativos en ambos estados, con advertencia visible y campos manuales para fecha clínica, responsable o colegiatura que no pudieron verificarse. No se infiere un profesional ni una hora desde otro encounter. La firma y el sello son manuales; no se afirma ni implementa firma digital. En el dashboard este fallback sigue trabajando con la visita ambulatoria activa verificada; los documentos históricos se abren desde la consulta seleccionada en Consultas previas.

La cabecera ofrece además **Imprimir indicaciones**, una hoja PDF breve para entregar al paciente. Incluye la identificación institucional de la ubicación activa (dirección, teléfono y código IPRESS), identificación del paciente, fecha y responsable de la atención, la próxima cita programada verificable, indicaciones terapéuticas, medicamentos indicados mediante órdenes no anuladas, sustituidas, suspendidas ni vencidas registradas en la visita, incluido el motivo registrado cuando el uso es según necesidad (PRN), la indicación clínica y el número de renovaciones registrado (incluido cero), la fecha de control indicada y un espacio para la firma, el sello y el número de colegiatura manuscritos del profesional responsable. Las órdenes canónicas tienen prioridad; el texto histórico de prescripción se usa únicamente cuando la visita no contiene órdenes canónicas, para evitar duplicados. La hoja debe ser revisada, firmada y sellada antes de entregarse al paciente; sigue siendo informativa y no sustituye una receta médica o electrónica válida para dispensación. El número de renovaciones se muestra como dato registrado y no afirma que el documento sea dispensable.

**Emitir Receta Única** aparece junto a las acciones de documentos solo cuando `recetaUnica.identifierSourceUuid` apunta a una fuente idgen (SequentialIdentifierGenerator) del backend. Pedir el correlativo a idgen (`POST /idgen/identifiersource/{uuid}/identifier`) exige el privilegio nativo **`Edit Patient Identifiers`** en el rol del profesional que emite; sin él el backend responde 403 y la interfaz informa que el servidor no entregó la numeración. El rol `SIHSALUS Consulta Externa` lo incluye desde content (sihsalus-content#221). Antes de solicitar un correlativo, el frontend exige el contrato `canonical-complete`, un diagnóstico principal con CIE-10 y órdenes vigentes cuyo `orderer` sea el mismo provider responsable; un registro legacy/incompleto no consume numeración. La vigencia de las órdenes se verifica con la cabecera HTTP `Date` de la lectura de la visita, no con el reloj del portátil, y al componer el PDF se vuelve a evaluar contra `issuedAt` del servidor. La emisión pide el correlativo al servidor —el log de idgen registra fecha, usuario y un comentario con la visita y el paciente: esa es la auditoría de emisión— y usa la cabecera `Date` de la respuesta como fecha de emisión. La vigencia impresa es `validityDays` días desde esa fecha; confirme el valor con la dirección de farmacia según la directiva SISMED (RM 116-2018). El PDF sale en dos cuerpos con el mismo correlativo: ejemplar de farmacia (diagnósticos CIE-10 y detalle completo de cada orden, incluida la cantidad) y ejemplar del paciente con las indicaciones. Nombre y colegiatura proceden del mismo provider canónico; si falta la colegiatura, la línea queda manuscrita y la firma y el sello siguen validando el documento. Si el servidor no entrega numeración, la receta NO se emite (nunca se degrada a numeración local: dos laptops sin red acuñarían duplicados); la hoja informativa de indicaciones sigue disponible. Fuera de alcance: sustancias controladas (recetario especial) y firma digital.

Cuando un documento no se puede producir —sin visita ambulatoria verificada, sin contenido clínico, sin indicaciones ni medicamentos, o sin el contrato clínico de la Receta Única— la acción abre un modal que enumera los datos pendientes y ofrece ir a la pestaña donde se registra el primero de ellos, en vez de un aviso temporal que se desvanece y deja al botón pareciendo inerte. Las advertencias que **sí** producen el documento —registro histórico o incompleto, colegiatura no registrada— siguen siendo avisos temporales: el PDF se genera con esos campos marcados para completarlos a mano.

La identificación institucional se lee primero de la `Location` activa de la sesión mediante REST. La dirección respeta la jerarquía configurada por content: `address4` es la única fuente de calle/dirección, `countyDistrict` es distrito, `stateProvince` es provincia y `address1` es región; no se inventa una calle cuando `address4` está vacío. El teléfono y el código IPRESS se leen de los Location Attribute Types configurables `outpatientDocumentFacilityPhoneAttributeTypeUuid` y `outpatientDocumentFacilityIpressCodeAttributeTypeUuid`; los atributos anulados o vacíos se ignoran. Las acciones de documento esperan a que termine esa lectura para no imprimir una identidad transitoria.

El content que crea esos Attribute Types y completa la `Location` debe desplegarse antes o junto con este frontend. Durante la transición, los valores verificados de Santa Clotilde en `outpatientDocumentFacilityAddress`, `outpatientDocumentFacilityPhone` y `referralOriginRenaesCode` solo se usan si la ubicación activa coincide exactamente con `outpatientDocumentFacilityLocationUuid`; un error o dato ausente en cualquier otra ubicación deja el campo sin imprimir en vez de combinar instituciones. Este fallback se conserva únicamente para tolerar el orden de despliegue y debe retirarse cuando los entornos tengan el content alineado.

La **Próxima cita programada** proviene de Appointment Scheduling y se muestra con fecha, servicio, lugar y profesional disponibles. La fecha de control, en cambio, es una observación clínica y no demuestra que exista una reserva; por eso aparece por separado como **Fecha de control indicada** y se aclara que debe confirmarse la programación. Si no se puede consultar la agenda, la impresión continúa con medicamentos e indicaciones, pero avisa al usuario y omite la cita no verificada. El PDF se genera localmente, no incluye identificadores del paciente ni de la visita en el nombre del archivo y descarga el mismo documento como respaldo cuando el visor PDF integrado no carga o informa un error.

La lectura de órdenes usa la representación polimórfica `FULL` de REST para respetar las diferencias entre `DrugOrder` y `TestOrder`, y enriquece únicamente la fortaleza de los medicamentos identificados. Una orden de laboratorio en la misma atención no debe impedir la generación de los documentos ni perder el detalle de dosis de los medicamentos.

La Epicrisis pertenece al egreso de hospitalización según la NTS 139. Consulta Externa no abre ni reutiliza `Formulario Epicrisis Médica` ni `(Página 16) Epicrisis`; su documento es únicamente el resumen de la atención ambulatoria.

**Examen físico** usa el formulario propio `CE-EXF-001-EXAMEN FISICO` (`1.0.0`) mediante `formsList.physicalExamForm`. Contiene examen general y regional por sistemas, sin Subjetivo, Objetivo, Apreciación ni Plan. Conserva los conceptos y `formFieldPath` de los campos segmentados. Ningún campo se completa como “normal” automáticamente. Content debe incorporar este formulario antes de habilitar el frontend; si falta, se muestra el error de formulario no disponible. Los formularios de Hospitalización conservan su flujo.

El historial se implementa en `usePhysicalExam` y `examen-fisico.component.tsx`. Devuelve `physicalExamEntries` y filtra los encuentros sin hallazgos antes de paginar. Los registros anteriores se conservan mediante `legacyObjective`; los documentos leen únicamente narración y examen anteriores en `legacyNotes`. Las claves de conceptos de lectura son `legacyNarrativeUuid` y `legacyPhysicalExamUuid`; los overrides previos de `soapSubjectiveUuid` y `soapObjectiveUuid` deben trasladarse a esas claves sin cambiar sus valores. Las rutas de observación históricas permanecen para lectura; evaluación y plan SOAP no forman parte del resumen ambulatorio ni de sus criterios de contenido.

La generación de ambos documentos falla cerrada si no se puede verificar que la visita, su tipo ambulatorio y el paciente coincidan. El dashboard usa la visita activa; el historial usa exclusivamente la visita finalizada seleccionada explícitamente, sin elegir silenciosamente “la última” del paciente.

### Documentos de consultas finalizadas

En **Consultas previas → consulta seleccionada → Documentos de Consulta Externa**
se puede descargar el resumen e imprimir las indicaciones de una visita
ambulatoria finalizada. La selección, las fechas y la paginación pertenecen al
historial existente de Visitas. El panel se integra en `visit-summary-panels` y
reutiliza el lector y los generadores PDF anteriores; no crea ni cambia la visita
activa y no ofrece edición ni emisión de Receta Única.

Se necesitan ambos permisos de lectura: `app:hoja.clinica.visitas` y
`app:hoja.clinica.consultaExterna`. Al generar se vuelve a verificar en REST la
identidad de la visita, el paciente, el tipo ambulatorio y que siga finalizada.
Cambiar de paciente o de visita, o desmontar el panel, descarta cualquier
documento pendiente de ese contexto.

Los documentos históricos son **copias informativas de los datos actualmente
disponibles en el registro**, no reproducciones de una emisión archivada. La
advertencia aparece en el panel y en el PDF. Las indicaciones incluyen los
medicamentos registrados aunque hayan vencido o terminado; conservan el filtrado
existente de órdenes anuladas o sustituidas y no afirman tratamiento vigente.
Nunca incorporan citas futuras consultadas en la agenda actual ni consumen un
correlativo de receta.

El establecimiento procede de la ubicación asociada a la visita. Se omiten
dirección, teléfono y código IPRESS, porque el contrato actual no conserva una
versión histórica de esos atributos. Tampoco conserva una instantánea de la
identificación del paciente o del provider: se muestran los datos disponibles
mediante sus referencias, sin presentarlos como una reproducción certificada.
No se completa la institución histórica con la ubicación activa de la sesión.

Esta iteración contribuye al
[issue #12](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/12);
no lo cierra. Quedan pendientes la validación clínica con dos consultas
sintéticas en DEV/QLTY y los otros casos de persistencia/edición del issue.

## Validación local

`yarn workspace @sihsalus/esm-atencion-ambulatoria-app typescript` comprueba tanto
el código del módulo como sus tests `.test.ts` y `.test.tsx`. Los mocks deben
respetar los contratos de los hooks y componentes; no se excluyen del compilador.
Ejecutar también `yarn workspace @sihsalus/esm-atencion-ambulatoria-app test`
para validar las aserciones de comportamiento.

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

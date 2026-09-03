# esm-patient-chart

This microfrontend provides the underlying framework on top of which all the individual widgets are run. It sets up the layout of the patient chart and handles routing between the chart summary and widget dashboards. It also sets up core extensions, the workspace, the side and nav menus, visits functionality as well as offline mode.

## Rol dentro de SIH Salus

`esm-patient-chart-app` es una zona critica. Es el contenedor de historia clinica del paciente y coordina:

- banner del paciente;
- left sidebar del chart;
- right sidebar y acciones contextuales;
- visit/consulta activa;
- workspaces de registro clinico;
- extension slots de otros microfrontends;
- widgets de resumen, resultados, ordenes, FUA, notas, listas, condiciones y datos clinicos.

Un cambio pequeno aqui puede romper multiples apps porque muchas extensiones dependen del mismo layout y del mismo contexto de paciente/visita.

## Contratos funcionales

- No registrar datos clinicos si no existe una visita/consulta activa, salvo flujo explicitamente documentado.
- No cambiar nombres de workspaces, modales o extension slots sin actualizar consumidores.
- No esconder errores de registro: si un workspace o modal no existe, el mensaje debe indicar el nombre faltante y la accion esperada.
- No reemplazar componentes estructurales por `div` salvo que se documente el motivo y se valide el layout.
- El banner del paciente debe ser estable: `Mostrar mas` no debe ocultar el resumen ni romper el layout.
- El left sidebar debe mostrar labels traducidos; keys como `caseMonitoringEncounters` son defectos.
- El right sidebar debe conservar acciones criticas: ordenes, FUA, notas de visita, formularios y listas de pacientes.

### Acompañante por consulta

El acompañante seleccionado al iniciar una consulta pertenece únicamente a esa visita. No debe crearse una relación
permanente entre la persona y el paciente ni reutilizarse automáticamente en atenciones posteriores.

- Configuración frontend: `companionVisitAttributeTypeUuid`.
- Tipo de atributo de visita SIH SALUS: `710da0b9-e15f-47f0-827a-e97f1937c81d`.
- Valor almacenado: UUID de la `Person` seleccionada como acompañante.
- Cardinalidad backend: `0..1` por visita, usando `FreeTextDatatype`.
- En menores de edad la selección de una persona adulta es obligatoria; en adultos es opcional.

### Cobertura de la consulta

El formulario de inicio/edición aplica el financiador efectivo de la visita, que puede corregir la
afiliación administrativa de la persona para esa atención:

- SIS muestra número, estado y fecha/hora de acreditación mediante los cuatro atributos canónicos que el
  formulario reinyecta siempre. Al editar, la fecha persistida vuelve a mostrarse; borrarla conserva un valor
  vacío y nunca lo sustituye silenciosamente por la fecha actual.
- Otra IAFAS muestra el número de póliza y oculta los campos SIS.
- Autofinanciamiento muestra solo el financiador.
- Cambiar de financiador limpia los complementos del anterior y el payload vuelve a sanearlos antes de
  persistir.
- DNI, CE, pasaporte, HCE y los identificadores sin tipo nunca se copian como número de seguro. La única
  excepción es `E-########` del tipo configurado en `sisTemporaryAffiliationPatientIdentifierTypeUuid`, y
  solo cuando una lectura REST fresca confirma el identificador canónico vigente, el financiador es SIS y la
  persona conserva acreditación Vigente con fecha/hora ISO completa y método `manual-web`, `setisis` o
  `siasis-adt`; FHIR vacío/obsoleto, un E con separador o longitud inválidos, otro tipo, evidencia ausente o modo
  offline falla cerrado.
  El mismo snapshot fresco se reutiliza en la copia posterior para no abrir una segunda carrera de lectura.

El método de verificación aún no forma parte de los atributos de visita: se valida desde persona antes de crear
el snapshot, pero esa procedencia no queda disponible en la visita histórica ni en FUA. Añadir método/usuario al
snapshot exige un cambio coordinado de content, backend y consumidores; no debe inferirse después del hecho.

El mapeo predeterminado persona→visita incluye financiador, número, estado SIS y fecha/hora de consulta;
los ocho tipos de atributo forman el contrato canónico compartido con Visitas Activas y FUA. Los overrides
genéricos de `visitAttributeTypes` y `defaultVisitAttributesFromPersonAttributes` pueden agregar campos y
mapeos locales, pero el formulario reinyecta siempre los cuatro atributos y cuatro mapeos canónicos: un
override aislado no puede retirar ni redirigir la cobertura compartida.

Al editar una consulta, el formulario vuelve a leer los atributos persistidos y trata el estado SIS como
marcador de commit. Lo invalida antes de cambiar el bundle, escribe el estado nuevamente al final y usa un
orden asimétrico al cambiar de IAFAS: entrar a SIS confirma primero el financiador para que un fallo posterior
quede visible como SIS pendiente; salir de SIS conserva el financiador anterior hasta limpiar los complementos.
El reintento parte del snapshot actual del servidor y converge sin repetir la actualización clínica.

Después de crear la consulta, la copia persona→visita es no bloqueante e idempotente. Si una escritura
administrativa transitoria falla, el usuario recibe `Reintentar cobertura`; el reintento completa la misma
visita y no crea otra. Antes de intentarla, la UI exige `Get People`, `Get Patients`, `Get Visits`, `Edit Visits`
y `Get Visit Attribute Types`. Si el rol no reúne esa capacidad —o el servidor responde 401/403— la consulta
clínica permanece creada, se deriva la cobertura a Admisión y no se ofrece un reintento imposible. Una cobertura
completa incluida en el POST inicial no necesita esta capacidad posterior. Los resultados determinísticos
—financiador ausente, cobertura incompleta o conflicto SIS—
no entran en un ciclo de reintentos: muestran `Revisar cobertura` y llevan a la sección de seguro del paciente
solo cuando el usuario tiene `app:opciones.registrarPaciente`; sin ese permiso no se ofrece una acción que
terminaría bloqueada. La obligatoriedad del financiador, la derivación automática a Caja y un privilegio
administrativo más específico para editar únicamente cobertura continúan como decisiones pendientes.

Cuando el formulario se abre desde una ruta que exige triaje, la barrera
compatible `requireActiveSisFinancing` significa financiamiento resuelto: acepta
SIS vigente con bundle completo y un financiador no-SIS explícito, incluido
autofinanciamiento. Un financiador ausente o un SIS incompleto, inactivo,
pendiente o no consultado impide ejecutar el callback de cola. Esta regla no
amplía la elegibilidad de FUA.

Al finalizar una consulta elegible para FUA, la prevalidación recorre todas las páginas de encounters de la visita. Solo acepta como diagnóstico principal uno no anulado con código respaldado por mapping CIE-10/ICD-10 o por el nombre `SHORT` del catálogo MINSA, y exige además el código prestacional. Si no puede verificar ambos datos, abre el resumen de consulta y no cierra la visita.

## Taxonomia clinica del resumen del paciente

Los nombres visibles del resumen deben usar lenguaje clinico entendido por los equipos peruanos. Los nombres tecnicos de FHIR son detalles de implementacion. Por ejemplo, FHIR `Condition` puede representar un problema activo, un diagnostico de una atencion o una condicion historica resuelta; eso no obliga a mostrar una seccion llamada `Condiciones`.

### Secciones recomendadas

| Seccion UI                  | Proposito                                                         | Contenido tipico                                                                                        | Mapeo tecnico                                                                          |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Problemas activos           | Problemas clinicamente relevantes que afectan la atencion actual. | Diabetes, hipertension, asma, desnutricion, embarazo de alto riesgo, enfermedad cronica en seguimiento. | Usualmente FHIR `Condition` con estado activo o recurrente.                            |
| Diagnosticos de la atencion | Diagnosticos registrados para una consulta/encuentro especifico.  | Diagnostico agudo, diagnostico diferencial, diagnostico final, diagnostico CIE-10 de la consulta.       | `Condition`, `Encounter.diagnosis` u observaciones diagnosticas segun soporte backend. |
| Antecedentes                | Historia pasada o informacion contextual relevante.               | Antecedentes patologicos, familiares, sociales, ocupacionales, gineco-obstetricos y otros.              | Puede venir de `Condition`, observaciones, formularios o modelos locales.              |
| Procedimientos y cirugias   | Procedimientos invasivos, quirurgicos o terapeuticos importantes. | Cesarea, apendicectomia, legrado, cirugia de catarata, endoscopia, dispositivos implantados.            | Preferir FHIR `Procedure`; datos legacy pueden venir de formularios u observaciones.   |
| Alergias                    | Alergias e intolerancias.                                         | Alergia medicamentosa, alimentaria, reaccion, severidad/criticidad.                                     | FHIR `AllergyIntolerance`.                                                             |
| Medicamentos                | Medicacion activa y medicacion anterior relevante.                | Prescripciones activas, medicamentos previos, renovaciones.                                             | `MedicationRequest`, `MedicationStatement` u ordenes de medicamentos OpenMRS.          |

### Regla de nombres

Evitar `Condiciones` como titulo principal del resumen. Es correcto tecnicamente en FHIR, pero es demasiado amplio para la UI y puede confundirse con antecedentes.

Usar `Problemas activos` cuando la tarjeta funciona como lista de problemas longitudinales. Si la implementacion actual mezcla problemas activos con condiciones resueltas, separar antes de renombrar todo como antecedentes:

- Problemas activos
- Antecedentes patologicos

Usar `Diagnosticos` solo cuando la seccion muestra diagnosticos de una atencion o una evaluacion clinica. Si el registro de diagnosticos ya vive en consulta externa o en la seccion SOAP/A, no duplicarlo en el resumen salvo como ultimos diagnosticos o diagnosticos relevantes.

Crear una tarjeta separada llamada `Procedimientos y cirugias`. Las cirugias son antecedentes, pero para continuidad de atencion y resumen tipo IPS deben tener visibilidad propia.

### Alineamiento MINSA e IPS

El marco MINSA/RENHICE considera informacion clinica basica a datos relevantes como antecedentes, alergias, diagnosticos anteriores, medicacion, cirugias previas y grupo sanguineo para situaciones de atencion urgente. Ver lineamientos CorePE/RENHICE: https://dyaku.minsa.gob.pe/guides/Lineamientos.html

El resumen tipo IPS prioriza una vista compacta para continuidad de atencion: problemas, alergias, medicamentos, inmunizaciones, procedimientos, resultados e historia relevante. SIH Salus debe seguir esa intencion usando etiquetas clinicas locales.

## Dependencias compartidas

- `esm-styleguide` para workspaces, action menus y componentes Carbon compartidos.
- `esm-patient-banner-app` para datos visibles del paciente.
- `esm-patient-orders-app`, `esm-fua-app`, `esm-patient-notes-app`, `esm-patient-forms-app`, `esm-patient-list-management-app` y otros módulos que inyectan acciones.
- OpenMRS REST/FHIR segun el widget: visitas, encounters, obs, ordenes, condiciones, alergias, medicamentos, resultados y archivos.

## QA minimo antes de mergear cambios aqui

- Abrir patient summary.
- Expandir y colapsar `Mostrar mas` del banner.
- Abrir left sidebar y verificar traducciones visibles.
- Abrir right sidebar y confirmar acciones principales.
- Iniciar consulta si no hay visita activa.
- Abrir una accion que dependa de visita activa y confirmar que el mensaje sale en el lugar correcto.
- Confirmar que no aparece `Minified React error #130`, pantalla blanca ni `workspace not registered`.

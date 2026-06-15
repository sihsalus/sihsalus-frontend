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

## Taxonomia clinica del resumen del paciente

Los nombres visibles del resumen deben usar lenguaje clinico entendido por los equipos peruanos. Los nombres tecnicos de FHIR son detalles de implementacion. Por ejemplo, FHIR `Condition` puede representar un problema activo, un diagnostico de una atencion o una condicion historica resuelta; eso no obliga a mostrar una seccion llamada `Condiciones`.

### Secciones recomendadas

| Seccion UI | Proposito | Contenido tipico | Mapeo tecnico |
| --- | --- | --- | --- |
| Problemas activos | Problemas clinicamente relevantes que afectan la atencion actual. | Diabetes, hipertension, asma, desnutricion, embarazo de alto riesgo, enfermedad cronica en seguimiento. | Usualmente FHIR `Condition` con estado activo o recurrente. |
| Diagnosticos de la atencion | Diagnosticos registrados para una consulta/encuentro especifico. | Diagnostico agudo, diagnostico diferencial, diagnostico final, diagnostico CIE-10 de la consulta. | `Condition`, `Encounter.diagnosis` u observaciones diagnosticas segun soporte backend. |
| Antecedentes | Historia pasada o informacion contextual relevante. | Antecedentes patologicos, familiares, sociales, ocupacionales, gineco-obstetricos y otros. | Puede venir de `Condition`, observaciones, formularios o modelos locales. |
| Procedimientos y cirugias | Procedimientos invasivos, quirurgicos o terapeuticos importantes. | Cesarea, apendicectomia, legrado, cirugia de catarata, endoscopia, dispositivos implantados. | Preferir FHIR `Procedure`; datos legacy pueden venir de formularios u observaciones. |
| Alergias | Alergias e intolerancias. | Alergia medicamentosa, alimentaria, reaccion, severidad/criticidad. | FHIR `AllergyIntolerance`. |
| Medicamentos | Medicacion activa y medicacion anterior relevante. | Prescripciones activas, medicamentos previos, renovaciones. | `MedicationRequest`, `MedicationStatement` u ordenes de medicamentos OpenMRS. |

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

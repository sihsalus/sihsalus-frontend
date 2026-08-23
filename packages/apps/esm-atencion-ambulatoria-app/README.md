# esm-atencion-ambulatoria-app

Microfrontend de atención ambulatoria y consulta externa para SIH Salus, una distribución de OpenMRS 3.x adaptada al ecosistema de salud peruano y las directrices del MINSA.

## Contrato RBAC actual

Los permisos de lectura protegen los puntos de entrada y mantienen visibles los datos clínicos. Los permisos de edición ocultan las acciones de registro o modificación cuando el usuario solo puede consultar.

| Superficie                                | Lectura / entrada                  | Modificación                                                                   |
| ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| Consulta externa e historia médica        | `app:hoja.clinica.consultaExterna` | `app:hoja.clinica.consultaExterna.editar`                                      |
| Formularios AMPATH de Consulta Externa    | `app:hoja.clinica.consultaExterna` | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.formulariosClinicos` |
| Diagnóstico/plan desde Consulta Externa   | `app:hoja.clinica.consultaExterna` | `app:hoja.clinica.consultaExterna.editar` + `app:hoja.clinica.resumenConsulta.editar` |
| Historia social                           | `app:hoja.clinica.historiaSocial`  | `app:hoja.clinica.historiaSocial.editar`                                       |
| Prescripción desde el plan de tratamiento | Entrada por Consulta Externa       | `app:hoja.clinica.canastaOrdenes` + `app:hoja.clinica.ordenes.editar`  |

En la navegación normal, los guards se acumulan: primero se entra al dashboard con lectura y después se habilita la acción con edición. Los workspaces y modales registrados declaran directamente el privilegio de edición, sin inferir el permiso base; OpenMRS no implementa herencia padre/hijo por el nombre del privilegio.

Las listas y estados vacíos siguen visibles en modo de solo lectura, pero sin botones de registro. Los controles heredados de antecedentes todavía delegan el bloqueo final al workspace o modal registrado. Estos guards frontend no sustituyen los permisos del backend para leer o guardar encounters, condiciones, observaciones u órdenes.

## Contrato de diagnóstico de Consulta Externa

La acción **Registrar Diagnóstico** abre el workspace de Visit Notes, que persiste diagnósticos CIE-10
como diagnósticos nativos del encounter. Requiere una visita ambulatoria actual o seleccionada y los
dos privilegios de modificación indicados en la tabla. `CE-001-CONSULTA EXTERNA` conserva la captura
del plan y demás datos de consulta, pero no debe volver a capturar diagnósticos mediante observaciones.

## Advertencia de financiamiento SIS (opcional)

Con `showSisFinancingWarning: true` (apagada por defecto), el dashboard de consulta externa muestra una advertencia no bloqueante cuando la visita activa no tiene financiador definido o el SIS no está vigente, con la misma semántica que el gating de triaje (`getSisFinancingState` sobre los visit attributes canónicos de `@openmrs/esm-patient-common-lib`). Si el usuario tiene `app:home.facturacion`, la advertencia ofrece la acción "Ir a Caja"; sin ese privilegio solo informa. La atención clínica nunca se bloquea: el hard-stop permanece en el flujo de FUA (ver `docs/clinical/plan-alineamiento-seguros-sis.md`).

## TODO content/backend

- Validar en QLTY que `encounterTypes.externalConsultation`, `triage`, `referralCounterReferral` y `consultation` existan y sean los usados por los formularios reales.
- Revisar que `conditionConceptClassUuid`, `conditionConceptSets` y `conditionFreeTextFallbackConceptUuid` resuelvan conceptos válidos para antecedentes y diagnósticos.
- Validar conceptos de anamnesis compartidos desde `ANAMNESIS_DEFAULT_CONCEPT_UUIDS` y los conceptos locales de diagnóstico, tratamiento, financiador, pertenencia étnica y referencia/contrarreferencia.
- Confirmar que los datos de triaje provengan del encounter type correcto y no se mezclen con vitales de otros flujos.
- Documentar qué formularios de consulta externa crean encounter nuevo y cuáles deben editar el encounter clínico actual.

Los valores de `formsList` para consulta externa usan los nombres estables publicados por content (`CE-001-CONSULTA EXTERNA`, `CE-ANAM-001-ANAMNESIS`, `CE-SOAP-001-NOTA SOAP` y `CE-REF-001-REFERENCIA-CONTRARREFERENCIA`). No deben reemplazarse por los UUID de los archivos de esquema, porque esos UUID pueden variar entre entornos.

Anamnesis y SOAP son únicos por visita ambulatoria: cero coincidencias crea, una edita y más de una bloquea. Referencia es repetible porque cada derivación es un evento clínico independiente; siempre crea un encounter nuevo, pero siempre adjunto a la visita ambulatoria verificada.

## TODO QA/QLTY

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que el widget correspondiente lee los datos persistidos.
- Probar en QLTY el flujo end-to-end de consulta externa: abrir dashboard, registrar anamnesis, diagnóstico, plan, SOAP, referencia y recargar para confirmar persistencia.
- Validar que el dashboard lea correctamente datos de triaje, motivo de consulta, financiador, pertenencia étnica y plan de tratamiento.
- Probar creación y edición de diagnósticos clasificados con CIE/conceptos, incluyendo eliminación o reemplazo si aplica.
- Probar referencia/contrarreferencia con datos completos y confirmar que el encounter se consulta después de recargar.
- Probar la matriz anterior con perfiles de solo lectura y edición, incluyendo apertura directa de workspaces y autorización backend al guardar.
- Mantener pacientes de prueba para consulta sin datos, consulta con triaje, consulta completa y consulta con referencia.

## TODO i18n/UI

- Agregar smoke tests que detecten claves crudas visibles en consulta externa, por ejemplo labels de anamnesis, SOAP, diagnóstico, financiador o referencia.
- Agregar smoke test para estados vacíos duplicados o mal compuestos, por ejemplo `No hay no hay`.
- Revisar componentes que usan `useTranslation()` sin namespace explícito cuando se renderizan desde slots compartidos.
- Validar que los labels largos de diagnóstico, referencia/contrarreferencia y pertenencia étnica no se corten en desktop/tablet.
- Revisar `en.json` y traducciones heredadas para evitar mezcla de español/inglés en pantallas clínicas.

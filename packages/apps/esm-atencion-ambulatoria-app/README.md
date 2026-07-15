![Node.js CI](https://github.com/sihsalus/openmrs-esm-sihsalus-modules/workflows/Node.js%20CI/badge.svg)

# SIH SALUS ESM Modules

Colección de módulos microfrontend para SIH SALUS, una distribución especializada de OpenMRS 3.x adaptada al ecosistema de salud peruano y las directrices del MINSA.

## TODO content/backend

- Validar en QLTY que `encounterTypes.externalConsultation`, `triage`, `referralCounterReferral` y `consultation` existan y sean los usados por los formularios reales.
- Revisar que `conditionConceptClassUuid`, `conditionConceptSets` y `conditionFreeTextFallbackConceptUuid` resuelvan conceptos válidos para antecedentes y diagnósticos.
- Validar conceptos de anamnesis compartidos desde `ANAMNESIS_DEFAULT_CONCEPT_UUIDS` y los conceptos locales de diagnóstico, tratamiento, financiador, pertenencia étnica y referencia/contrarreferencia.
- Confirmar que los datos de triaje provengan del encounter type correcto y no se mezclen con vitales de otros flujos.
- Documentar qué formularios de consulta externa crean encounter nuevo y cuáles deben editar el encounter clínico actual.

Los valores de `formsList` para consulta externa usan los nombres estables publicados por content (`CE-001-CONSULTA EXTERNA`, `CE-ANAM-001-ANAMNESIS`, `CE-SOAP-001-NOTA SOAP` y `CE-REF-001-REFERENCIA-CONTRARREFERENCIA`). No deben reemplazarse por los UUID de los archivos de esquema, porque esos UUID pueden variar entre entornos.

## TODO QA/QLTY

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que el widget correspondiente lee los datos persistidos.
- Probar en QLTY el flujo end-to-end de consulta externa: abrir dashboard, registrar anamnesis, diagnóstico, plan, SOAP, referencia y recargar para confirmar persistencia.
- Validar que el dashboard lea correctamente datos de triaje, motivo de consulta, financiador, pertenencia étnica y plan de tratamiento.
- Probar creación y edición de diagnósticos clasificados con CIE/conceptos, incluyendo eliminación o reemplazo si aplica.
- Probar referencia/contrarreferencia con datos completos y confirmar que el encounter se consulta después de recargar.
- Validar permisos de usuario para abrir workspaces, guardar formularios clínicos y consultar encounters previos.
- Mantener pacientes de prueba para consulta sin datos, consulta con triaje, consulta completa y consulta con referencia.

## TODO i18n/UI

- Agregar smoke tests que detecten claves crudas visibles en consulta externa, por ejemplo labels de anamnesis, SOAP, diagnóstico, financiador o referencia.
- Agregar smoke test para estados vacíos duplicados o mal compuestos, por ejemplo `No hay no hay`.
- Revisar componentes que usan `useTranslation()` sin namespace explícito cuando se renderizan desde slots compartidos.
- Validar que los labels largos de diagnóstico, referencia/contrarreferencia y pertenencia étnica no se corten en desktop/tablet.
- Revisar `en.json` y traducciones heredadas para evitar mezcla de español/inglés en pantallas clínicas.

## 🏥 Características Principales

- **SIH SALUS Library**: Componentes UI y servicios comunes optimizados para el flujo de trabajo peruano

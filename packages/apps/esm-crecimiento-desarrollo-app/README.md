# esm-cred-app

Este microfrontend vive en la carpeta `packages/apps/esm-crecimiento-desarrollo-app` y se publica como `@sihsalus/esm-cred-app`.

App orientada al seguimiento de CRED y control preventivo infantil.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales
- Gestiona flujos de crecimiento y desarrollo, así como planes de inmunización asociados.
- Expone vistas para seguimiento pediátrico preventivo y cuidado del niño sano.
- No cubre atención de adulto, hospitalización ni gestión general de farmacia.
- No reemplaza el módulo de vacunación; solo consume y presenta el contexto CRED cuando aplica.

## Integraciones
- APIs clínicas de seguimiento infantil e inmunizaciones.
- Vistas de grupo clínico, cuidado del niño sano y plan de inmunización.
- Configuración y tipos compartidos del frontend.

## TODO content/backend

- Usar siempre `external_id` de OCL como UUID de OpenMRS. El campo `uuid` de OCL es interno/versionado y no debe entrar en config frontend.
- Publicar/importar en content el concepto numérico `Número de control CRED` (`ce8b07e8-712f-406a-b44d-2fa69167f5ea`) antes de configurarlo como `controlNumber`.
- Crear/asignar privilegios OpenMRS para `app:hoja.clinica.cred.*`; en DEV no existen y solo el rol `System Developer` pasa los guards por bypass.
- Configurar `credScheduling.appointmentServiceUuid` con el servicio real de citas CRED; si queda vacío, la generación de citas debe permanecer oculta o mostrar error claro.
- Corregir edición vs creación en widgets que abren form engine con `encounterUuid: ''`; varios resúmenes todavía crean registros nuevos en vez de editar el encounter existente.
- Revisar `useCreateCarePlanAppointments`: hoy queda como helper TODO para planes de cuidado (madre gestante, CRED y vacunación), pero no está integrado como contrato estable.

Validado en DEV/OCL: `CRED-001` a `CRED-027`, `INMU-002-REPORTE ESAVI`, encounter type `vaccinationAdministration`, `consultationTime` = `Hora` (`2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4`), `CRED.perinatalConceptSetUuid` = `Antecedentes de Riesgo Perinatal` (`9dce2946-9fda-4d62-b68e-d62711801189`), `Número de control CRED` existe en OCL pendiente de release/content, y psicoprofilaxis/riesgo obstétrico/causa probable de muerte usan `external_id` existentes. El TPED histórico tiene una definición frontend versionada de 88 hitos, pero su mapeo individual de conceptos sigue pendiente; ver `docs/clinical/test-peruano/CONCEPT-AUDIT.md`.

El componente `tped-reference-widget` muestra la matriz historica y el detalle de hitos en
la pestana Desarrollo. Es solo de consulta: no persiste observaciones, puntajes ni
clasificaciones.

## TODO QA/QLTY

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que el widget correspondiente lee los datos persistidos.
- Probar en QLTY el flujo end-to-end de CRED neonatal: abrir formulario, guardar, recargar la historia y confirmar que los widgets leen el encounter y las obs guardadas.
- Probar balance de líquidos, biometría, evaluación cefalocaudal, alojamiento conjunto y consejería de lactancia con datos reales.
- Validar que los formularios de nutrición infantil, estimulación temprana y control de niño sano persistan con el `encounterType`, `formUuid` y conceptos esperados.
- Confirmar permisos de usuario para crear y editar formularios CRED en QLTY, no solo para renderizar los dashboards.
- Mantener un set de pacientes de prueba para CRED con casos vacío, recién nacido, lactante y niño con controles previos.

## TODO i18n/UI

- Ampliar smoke tests de i18n más allá de dashboards: workspaces, botones de acción, estados vacíos y formularios sloteados.
- Agregar smoke test para textos duplicados de estados vacíos, por ejemplo `No hay no hay`.
- Revisar componentes CRED que usan `useTranslation()` sin namespace explícito cuando se renderizan dentro de slots compartidos.
- Acortar labels largos en tabs para evitar truncamiento visual; por ejemplo, evaluar `Consejería en lactancia materna` como `Lactancia`.
- Revisar `en.json` porque aún conserva textos heredados en español y puede confundir validaciones bilingües.

## TODO ya cubiertos en código

- Calendario CRED alineado a NTS 238: `cred-schedule-rules.ts` define 27 controles y `cred-schedule-rules.test.ts` lo verifica.
- Selector CRED: `useCREDFormsForAgeGroup` ya convierte keys de `formsList` en objetos `Form` válidos para el selector.
- Traducciones base de dashboards: `dashboard-translations.test.ts` cubre keys principales como `neonatalCare`, `newbornVitals`, `wellChildCare` y `childNutrition`.

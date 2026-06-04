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

- Validar los UUIDs de CRED Controls. `consultationTime`, `controlNumber` y `attendedAge` comparten el mismo UUID por copy-paste y deben apuntar a conceptos distintos.
- Definir el concept set real para `CRED.perinatalConceptSetUuid`; actualmente queda vacío y marcado pendiente de OCL.
- Validar en content/QLTY los UUIDs sintéticos usados por Test Peruano (`c401...`) y ESAVI (`f000...`). El frontend ya tiene defaults, pero pueden fallar si el paquete de contenido no los instala.
- Confirmar que el guardado de reacción adversa ESAVI tenga en content el encounter type `vaccinationAdministration`, el form `adverseReactionForm` y los conceptos configurados en `adverseReactionReporting`.
- Validar que los formularios placeholder de `formsList` existan en backend antes de exponerlos en el selector CRED: nutrición infantil (`c106...` a `c108...`), EDI/TEA/salud mental (`c109...` a `c111...`) y formularios normativos (`c212...` a `c225...`).
- Configurar `credScheduling.appointmentServiceUuid` con el servicio real de citas CRED; si queda vacío, la generación de citas debe permanecer oculta o mostrar error claro.
- Corregir edición vs creación en widgets que abren form engine con `encounterUuid: ''`; varios resúmenes todavía crean registros nuevos en vez de editar el encounter existente.
- Revisar `useCreateCarePlanAppointments`: hoy queda como helper TODO para planes de cuidado (madre gestante, CRED y vacunación), pero no está integrado como contrato estable.

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

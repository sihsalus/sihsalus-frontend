# esm-vacunacion-app

Microfrontend consolidado de vacunacion para SIHSALUS.

Este modulo vive en `packages/apps/esm-vacunacion-app`, se publica como `@sihsalus/esm-vacunacion-app` y reemplaza al upstream `esm-patient-immunizations-app` con adaptaciones para el esquema MINSA.

Base tecnica:

- upstream OpenMRS `openmrs-esm-patient-chart` `v12.1.0`
- ajustes funcionales locales preservados del fork de inmunizaciones
- configuracion de secuencias y etiquetas adaptadas a vacunacion MINSA

Estado de alineamiento:

- El tag upstream OpenMRS mas reciente verificado es `v12.1.0`.
- La configuracion normativa local usa NTS N.° 196-MINSA/DGIESP-2022, aprobada por RM 884-2022-MINSA.
- Modificatorias consideradas en configuracion: RM 218-2024, RM 474-2025, RM 709-2025 y RM 403-2026-MINSA.
- RM 403-2026-MINSA incorpora VRS/Nirsevimab de forma progresiva. Antes de habilitarlo como vacuna seleccionable, deben existir los conceptos/medicamentos correspondientes en el content package.
- El formulario muestra advertencias cuando una dosis configurada se registra fuera de la ventana de edad MINSA. No bloquea el guardado porque pueden existir rescates, campañas o indicaciones especiales.

Configuracion de conceptos:

- `immunizationConceptSet`: default `CIEL:984`. Debe resolver a un set/concepto con las vacunas seleccionables como respuestas.
- `fhirConceptMappings.immunizationResourceConcept`: default `CIEL:1421`. Debe existir como mapping unico en el content package para que el recurso FHIR2 `Immunization` pueda leer y guardar.

Contratos de frontend:

- Los conceptos y mappings de vacunacion deben venir de `config-schema`; no agregar UUIDs clinicos hardcodeados.
- Un `501 Not Implemented` de FHIR2 `Immunization` no debe romper la UI cuando `ampathFormPersistence.enabled=true`: las lecturas degradan al fallback Ampath/REST y el formulario guarda vacunas nuevas como encounters.
- Si `ampathFormPersistence.enabled=false`, el modulo depende directamente de FHIR2 `Immunization`; un `501` debe mostrarse como error operativo claro para QA/backend.
- El usuario final no debe ver detalles tecnicos del endpoint, salvo que sea una pantalla de diagnostico.
- Las advertencias MINSA por edad/dosis no deben bloquear guardado sin una regla clinica explicita.
- Si una vacuna de la NTS no existe en content/backend, debe estar deshabilitada o documentada como pendiente, no simulada silenciosamente.

TODO content/backend:

- Corregir en backend QLTY el `501 Not Implemented` de `GET /openmrs/ws/fhir2/R4/Immunization?patient=<uuid>`. El frontend usa fallback Ampath/REST cuando esta habilitado, pero la solucion real es habilitar/actualizar FHIR2 Immunization y sus mappings de contenido.
- Validar en el content reference application que `CIEL:1421` exista como mapping unico para FHIR2 `Immunization`.
- Validar que `CIEL:984` resuelva al set local correcto de vacunas, o sobreescribir `immunizationConceptSet` en config con el mapping/UUID local.
- Confirmar que las vacunas configuradas como respuestas del set local existan como conceptos activos y con mappings estables.
- Validar que las dosis MINSA configuradas tengan conceptos/medicamentos disponibles antes de habilitar VRS/Nirsevimab.

TODO QA/QLTY:

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que FHIR2/widgets leen los datos persistidos.
- Reprobar el endpoint FHIR2 `Immunization` en QLTY después de corregir `CIEL:1421`; debe responder bundle vacío o con recursos, no `501`.
- Probar el flujo end-to-end de vacunación: abrir formulario, registrar vacuna, guardar, recargar y confirmar lectura por FHIR2.
- Probar un paciente sin inmunizaciones, un paciente con esquema parcial y un paciente con dosis fuera de ventana de edad para validar advertencias MINSA.
- Confirmar permisos de usuario para crear y editar inmunizaciones en QLTY.
- Volver a incluir la pantalla de vacunación infantil en los GIFs CRED cuando el backend deje de responder `501`.

TODO i18n/UI:

- Agregar smoke tests que detecten claves crudas visibles en vacunación y CRED infantil.
- Validar que el estado vacío por `501` se mantenga silencioso para usuarios, pero que el error quede trazable para QA/backend.
- Revisar labels de dosis, advertencias y acciones en español para que no mezclen terminología clínica con claves técnicas.

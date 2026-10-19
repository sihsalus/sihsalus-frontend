# esm-patient-immunizations-app

Microfrontend consolidado de vacunacion para SIHSALUS.

Este modulo vive en `packages/apps/esm-patient-immunizations-app`, se publica como `@sihsalus/esm-patient-immunizations-app` y reemplaza al upstream `esm-patient-immunizations-app` con adaptaciones para el esquema MINSA.

Base tecnica:

- upstream OpenMRS `openmrs-esm-patient-chart` `v12.1.0`
- ajustes funcionales locales preservados del fork de inmunizaciones
- configuracion de secuencias y etiquetas adaptadas a vacunacion MINSA

Estado de alineamiento:

- La base de comparación upstream es `v12.1.0`.
- La referencia actual es NTS N.° 246-MINSA/DGIESP-2026, aprobada por RM 561-2026-MINSA.
- Los UUID de productos de las secuencias reutilizan el export OCL de inmunizaciones `2026-06-30`. Las edades de las pautas infantiles verificadas se evalúan en meses calendario; no se interpreta 60 días como dos meses. Los números históricos de dosis y refuerzos no se convierten.
- La entrada de hexavalente depende del agotamiento de pentavalente/IPV en los niveles nacional, regional y local; el primer refuerzo DPT se sustituye en 2027. Se conserva la pauta anterior mientras el programa determine la transición. Hexavalente y meningococo requieren curación y publicación canónica OCL; no se generan UUID operativos alternativos en frontend.
- La segunda dosis de varicela es progresiva. VRS, Nirsevimab y meningococo dependen de población, estación o evaluación específica. El calendario predeterminado no establece elegibilidad para esos casos. VRS y Nirsevimab conservan sus opciones de registro manual.
- Los valores predeterminados describen la pauta infantil regular revisada; no son un calendario completo por curso de vida. El calendario publicado en `vaccinationschedule.schedule.PE` conserva su mecanismo existente y debe revisarse por el programa para el establecimiento.
- El formulario muestra advertencias cuando una dosis configurada se registra fuera de la ventana de edad MINSA. No bloquea el guardado porque pueden existir rescates, campañas o indicaciones especiales.

Configuracion de conceptos:

- `immunizationConceptSet`: default `CIEL:984`. Debe resolver a un set/concepto con las vacunas seleccionables como respuestas.
- `fhirConceptMappings.immunizationResourceConcept`: default `CIEL:1421`. Debe existir como mapping unico en el content package para que el recurso FHIR2 `Immunization` pueda leer y guardar.

Contratos de frontend:

- Los conceptos y mappings de vacunacion deben venir de `config-schema`; no agregar UUIDs clinicos hardcodeados.
- La persistencia alternativa sólo se habilita ante un error HTTP 501 clasificado `fhir-setup`, con `ampathFormPersistence.enabled=true`. Errores de mappings, validación, permisos o mensajes que sólo contienen «501» no habilitan otra escritura.
- Para una captura nueva, el resolver compartido verifica un único Form REST publicado y activo de nombre `INMU-001-REGISTRO DE VACUNACIÓN`, versión `1.1.0`. Un UUID configurado también debe coincidir con ese contrato. El UUID superior del JSON AMPATH no identifica el Form persistido.
- Estado, motivo y contexto reutilizan `sihsalus:4460–4462` del contenido. Los UUID de apetito, sed y sueño no se reinterpretan ni se usan como alternativa histórica.
- La captura nueva exige el profesional vinculado a la sesión. El encuentro REST incluye proveedor y rol funcional configurable `Responsable del registro de inmunización` (`738ba7c1-354f-47f8-b6d4-9d705ce05731`), cuya provisión requiere el content coordinado. Ese rol no atribuye una profesión ni otorga permisos.
- Las lecturas REST recorren el tipo de encuentro y la observación canónica de producto, incluyendo versiones anteriores del Form. Al editar un encuentro REST se conservan Form, proveedor, fecha/hora, visita y ubicación originales. La fecha de administración completada se conserva en su observación propia; una no aplicación no genera fecha de administración. La nueva versión `1.1.0` distingue fecha del registro y fecha de administración; el timestamp completo del registro debe estar dentro de la visita, sin sustituirlo por la medianoche del día elegido.
- Las dosis ya registradas producen una advertencia y no excluyen opciones: el profesional puede registrar aplicaciones anuales o corregir datos. Un registro `not-done` no equivale a una dosis administrada.
- Las pautas predeterminadas no calculan la próxima fecha con intervalos aproximados; el profesional la confirma. Los calendarios institucionales publicados conservan su configuración existente de intervalos.
- Si `ampathFormPersistence.enabled=false`, el modulo depende directamente de FHIR2 `Immunization`; un `501` debe mostrarse como error operativo claro para QA/backend.
- El usuario final no debe ver detalles tecnicos del endpoint, salvo que sea una pantalla de diagnostico.
- Las advertencias MINSA por edad/dosis no deben bloquear guardado sin una regla clinica explicita.
- Si una vacuna de la NTS no existe en content/backend, debe estar deshabilitada o documentada como pendiente, no simulada silenciosamente.

TODO content/backend:

- QLTY 2026-07-04: `GET /openmrs/ws/fhir2/R4/Immunization?patient=<synthetic-empty-uuid>` responde `200` con Bundle vacio. Mantener el fallback Ampath/REST, pero ya no tratar el `501` como bloqueo activo para esa consulta.
- Validar en el content reference application que `CIEL:1421` exista como mapping unico para FHIR2 `Immunization`.
- Validar que `CIEL:984` resuelva al set local correcto de vacunas, o sobreescribir `immunizationConceptSet` en config con el mapping/UUID local.
- Confirmar que las vacunas configuradas como respuestas del set local existan como conceptos activos y con mappings estables.
- Verificar en el entorno la lectura y escritura de VRS/Nirsevimab, incluyendo su clasificación y las reglas aplicables del programa; disponer de la opción no acredita ese ensayo.

TODO QA/QLTY:

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que FHIR2/widgets leen los datos persistidos.
- Mantener healthcheck de FHIR2 `Immunization` en QLTY; debe responder bundle vacio o con recursos, no `501`, antes y despues de los cambios de content.
- Probar el flujo end-to-end de vacunación: abrir formulario, registrar vacuna, guardar, recargar y confirmar lectura por FHIR2.
- Probar un paciente sin inmunizaciones, un paciente con esquema parcial y un paciente con dosis fuera de ventana de edad para validar advertencias MINSA.
- Confirmar permisos de usuario para crear y editar inmunizaciones en QLTY.
- Volver a incluir la pantalla de vacunación infantil en los GIFs CRED cuando el save/read real este validado en QLTY.

TODO i18n/UI:

- Agregar smoke tests que detecten claves crudas visibles en vacunación y CRED infantil.
- Verificar el estado vacío ante un `501` confirmado con alternativa REST disponible; un fallo de ambas lecturas debe conservarse como error y bloquear el guardado.
- Revisar labels de dosis, advertencias y acciones en español para que no mezclen terminología clínica con claves técnicas.

### Reportes de inmunización #376–378

El formulario indica sus campos requeridos con asterisco: fecha, vacuna, estado
y contexto. El motivo es obligatorio cuando la vacuna no se aplicó. Dosis, lote,
fabricante y demás campos opcionales conservan su validación. Un fallo al leer
el historial bloquea el guardado; no equivale a un historial vacío. Los errores
de guardado conservan el formulario y muestran mensajes traducidos sin respuestas
técnicas ni identificadores del servidor. No se agrega un fallback de escritura
ante un error de validación FHIR.

Los reportes [#376](https://github.com/sihsalus/sihsalus/issues/376) y
[#377](https://github.com/sihsalus/sihsalus/issues/377) siguen bloqueados para su
resolución completa: FHIR2 exige un proveedor con el rol configurado para la
atención de inmunización. El código fijado por la distribución en
`069deb714818428540719182472ea13711628526` reutiliza la última atención de
inmunización de la consulta y rechaza su lectura si falta ese proveedor/rol; ver
[ImmunizationTranslatorImpl](https://github.com/openmrs/openmrs-module-fhir2/blob/069deb714818428540719182472ea13711628526/api/src/main/java/org/openmrs/module/fhir2/api/translators/impl/ImmunizationTranslatorImpl.java)
y [ImmunizationObsGroupHelper](https://github.com/openmrs/openmrs-module-fhir2/blob/069deb714818428540719182472ea13711628526/api/src/main/java/org/openmrs/module/fhir2/api/util/ImmunizationObsGroupHelper.java).
La referencia FHIR `Encounter/<visitUuid>` es parte de ese contrato; no debe
sustituirse por un UUID de atención REST.

Esta corrección modifica únicamente frontend: no reasigna profesionales o roles,
no repara registros históricos ni modifica backend/content. El responsable de
backend debe revisar el contrato y los registros afectados en una tarea separada.
Las pruebas locales de interfaz no acreditan el guardado/lectura real de esos
reportes. Queda pendiente aceptación en QLTY con paciente sintético y rol CRED.

### Fuentes y aceptación pendiente de la revisión del 19 de octubre de 2026

[NTS 246, parte 1](https://cdn.www.gob.pe/uploads/document/file/10154198/8265031-nts-n-246-minsa-digiesp-2026-parte-1.pdf): §6.2.2 y notas, páginas 45–47; anexos 1–2, páginas 79–80. Los valores predeterminados separan IPV de bOPV, usan la tercera dosis de neumococo a doce meses y SPR a doce/dieciocho meses. No crean reglas universales para las condiciones especiales del §6.3.

El cambio conserva los mecanismos nativos de Form/encuentro y el calendario existente. Requiere revisión del programa de inmunizaciones, content con el rol coordinado y un ensayo sintético de alta, reapertura y edición tanto FHIR como REST. Las regresiones locales no acreditan una integración clínica desplegada. Los registros históricos bajo conceptos incorrectos requieren revisión clínica separada; no se migran automáticamente.

La edición REST relee el encuentro, verifica el mismo paciente y conserva los UUID de las observaciones. La actualización envía únicamente observaciones; no reasigna paciente, tipo, formulario ni otro contexto del encuentro. Los campos retirados se anulan explícitamente; las observaciones ajenas se conservan y una duplicación activa de una pregunta canónica bloquea la edición. El setter de REST no sustituye por concepto ni anula las observaciones omitidas. Se reutiliza la revisión/anulación nativa, conforme a [EncounterResource1_8](https://github.com/sihsalus/openmrs-module-webservices.rest/blob/9dcfc9f6efd0d296ae1973696324f227b0bcb658/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/resource/openmrs1_8/EncounterResource1_8.java#L262). Este cambio necesita ensayo integrado de actualización y anulación, además de las regresiones del payload.

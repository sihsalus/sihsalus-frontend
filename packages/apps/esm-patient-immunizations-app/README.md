# esm-patient-immunizations-app

Microfrontend consolidado de vacunacion para SIHSALUS.

Este modulo vive en `packages/apps/esm-patient-immunizations-app`, se publica como `@sihsalus/esm-patient-immunizations-app` y reemplaza al upstream `esm-patient-immunizations-app` con adaptaciones para el esquema MINSA.

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
- En «Vacunación reciente», la fecha/hora de aplicación determina el registro
  mostrado. Si varios registros de una vacuna tienen exactamente la misma
  fecha/hora, se muestra el mayor número de dosis entero positivo registrado,
  conservando la etiqueta de secuencia configurada cuando exista. El número procede de FHIR
  `protocolApplied.doseNumberPositiveInt` o de la observación configurada de
  Ampath; nunca se calcula contando registros. Este desempate no determina la
  hora real de aplicación ni valida la pertinencia clínica de las dosis.

TODO content/backend:

- QLTY 2026-07-04: `GET /openmrs/ws/fhir2/R4/Immunization?patient=<synthetic-empty-uuid>` responde `200` con Bundle vacio. Mantener el fallback Ampath/REST, pero ya no tratar el `501` como bloqueo activo para esa consulta.
- Validar en el content reference application que `CIEL:1421` exista como mapping unico para FHIR2 `Immunization`.
- Validar que `CIEL:984` resuelva al set local correcto de vacunas, o sobreescribir `immunizationConceptSet` en config con el mapping/UUID local.
- Confirmar que las vacunas configuradas como respuestas del set local existan como conceptos activos y con mappings estables.
- Validar que las dosis MINSA configuradas tengan conceptos/medicamentos disponibles antes de habilitar VRS/Nirsevimab.

TODO QA/QLTY:

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que FHIR2/widgets leen los datos persistidos.
- Mantener healthcheck de FHIR2 `Immunization` en QLTY; debe responder bundle vacio o con recursos, no `501`, antes y despues de los cambios de content.
- Probar el flujo end-to-end de vacunación: abrir formulario, registrar vacuna, guardar, recargar y confirmar lectura por FHIR2.
- Probar un paciente sin inmunizaciones, un paciente con esquema parcial y un paciente con dosis fuera de ventana de edad para validar advertencias MINSA.
- Confirmar permisos de usuario para crear y editar inmunizaciones en QLTY.
- Para el reporte #393, verificar con datos sintéticos el resumen de dosis 1, 2
  y 3 con una misma fecha, tanto antes como después de recargar; debe mostrar 3
  y conservar los tres registros al expandir la fila. Una dosis 1 de fecha
  posterior debe seguir siendo la más reciente. Comparar con la respuesta
  persistida: si todos los registros contienen dosis 1, el frontend debe seguir
  mostrando 1, y corresponde investigar el registro sin inventar una secuencia.
- Volver a incluir la pantalla de vacunación infantil en los GIFs CRED cuando el save/read real este validado en QLTY.

TODO i18n/UI:

- Agregar smoke tests que detecten claves crudas visibles en vacunación y CRED infantil.
- Validar que el estado vacío por `501` se mantenga silencioso para usuarios, pero que el error quede trazable para QA/backend.
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

Mitigación frontend (sin cambios de backend/content):

- Antes de crear una vacuna por FHIR, el formulario consulta por REST
  (`GET /encounter?patient=...&visit=...&encounterType=...`) la última atención
  del tipo `ampathFormPersistence.encounterTypeUuid` de la consulta y, si no
  tiene un proveedor con el rol `unknownEncounterRoleUuid` (default
  `a0b03050-c99b-11e0-9572-0800200c9a66`, "Unknown"), lo agrega con el
  profesional de la sesión (`POST /encounter/<uuid>/encounterprovider`).
  `unknownEncounterRoleUuid` debe coincidir con la propiedad global de FHIR2
  `fhir2.administeringEncounterRoleUuid`, que selecciona el rol de atención
  administrador y por defecto es el rol "Unknown". Si la
  sesión no tiene profesional asociado, no guarda y muestra un error; si esa
  consulta previa falla, tampoco guarda y lo indica. Esa consulta REST solo ve
  atenciones no anuladas, mientras que FHIR2 considera todas las de la
  consulta, por lo que una última atención de vacunación anulada no se repara.
- El fallback AMPATH crea la atención con `encounterProviders` usando ese rol.
- Si la lectura FHIR falla con el diagnóstico de FHIR2 sobre el rol de atención
  faltante (cualquiera sea el nombre del rol), el resumen y la vista detallada
  muestran un estado de error específico con el botón
  "Reparar" (solo con profesional en sesión), que agrega el rol a la atención
  indicada y recarga el historial.
- En el resumen, las dosis con la misma fecha se ordenan por número de dosis
  descendente, de modo que "Vacunación reciente" muestra la última dosis (#393).

Queda pendiente aceptación en QLTY con paciente sintético y rol CRED.

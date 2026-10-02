# @sihsalus/esm-epidemiological-surveillance-app

Microfrontend OpenMRS 3 de vigilancia epidemiológica de SIH Salus, iteración 1 (RE 3.1). Registro de casos, alertas, curva epidémica, canal endémico y distribución demográfica.

Terminología: visita = consulta; encounter = atención.

## Alcance

Registro en **tres pasos**: paciente/atención existente; todos los campos del caso; revisión de solo lectura y registro. El paso 2 reúne profesional/localidad de solo lectura, diagnóstico, clasificación, laboratorio, origen, lugar probable de infección, inicio de síntomas, vacunación, tipo de vigilancia y fechas de investigación/notificación/defunción. No se incorpora React Form Engine en este cambio.

Cubre RF-01 a RF-07, RF-11 a RF-13, RF-17 a RF-19, RF-22, RF-26 y RF-27; usabilidad RNF-04, RNF-05 y RNF-06. No incluye padrón de febriles, NOTI/Excel, mapas o clasificación automática de focos. La aceptación con metadatos e instancia real sigue pendiente.

### Edición de eventos notificables

Las tablas de Casos y Eventos muestran 10 filas por página, con opciones de 20 y
50, selector de página y botones anterior/siguiente. La paginación es local sobre
los resultados de la API; al filtrar o recargar los registros vuelve a la primera página.

Cada fila de Eventos ofrece **Editar evento notificable**. El formulario precarga
la enfermedad, periodicidad, norma de referencia y fechas de vigencia y permite
modificar todos esos atributos, incluida la eliminación de la fecha final.
Guarda mediante `PUT /events/{uuid}` con el privilegio de administración existente;
requiere el OMOD con esa ruta. Conserva UUID y auditoría de creación. El nombre y
plazo de notificación se derivan del concepto y periodicidad. Al guardar recarga
la lista y el catálogo; al fallar conserva los datos para reintentar.

### Consulta y edición de casos guardados

La pestaña Casos abre modales Carbon desde los iconos Ver y Editar. El detalle
consulta `GET /cases/{uuid}` y la ficha REST del paciente (incluida
`person.preferredAddress.stateProvince/countyDistrict/cityVillage`); la residencia
se muestra como provincia → distrito → centro poblado y no se copia al caso.
No se muestran UUID: nombres ausentes se presentan como no disponibles.
El OMOD aporta nombres de atención, profesional, localidad, orden y la ruta del lugar
de infección; requiere la versión que incluye `liquibase-case-laboratory.xml`.

La edición usa `PUT /cases/{uuid}`: origen, vacunación, vigilancia,
fechas, centro poblado de infección y resultado de laboratorio de la atención.
Conserva paciente, atención, diagnóstico, profesional y localidad; no permite
editar datos demográficos ni metadatos de respuesta. Conserva la orden de laboratorio
previa salvo selección o eliminación explícita. La clasificación se deriva del
resultado mediante las mismas reglas compartidas con el registro; no es editable
manualmente. Resultados históricos sin referencia persistida no se adivinan ni se
asignan por coincidencia de orden.

El resultado se presenta como orden · fecha · resultado; no se muestra un campo
separado de orden en el detalle ni en los formularios. Cambiar de resultado permite
elegir entre todas las órdenes elegibles de la atención, sin filtrar por la anterior.
Un caso con fecha de defunción
ya guardada es de solo lectura; introducir una fecha nueva muestra una advertencia.
El servidor sigue validando privilegios, profesional de la sesión, referencias y fechas.
Los errores conservan el formulario; al guardar se recarga la lista. No se encolan
ediciones sin conexión. Smoke clínico integrado pendiente en entorno autorizado.

## Ruta, extensiones y permisos

Ruta relativa al SPA base: `home/epidemiological-surveillance`. Conserva el enlace del dashboard de inicio en `src/routes.json`. El startup registra configuración, traducciones y sincronización.

| Superficie              | Privilegio                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Ruta/enlace             | `app:home.epidemiologicalSurveillance`                                                    |
| Formulario y pendientes | `Vigilancia Epidemiologica: Ver Casos` **y** `Vigilancia Epidemiologica: Registrar Casos` |
| Indicadores             | `Vigilancia Epidemiologica: Ver Indicadores`                                              |

`RequirePrivilege` protege ruta y superficies. El servidor autoriza de nuevo; los roles necesitan además permisos nativos REST/FHIR. El cambio de usuario desmonta el estado de pacientes, borradores y reportes. No se asignan permisos automáticamente.

## Backend y contratos

OMOD `sihsalusepidemiologicalsurveillance` **1.0.0-SNAPSHOT**, OpenMRS **2.4.2**. Dependencias declaradas: REST Web Services ≥2.2.0, FHIR2 ≥1.2.0. Comprobar capacidades reales de la instancia.

Base `/ws/rest/v1/sihsalusepidemiologicalsurveillance`, mediante `openmrsFetch` y el contexto configurado.

| Método/recurso                                                     | Contrato                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| GET `/catalog`                                                     | `{catalog, events}`, catálogo fijo y eventos activos disponibles.             |
| POST `/cases`                                                      | `CaseRequest` → `CaseResult`; 200, con `replayed` para reintento idempotente. |
| GET `/cases/{uuid}`                                                | Evaluación y alertas de un registro.                                          |
| GET `/reports?event=…&from=YYYY-MM-DD&to=YYYY-MM-DD&period=semana` | Totales, curva, canal, demografía, advertencias y fecha de generación.        |

DTO en [src/types.ts](src/types.ts); contrato completo en `epidemiologysurveillance/docs/api-contract.md`. Administración de reglas y recálculo solo en backend.

Lecturas clínicas: FHIR R4 `Patient,Encounter,Observation`; REST `encounter` (diagnósticos nativos), `provider,location`. Los diagnósticos de la atención no se sustituyen por Conditions longitudinales. Paginación completa con límite defensivo, rechazo de ciclos/enlaces externos y errores seguros. Resultados de laboratorio locales codificados vinculados a TestOrder; adjuntos e informes externos no se convierten en resultados.

## Configuración y metadatos

```json
{
  "@sihsalus/esm-epidemiological-surveillance-app": {
    "defaultReportPeriod": "semana",
    "reportLookbackDays": 28
  }
}
```

Periodos: `dia,semana,mes,trimestre,semestre`. Fechas iniciales respetan cobertura; servidor admite hasta 731 días de diferencia.

El OMOD fija los UUID clínicos en `SurveillanceCatalog.java` tras contrastarlos con `sihsalus-content`; no lee archivo JSON ni global property. Abrir el catálogo no exige validar todos los conceptos. Al guardar se comprueban las referencias utilizadas: `CLINICAL_CONCEPT_UNAVAILABLE` indica un concepto ausente o retirado y `CLINICAL_DATATYPE_MISMATCH` un tipo incompatible. Actualizar el OMOD y el ESM juntos porque el contrato usa `/catalog` y la propiedad `catalog`.

El backend ofrece `GET /events`, `GET /events/{uuid}`, `POST /events` y
`PUT /events/{uuid}`. La pantalla permite crear y editar eventos.
`GET /healthcheck` devuelve `{"status":"UP"}` con una sesión autorizada.

## Registro y trabajo sin conexión

La solicitud lleva UUID nuevo estable para el intento, paciente, UUID de la atención de metaxénicas existente, proveedor de la sesión, localidad, evento, estado, gravedad, origen, especie opcional, inicio de síntomas y resultado opcional; no copia nombres/historia clínica.

Se usa exclusivamente la cola compartida del framework: `queueSynchronizationItem`, `getFullSynchronizationItemsFor`, `setupOfflineSync`, `deleteSynchronizationItem`. Tipo `sihsalus-epidemiological-surveillance-case-v1`. Persiste antes de enviar y elimina tras respuesta exitosa y comprobación de propietario. No añade localStorage clínico independiente.

- Sin red, usar pacientes/atenciones descargados previamente. **Pendiente de sincronización** no significa registro confirmado ni notificación.
- Reconexión: reintento con mismo UUID y usuario; el formulario conserva estado al cambiar conectividad.
- Rechazos por validación/permisos/duplicados permanecen para revisión. La pantalla muestra evento/fecha y permite revisar el mismo payload.
- Un UUID recibido con contenido distinto produce conflicto; no crea otro caso automáticamente.
- Aislamiento, cifrado y ciclo de vida dependen del perfil offline compartido. Las pruebas con mocks no certifican cifrado o sincronización real del dispositivo.

## Indicadores y usabilidad

El paciente muestra su edad en años cumplidos tanto en las opciones como después
de seleccionarlo, calculada desde `birthDate` con la fecha de la zona horaria del
catálogo. Una fecha ausente, inválida o futura se muestra como edad no disponible.

“Lugar probable de infección” busca directamente por nombre de centro poblado,
distrito o provincia, o por código de centro poblado. Todas las opciones muestran
Provincia → Distrito → Centro poblado (código). Usa el contrato AJAX de Address Hierarchy
que utiliza patient-registration, sin importar componentes de otro microfrontend:
`/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form`,
con `addressField=stateProvince|countyDistrict|cityVillage`, `parentUuid`,
`searchString` y `limit=1000`. Expande provincias/distritos encontrados hasta sus
centros poblados y deduplica por UUID. Para código usa `userGeneratedIdForParent`
con los seis primeros dígitos del UBIGEO, como patient-registration; conserva los
ceros iniciales y filtra por el prefijo escrito. Requiere al menos tres caracteres
para nombres o seis dígitos para código. No inventa códigos faltantes. Si alcanza
el límite de resultados de una consulta o 50 peticiones, pide acotar la búsqueda
en lugar de presentar una lista silenciosamente incompleta.
Requiere ese OMOD y autorización de lectura; los errores no se convierten en listas
vacías ni en direcciones libres. Este cambio no modifica los filtros de indicadores.

Solo el UUID del centro poblado se envía como `infectionAddressUuid`, no los nombres
ni los UUID de provincia/distrito. Conserva la selección y su ruta al volver del
resumen; “Cambiar lugar” limpia la selección y reinicia la búsqueda. Descarta
respuestas de búsquedas anteriores y permite reintentar tras un error. Una referencia
precargada sin ruta se muestra como selección anterior, sin inventar su nombre.

Curva por inicio de síntomas y canal endémico desde `period_case_count` del OMOD.
Filtros: `diagnosisType=CONFIRMADO|PROBABLE|TODOS` (predeterminado `CONFIRMADO`),
`zoneLevel=DISTRITO|CENTRO_POBLADO` (predeterminado `CENTRO_POBLADO`) y `address`
opcional, UUID de Address Hierarchy del nivel elegido. Provincia y distrito permiten
buscar una zona; sin seleccionar una zona del nivel elegido se incluyen **todas** las
zonas de ese nivel, no solo las de la provincia usada para buscar. Cambiar de nivel o
provincia limpia la selección anterior. `TODOS` excluye descartados. La respuesta
incluye los filtros aplicados; los títulos de los gráficos reflejan el diagnóstico.

El histórico suma las zonas y diagnósticos de cada año antes de calcular cuartiles,
sin fabricar ceros para años sin filas ni clasificar períodos incompletos como zonas
definitivas. La distribución demográfica (RF-22) queda fuera de esta iteración y ya no
se muestra. Contrato vigente: `epidemiologysurveillance/docs/api-contract.md`.

Gráficos SVG con tablas accesibles; colores, texto e iconos para alertas. Estados de carga, vacío, sin permisos, sin contenido, sin conexión y error accionable. Traducciones en español/inglés; etiquetas del catálogo proceden del servidor.

Se muestra fecha de generación del reporte y aviso sin conexión. La caché compartida puede devolver reportes descargados; no se calcula otro canal en el navegador ni se garantiza frescura de caché.

## Estructura

| Archivo                                         | Responsabilidad                                         |
| ----------------------------------------------- | ------------------------------------------------------- |
| `root.component.tsx`, `dashboard.component.tsx` | Permisos, aislamiento por usuario, catálogo y pestañas. |
| `case-form.component.tsx`, `case-form.utils.ts` | Tres pasos, precarga y validación local.                |
| `api.ts`, `types.ts`                            | REST/FHIR, paginación, errores y contratos.             |
| `offline.ts`, `pending-cases.component.tsx`     | Cola, reintentos y revisión.                            |
| `case-result.component.tsx`                     | Confirmación, periodicidad y alertas.                   |
| `report-panel.component.tsx`                    | Filtros, gráficos y tablas.                             |

## Desarrollo y validación

El `rspack.config.js` aplica una adaptación local, solo en desarrollo, para
`@rspack/dev-server` 2 con `@rspack/core` 1: expone `log` y `emitter` también como
exports nombrados, conservando las mismas instancias CommonJS para HMR. Evita
que el cliente falle en `setLogLevel` antes de publicar el contenedor federado.
Después de cambiar esta configuración hay que reiniciar el servidor de desarrollo.
La compilación de producción no utiliza esta adaptación.

Desde la raíz del monorepo:

```sh
yarn workspace @sihsalus/esm-epidemiological-surveillance-app start
yarn workspace @sihsalus/esm-epidemiological-surveillance-app lint
yarn workspace @sihsalus/esm-epidemiological-surveillance-app typescript
yarn workspace @sihsalus/esm-epidemiological-surveillance-app test
yarn workspace @sihsalus/esm-epidemiological-surveillance-app build
```

Usar Node/Yarn del monorepo. Pruebas sintéticas de tres pasos, campos/fechas, precarga, permisos concedidos/denegados, cambio de usuario, paginación, errores seguros, cola y reportes.

Validación local de edad y búsqueda directa (2026-09-30): `test` PASSED (51 pruebas
Vitest y 2 comprobaciones HMR), `typescript` PASSED, `lint` PASSED con una advertencia
de variable `revision` no usada en el dashboard. Pruebas: contrato AJAX y UUID/ruta,
consulta por nombres/código, edad antes/después de cumpleaños, conservación de selección, descarte de respuestas tardías,
reintento/error/vacío y captura en paso 2 con paso 3 de solo lectura. `build` PASSED
con dos advertencias de tamaño del bundle. Prueba integrada del selector con sesión
real y smoke clínico DEV/QLTY: NOT RUN (sin sesión de prueba coordinada).
`yarn.cmd verify:changed --base origin/main --head HEAD`: BLOCKED; el lanzador
termina con código 1 antes de las validaciones globales. En este Windows/Node 24,
`spawnSync('yarn.cmd', ...)` sin shell devuelve `EINVAL`; se ejecutaron directamente
los scripts del paquete. `git diff --check HEAD^ HEAD`: PASSED para este cambio.
La comprobación contra `origin/main` señala una línea vacía final en `constants.ts`,
fuera del cambio actual; no se modificó ese archivo.
Validación integrada OpenMRS/MariaDB: NOT RUN, omitida por decisión del usuario.

QA DEV/QLTY pendiente: catálogo/privilegios reales; sospechoso, positivo confirmado y negativo descartado; persistencia tras recarga; duplicados; alertas grave/gestante/foco/umbrales; cotejo de conteos; desconexión/reconexión y cambio de cuenta; teclado y presentación móvil. Solo pacientes sintéticos. Resultados medidos y límites en `epidemiologysurveillance/docs/informe-pruebas-iteracion-1.md`.

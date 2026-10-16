# @sihsalus/esm-epidemiological-surveillance-app

Microfrontend OpenMRS 3 de vigilancia epidemiológica de SIH Salus, iteración 1 (RE 3.1). Registro de casos, eventos notificables, alertas, curva epidémica y canal endémico.

Terminología: visita = consulta; encounter = atención.

## Alcance

Registro en **tres pasos**: paciente/atención existente; todos los campos del caso; revisión de solo lectura y registro. El paso 2 reúne profesional/localidad de solo lectura, diagnóstico, clasificación, laboratorio, origen, lugar probable de infección, inicio de síntomas, vacunación, tipo de vigilancia y fechas de investigación/notificación/defunción. No se incorpora React Form Engine en este cambio.

Cubre el registro, la información temporal, la distribución demográfica (RF-22)
y la información geográfica de focos (RF-18/RF-19 de la tesis), con usabilidad
RNF-04, RNF-05 y RNF-06. NOTI/Excel no se incluye.

### Pestañas, demografía y configuración

Las pestañas de Información temporal, demográfica y geográfica inicializan los
filtros territoriales con `sessionLocation` de la sesión autenticada. Consultan
la dirección REST de Location (`address1`, `stateProvince`, `countyDistrict`,
`cityVillage`) y completan campos ausentes desde su ubicación padre. Resuelven
los nombres dentro de cada padre del catálogo territorial, sin elegir entradas
ambiguas. Si faltan datos, conservan únicamente los niveles reconocidos; el usuario
puede cambiarlos. Las respuestas tardías no sobrescriben selecciones manuales.
Información geográfica incluye también Centro poblado. El pastel queda centrado
con su leyenda debajo. Eventos ofrece Inmediata y Semanal en el filtro de periodicidad.
El registro presenta Clasificación del diagnóstico y Probable; conserva el código
interno `SUSPECTED` para mantener el contrato existente.

Pestañas: **Casos**, **Información temporal** (antes Indicadores), **Indicadores**,
**Demográfico**, **Geográfico**, **Eventos** y **Configuración**. Por indicación del
usuario, Indicadores queda vacía. Geográfico presenta el mapa, la tabla por origen
y el gráfico por centro poblado. Casos e Información temporal identifican sus controles con
el título Filtros. Nuevo caso usa el mismo botón primario con icono de Nuevo evento.

Demográfico cruza Fila y Columna: edad, sexo, enfermedad, grupo etario, etnia,
gestación o periodo. El tipo de periodo solo aparece al usar esa variable;
incluye día, semana epidemiológica, mes, trimestre, semestre y año. Al elegir
enfermedad se borra y bloquea el evento individual y aparece una selección múltiple
de enfermedades a comparar. La tabla incluye totales y permite ocultar filas y
columnas completamente nulas sin cambiar los totales. No acepta la misma variable
en ambos ejes. El cálculo se realiza en el servidor; no descarga fichas de pacientes.

El filtro temporal usa inicio de síntomas, y la
clasificación puede ser confirmado, probable o ambos; excluye descartados.
Edad, sexo y gestación usan el caso guardado; la etnia usa el atributo vigente
del paciente. Los datos demográficos ausentes quedan en Sin dato. Se informa por
separado cuántos casos de las enfermedades elegidas no tienen inicio de síntomas.

Configuración → Configurar grupo etario guarda límites compartidos en el servidor:
infantes 0–1, niños 2–11, adolescentes 12–17, jóvenes 18–29, adultos 30–59 y adultos
mayores desde 60. Al editar un máximo se calcula el mínimo siguiente. Se exige
cobertura desde 0, sin huecos ni solapamientos y con el último grupo sin máximo.
Cambiar los grupos reclasifica los reportes, sin modificar la edad guardada en casos.

### Información geográfica (RF-18/RF-19)

Filtros: enfermedad, inicio de síntomas desde/hasta (mismo año calendario), Casos
incluidos (confirmados por defecto, probables o ambos; nunca descartados), año
de referencia derivado y no editable, departamento, provincia y distrito.
`GET /reports/geography` acepta `diagnosisType=CONFIRMADO|PROBABLE|TODOS` y entrega agregados por centro de
infección, sin identificadores de pacientes. El conteo de riesgo, la tabla
Centro poblado × Origen y el pastel usan el intervalo y los tipos de caso seleccionados.
La clasificación usa el historial de esos mismos tipos hasta el año de referencia.
El filtro requiere actualizar frontend y OMOD juntos. Solo los
centros con casos y coordenadas aparecen en el mapa; los demás permanecen en
la tabla y el pastel, con aviso del número de casos sin coordenadas.

La clasificación considera los tipos de caso seleccionados registrados de esa
enfermedad y centro hasta el año de referencia: autóctonos ese año → activo;
último autóctono entre 1 y 3 años antes → residual no activo; sin autóctonos
en esos cuatro años → eliminado. Introducidos se tratan como otros orígenes
no autóctonos, según aclaración del usuario. Un origen histórico desconocido
impide afirmar eliminado y se muestra sin clasificación. La ausencia de casos
se refiere al historial registrado, no acredita cobertura histórica completa.

Las leyendas de riesgo (rojo/naranja/amarillo/verde) y clasificación
(círculo/triángulo/cuadrado) se ubican abajo a la derecha; siempre queda una
activa. Solo riesgo usa círculos; solo clasificación usa rojo. El mapa permite
desplazamiento, zoom y ajuste a los focos, con teselas OpenStreetMap y atribución.
El mapa base requiere red; no se precargan mapas para uso offline ni se envían
casos al proveedor. La tabla y el gráfico siguen disponibles si fallan las teselas.

Configuración abre modales con Cancelar/Guardar para grupos etarios, coordenadas
y riesgo. `PUT /configuration/coordinates` recibe `{csv}` con el formato exacto
del archivo `epidemiologysurveillance/centros_poblados_maynas.csv`:
`address_hierarchy_entry_id,latitude,longitude`. Aunque el encabezado dice ID,
sus valores son códigos territoriales `user_generated_id`; el servidor los
resuelve al ID interno de Address Hierarchy. Conserva ceros iniciales, rechaza
códigos duplicados y coordenadas no finitas o fuera de latitud ±90 y longitud
±180 antes de escribir. Los códigos desconocidos o ambiguos se guardan pendientes,
sin inventar centros poblados. La respuesta informa `imported`, `matched` y
`pending`; la pantalla conserva el resultado tras guardar. Las coordenadas se
asocian al consultar el mapa cuando existe una correspondencia única en el
catálogo. La importación es transaccional, actualiza los centros incluidos y
conserva los demás. Los códigos admiten hasta 255 caracteres numéricos, según
la columna `surveillance_coordinate_codes.center_code`, sin truncamiento.

`GET/PUT /configuration/risk-levels` almacena tres mínimos enteros crecientes
(Mediano, Alto, Muy Alto), por defecto `[10,20,50]`. Bajo empieza en 1; los máximos
se derivan del nivel siguiente, sin huecos ni solapamientos. El límite técnico
es el entero Java de 32 bits; no se añaden campos de texto libre ni truncamientos.
Guardar requiere el privilegio de administración; consultar el mapa requiere
el de indicadores, tanto en frontend como en backend.

Actualizar OMOD y ESM juntos: la migración `liquibase-geography.xml` crea las
tablas de coordenadas y riesgo; `liquibase-coordinate-codes.xml` agrega la
persistencia por código territorial, compatible con coordenadas ya cargadas.
No modifica casos ni la clasificación usada por
las alertas existentes. Sin estos endpoints se presenta un error seguro y reintento.

Validación local de geografía (15/10/2026): `mvn package` **PASSED** (126 pruebas
API y 7 REST); `yarn.cmd workspace @sihsalus/esm-epidemiological-surveillance-app
test` **PASSED** (126 pruebas Vitest y una prueba HMR); `lint`, `build` y
`node ../../../node_modules/typescript/bin/tsc6 --noEmit` **PASSED**.
`PLAYWRIGHT_CHANNEL=msedge node --test tooling/geographic-layout.check.cjs`
**PASSED**, leyendas y atribución dentro del mapa a 1280, 768 y 375 px, con
teselas y centros sintéticos. Incluye revisión de capturas; no acredita el mapa
base en red ni un entorno integrado. Pruebas de persistencia usan H2 y las de
migración ejecutan Liquibase dos veces. Smoke clínico DEV/QLTY/MariaDB **NOT RUN**
(sin sesión de prueba coordinada); no se realizó despliegue.

Corrección de importación CSV: el archivo de ejemplo contiene 694 filas válidas;
41 códigos no aparecen en el catálogo territorial del repositorio. Ahora se
persisten todos y se informa cuántos quedan pendientes, sin recargar la página
y perder el aviso. Validación: CSV completo aceptado por el validador Java;
`mvn package` con formateadores desactivados, 126 pruebas API y 7 REST PASSED;
126 pruebas Vitest y HMR, TypeScript, lint y build PASSED. La prueba H2 comprueba
que un código pendiente se resuelve al agregarlo al catálogo y no se asocia si
existen duplicados. La comprobación con el catálogo de la instancia desplegada
queda pendiente; requiere actualizar el OMOD para ejecutar la nueva migración.

Demográfico requiere el privilegio de indicadores; Configuración requiere el de
configuración. Los endpoints también verifican los permisos. Se requiere el OMOD
con `liquibase-age-groups.xml`. Contrato: `epidemiologysurveillance/docs/demographics.md`.

Crear o modificar casos o eventos recarga la página completa de Vigilancia
Epidemiológica tras confirmar el guardado. Un error conserva el formulario y no
recarga. Guardar grupos etarios también recarga para aplicar los límites nuevos.

### Edición de eventos notificables

Las tablas de Casos y Eventos muestran 10 filas por página, con opciones de 20 y
50, selector de página y botones anterior/siguiente. La paginación es local sobre
los resultados de la API; al filtrar o recargar los registros vuelve a la primera página.

Cada fila de Eventos ofrece **Editar evento notificable**. El formulario precarga
la enfermedad, periodicidad, norma de referencia y estado (Activo o Inactivo).
Solo existe un evento por enfermedad. Los inactivos permanecen en la tabla para
editarlos y reactivarlos, pero se excluyen de los filtros de enfermedad y de los
diagnósticos válidos al registrar nuevos casos.
Guarda mediante `PUT /events/{uuid}` con el privilegio de administración existente;
requiere el OMOD con esa ruta. Conserva UUID y auditoría de creación. El nombre y
plazo de notificación se derivan del concepto y periodicidad. Al guardar recarga
la lista y el catálogo; al fallar conserva los datos para reintentar.

### Consulta y edición de casos guardados

La pestaña Casos abre modales Carbon desde los iconos Ver y Editar. El detalle
consulta `GET /cases/{uuid}`. Nombres, apellido paterno, apellido materno, sexo,
edad en años cumplidos y residencia son copias persistidas por el servidor al crear
el caso. La residencia incluye provincia → distrito → centro poblado y las líneas
de dirección disponibles. Las copias no cambian al editar el paciente o el caso.
Los casos históricos sin copia muestran datos no disponibles; no se reconstruyen
con la ficha actual. Requiere `liquibase-case-snapshot.xml` y actualizar OMOD/ESM juntos.
No se muestran UUID: nombres ausentes se presentan como no disponibles.
El OMOD aporta nombres de atención, profesional, localidad, orden y la ruta del lugar
de infección; requiere la versión que incluye `liquibase-case-laboratory.xml`.

La edición usa `PUT /cases/{uuid}`: origen, vacunación, vigilancia, gestante,
fechas editables, centro poblado de infección y resultado de laboratorio de la atención.
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

Periodos: `dia,semana,mes,trimestre,semestre`. Fechas iniciales respetan cobertura; no hay límite de duración del intervalo.

El OMOD fija los UUID clínicos en `SurveillanceCatalog.java` tras contrastarlos con `sihsalus-content`; no lee archivo JSON ni global property. Abrir el catálogo no exige validar todos los conceptos. Al guardar se comprueban las referencias utilizadas: `CLINICAL_CONCEPT_UNAVAILABLE` indica un concepto ausente o retirado y `CLINICAL_DATATYPE_MISMATCH` un tipo incompatible. Actualizar el OMOD y el ESM juntos porque el contrato usa `/catalog` y la propiedad `catalog`.

El backend ofrece `GET /events`, `GET /events/{uuid}`, `POST /events` y
`PUT /events/{uuid}`. La pantalla permite crear y editar eventos.
`GET /healthcheck` devuelve `{"status":"UP"}` con una sesión autorizada.

## Registro y trabajo sin conexión

Gestante ofrece Sí/No solo para sexo femenino con edad de 10 a 55 años cumplidos,
ambos inclusive, a la fecha de investigación. En los demás casos, incluidos datos
insuficientes, se bloquea con No; el servidor aplica la misma regla. La edición usa
sexo y edad copiados. La fecha de investigación es de solo lectura y el servidor
la deriva de la atención del diagnóstico en la zona horaria del catálogo. Debe
ser menor o igual a hoy y a la notificación, cuando esta se consigne. La notificación
no admite fechas futuras. La edad se calcula entre investigación y nacimiento.

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
Departamento → Provincia → Distrito → Centro poblado (código). Usa el contrato AJAX de Address Hierarchy
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
Filtros: `diagnosisType=CONFIRMADO|PROBABLE|TODOS` (predeterminado `CONFIRMADO`).
El selector Departamento → Provincia → Distrito → Centro poblado envía
`zoneLevel=DEPARTAMENTO|PROVINCIA|DISTRITO|CENTRO_POBLADO` y `address` según
el nivel más específico seleccionado. Sin departamento incluye todas las zonas;
sin provincia incluye todo el departamento; sin distrito, toda la provincia;
sin centro poblado, todo el distrito. Cambiar un padre limpia sus descendientes.
`TODOS` excluye descartados. La respuesta incluye los filtros aplicados; los títulos de los gráficos reflejan el diagnóstico.

El histórico suma las zonas y diagnósticos de cada año antes de calcular cuartiles,
sin fabricar ceros para años sin filas ni clasificar períodos incompletos como zonas
definitivas. La distribución demográfica (RF-22) tiene su propia pestaña y usa casos,
sin depender de los agregados del canal. Contrato temporal: `epidemiologysurveillance/docs/api-contract.md`.

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

### Canal endémico: configuración y comparación histórica (16/10/2026)

Información temporal exige fechas del año calendario actual en la zona horaria
del catálogo. `OUTSIDE_CURRENT_YEAR` muestra el mensaje específico solicitado;
la validación de cobertura mantiene su significado independiente.
Configuración → Configurar canal endémico persiste `[años históricos, mínimo]`
en `/configuration/endemic-channel` (valores iniciales 5 y 3). Ambos son enteros
positivos, el mínimo no supera los años considerados y estos son menores que el
año actual, evitando años anteriores a 1. Requiere privilegio de administración.
El guardado actualiza Información temporal. Esta configuración se aplica al
reporte del canal; no cambia las reglas de alertas del registro de casos.

El reporte entrega `historicalYears` y `channel[].historicalCases`, agregados con
los mismos filtros de enfermedad, territorio y diagnóstico. Años a comparar usa
selección múltiple y solo cambia las líneas visibles, sin alterar los cuartiles.
Los periodos históricos sin casos registrados muestran cero en las comparaciones,
sin aumentar la muestra estadística usada para determinar historia suficiente.
Los periodos inexistentes (como el 29 de febrero en años no bisiestos) quedan ausentes.
El histórico se ancla a los años previos al año calendario consultado;
las semanas conservan su numeración epidemiológica y los días se alinean por mes
y día (sin inventar el 29 de febrero en años no bisiestos).

Cada periodo tiene una etiqueta sin año (DD/MM, SXX, MM, TX o semestre), los ejes tienen
títulos y el gráfico admite desplazamiento horizontal para rangos extensos.
Requiere actualizar ESM y OMOD junto con `liquibase-endemic-config.xml`.
Validación integrada DEV/QLTY: NOT RUN, sin sesión de prueba coordinada.

Validación local de este cambio: `yarn workspace
@sihsalus/esm-epidemiological-surveillance-app test` PASSED (133 pruebas y una
comprobación HMR); `lint`, `build` y `node
../../../node_modules/typescript/bin/tsc6 --noEmit` PASSED.
`PLAYWRIGHT_CHANNEL=msedge node --test tooling/endemic-layout.check.cjs` PASSED:
cinco periodicidades a 1280 y 375 px, con datos sintéticos. Backend:
`mvn -o -pl api,omod -am compiler:compile compiler:testCompile surefire:test`
PASSED (129 pruebas API y 7 REST), incluyendo migración y persistencia.

### Correcciones de información y formularios (14/10/2026)

Las pestañas se presentan como Información demográfica e Información geográfica.
Información temporal identifica sus fechas como Inicio de síntomas desde/hasta.
Información demográfica reutiliza la jerarquía territorial del reporte temporal,
sin selector de nivel geográfico. Filtra el lugar probable de infección mediante
`zoneLevel` y `address` en `/reports/demographics`, incluyendo todos los descendientes
del nivel más específico seleccionado.
Requiere actualizar también el OMOD.

Las etiquetas de periodos proceden del calendario epidemiológico del servidor:
diario `DD/MM/AAAA`, semanal `AAAA-SXX`, mensual `AAAA-MM`, trimestral `AAAA-QX`,
semestral `AAAA-X` y anual `AAAA`. Las fechas del módulo se presentan en día/mes/año,
incluidos los selectores Carbon; el contrato API conserva ISO. El selector valida
el formato completo antes de interpretar una fecha escrita parcialmente.

Los campos respaldados por columnas no nulas llevan `(obligatorio)` y asterisco
rojo en registro y edición. La referencia es `liquibase-surveillance-case.xml`:
paciente, atención, profesional, localidad, diagnóstico y clasificación en casos;
enfermedad, periodicidad, norma y estado en eventos. Los campos derivados
conservan su bloqueo. La edición sigue el orden del registro: origen, infección,
inicio de síntomas, laboratorio, clasificación, vacunación, gestación, vigilancia
y fechas de investigación, notificación y defunción.

Validación local: Maven `package` PASSED (117 pruebas API y 6 REST), TypeScript
con `tsc6 --noEmit` PASSED y compilación Rspack PASSED. Smoke visual con backend
DEV/QLTY NOT RUN: no hay sesión de pruebas coordinada. No se desplegó.
El script `test` PASSED con 103 pruebas Vitest y una comprobación HMR; `lint` y
Prettier del README PASSED. Carbon avisa que `parseDate` quedará obsoleto en su
próxima versión mayor; se usa para rechazar interpretaciones de fechas incompletas.

El módulo usa `openmrs/default-rspack-config` y la versión de Rspack fijada en
el monorepo (actualmente 2.2.8). Sus utilidades HMR `log` y `emitter` ya ofrecen
exports nombrados ES. No necesitan la adaptación CommonJS utilizada con Rspack 1.

### Error de carga del contenedor federado

`The global variable _sihsalus_esm_epidemiological_surveillance_app does not refer
to a federated module` indica que el script cargado no publicó el contenedor
esperado, con métodos `get` e `init`. Revisar también el primer error de consola
y la respuesta del script en Network; el mensaje de federación por sí solo no
identifica la causa.

Con Rspack 2, el antiguo `hmr-compat-loader.cjs` añadía `module.exports` a las
utilidades ES de HMR. Esto provocaba `ReferenceError: module is not defined`
durante el arranque e interrumpía la carga. Se retiró esa adaptación.
`tooling/hmr-compat.check.cjs` compila las utilidades instaladas usando las reglas
del módulo y ejecuta los bundles en un contexto de navegador simulado: comprueba
el evento HMR y la publicación del contenedor. La prueba reproduce el error con
el loader anterior; no sustituye un smoke del SPA con backend.

Después de actualizar, detener y volver a iniciar el servidor de desarrollo,
y recargar la página. Seguir la [preparación del SPA](../../../docs/development/README.md)
para disponer de `dist/spa` y del backend configurado. Para incluir este módulo
en el desarrollo con HMR, desde PowerShell en la raíz:

```powershell
$env:SIHSALUS_DEV_APPS = 'esm-login-app,esm-home-app,esm-epidemiological-surveillance-app'
yarn start
```

Conservar en `SIHSALUS_DEV_APPS` otras apps que también se estén desarrollando.
Si se sirven artefactos estáticos, reconstruir el paquete y ejecutar
`yarn assemble` para actualizar los assets del SPA. Si el error persiste,
comprobar que el import map o su override apunta al JavaScript de este paquete
y que la respuesta no es HTML ni un bundle anterior.

### Comprobaciones locales

Desde la raíz del monorepo:

```sh
yarn workspace @sihsalus/esm-epidemiological-surveillance-app lint
yarn workspace @sihsalus/esm-epidemiological-surveillance-app typescript
yarn workspace @sihsalus/esm-epidemiological-surveillance-app test
yarn workspace @sihsalus/esm-epidemiological-surveillance-app build
```

Usar Node/Yarn del monorepo. Pruebas sintéticas de tres pasos, campos/fechas, precarga, permisos concedidos/denegados, cambio de usuario, paginación, errores seguros, cola y reportes.

Validación de la corrección HMR (2026-10-02), Windows, Node 24.20.0, Yarn 4.18.1,
Rspack 2.2.8; cambios locales sobre `4234fb6d149d7562c31b35d11b7c284cba4f0413`.
Los comandos del paquete usan el prefijo
`yarn workspace @sihsalus/esm-epidemiological-surveillance-app`:

- `yarn install --immutable`: **PASSED**. `corepack enable`: **BLOCKED** por
  permisos sobre `C:\Program Files\nodejs\pnpx`; se usó Yarn ya disponible.
- `test`: **PASSED**, 75 pruebas Vitest y una regresión de compilación/ejecución
  HMR. Esta última falla con `module is not defined` al conservar el loader antiguo.
  Avisos de configuración futura de Vite y feature flags de Carbon.
- `lint` y `build`: **PASSED**, ejecutados para el paquete.
- `typescript`: **BLOCKED**, el script no encuentra `tsc`; la resolución instalada
  `@typescript/typescript6` expone `tsc6`. Como alternativa,
  `node ../../../node_modules/typescript/bin/tsc6 --noEmit`, desde el paquete:
  **PASSED**, con el `tsconfig.json` local que ya existía al iniciar la revisión.
- `yarn build --concurrency=2`: **PASSED**, 91 tareas; 90 desde caché y el build
  del módulo ejecutado. Los logs recuperados incluyen advertencias de tamaño.
- `$env:SPA_OUTPUT_DIR = 'dist/spa-surveillance-validation'; yarn assemble`:
  **PASSED**, shell compilado y artefacto validado con 68 módulos esperados.
  Advertencias de tamaño, API obsoleta de Webpack, bibliotecas sin rutas y URL
  relativa de vista previa social. El ensamble incorpora el CSS al precache
  después del aviso de tamaño de Workbox. Salida separada en
  `dist/spa-surveillance-validation`; no acredita un despliegue.
- `yarn prettier --check packages/apps/esm-epidemiological-surveillance-app/README.md`
  y `git diff --check -- packages/apps/esm-epidemiological-surveillance-app`:
  **PASSED**.
- `yarn verify:changed --base origin/main --head HEAD`: **NOT RUN**, la corrección
  permanece sin commit y ese rango no incluye los cambios del directorio de trabajo.
- Smoke en navegador con backend DEV/QLTY: **NOT RUN**, sin sesión de prueba
  coordinada. La regresión HMR usa bundles sintéticos y un contexto simulado.

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

### Rangos, canal y errores por campo (14/10/2026)

Información demográfica permite rangos mayores a dos años. Información temporal
se limita al año calendario actual desde la actualización del 16/10/2026. Se mantienen
el orden de las fechas, el límite de hoy y la cobertura del reporte temporal.
Información temporal muestra únicamente el canal endémico y su tabla; el periodo
diario permite consultar la evolución diaria. Los selectores de fecha ocupan el
ancho disponible en la grilla, con etiquetas que pueden ajustarse en pantallas pequeñas.

Registro y edición presentan las validaciones debajo del campo en rojo. Cada
mensaje corresponde a una sola condición incumplida; las fechas se validan por
formato, relaciones y límites antes de guardar. Los campos derivados bloqueados
conservan sus mensajes. Errores sin campo, como falta de red o permisos, permanecen
a nivel del formulario. La norma de referencia admite 100 unidades UTF-16 después
de quitar espacios en los extremos, según el contrato existente del servidor y
`reference_regulation varchar(100)`; no se truncan valores ni se bloquea la edición
para ocultar un valor histórico fuera del límite.

Requiere actualizar OMOD y ESM juntos: las respuestas de validación conservan
`code` y `fields` y añaden `fieldErrors`, con nombres de campos y motivos permitidos.
El frontend descarta nombres y motivos desconocidos; no presenta valores enviados
ni mensajes internos del servidor.

Validación de esta corrección: `mvn package` PASSED (119 pruebas API y 6 REST);
`yarn workspace @sihsalus/esm-epidemiological-surveillance-app test` PASSED
(109 pruebas Vitest y una comprobación HMR); `lint`, `build` y
`node ../../../node_modules/typescript/bin/tsc6 --noEmit` PASSED. Revisión visual
integrada DEV/QLTY NOT RUN, sin sesión coordinada. No se realizó despliegue.

Corrección del ancho de fechas: la clase local pertenece al contenedor exterior
`cds--form-item`; los selectores alcanzan ahora el DatePicker interior y el `span`
que contiene el campo y el icono, y sustituyen su `inline-size` fijo. La prueba
`node --test tooling/date-input-layout.check.cjs` renderiza componentes Carbon
reales con sus estilos y verifica sus dimensiones a 1280, 947, 600 y 375 px.
PASSED en Edge sin interfaz (`PLAYWRIGHT_CHANNEL=msedge`), junto con lint y build.
Es una prueba aislada de presentación, no un smoke clínico del SPA.

Corrección del guardado de grupos etarios: el cuerpo del PUT se serializa
explícitamente como un arreglo JSON, porque `openmrsFetch` solo serializa objetos
planos automáticamente. La prueba comprueba la decodificación del cuerpo enviado,
incluido el límite superior nulo del último grupo. Validación local PASSED:
`node ../../../node_modules/vitest/vitest.mjs run src/demographic.resource.test.ts src/age-groups.component.test.tsx`
(6 pruebas), `yarn lint`, `yarn build` y
`node ../../../node_modules/typescript/bin/tsc6 --noEmit`. Guardado integrado en
DEV/QLTY NOT RUN; no se realizó despliegue.

La pestaña Eventos permite filtrar por enfermedad y periodicidad. Ambos filtros
se combinan sobre la lista cargada, admiten Todos y reinician la paginación;
el total corresponde a los eventos filtrados.

La búsqueda de conceptos al registrar o editar eventos solo ofrece conceptos cuya
clase canónica es `Diagnosis`. Consulta las páginas siguientes de resultados cuando
hay conceptos de otras clases y excluye aquellos cuya clase no está disponible.

Actualización territorial: requiere publicar OMOD y ESM juntos. El endpoint
`/addresses/departments` usa `ADDRESS_1` y las provincias se consultan por su
departamento padre. La ubicación de infección y la residencia del paciente muestran
Departamento antes de Provincia; las copias históricas de residencia no se modifican.

Validación territorial local (15/10/2026): PASSED, 118 pruebas Vitest y una
comprobación HMR con yarn test; TypeScript, lint y build correctos. Backend:
mvn package PASSED, 120 pruebas API y 6 REST. Verificación integrada DEV/QLTY
NOT RUN; no se realizó despliegue.

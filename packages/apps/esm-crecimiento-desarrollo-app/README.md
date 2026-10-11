# esm-cred-app

El formulario de antecedentes por catálogo es `ConditionConceptSetForm` de `esm-patient-common-lib`. Este módulo conserva únicamente el adaptador de permiso, traducción y conjunto de conceptos; no mantiene copias del formulario, sus campos o estilos. Los campos tienen desplazamiento propio y las acciones permanecen visibles. Se conservan los filtros clínicos, permisos y contratos de guardado de cada módulo. Validar panel estrecho y tablet, creación/edición y cambio de paciente con datos sintéticos en QLTY.

Este microfrontend vive en la carpeta `packages/apps/esm-crecimiento-desarrollo-app` y se publica como `@sihsalus/esm-cred-app`.

App orientada al seguimiento de CRED y control preventivo infantil.

## Atención CRED integrada

La entrada **CRED** (`cred-dashboard`) reúne Resumen, Antecedentes y nacimiento,
Control y examen, Crecimiento y nutrición, Desarrollo, Vacunación y Seguimiento.
El resumen ofrece accesos a las secciones permitidas y fechas de atenciones
registradas. No calcula cumplimiento clínico ni declara un control completo por
contar formularios. Las curvas reutilizan el lector y las referencias OMS del
componente de crecimiento existente; sus límites y procedencia siguen vigentes.

La entrada exige sesión autenticada, acceso a la historia,
`app:hoja.clinica.cred.cursoVida` y lectura de al menos una familia CRED.
Cada sección conserva su permiso de lectura
y los lectores/formularios mantienen sus permisos de edición. Las pestañas sin
permiso no se muestran ni montan sus lectores. Solo se monta la pestaña activa y
al cambiar de paciente se reinicia en Resumen. La inscripción activa al programa
«Control de Niño Sano» sigue condicionando el enlace lateral mediante el helper
clínico compartido. La ruta directa comprueba también esa inscripción antes de
montar los lectores clínicos; carga incompleta o error no habilitan el panel.
No se crea otro evaluador de programas.

El resumen muestra **Madre vinculada** con acceso a la historia y lectura
neonatal (`app:hoja.clinica.cred.neonatal`), sin exigir edición de relaciones.
El lector compartido consulta el vínculo explícito de EmrApi por el UUID del
niño y abre la historia nativa de la madre. Carga todas las páginas; un error de
consulta o configuración no se presenta como ausencia de madre. No deriva
parentesco de conceptos compartidos ni copia datos maternos al niño. La
aceptación en QLTY requiere comprobar el mapeo canónico, los perfiles backend y
el recorrido bilateral con pacientes sintéticos.

**Abrir formularios del control** reutiliza el workspace y la comprobación de
consulta activa existentes. **Consultas anteriores** conserva el permiso de
visitas y abre el historial del mismo paciente sin cambiar la consulta activa.
El orden del enlace lateral pertenece a `config/frontend.json`. Las rutas,
componentes y privilegios de los cinco dashboards anteriores se conservan para
enlaces directos. La atención inmediata y hospitalaria neonatal permanece en su
pantalla original, accesible desde **Ver atención neonatal** con su permiso
propio; no es un paso obligatorio del control ambulatorio.

QA pendiente en QLTY: recorrido de las siete pestañas con datos sintéticos,
perfiles de lectura/edición restringidos, revocación, cambio de paciente, creación
y reapertura del mismo control, curvas y citas. La reorganización no modifica
conceptos, formularios ni reglas clínicas y no cierra las brechas de content
documentadas debajo.

En el dashboard neonatal, la pestaña de consejería usa la etiqueta corta
«Lactancia»; el encabezado del contenido conserva su nombre completo.
Las tarjetas de seguimiento nutricional y estimulación histórica muestran la
fecha más reciente entre sus campos independientes. La fecha de última medición
nutricional se deriva de peso y talla; una clasificación posterior no se presenta
como si fuese una nueva medición. Estos resúmenes no crean ni modifican obs.

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

Servicios adicionales de Cuidado del niño sano incluye el odontograma completo
mediante una extensión del módulo odontológico. Reutiliza su pantalla, historial,
permisos y guardado para el paciente actual; complementa el formulario CRED-016.
Requiere conexión y los privilegios odontológicos correspondientes. La integración
y su aceptación en QLTY se siguen en
[el issue #120](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/120).

El historial de condiciones comparte lectura, creación, corrección y anulación REST, con paginación completa y estados clínicos precisos. Crear o editar una condición exige un proveedor clínico asociado a la sesión. La creación deriva el registrador de la sesión autenticada; la corrección parcial usa REST y conserva la versión original mediante el versionado de core. Cada versión tiene su autor y fecha de registro; la fecha clínica no cambia si no se edita. El UUID del proveedor no identifica al usuario registrador. Este contrato se ha revisado contra core 2.8.9 y REST 3.5.0; la validación con el backend instalado sigue pendiente. Los límites de persistencia, contenido y auditoría se documentan en el [contrato de antecedentes](../../../docs/clinical/antecedents-data-contract.md).

Las dos entradas de antecedentes patológicos del menor muestran los registros patológicos, los diagnósticos previos del propio paciente y los históricos sin tipo. Excluyen clasificaciones explícitas familiares, sociales, quirúrgicas, hospitalizaciones previas y otros antecedentes, incluso cuando comparten un concepto del conjunto pediátrico. Las tablas genéricas conservan su selección por conjunto salvo que su consumidor solicite ese filtro clínico.

## TODO content/backend

- Usar siempre `external_id` de OCL como UUID de OpenMRS. El campo `uuid` de OCL es interno/versionado y no debe entrar en config frontend.
- Content ya declara los privilegios `app:hoja.clinica.cred.*` y conserva el perfil `SIHSALUS CRED - Pruebas` en su contrato de accesos. Falta comprobar la sesión operativa contra el ambiente desplegado; no convertir ese perfil de pruebas en una política de producción por inferencia.
- Configurar `credScheduling.appointmentServiceUuid` con el servicio real de citas CRED; si queda vacío, la generación de citas debe permanecer oculta o mostrar error claro.

Validado en DEV/OCL: `CRED-001` a `CRED-027`, `INMU-002-REPORTE ESAVI`, encounter type `vaccinationAdministration`, `consultationTime` = `Hora` (`2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4`), `CRED.perinatalConceptSetUuid` = `Antecedentes de Riesgo Perinatal` (`9dce2946-9fda-4d62-b68e-d62711801189`), `Número de control CRED` = `ce8b07e8-712f-406a-b44d-2fa69167f5ea` está instalado en DEV como concepto numérico, y psicoprofilaxis/riesgo obstétrico/causa probable de muerte usan `external_id` existentes. El TPED histórico tiene una definición frontend versionada de 88 hitos, pero su mapeo individual de conceptos sigue pendiente; ver `docs/clinical/test-peruano/CONCEPT-AUDIT.md`.

El componente `tped-reference-widget` muestra la matriz historica y el detalle de hitos en
la pestana Desarrollo. Es solo de consulta: no persiste observaciones, puntajes ni
clasificaciones.

## TODO QA/QLTY

### Prueba de persistencia y correcciones — 02/10/2026

Candidato local: `9857f27a1b72bf1564cf6afc914e010b88c7cd06`, en un worktree
con instalación independiente. La SPA se ensambló con sus 67 módulos locales y
se probó contra el backend de QLTY con un paciente sintético propio, visita activa
y sesión administrativa autorizada. El frontend desplegado en QLTY seguía en
`692265308df1de9e9e14bad841a62e6c414b45f8`; esta evidencia no acredita despliegue
del candidato ni aceptación de un perfil clínico.

Se corrigieron defectos encontrados durante el recorrido:

- La búsqueda de roles de atención obtiene el catálogo activo completo y permite
  coincidencias parciales; REST solo devolvía el rol con el nombre exacto.
- Los seis resúmenes esperan la metadata del formulario histórico antes de
  habilitar la edición; las medidas conservan el cero y muestran sus unidades.
- El motor no asigna a un campo vacío una observación identificada como otro
  campo. Esto evita anular detalles independientes cuando el formulario comparte
  conceptos. El resumen distingue esófago y ano por la identidad persistida; un
  dato histórico sin esa identidad pide revisar el formulario original.
- Las casillas y multiselecciones reflejan el valor actual del formulario,
  incluida la carga tardía, sin mantener un segundo estado de selección.
- El chart declara su dependencia de desarrollo del workspace común, para que
  Turborepo recompile el proveedor compartido cuando cambia la representación REST.
  En navegador se comprobó que la versión anterior omitía la identidad de campo y
  que el candidato la solicita y recibe.
- El acceso de formularios CRED se registra en la barra vigente del chart,
  conserva su permiso y comprueba la visita activa. Pasa la identidad del paciente
  tanto al grupo como al workspace; antes el control abría sin paciente y quedaba
  deshabilitado.
- La lectura y escritura del número de control usan `concepts.controlNumber`,
  la ruta declarada en el esquema. La observación se añade atómicamente al crear;
  al editar se conserva la persistida, evitando añadir un segundo número.
- Las consultas de observaciones seleccionan explícitamente el buscador REST
  `s=default`. En el backend probado, el parámetro no admitido `sort=desc` hacía
  caer en la búsqueda general del paciente: peso, talla, clasificación y Hb podían
  mostrar otra observación. Se retiró ese parámetro de los consumidores CRED.
  Los signos neonatales usan `concepts` para la lista de UUIDs y requieren paciente.

Los seis registros persistidos se verificaron en `629572ec3`; su edición y
reapertura se repitieron en `f4d9e6701`. Se verificaron la respuesta
HTTP, UUID de atención, formulario original, paciente, visita, observaciones
persistidas y ausencia de duplicados, además del valor mostrado tras F5.
Dos guardados consecutivos de la evaluación cefalocaudal conservaron las casillas,
ambos detalles «Otros» y los resúmenes anatómicos independientes. Las pruebas
unitarias de estos defectos fallaron antes de la corrección y pasaron después.

En `ef4895937` se creó el examen físico `CRED-014` desde el selector del control,
se guardó, recargó y editó la misma atención. En el candidato final se repitió
la edición y recarga: un solo número de control canónico con valor 1 y ninguna
atención duplicada. También se comprobaron `CRED-006` (nutrición) y `CRED-003`
(estimulación): paciente, visita, formulario, encounter type, identidad de campos,
observaciones guardadas y resumen tras F5. Nutrición se creó en `ef4895937` y su
resumen corregido se verificó en el candidato final; estimulación se creó y
verificó con este último. Esta prueba no cubre todos los formularios de esas áreas.

| Estado  | Comprobación                                                                                                  | Resultado y alcance                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PASSED  | `VITEST_MAX_WORKERS=1 TURBO_ENV_MODE=loose yarn verify:changed --base origin/main --head HEAD` en `9857f27a1` | Lint/tipado y builds dependientes: 270 tareas, 267 de caché, 3,829 s. Pruebas: 115 tareas, 114 de caché, 34,841 s; CRED ejecutó 345 pruebas en 39 archivos. La caché corresponde a tareas sin cambios validadas en esta instalación.                                                                                                                                     |
| PASSED  | `yarn workspace @sihsalus/esm-cred-app build` y `yarn assemble` en `9857f27a1`                                | Compilación y validación del artefacto SPA de 67 módulos locales. Persisten advertencias de tamaño de bundles.                                                                                                                                                                                                                                                           |
| PASSED  | Navegación en Chromium con backend QLTY                                                                       | Cinco dashboards, 18 pestañas y cero excepciones no manejadas en el recorrido. No acredita guardar todos sus formularios.                                                                                                                                                                                                                                                |
| FAILED  | Regresiones y recorridos anteriores a las correcciones                                                        | Se reprodujeron la pérdida de identidad de campo, selección desactualizada, paciente ausente, número omitido/duplicado y filtro REST perdido; las regresiones correspondientes pasaron tras sus fixes. El primer baseline en `f4d9e6701` también tuvo timeouts en registro de pacientes; la repetición limitada a un worker pasó sin cambiar timeouts ni omitir pruebas. |
| PASSED  | Limpieza sintética en QLTY                                                                                    | El journal quedó cerrado como limpio tras verificar la anulación del paciente propio, persona, visita y dependencias. Se conservó durante los timeouts de REST mientras el backend estaba iniciando y se reintentó cuando volvió a responder.                                                                                                                            |
| NOT RUN | CI de PR, release, despliegue y aceptación clínica con perfil restringido                                     | Cambios locales aislados; no se publicaron ni desplegaron. La sesión administrativa no acredita permisos operativos.                                                                                                                                                                                                                                                     |

DEV autenticó y permitió lectura, pero IDGen respondió 500 al intentar obtener
un identificador: `EntityManagerFactory is closed`. No se creó un paciente allí.
La asociación temporal de proveedor de prueba fue retirada y su retiro se verificó;
no se cambiaron roles. Este fallo externo no se ocultó ni se reinició DEV para
resolverlo dentro de esta validación.

La revisión de configuración encontró 97 referencias a 88 conceptos únicos:
los 88 estaban activos en DEV y QLTY. Los seis formularios neonatales tenían una
única versión publicada activa por nombre exacto. Esta comprobación acredita
existencia y disponibilidad; no acredita equivalencia clínica ni cierra las
colisiones terminológicas del contrato de content.

La consulta autenticada de [OCL SIHSALUS](https://app.openconceptlab.org/#/orgs/SIHSALUS/)
verificó los mismos 88 `external_id`: 83 activos en `sihsalus`, cuatro en
`laboratorio` y uno en `diagnosis`. Se revisaron los 4.485 conceptos de HEAD de
`sihsalus` y los 248 de `laboratorio`; las releases consultadas fueron
`2026-09-15-1` y `2026-09-17-1`. No se publicaron conceptos ni se sustituyeron
exports históricos. Los conjuntos EDI, Huanca y M-CHAT contienen conceptos de
resultados agregados; sus mappings no equivalen a disponer de todos los ítems.
No se encontraron conceptos específicos de z por indicador ni Hb ajustada en
las dos fuentes revisadas. La Hb medida de laboratorio no representa Hb ajustada.

Git contiene la NTS 238 y la Libreta CRED archivadas en
[las fuentes normativas](../../../docs/clinical/test-peruano/SOURCES.md), y las
auditorías de content enumeran los ítems pendientes. No se encontró aprobación
clínica de la captura íntegra ni documentación que establezca el uso digital de
M-CHAT-R/F para la distribución de este software. Las
[condiciones de los autores](https://www.mchatscreen.com/mchat-rf/) distinguen el uso
interno en el EHR de una práctica clínica de la distribución del instrumento
dentro de software; esa aplicabilidad debe quedar documentada antes de publicarlo.

Continúan pendientes los conceptos canónicos para resolver las 11 colisiones
semánticas de content (42 campos en diez formularios), y la persistencia estructurada de
z/clasificación por indicador y Hb ajustada, las versiones aprobadas de EDI y
Huanca, y la documentación de las condiciones de uso y captura íntegra de M-CHAT-R/F. Tampoco se
acredita aquí la aceptación por personal clínico, el perfil restringido desplegado
ni el guardado de todos los formularios de nutrición y estimulación. El acceso
administrativo no resuelve esas condiciones.

### Verificación histórica de correcciones neonatales — 01/10/2026

Código validado: `ff1451bdabcd6f01bd72d041c715386c2d2ba1a6`. La revisión conserva
el esquema histórico al editar y corrige la lectura paginada descrita debajo.

| Estado  | Comprobación                                                                                                                                                                              | Resultado y alcance                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PASSED  | `yarn workspace @sihsalus/esm-cred-app test`, ejecutado por Turbo                                                                                                                         | 329 pruebas en 37 archivos.                                                                                                                                                                                              |
| PASSED  | `yarn workspace @openmrs/esm-patient-common-lib test`, ejecutado por Turbo                                                                                                                | 507 pruebas en 32 archivos; incluye historial de más de 100 atenciones y error en una página posterior.                                                                                                                  |
| PASSED  | `VITEST_MAX_WORKERS=2 TZ=UTC yarn turbo run lint typescript test --concurrency=2 --env-mode=loose`, filtrando los mismos 45 workspaces de `verify:changed --base origin/main --head HEAD` | 223 tareas correctas, 86 de caché, 14 min 53 s; incluye builds dependientes. 6128 pruebas pasaron en 720 archivos. Cuatro workspaces no contienen pruebas: referrals, psicología, terapia física y seguimiento de casos. |
| PASSED  | Build de CRED incluido en la ejecución anterior                                                                                                                                           | Rspack completó; persisten advertencias de tamaño de bundles.                                                                                                                                                            |
| FAILED  | Primeras ejecuciones de `yarn verify:changed --base origin/main --head HEAD`                                                                                                              | Restricción local de caché SWC y, al habilitarla, timeouts de alergias con la concurrencia predeterminada. La ejecución limitada anterior completó el mismo alcance sin cambiar timeouts ni omitir pruebas.              |
| BLOCKED | Persistencia, permisos operativos y aceptación clínica en DEV/QLTY                                                                                                                        | Falta sesión de prueba vigente; QLTY no respondió durante el preflight. No se acredita despliegue ni escritura clínica.                                                                                                  |

La [revisión terminológica de content](https://github.com/sihsalus/sihsalus-content/blob/main/docs/contracts/cred-clinical-completion.md)
se mantiene por separado: existencia de UUID, equivalencia clínica y lectura de
datos históricos son condiciones distintas. Las pruebas locales no las sustituyen.

Los seis resúmenes neonatales (nacimiento, embarazo y parto, atención inmediata,
evaluación cefalocaudal, alojamiento conjunto y lactancia) esperan la lectura
completa del historial antes de habilitar el registro. La consulta por nombre
incluye todas las páginas y versiones del formulario; una página fallida muestra
error y no habilita una creación como si no existiera historial. Un registro
existente ofrece **Editar**, conserva su UUID de atención y resuelve su formulario
original. Si ese formulario fue retirado o dejó de estar publicado, la edición
se bloquea explícitamente; no se sustituye por un esquema nuevo.

La actualización del resumen ocurre con la confirmación del form engine, sin
temporizadores al abrirlo. Un fallo de actualización queda visible y no reenvía
la escritura. Las pruebas de componentes cubren los seis consumidores, permisos,
consulta activa, carga, error, identidad de atención/formulario y confirmación.
No sustituyen guardar, recargar y editar contra el backend.

La tarjeta obstétrica heredada `labour-history-chart` se retiró de la configuración
neonatal por defecto: intentaba abrir `OBST-005` en la historia del niño.
`pregnancy-details-chart` conserva la captura perinatal CRED. Para configuraciones
externas, el lifecycle `neonatalRegisterChart` sigue disponible como alias de esa
misma captura. No se eliminan atenciones ni formularios históricos.

El selector de formularios espera la lectura de atenciones y de sus números de
control antes de ofrecer acciones. Si falla cualquiera de las dos consultas,
presenta el estado de error compartido y permite reintentar; un error no equivale
a un historial vacío. Reutiliza `FormsSelectorWorkspace`, `ErrorState` y los
controles Carbon existentes. Conserva el estado de formularios guardados durante
el reintento y reabre la atención del control seleccionado, sin tomar la de otro
control por ser más reciente. Las vistas de consulta pueden seguir mostrando el
historial disponible aunque falle la lectura de números de control.

Las pruebas de este selector usan respuestas REST sintéticas y verifican la
reapertura antes y después de recargar, los errores, la espera y los permisos.
La persistencia real, el inventario de widgets heredados y la aceptación por
formulario siguen en el
[issue #57](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/57).

El calendario y el inicio de control también esperan las lecturas necesarias.
Un error de paciente, historial, número de control o citas no genera una
recomendación como si el historial estuviera vacío. El workspace muestra el
estado de error compartido y permite reintentar la lectura del historial antes
de continuar, conservando los valores del formulario.

El historial y los números de control consumen todas las páginas REST mediante
`useOpenmrsFetchAll` de la plataforma. El límite de una respuesta no representa
el fin del historial; una página pendiente o fallida impide iniciar un control.
El campo de hora admite borrar y escribir un nuevo valor sin sustituirlo por la
hora actual durante la edición.

La resolución de formularios exige respuesta actual del servidor, UUID correcto
o una única coincidencia exacta por nombre, publicación confirmada y formulario
no retirado. Una búsqueda incompleta, ambigua o sin coincidencias muestra el
error existente; no abre el primer resultado aproximado ni un borrador. Estas
condiciones corresponden a la metadata servida por OpenMRS y no añaden reglas
clínicas a content.

Los resúmenes de consejería alimentaria y seguimiento nutricional leen el último
encounter activo de CRED-007 y CRED-008, respectivamente, con todas las páginas
REST. Sus campos pertenecen al mismo formulario, paciente y episodio; una obs
anulada o ausente no se sustituye por la de otro registro. CRED-007 muestra la
práctica revisada, consejería y acuerdos registrados. CRED-008 muestra la
clasificación, evolución y referencia registradas. Estos resúmenes no derivan
lactancia, consumo de suplementos ni cumplimiento del plan a partir de otros
formularios. `cred-nutrition-records.test.tsx` cubre esa separación, paginación,
errores y cambio de paciente; la aceptación visual requiere el recorrido QLTY.

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que el widget correspondiente lee los datos persistidos.
- Probar en QLTY el flujo end-to-end de CRED neonatal: abrir formulario, guardar, recargar la historia y confirmar que los widgets leen el encounter y las obs guardadas.
- Probar balance de líquidos, biometría, evaluación cefalocaudal, alojamiento conjunto y consejería de lactancia con datos sintéticos en DEV/QLTY autorizado y coordinado.
- Validar que los formularios de nutrición infantil, estimulación temprana y control de niño sano persistan con el `encounterType`, `formUuid` y conceptos esperados.
- Confirmar permisos de usuario para crear y editar formularios CRED en QLTY, no solo para renderizar los dashboards.
- Confirmar que todos los formularios guardados en un mismo control comparten `Número de control CRED` y que al reabrir el mismo día/consulta se conserva ese número.
- Mantener un set de pacientes de prueba para CRED con casos vacío, recién nacido, lactante y niño con controles previos.

## i18n/UI

Los componentes y el lanzador de formularios usan explícitamente el catálogo
`@sihsalus/esm-cred-app`, también dentro de slots de otros módulos. El estado
vacío reutiliza `EmptyState` con el nombre del dato; el catálogo compartido
construye el mensaje de ausencia una sola vez. Las pruebas con i18next real
cubren etiquetas, acciones, valores ausentes, estados de control y secciones
no disponibles en español e inglés bajo un namespace ajeno.

El catálogo inglés incluye las etiquetas neonatales y de reacciones adversas;
los formularios declarativos y los nombres de conceptos siguen perteneciendo
a content. La revisión clínica de esos textos no se sustituye con etiquetas
del frontend. El alcance pendiente y la aceptación del módulo se siguen en el
[issue #91](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/91).

- Ampliar el recorrido en QLTY a todos los workspaces y formularios sloteados.
- Acortar labels largos en tabs para evitar truncamiento visual; por ejemplo, evaluar `Consejería en lactancia materna` como `Lactancia`.

## TODO ya cubiertos en código

- Calendario CRED alineado a NTS 238: `cred-schedule-rules.ts` define las 27 edades ideales y `cred-control-intervals.ts` calcula el siguiente control desde la ultima atencion real.
- Selector CRED: `useCREDFormsForAgeGroup` ya convierte keys de `formsList` en objetos `Form` válidos para el selector.
- Traducciones base de dashboards: `dashboard-translations.test.ts` cubre keys principales como `neonatalCare`, `newbornVitals`, `wellChildCare` y `childNutrition`.

## Estado de la iteración clínica — 23/09/2026

[Frontend #1093](https://github.com/sihsalus/sihsalus-frontend/pull/1093) está integrado
en `main` desde `84f371aec`. El alta neonatal de
[content #241](https://github.com/sihsalus/sihsalus-content/pull/241) también está
integrada; corresponde al paquete 1.25.26. La corrección de límites de altitud de
CRED-001 1.2.1 proviene de
[content #240](https://github.com/sihsalus/sihsalus-content/pull/240).

La [documentación conjunta de CRED](https://github.com/sihsalus/sihsalus-content/blob/main/docs/contracts/cred-clinical-completion.md)
centraliza el estado de los seis issues, los SHA probados y los requisitos para
QLTY. En `0ce17cb9b` pasaron 290 pruebas CRED y 12 casos visuales locales; el CI del
PR pasó sus controles técnicos, con E2E omitido. Es evidencia de esa revisión,
no de persistencia, permisos operativos o despliegue del frontend integrado.

Siguen pendientes la persistencia de z/clasificación por indicador, el cálculo y
guardado de Hb ajustada y la captura íntegra de EDI (`CRED-009`), Huanca (`CRED-026`)
y M-CHAT-R/F (`CRED-010`). Se requieren conceptos OCL canónicos, versiones clínicas
aprobadas y documentación del permiso M-CHAT. Los casos de aceptación y la
coordinación de content antes del frontend están en el contrato conjunto.

## Curvas escolares y primer control neonatal

La fecha FHIR de nacimiento se interpreta como fecha de calendario mediante el
lector de fechas compartido. No se convierte a medianoche UTC: eso adelantaba
la edad mostrada un día en Lima y desplazaba la edad usada por las curvas.

Las curvas escolares reutilizan el componente Carbon de crecimiento para IMC/edad y
talla/edad, con referencias OMS 2007 de ambos sexos entre 61 y 228 meses. Los
parámetros LMS, procedencia y límites están en
[src/ui/growth-chart/data-sets/WhoReference2007/README.md](src/ui/growth-chart/data-sets/WhoReference2007/README.md).
El IMC exige peso y talla de la misma atención. La interpretación del gráfico es
referencial: no persiste nuevas observaciones ni sustituye una clasificación clínica.
Los conceptos y la persistencia estructurada del
[issue #58](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/58) siguen pendientes.

Para el primer control de un recién nacido, la lectura paginada de antecedentes
perinatales obtiene el lugar del parto de Embarazo y Parto y el alta del niño de
Datos del Nacimiento. Un parto institucional exige alta válida y espera 48 horas
exactas. Datos faltantes, ambiguos, anulados o un error de lectura no generan una
recomendación. No se toma el alta de otra hospitalización. El día 14 pertenece a la
ventana normativa del segundo control; el intervalo mínimo entre controles se
mantiene en siete días. El calendario ideal inicia su primera ventana antes de los
siete días y no fija el primer control a tres días del nacimiento.

Requiere el campo de alta opcional en content `(CRED) Detalles de Nacimiento` 1.2,
concepto Datetime `e911fe60-6d45-40c7-8d65-1ab93b3c77f4`. Todos los UUID están en
`neonatalConcepts`. La consulta adicional se limita al primer control mientras el
paciente está en período neonatal. La reanudación de controles conserva su número
y no aplica otra espera desde el alta. Partos domiciliarios documentados pueden
atenderse al conocerse el nacimiento; falta persistir esa notificación y validar los
registros retrospectivos y la captación tardía en QLTY. Estos límites mantienen
abierto el [issue #98](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/98).

La fecha de próximo tamizaje de anemia del widget es **orientativa**: se estima
con la última Hb y una banda de edad. No determina el calendario completo de
NTS 213 ni incorpora inicio/fin de suplementación, tratamiento o prematuridad.
La interfaz pide confirmar la fecha con el profesional; no añade reglas
clínicas ni cambia la Hb registrada para suplir ese contexto.

### Growth and development summary cards

The visible module name is “Crecimiento y desarrollo” / “Growth and development”.
Canonical translation keys, routes, workspace names and form identifiers remain unchanged.
The controls, nutrition follow-up and development follow-up cards use the shared native
`CardHeader` and Carbon structured lists, with module-local responsive styles. Recorded
values wrap without adding clinical interpretations; registration and appointment
actions retain their existing privilege and scheduling checks.

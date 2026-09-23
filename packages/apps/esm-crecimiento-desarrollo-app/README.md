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
- Crear/asignar privilegios OpenMRS para `app:hoja.clinica.cred.*`; en DEV no existen y solo el rol `System Developer` pasa los guards por bypass.
- Configurar `credScheduling.appointmentServiceUuid` con el servicio real de citas CRED; si queda vacío, la generación de citas debe permanecer oculta o mostrar error claro.
- Corregir edición vs creación en widgets que abren form engine con `encounterUuid: ''`; varios resúmenes todavía crean registros nuevos en vez de editar el encounter existente.
- Revisar `useCreateCarePlanAppointments`: hoy queda como helper TODO para planes de cuidado (madre gestante, CRED y vacunación), pero no está integrado como contrato estable.

Validado en DEV/OCL: `CRED-001` a `CRED-027`, `INMU-002-REPORTE ESAVI`, encounter type `vaccinationAdministration`, `consultationTime` = `Hora` (`2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4`), `CRED.perinatalConceptSetUuid` = `Antecedentes de Riesgo Perinatal` (`9dce2946-9fda-4d62-b68e-d62711801189`), `Número de control CRED` = `ce8b07e8-712f-406a-b44d-2fa69167f5ea` está instalado en DEV como concepto numérico, y psicoprofilaxis/riesgo obstétrico/causa probable de muerte usan `external_id` existentes. El TPED histórico tiene una definición frontend versionada de 88 hitos, pero su mapeo individual de conceptos sigue pendiente; ver `docs/clinical/test-peruano/CONCEPT-AUDIT.md`.

El componente `tped-reference-widget` muestra la matriz historica y el detalle de hitos en
la pestana Desarrollo. Es solo de consulta: no persiste observaciones, puntajes ni
clasificaciones.

## TODO QA/QLTY

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

## Curvas escolares y primer control neonatal

Las curvas escolares reutilizan el componente Carbon de crecimiento para IMC/edad y
talla/edad, con referencias OMS 2007 de ambos sexos entre 61 y 228 meses. Los
parámetros LMS, procedencia y límites están en
[src/ui/growth-chart/data-sets/WhoReference2007/README.md](src/ui/growth-chart/data-sets/WhoReference2007/README.md).
El IMC exige peso y talla de la misma atención. La interpretación del gráfico es
referencial: no persiste nuevas observaciones ni sustituye una clasificación clínica.
Los conceptos y la persistencia estructurada del issue #58 siguen pendientes.

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
abierto el issue #98.

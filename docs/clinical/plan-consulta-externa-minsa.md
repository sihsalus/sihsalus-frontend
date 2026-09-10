# Plan de alineamiento de Consulta Externa con el manual MINSA

**Estado:** propuesta para revisión funcional y clínica; implementación pendiente.
**Fecha:** 2026-09-10.
**Alcance de este cambio:** documentación del plan. No modifica formularios,
conceptos, permisos, datos clínicos ni configuración desplegada.

## Objetivo y fuente

Completar el recorrido de Consulta Externa sobre los módulos existentes de
SIH Salus, con coherencia entre captura, persistencia, lectura y documentos.

La referencia funcional es el [Manual de usuario de Consulta Externa, MINSA,
edición 2024, 35 páginas](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf).
Las páginas siguientes corresponden al contador del PDF:

| Páginas                                                                           | Referencia funcional                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [5–8](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=5)    | Citas pendientes y atendidas, historial y alertas.                                                                                                                             |
| [9–13](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=9)   | Identificación, antecedentes e historia clínica integrada.                                                                                                                     |
| [14–19](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=14) | Síntomas codificados, duración con unidad, cuidados paliativos, contexto reproductivo, funciones biológicas y evaluaciones regional, visual, mental y de desarrollo sexual.    |
| [20–23](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=20) | Diagnósticos P/D/R, medicamentos y exámenes asociados a diagnósticos; RAM y stock referencial.                                                                                 |
| [24–26](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=24) | Alta, citado, interconsulta, referencia, contrarreferencia y guardado. Hasta cuatro referencias, sin repetir diagnósticos ni UPS; establecimiento destino distinto del origen. |
| [27–35](https://www.minsa.gob.pe/sihce/manualess/MU_CONSULTA_EXTERNA.pdf#page=27) | Resumen, edición, documentos, FUA para SIS y registro de resultados.                                                                                                           |

Las decisiones de arquitectura y aceptación de este documento son propuestas
para SIH Salus. El manual describe una aplicación de 2024; no determina por sí
solo la vigencia normativa, las interfaces institucionales disponibles ni la
acreditación de este sistema. Las reglas clínicas y documentales deben
confirmarse con los responsables del establecimiento antes de implementarlas.

## Base de la revisión

- Frontend: `5bd044f0ceee705ca8270973ff3295c0c25398c3`, base de
  `origin/main` consultada el 2026-09-10.
- Content: `1b4b931f2a572fc31a32b3fa923aa4c478b43b77`, referencia local de
  `origin/main` consultada durante la investigación.
- Evidencia: lectura de código, documentación y esquemas. No se verificaron
  backend, contenido instalado, build desplegado ni recorridos en DEV/QLTY.
- Los cambios locales sin commit observados durante la investigación no forman
  parte de esta base ni de este PR. La implementación debe volver a contrastar
  las ramas y PRs vigentes antes de empezar.

| Área                  | Evidencia en la base revisada                                                                                                                                                                                                                     | Brecha o comprobación pendiente                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Captura               | [Anamnesis](../../packages/apps/esm-atencion-ambulatoria-app/src/anamnesis/anamnesis.ts) proyecta motivo, enfermedad actual y funciones biológicas.                                                                                               | Precisar qué datos requieren estructura adicional y cómo evolucionan los conceptos de texto existentes.                   |
| Examen                | [Examen físico](../../packages/apps/esm-atencion-ambulatoria-app/src/consulta-externa/notas-soap.component.tsx) muestra hallazgos generales/regionales y lectura objetiva histórica.                                                              | El esquema de content aún contiene secciones SOAP: comprobar la captura efectiva y coordinar la evolución del formulario. |
| Diagnóstico y órdenes | [Visit Notes](../../packages/apps/esm-patient-notes-app/README.md) persiste diagnósticos nativos; [Orders](../../packages/apps/esm-patient-orders-app/README.md) concentra la canasta.                                                            | Verificar la asociación codificada diagnóstico–orden de extremo a extremo y su lectura documental.                        |
| Operación             | [Citas](../../packages/apps/esm-appointments-app/README.md), [Libro de Atenciones](../../packages/apps/esm-care-logbook-app/README.md) e [Interconsultas](../../packages/apps/esm-interconsultas-app/README.md) tienen responsabilidades propias. | Coordinar el recorrido desde Consulta Externa y la recuperación de cierres parciales.                                     |
| Documentos            | El [contrato ambulatorio](../../packages/apps/esm-atencion-ambulatoria-app/README.md#resumen-de-atención-ambulatoria) ofrece resumen, indicaciones y emisión de Receta Única para la visita activa.                                               | Incorporar selección histórica y definir una reimpresión reproducible.                                                    |

Esquema de content consultado:
[`CE-SOAP-001-NOTA SOAP.json` en la revisión indicada](https://github.com/sihsalus/sihsalus-content/blob/1b4b931f2a572fc31a32b3fa923aa4c478b43b77/configuration/backend_configuration/ampathforms/CE-SOAP-001-NOTA%20SOAP.json).
Los nombres internos heredados no prueban por sí mismos un defecto: se conserva
su compatibilidad mientras se verifica qué campos permite registrar el esquema.

## Contratos de implementación

1. Mantener la identidad paciente–visita–encounter al leer y escribir. Usar el
   contrato de unicidad existente: cero coincidencias crea, una edita y más de
   una bloquea; las referencias conservan su carácter repetible.
2. Conservar diagnósticos y órdenes nativos. Visit Notes debe leer el contexto
   registrado por los otros formularios sin volver a guardar copias del mismo.
3. Definir en content los nuevos conceptos, datatypes y formularios; exponer
   sus identificadores configurables en `config-schema`. No cambiar el datatype
   de un concepto con registros existentes para adaptar un control de UI.
4. Mantener el orden operativo y los slots documentados del dashboard. Reutilizar
   componentes, constantes de workspace y dependencias declaradas. Los textos
   nuevos deben existir en `en.json` y `es.json`.
5. Mantener las comprobaciones de lectura, edición y autorización backend.
   Cambiar de pestaña o abrir un historial no debe iniciar otra visita.
6. Aplicar los [contratos de signos vitales y triaje](vitals-triage-encounter-contracts.md):
   una corrección requiere definir autoría, motivo y relación con el registro
   anterior. La ausencia de un dato no equivale a un hallazgo normal.
7. Reutilizar el [contrato de financiador/SIS](plan-alineamiento-seguros-sis.md)
   y los controles documentados de cada flujo. Este plan no cambia la
   advertencia clínica, los requisitos de llegada/triaje ni la elegibilidad FUA.

## Entregas y dependencias

Cada entrega de implementación debe tener un PR enfocado y actualizar el README
de sus paquetes cuando cambie un contrato. La primera entrega funcional agrupa
la preparación de la fase 1 y el alcance acordado de la fase 2.

### 1. Contrato clínico y matriz de campos — prioridad P0

**Responsables por función:** responsable clínico de Consulta Externa,
mantenedores de frontend y content; personas por asignar.

- Completar una matriz por campo: página de referencia, condición de aplicación,
  obligatoriedad, concepto/datatype, formulario, propietario de escritura,
  lectores, permiso y caso de aceptación.
- Clasificar cada requisito como existente, parcial, pendiente o dependiente de
  integración externa, con evidencia de la revisión exacta.
- Confirmar versiones instaladas y definir qué se crea, edita o consulta como
  histórico. Identificar migraciones y consumidores de los esquemas.
- Resolver el alcance de los campos condicionales y la representación de
  pendiente, no evaluado y hallazgo registrado, con revisión clínica.

**Criterio de salida:** cada campo incluido tiene un contrato verificable;
los pendientes tienen responsable y la entrega dependiente identificada.

### 2. Captura clínica coordinada — prioridad P0

**Propietarios:** `esm-atencion-ambulatoria-app`, content y motor de formularios
solo si el esquema exige una capacidad que el motor aún no soporta.
**Depende de:** fase 1.

- Implementar el alcance de captura definido en la matriz y reutilizar las
  vistas longitudinales de antecedentes.
- Versionar esquemas, lectores, resúmenes y exportaciones conjuntamente.
  Mantener los nombres estables y la lectura de registros anteriores.
- Al estructurar información antes textual, conservar el original como
  histórico; cualquier conversión exige reglas determinísticas.
- Evitar prellenados clínicos inferidos. Si se propone una acción colectiva
  de marcado, requiere diseño explícito y revisión clínica.
- Proteger cambios sin guardar al cerrar, cambiar de paciente o reemplazar un
  workspace. Confirmar la identidad antes del envío.

**Aceptación:** crear, recargar y editar conserva todos los datos incluidos;
los registros anteriores siguen legibles; doble clic, revalidación y timeout
no producen duplicados ni sobrescriben datos de otra consulta.

### 3. Trazabilidad del tratamiento — prioridad P1

**Propietarios:** `esm-patient-notes-app`, `esm-patient-orders-app`,
`esm-patient-medications-app`, `esm-patient-tests-app` y sus consumidores.
**Depende de:** fase 1 y del contrato clínico disponible.

- Verificar selección, payload, persistencia y recuperación de la asociación
  entre cada orden y el diagnóstico de la consulta.
- Determinar si el contrato REST permite la asociación requerida; si falta,
  coordinar su ampliación antes de prometerla desde un selector.
- Conservar posología, indicación, autor y estados de las órdenes al editar.
  Definir qué ocurre si se modifica un diagnóstico ya asociado.
- Reutilizar alergias, resultados y disponibilidad de medicamentos, mostrando
  la procedencia y el estado de consulta. Un fallo de inventario no acredita
  que el producto esté agotado.

**Aceptación:** el guardado y la recarga mantienen la relación y el detalle de
la orden; UI y documentos aplican las mismas reglas para órdenes anuladas,
sustituidas, suspendidas o vencidas.

### 4. Destino y cierre recuperable — prioridad P1

**Propietarios:** atención ambulatoria, patient chart, citas, colas e interconsultas.
**Depende de:** fases 1–3 para los datos y relaciones que vaya a verificar.

- Incorporar una revisión final con pendientes y accesos a las acciones que
  ya poseen cada flujo. Acordar qué impide finalizar y qué permite seguimiento.
- Delegar programación a Citas, solicitudes interprofesionales a Interconsultas
  y derivaciones a Referencia/Contrarreferencia. Registrar una fecha de control
  no debe presentarse como una reserva confirmada.
- Definir por escrito las transiciones y precondiciones de visita, cita y cola.
  Distinguir guardar un formulario, descartar un borrador y finalizar.
- Conservar evidencia de pasos confirmados cuando falle una operación posterior;
  reintentar únicamente lo pendiente y reconciliar respuestas ambiguas.
- Mantener la política offline existente por flujo. El cierre y las emisiones
  que necesiten autoridad del servidor deben quedar pendientes sin inventar
  confirmaciones locales.

**Aceptación:** un fallo parcial se explica y se recupera sin repetir escrituras.
La finalización no oculta trabajo pendiente ni desasocia registros clínicos.

### 5. Bandeja, historia y documentos — prioridad P1

**Propietarios:** atención ambulatoria, citas, Libro de Atenciones, patient chart,
FUA y backend documental cuando corresponda.
**Depende de:** contratos de las fases 1 y 4; fuentes clínicas de fases 2–3.

- Integrar accesos al trabajo pendiente y realizado sobre los recursos
  existentes, con filtros y paginación completos. No crear otro estado
  operativo mantenido solo por el navegador.
- Seleccionar explícitamente la visita histórica, manteniendo la visita activa.
  Una futura enmienda de una consulta finalizada requiere motivo, autoría y
  política de versiones; no habilitar edición silenciosa.
- Definir emisión, conservación y reimpresión por separado. La reimpresión debe
  recuperar el número, fecha y versión emitidos; no solicitar otro correlativo.
- Resolver institución, profesional y contexto clínico desde fuentes vinculadas
  al evento histórico. La ubicación actual de sesión no identifica por sí sola
  al establecimiento que atendió anteriormente.
- Conservar la distinción entre indicaciones informativas, receta, resumen y
  FUA. La firma digital sigue siendo una capacidad independiente por contratar.

**Aceptación:** dos visitas del mismo paciente no mezclan contenido; consultar
el histórico no crea ni cambia la visita activa; la reimpresión conserva la
identidad documental y permite reconocer una versión sustituida.

### 6. Integraciones y aceptación integral — prioridad P2 y validación transversal

**Responsables por función:** responsables institucionales de interoperabilidad,
backend/content, QA y referentes clínicos; personas por asignar.

- Inventariar capacidades disponibles, versiones, autenticación institucional,
  permisos, límites y comportamiento ante ausencia para FUA, REFCON,
  HISMINSA e historia entre establecimientos.
- Separar registro local, envío, recepción y aceptación externa. Exigir
  procedencia, identificadores estables, deduplicación y conciliación.
- Registrar como dependencias propias las alertas preventivas y el seguimiento
  longitudinal: confirmar reglas, fuentes, vigencia y responsables antes de
  presentar conclusiones clínicas.
- La captura local puede avanzar mientras las integraciones conservan un estado
  explícitamente pendiente. Habilitar cada conector solo cuando su contrato y
  pruebas estén disponibles.

**Aceptación:** cada integración habilitada tiene pruebas de éxito, rechazo,
reintento y conciliación. Su ausencia no se muestra como éxito ni como resultado
clínico negativo.

## Validación y evidencia

Este PR documenta una propuesta. Los comandos clínicos siguientes son requisitos
para las futuras entregas, no resultados de pruebas ejecutadas.

| Alcance                           | Validación prevista                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documento                         | `yarn prettier --check` sobre este archivo y `git diff --check origin/main...HEAD` después del commit.                                                                                           |
| Código de cada entrega            | `yarn verify:changed --base origin/main --head HEAD` después de crear sus commits; inspeccionar y ejecutar los scripts aplicables de lint, TypeScript, tests y build de paquetes y consumidores. |
| Workspaces, permisos o navegación | `yarn validate:workspaces`, `yarn validate:critical-route-privileges` y `yarn validate:react-router` según el cambio.                                                                            |
| Errores y contenido               | `yarn validate:error-exposure --base origin/main --head HEAD`; `yarn validate:concepts` únicamente en DEV/QLTY autorizado y coordinado.                                                          |
| E2E clínico                       | Ampliar las suites existentes, comprobar su inclusión en `e2e/tsconfig.json`, ejecutar `yarn typecheck:e2e` y el recorrido aplicable contra el build identificado.                               |

Usar como punto de partida
[`consulta-externa.spec.ts`](../../e2e/tests/consulta-externa.spec.ts) y
[`consulta-externa-acceptance.spec.ts`](../../e2e/tests/consulta-externa-acceptance.spec.ts).
La presencia de pestañas o metadatos no demuestra persistencia clínica.

Los casos integrales deben cubrir: llegada con y sin cita, identidad sin DNI,
consulta con y sin triaje, captura y recarga, órdenes mixtas, derivación, cierre,
histórico y documentos. Añadir roles de lectura y edición, acceso directo a
workspaces, sesión vencida, cambio de paciente, concurrencia, timeout,
desconexión y recuperación parcial.

Registrar por caso `PASSED`, `FAILED`, `NOT RUN` o `BLOCKED`, comando,
resultado, SHA y entorno. Las escrituras de prueba requieren autorización del
target, sesión y permisos verificados, datos sintéticos y estado recuperable de
limpieza hasta confirmar su terminación. Aplicar
[CONTRIBUTING.md](../../CONTRIBUTING.md) y el [contrato E2E](../../e2e/README.md).

## Coordinación y reversión

La implementación tiene impacto clínico alto aunque este PR documental sea de
riesgo bajo. Antes de cada entrega, asignar responsables y obtener revisión de
dominio sobre sus decisiones pendientes. Desplegar content compatible antes o
junto al consumidor mediante el procedimiento autorizado; una capacidad nueva
puede permanecer deshabilitada hasta verificar el entorno.

Detener la habilitación ante asociación con paciente/visita incorrectos,
duplicación, pérdida de datos, permisos insuficientes o divergencia documental.
Revertir UI/configuración a la versión compatible y conservar los registros
creados. Una reversión de frontend no revierte datos clínicos ni justifica
eliminarlos; las migraciones necesitan su propio procedimiento revisado.

Merge, publicación de imágenes, promoción y despliegue siguen el
[runbook de salida](../runbooks/frontend-go-live.md) y requieren autorización
específica. Aprobar este plan no equivale a completar sus implementaciones ni a
aceptar clínicamente un build.

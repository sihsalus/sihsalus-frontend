# esm-patient-search-app

App para búsqueda de pacientes y selección contextual.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 29733, Ley de Protección de Datos Personales (Perú).

## Límites funcionales

- Proporciona búsqueda compacta, overlay y página de resultados.
- Facilita la selección de paciente para otros módulos del portal.
- En selección contextual, los resultados ocultan las acciones clínicas ajenas al flujo; solo muestran acciones adicionales habilitadas explícitamente por la integración.
- En búsqueda standalone, la tarjeta solo navega a la hoja clínica con `app:hoja.clinica`. Sin ese privilegio permanece informativa y no navega por clic ni teclado; esto no deshabilita el callback de una selección contextual.
- No crea ni modifica el registro del paciente.
- No reemplaza módulos de admisión, listas o atención clínica.
- No debe depender de DNI, teléfono o código postal como pivotes principales para encontrar pacientes.

## Búsqueda avanzada e identidad

La búsqueda avanzada debe priorizar datos que sirven para confirmar identidad o ubicar una atención real:

- identificadores clínicos/administrativos y código temporal,
- nombre,
- sexo,
- edad exacta expresada en días, meses o años,
- existencia de una consulta activa,
- estado de verificación de identidad,
- estado de identificación en admisión.

El texto principal admite nombre o cualquier identificador/documento, por lo que no se duplican filtros separados de tipo y número de documento. La consulta se ejecuta desde 3 caracteres y se limita a 100 tanto en la cabecera como en la página completa.

Para evitar unidades ambiguas, la edad se captura como número más unidad: días (0–27), meses (0–23) o años (0–140, respetando los límites configurados). El filtro de consulta activa contrasta los resultados con las visitas actualmente activas de OpenMRS.

Los resultados se muestran de 10 en 10. Cada cambio de página devuelve el foco visual al inicio de los resultados para no dejar al usuario al final de la lista anterior.

`zipcode`, `postcode`, código postal y teléfono no se muestran como filtros avanzados por defecto. Son datos débiles para admisión/emergencia: pueden faltar, estar desactualizados, pertenecer a un responsable o generar falsos positivos. Solo deben habilitarse por configuración local si hay un caso administrativo específico.

El filtro de atributos textuales usa coincidencia parcial para facilitar búsquedas operativas, por ejemplo `SAMU` encuentra `SAMU Loreto`.

## Pacientes vistos recientemente

El acceso «Pacientes recientes» de la cabecera lleva a la lista «Pacientes vistos recientemente»;
también aparece al abrir el buscador compacto sin texto y en la búsqueda completa/tablet sin consulta.
Muestra las últimas 10 historias abiertas, sin duplicados y con la apertura más reciente primero.
El médico puede reabrir una historia mientras espera resultados; la lista no indica que haya resultados
pendientes ni sustituye el seguimiento clínico.

- `recently-viewed-patient-tracker` usa el slot existente `patient-header-slot` y exige la marca explícita
  `isPatientChart === true` que emite el chart, además del paciente FHIR cargado con el mismo UUID.
  El slot también se usa en formularios de citas y otros contextos: la ausencia de la marca o el valor
  `false` no registra ni reordena pacientes. Abrir la historia desde búsqueda, colas, visitas u otra entrada
  actualiza la misma lista; seleccionar un paciente en un formulario sin abrir la historia no lo registra.
- Se conserva la configuración `search.showRecentlySearchedPatients` por compatibilidad. Deshabilitarla
  oculta los accesos y detiene el registro. Se mantiene `app:hoja.clinica`; la cabecera conserva además
  el privilegio existente `app:opciones.busquedaPaciente`.
- Solo los UUID se mantienen en memoria de esta pestaña. No se escribe en `userProperties`, almacenamiento
  local, almacenamiento de sesión ni backend. Recargar la página, cerrar sesión, cambiar de cuenta,
  ubicación o permisos limpia el historial. El observador de sesión permanece activo aunque la búsqueda
  esté cerrada. No se importan listas históricas de `patientsVisited`.
- Los datos visibles se leen con `GET /ws/rest/v1/patient/{uuid}` bajo el contexto de acceso actual.
  Las claves de caché separan sesiones y orden de la lista; una lectura anterior no se conserva al cambiar
  de contexto. `403` y `404` omiten ese paciente; `401` y fallos de servidor muestran un error seguro.
  No requiere permisos para editar usuarios ni crea consultas, órdenes o datos clínicos.
- QA mínimo: abrir dos historias por entradas diferentes, reabrir la primera y confirmar orden/deduplicación;
  reabrir desde el listado con clic y teclado en escritorio/tablet; verificar lista vacía, fallo de lectura,
  flag apagado, acceso denegado y limpieza por cierre/cambio de sesión. Usar solo pacientes sintéticos en
  DEV/QLTY coordinado, verificando el SHA desplegado.

## Integraciones del buscador

- API de búsqueda y datos básicos del paciente.
- Componentes compactos, overlays y extensiones del buscador.
- Contexto compartido para interoperar con otros flujos del frontend.
- Person attributes definidos en `sihsalus-content` para pacientes no identificados y responsable.

## Offline contract

Patient synchronization succeeds only after the service worker accepts the patient route and a confirmed fresh
network response replaces the stable cache entry. A failed or canceled refresh preserves any previously cached
response and reports one fixed, non-sensitive failure; stale cache or locally queued data never count as a successful
refresh.

## Metadata esperada

| Uso                                     | Person attribute type                  |
| --------------------------------------- | -------------------------------------- |
| Estado de verificación civil            | `Estado de Verificación de Identidad`  |
| Estado administrativo de identificación | `Estado de Identificación en Admisión` |
| Barrio de residencia                    | `Barrio`                               |

Si alguno de estos person attribute types no existe en el backend objetivo, el filtro se oculta para no bloquear ni ensuciar la búsqueda.

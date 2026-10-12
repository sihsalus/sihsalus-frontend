# esm-active-visits-app

App encargada de la vista operativa de visitas activas.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Muestra y organiza el estado actual de las consultas activas del paciente.
- Consulta contexto clínico, resúmenes y widgets asociados a la atención en curso.
- No gestiona registro, facturación ni historial longitudinal completo.
- No reemplaza otros módulos clínicos; solo expone la capa operativa de visitas activas.

## Integraciones

- Frontend modular de OpenMRS/SIHSalus.
- APIs de visitas, encuentros y contexto del paciente.
- Componentes compartidos de navegación, estado y UI.

## Acreditaciones SIS pendientes

La acreditación verificada de una visita es un bundle indivisible: número de afiliación
`aac48226-d143-4274-80e0-264db4e368ee`, estado SIS
`5e13e902-2030-4f65-b9d5-9a4810c9a603` y fecha/hora de consulta
`e3a66f60-4abe-4948-b323-7c4935d8eb8a`. Una visita con estado vigente o no
vigente pero sin número o fecha continúa en la lista de pendientes; así, una escritura
parcial no desaparece después de recargar la aplicación.

`Sincronizar cobertura` reemplaza de forma explícita e idempotente los atributos
de esa misma visita con la afiliación actual de la persona y refresca la lista
con el estado persistido. Por eso debe usarse después de revisar la afiliación
cuando la visita conserva un estado pendiente o desactualizado. Los fallos
transitorios dejan la acción disponible para un nuevo intento. Si los datos
fuente siguen ausentes, incompletos o en conflicto, la UI no repite la operación
a ciegas: conserva `Acreditar` y ofrece `Revisar cobertura` únicamente a
usuarios con `app:opciones.registrarPaciente`.
Los tipos de atributo de financiador, número, estado y fecha —tanto de persona
como de visita— forman un contrato canónico compartido por Hoja Clínica,
Visitas Activas y FUA, exportado por `esm-patient-common-lib`. No se admiten
overrides locales de estos ocho UUID porque configurar solo un microfrontend
haría que los demás leyeran otra cobertura. `pendingSisAccreditations` conserva
únicamente la configuración operativa de conceptos SIS, estados pendientes y
tipo de identificador DNI.

La lista sigue siendo legible con `app:home.admision`, pero la mutación
`Sincronizar cobertura` solo aparece con el conjunto backend completo que usa
la operación: `Get People`, `Get Patients`, `Get Visits`, `Edit Visits` y `Get
Visit Attribute Types`. Este conjunto se publica como una capacidad compartida
para que Inicio de Consulta aplique el mismo preflight. `Acreditar` se evalúa por separado con
`app:opciones.registrarPaciente`, evitando que una capacidad implique la otra.
Si el servidor responde 401/403 pese al preflight, la sincronización se oculta durante esa sesión y la UI
deriva a un usuario autorizado; solo los fallos transitorios mantienen el reintento.
El nombre del paciente solo enlaza a la hoja clínica con `app:hoja.clinica`;
para el rol administrativo permanece como texto informativo.

## Mis atenciones

`/home/my-attentions` ofrece una consulta de solo lectura de las atenciones del
profesional de la sesión. Se registra en `homepage-dashboard-slot` y `app-menu-slot`
usando la navegación de Inicio; no añade un ordenamiento propio. Requiere los tres
privilegios `Get Encounters`, `Get Patients` y `Get Visits`, tanto en los accesos
como al cargar datos. `app:hoja.clinica` habilita por separado `Ver consulta` y
`Abrir historia`. El detalle reutiliza `VisitDetail` y muestra las atenciones
permitidas de la consulta completa, no solo las del profesional actual.

### Contrato backend

Requiere `GET /ws/rest/v1/emrapi/myattentions` del fork SIHSalus de EMR API
(`3.5.1-sihsalus.3-SNAPSHOT`, implementación `MyAttentionsController`,
`MyAttentionsQuery` y `HibernateMyAttentionsDao`). El número de versión por sí
solo no garantiza esta capacidad: se debe desplegar el cambio que incorpora
ese endpoint antes de aceptar el flujo. No se consulta FHIR ni se necesitan
UUIDs de contenido nuevos.

El servidor determina la persona del usuario autenticado y todos sus registros
`provider`, incluidos los retirados para conservar historia. La autoría proviene
de `encounter_provider`, no de `creator` ni de la ubicación de sesión. El cliente
no envía usuario, persona ni profesional seleccionable. El backend excluye
registros anulados y atenciones cuyo tipo no permita ver al usuario; agrupa por
consulta antes de paginar. Las atenciones sin consulta conservan una fila propia.
El contador y la fecha de último registro corresponden a las atenciones del
profesional que coinciden con el rango; el estado abierto/cerrado corresponde a
la consulta nativa, no implica que una atención esté terminada.

| Parámetro             | Semántica                                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`, `until`       | Instantes ISO: medianoche local inicial inclusiva y medianoche siguiente al día final exclusiva; máximo 366 días de duración, como valida `MyAttentionsQuery`. El filtro usa fecha de atención, no fecha de creación.        |
| `q`                   | Nombre o identificador, sin espacios exteriores. Máximo operativo de búsqueda de 100 unidades UTF-16, conforme a `MyAttentionsQuery.text`; no es un campo de persistencia. La UI conserva y rechaza el exceso sin truncarlo. |
| `status`              | `all`, `open`, `closed` o `unlinked`.                                                                                                                                                                                        |
| `startIndex`, `limit` | Desplazamiento y tamaño de página. UI: 10, 20 o 50 filas.                                                                                                                                                                    |

La respuesta contiene `hasProvider`, `results`, `totalCount`, `startIndex` y
`limit`. Cada resultado incluye paciente/identificador, consulta opcional, tipo,
ubicación, estado, cantidad y fecha del último registro. El backend ordena por
fecha más reciente y desempata de forma estable. SWR conserva respuestas solo
en memoria y separa la clave por UUID del usuario; no arrastra resultados al
cambiar filtros o usuario. No se habilita navegación offline.

### Estados y validación mínima

La UI distingue carga, lista vacía y falta de profesional vinculado. Una respuesta
fallida, incluido un endpoint ausente, muestra un error seguro y permite actualizar;
401/403 explican el problema de acceso sin presentar resultados cacheados como
historia válida. La sesión vencida oculta la pantalla y solicita iniciar sesión.

Las pruebas locales cubren fechas, límite de búsqueda, aislamiento de caché,
permisos permitidos/denegados, sesión vencida, carga/error/vacío, filtros,
paginación, registros sin consulta y acceso al detalle. El smoke visual local usa
Carbon y el componente real a 320, 420 y 1440 px, con respuestas sintéticas y el
detalle de consulta simulado; no valida el backend ni el shell desplegado.

Antes de aceptar en DEV/QLTY, comprobar el SHA desplegado de frontend y EMR API,
roles con/sin permisos, profesionales múltiples/retirados, encuentros realizados
por un profesional y registrados por otro usuario, consultas abiertas/cerradas,
atenciones sin consulta, límites de fecha, paginación y apertura del detalle y la
historia. Esa integración sigue pendiente mientras el endpoint no esté desplegado;
una lista local simulada no acredita el resultado clínico.

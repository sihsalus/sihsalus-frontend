# @sihsalus/esm-epidemiological-surveillance-app

Microfrontend OpenMRS 3 de vigilancia epidemiológica de SIH Salus, iteración 1 (RE 3.1). Registro de casos, alertas, curva epidémica, canal endémico y distribución demográfica.

Terminología: visita = consulta; encounter = atención.

## Alcance

Registro en **tres pasos**: paciente/atención de metaxénicas existente; clasificación y laboratorio; revisión y registro. Precarga valores inequívocos de observaciones/diagnósticos existentes. El servidor valida, asocia CIE-10, detecta duplicados y determina periodicidad y alertas. El registro completa esa misma atención; `CaseResult.uuid` es su UUID.

Cubre RF-01 a RF-07, RF-11 a RF-13, RF-17 a RF-19, RF-22, RF-26 y RF-27; usabilidad RNF-04, RNF-05 y RNF-06. No incluye edición de casos guardados, padrón de febriles, NOTI/Excel, mapas o clasificación automática de focos. La aceptación con metadatos e instancia real sigue pendiente.

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

DTO en [src/types.ts](src/types.ts); contrato completo en `epidemiologysurveillance/docs/rest-contract.md`. Administración de eventos/reglas y recálculo solo en backend.

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

El backend ofrece `GET /events`, `GET /events/{uuid}`, `PUT /events/{uuid}` y `DELETE /events/{uuid}`. La eliminación retira el evento conservando los casos históricos; la administración se realiza mediante API. `GET /healthcheck` devuelve `{"status":"UP"}` con una sesión autorizada.

## Registro y trabajo sin conexión

La solicitud lleva UUID nuevo estable para el intento, paciente, UUID de la atención de metaxénicas existente, proveedor de la sesión, localidad, evento, estado, gravedad, origen, especie opcional, inicio de síntomas y resultado opcional; no copia nombres/historia clínica.

Se usa exclusivamente la cola compartida del framework: `queueSynchronizationItem`, `getFullSynchronizationItemsFor`, `setupOfflineSync`, `deleteSynchronizationItem`. Tipo `sihsalus-epidemiological-surveillance-case-v1`. Persiste antes de enviar y elimina tras respuesta exitosa y comprobación de propietario. No añade localStorage clínico independiente.

- Sin red, usar pacientes/atenciones descargados previamente. **Pendiente de sincronización** no significa registro confirmado ni notificación.
- Reconexión: reintento con mismo UUID y usuario; el formulario conserva estado al cambiar conectividad.
- Rechazos por validación/permisos/duplicados permanecen para revisión. La pantalla muestra evento/fecha y permite revisar el mismo payload.
- Un UUID recibido con contenido distinto produce conflicto; no crea otro caso automáticamente.
- Aislamiento, cifrado y ciclo de vida dependen del perfil offline compartido. Las pruebas con mocks no certifican cifrado o sincronización real del dispositivo.

## Indicadores y usabilidad

Confirmados por inicio de síntomas. Edad al inicio, sexo, enfermedad, grupo etario, etnia, gestación y periodo; faltantes como desconocidos. Canal por años previos, sin fabricar ceros fuera de cobertura ni clasificar periodos incompletos como zonas definitivas.

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

QA DEV/QLTY pendiente: catálogo/privilegios reales; sospechoso, positivo confirmado y negativo descartado; persistencia tras recarga; duplicados; alertas grave/gestante/foco/umbrales; cotejo de conteos; desconexión/reconexión y cambio de cuenta; teclado y presentación móvil. Solo pacientes sintéticos. Resultados medidos y límites en `epidemiologysurveillance/docs/informe-pruebas-iteracion-1.md`.

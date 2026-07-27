# Revisión de preparación para producción — frontend — 2026-07-27

**Sistema:** SIHSALUS, Hospital II-1 Santa Clotilde, Napo, Maynas, Loreto.

**Base revisada:** `main` en `5d05d1b56bd2ab7ba3f87b76d07a466cba6477cc`.

**Ramas de correcciones:** `fix/production-readiness-p0-20260727` y
`fix/react-router-7-security-20260727` y
`fix/trivy-router-rsc-exception-20260727`, ya integradas; más
`fix/sanitize-stock-print-html-20260727`, candidata.

**Decisión actual:** **NO-GO para PROD**. El código pasa la validación técnica
local, pero faltan gates clínicos, de seguridad y de infraestructura que no se
pueden sustituir con pruebas unitarias.

## 1. Evidencia técnica reproducible

| Control                          | Resultado                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación reproducible         | `yarn install --immutable` exitoso.                                                                                                                                                                                 |
| Lint + TypeScript de 90 paquetes | 267/267 tareas exitosas desde un árbol limpio.                                                                                                                                                                      |
| Pruebas de 90 paquetes           | 112/112 tareas exitosas.                                                                                                                                                                                            |
| Tooling y contratos CI           | 65/65 pruebas exitosas.                                                                                                                                                                                             |
| TypeScript E2E raíz              | Exitoso.                                                                                                                                                                                                            |
| Workspaces clínicos              | Auditoría dura exitosa; los literales Workspace V2 resuelven.                                                                                                                                                       |
| RBAC de rutas críticas           | 14/14 aplicaciones críticas fallan cerradas en frontend.                                                                                                                                                            |
| Exposición de errores            | 69 exposiciones heredadas eliminadas en el alcance modificado; no se añadieron regresiones.                                                                                                                         |
| Build                            | 89/89 tareas exitosas.                                                                                                                                                                                              |
| SPA ensamblado                   | 66 módulos locales, 81 entradas de import map; artefacto válido.                                                                                                                                                    |
| Traducciones modificadas         | JSON válido en `en` y `es`.                                                                                                                                                                                         |
| DEV y QLTY vigentes              | Ambos entregan `53d2bd2d6361af005b0a487ff056e1414cbe6744`, digest `sha256:3514c23b8e8e10943263dcbe40cb3200c4bce78942e788f250ff67d9f0cfc07e`. El release de `5d05d1b5` se encuentra pendiente al cerrar esta revisión; no se considera desplegado hasta comprobar SHA y digest en `build-info.json`. |

El artefacto local ensamblado ocupa 148 MiB. El SHA y digest definitivos deben
provenir de CI después del PR y comprobarse en cada ambiente; nunca se infieren
desde el artefacto local.

## 2. Correcciones P0 incluidas

### Privacidad y sesión

- El contexto temporal de captura clínica rápida pasó de `localStorage` a
  `sessionStorage`.
- El cierre de sesión elimina datos clínicos temporales y claves heredadas,
  pero solo después de confirmar el logout o una sesión ya cerrada.
- Se eliminó la persistencia local innecesaria de consultorio/proveedor de
  colas.
- Los E2E ya no incluyen credenciales predeterminadas ni UUID/nombres de
  pacientes en código. Credenciales, UPSS y pacientes sintéticos son
  configuración obligatoria.
- La plantilla de entorno y la documentación de imágenes médicas dejaron de
  publicar credenciales reutilizables; cada entorno debe usar cuentas
  dedicadas y secretos externos al repositorio.

### Autorización

- Se añadieron guards fail-closed a las rutas, extensiones, modales y workspaces
  críticos de atención ambulatoria, registro, emergencia, laboratorio,
  dispensación, hospitalización, facturación, FUA, salud materna y stock.
- CI valida el inventario crítico automáticamente.
- Esta defensa evita ofrecer acciones no autorizadas, pero no reemplaza la
  autorización del backend.

### Errores y datos sensibles

- Los flujos modificados ya no muestran mensajes técnicos del backend,
  endpoints, CORS, objetos de error ni detalles internos a pacientes u
  operadores.
- El detalle técnico se conserva en logging contextual.
- Se corrigieron efectos secundarios que se ejecutaban durante render en
  stock y hospitalización.

### FUA

- El HTML retornado por el backend se trata como no confiable.
- Solo se admiten etiquetas y atributos estáticos necesarios para el
  documento; scripts, formularios, iframes, enlaces y recursos remotos se
  eliminan.
- Se inyecta una CSP local con `default-src 'none'`; solo se permiten estilos
  inline e imágenes/fuentes embebidas.
- El iframe usa sandbox total y `no-referrer`.
- Las vistas en pestaña separada anulan `window.opener` antes de navegar.
- Las pruebas cubren scripts, event handlers, formularios, iframes, enlaces y
  píxeles remotos.

### Impresión de stock

- Los campos interpolados en notas de ingreso, requisiciones y transferencias
  se tratan como no confiables; esto incluye observaciones, artículos, UPSS,
  títulos y logos configurables.
- El documento pasa por una lista estática y por DOMPurify. Se eliminan scripts,
  event handlers, formularios, iframes, enlaces, recursos remotos y SVG
  embebido mediante `data:`.
- La pestaña de impresión anula `window.opener` y el documento recibe una CSP
  local con scripts, red, formularios, frames, objetos y base URI bloqueados.
- Las pruebas conservan tablas, SVG estático y raster base64, y ejercitan los
  payloads ejecutables y el bloqueo de popups.

### Integridad de flujos

- Salud materna abre formularios por UUID exacto o nombre normalizado exacto;
  rechaza ambigüedad, formularios retirados y coincidencias parciales.
- El contrato de identificadores de registro respeta
  `PatientIdentifierType.locationBehavior`: omite UPSS para `NOT_USED`, exige
  UPSS para `REQUIRED` y preserva el comportamiento `OPTIONAL` en registro,
  edición, promoción, importación masiva y modo offline.
- Se eliminó una implementación prenatal CRED muerta y duplicada.
- Se añadieron validaciones de workspace, RBAC y exposición de errores a CI.
- Los fallos de exportación de caché Docker ya no invalidan una imagen que sí
  fue construida y publicada; build, push y escaneo siguen siendo obligatorios.

## 3. Bloqueadores para PROD

### P0 — deben cerrarse

1. **Gate clínico autenticado ausente.** El workflow E2E no tiene variables,
   credenciales ni pacientes sintéticos configurados y sus ejecuciones
   recientes fueron omitidas. No existe evidencia del SHA/digest de esta rama
   en QLTY para registro, citas, colas, SOAP/examen físico, odontograma,
   laboratorio, dispensación, FUA y hospitalización.
2. **Auditoría clínica server-side ausente y error público inseguro.**
   `GET /ws/rest/v1/sihsalus/audit` devuelve 404 en DEV y QLTY. La respuesta no
   autenticada expone una traza completa de Java/OpenMRS/Tomcat. Los logs del
   navegador no satisfacen trazabilidad clínica ni administrativa. Seguimiento:
   `sihsalus-core#95`.
3. **Candidato completo sin digest desplegado y validado.** La migración de
   Router ya está integrada en `main`, pero la sanitización de impresiones de
   stock continúa en rama candidata. No existe todavía un único SHA/digest con
   ambas correcciones desplegado en DEV y QLTY. La advisory alta
   `GHSA-qwww-vcr4-c8h2` afecta exclusivamente APIs RSC inestables, que este SPA
   no usa y que CI prohíbe explícitamente; la excepción de Trivy está limitada
   al PURL exacto, vence el 2026-08-31 y tiene pruebas negativas. La decisión y
   el riesgo residual están documentados en
   `2026-07-27-react-router-security.md`.
4. **Contrato de identificadores sin validación clínica.** El cambio del PR 676
   ya está en `main` y QLTY, pero todavía no fue probado con evidencia clínica.
   Deben cubrirse tipos `NOT_USED`, `REQUIRED`, `OPTIONAL` y metadato ausente en
   registro, edición, promoción, importación masiva y recuperación offline.
5. **Cabeceras de PROD no verificadas.** DEV y QLTY sí entregan HSTS, CSP,
   `X-Frame-Options`, protección MIME, referrer policy, permissions policy y
   no-cache para HTML. Falta demostrar la configuración efectiva de PROD y
   endurecer el `'unsafe-inline'` residual de `script-src`.
6. **Protección de ramas insuficiente.** El ruleset de `main` exige PR, pero no
   exige aprobación, resolución de conversaciones ni checks concretos. El
   repositorio de distribución tampoco exige PR ni checks. Por esta brecha, un
   cambio fallido —como el PR automatizado 652, que actualmente falla calidad e
   imagen SPA— puede fusionarse sin que GitHub lo impida.
7. **Promoción PROD no formalizada.** La automatización actual despliega solo
   DEV y QLTY, lo que evita una promoción accidental, pero no existe ambiente
   GitHub PROD con aprobación, comprobación de digest ni rollback automatizado.
   El primer pase a PROD no debe improvisarse con acceso directo al servidor.

### P1 — resolver o aceptar formalmente antes del go

- El CSS principal pesa 3.42 MiB y queda fuera del precache del service worker.
  La carga inicial combinada del app shell es aproximadamente 3.49 MiB.
- Hay chunks mayores a 1 MiB en odontología, CRED, salud materna, form engine y
  form builder; FUA y registro comparten un vendor de aproximadamente 910 KiB.
- El SPA ensamblado contiene 148 MiB, incluidos videos de 35 MiB y 8.7 MiB.
  Para conectividad amazónica se requiere presupuesto de transferencia,
  compresión y prueba con red degradada.
- `i18next-parser` está deprecado. Es dependencia de desarrollo, no runtime,
  pero debe migrarse a `i18next-cli`.
- Permanecen exposiciones de error heredadas fuera de los módulos modificados.
  El guard evita regresiones, pero la deuda debe reducirse por lotes,
  priorizando stock, form builder, cohort builder e imaging.
- Persisten advertencias históricas de accesibilidad, claves React y tests sin
  `act()`. No fallan CI hoy; deben tener backlog y responsable.

## 4. Gate clínico mínimo en QLTY

Ejecutar sobre el **mismo SHA y digest** candidatos, con datos exclusivamente
sintéticos y al menos estos perfiles: Admisión, Médico/Enfermería, Odontología,
Laboratorio, Farmacia, Caja/FUA, Administrador y solo lectura.

| Flujo           | Evidencia obligatoria                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Login/UPSS      | Listado real de UPSS, cambio de UPSS, refresh y logout sin datos clínicos residuales.                      |
| Registro        | DNI/CE/CNV, nacionalidad, fecha válida/estimada, domicilio Perú, duplicados, edición y `locationBehavior`. |
| Citas           | Crear/editar/cancelar; fechas imposibles bloqueadas; servicio y UPSS preservados.                          |
| Colas           | Atención con y sin cita, prioridad, consultorio, iniciar/finalizar atención y concurrencia.                |
| Historia        | Abrir paciente, iniciar/finalizar visita, SOAP/examen físico, diagnósticos, órdenes y notas.               |
| Odontología     | Carga del odontograma, registro/edición de hallazgos, persistencia y recarga.                              |
| Laboratorio     | Orden, toma/recepción, resultado, aprobación/rechazo y permisos negativos.                                 |
| Dispensación    | Receta, entrega parcial/completa, stock y denegación por rol.                                              |
| Hospitalización | Admitir, transferir, cambiar cama, notas y alta.                                                           |
| FUA/SIS         | Elegibilidad, generación/vista/PDF, contenido estático, permisos y trazabilidad.                           |
| Fallos          | Backend 401/403/404/500, red intermitente, recarga, atrás/adelante y sesión expirada.                      |

Cada caso debe guardar: actor/rol, hora, SHA, digest, UPSS, resultado, captura o
log sin PHI, y ticket de cualquier desviación.

## 5. Promoción y rollback

1. Mergear solo con CI, CodeQL, imagen SPA y escaneo verdes.
2. Publicar la imagen inmutable `sha-<commit>` y registrar su digest.
3. Promover **solo ese frontend** a DEV; comprobar `build-info.json`.
4. Promover el mismo digest a QLTY y ejecutar la matriz anterior.
5. Obtener aprobación funcional y de seguridad.
6. Promover el mismo digest a PROD sin reconstruir ni actualizar otros
   servicios.
7. Conservar el digest anterior y el comando probado de rollback.
8. Verificar tras promoción: login, UPSS, búsqueda de paciente, chart,
   odontograma, citas/colas, consola, 404 de chunks y latencia.
9. Ante regresión clínica, pérdida de autorización, datos incorrectos o chunks
   404: rollback inmediato del frontend y apertura de incidente.

## 6. Criterio de salida

La etiqueta “listo para producción” solo es válida cuando:

- todos los P0 están cerrados;
- CI y escaneo corresponden al SHA/digest exactos;
- la matriz clínica QLTY está firmada;
- no se usaron pacientes reales en E2E;
- observabilidad y auditoría server-side están operativas;
- rollback fue ensayado;
- los P1 tienen corrección o aceptación explícita con responsable y fecha.

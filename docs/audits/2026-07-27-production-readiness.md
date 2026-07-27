# Revisión de preparación para producción — frontend — 2026-07-27

**Sistema:** SIHSALUS, Hospital II-1 Santa Clotilde, Napo, Maynas, Loreto.

**Base revisada:** `main` en `ad7569d6c388b5d8e32f4bf9219d2a6383822efc`.

**Rama de correcciones:** `fix/production-readiness-p0-20260727`.

**Decisión actual:** **NO-GO para PROD**. El código pasa la validación técnica
local, pero faltan gates clínicos, de seguridad y de infraestructura que no se
pueden sustituir con pruebas unitarias.

## 1. Evidencia técnica reproducible

| Control                          | Resultado                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación reproducible         | `yarn install --immutable` exitoso.                                                                                                                                                                                 |
| Lint + TypeScript de 90 paquetes | 267/267 tareas exitosas desde un árbol limpio.                                                                                                                                                                      |
| Pruebas de 90 paquetes           | 112/112 tareas exitosas.                                                                                                                                                                                            |
| Tooling y contratos CI           | 60/60 pruebas exitosas.                                                                                                                                                                                             |
| TypeScript E2E raíz              | Exitoso.                                                                                                                                                                                                            |
| Workspaces clínicos              | Auditoría dura exitosa; los literales Workspace V2 resuelven.                                                                                                                                                       |
| RBAC de rutas críticas           | 14/14 aplicaciones críticas fallan cerradas en frontend.                                                                                                                                                            |
| Exposición de errores            | 69 exposiciones heredadas eliminadas en el alcance modificado; no se añadieron regresiones.                                                                                                                         |
| Build                            | 89/89 tareas exitosas.                                                                                                                                                                                              |
| SPA ensamblado                   | 66 módulos locales, 81 entradas de import map; artefacto válido.                                                                                                                                                    |
| Traducciones modificadas         | JSON válido en `en` y `es`.                                                                                                                                                                                         |
| DEV y QLTY vigentes              | El release anterior de `main`, digest `sha256:b88c6f993491f13990bac98338f20565d16b1d5f8362efd623e58c23be1ca15a`, se desplegó exitosamente en ambos ambientes. La rama de esta auditoría todavía no está desplegada. |

El artefacto local ensamblado ocupa 148 MiB. El `build-info.json` local conserva
el SHA base porque las correcciones aún no tienen commit; el SHA y digest
definitivos deben provenir de CI después del PR, nunca de este artefacto local.

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

### Integridad de flujos

- Salud materna abre formularios por UUID exacto o nombre normalizado exacto;
  rechaza ambigüedad, formularios retirados y coincidencias parciales.
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
2. **Auditoría clínica server-side ausente.** En la última revisión autenticada
   de QLTY, `GET /ws/rest/v1/sihsalus/audit` devolvió 404. Los logs del navegador
   no satisfacen trazabilidad clínica ni administrativa.
3. **Tres alertas moderadas de runtime.** `react-router`/`react-router-dom`
   6.30.4 mantienen Dependabot 140, 141 y 142, incluyendo open redirect/XSS.
   La corrección requiere migrar coherentemente a 7.18.0 y validar navegación
   clínica; está planificada en el issue 669.
4. **Contrato de identificadores pendiente.** El PR 676 está verde y mergeable,
   pero todavía no está en `main`. Evita enviar una UPSS en identificadores
   cuyo `PatientIdentifierType.locationBehavior` es `NOT_USED` y falla cerrado
   ante metadato desconocido.
5. **Cabeceras del proxy no verificadas.** La imagen de release es un
   `secure-init`; el nginx efectivo pertenece al despliegue de distribución.
   Deben verificarse HSTS, CSP, `frame-ancestors`, protección MIME, referrer
   policy y permisos en el endpoint real. El `nginx.spa.conf` de este repo no
   demuestra la configuración de DEV/QLTY/PROD.
6. **La rama corregida no tiene digest desplegado.** No se permite promover el
   digest anterior de `main` como si incluyera estas correcciones.

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

- los seis P0 están cerrados;
- CI y escaneo corresponden al SHA/digest exactos;
- la matriz clínica QLTY está firmada;
- no se usaron pacientes reales en E2E;
- observabilidad y auditoría server-side están operativas;
- rollback fue ensayado;
- los P1 tienen corrección o aceptación explícita con responsable y fecha.

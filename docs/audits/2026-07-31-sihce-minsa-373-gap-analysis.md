# Análisis de brechas para acreditación SIHCE MINSA

**Fecha de corte:** 31 de julio de 2026

**Sistema:** SIHSALUS — Hospital II-1 Santa Clotilde, Napo, Maynas, Loreto

**Base técnica revisada:** `main` en `2aa7fcc9d234a46b92875a85e2c848b3dacef44e`
**Rama de mitigaciones frontend:** `fix/audit-trail-integrity-20260731`

**Alcance inspeccionado:** código y documentación del repositorio frontend, más
comprobaciones HTTP puntuales documentadas de DEV/QLTY. No se auditó integralmente
el código backend, PKI, almacenamiento, copias de seguridad ni la red RENHICE; en
esos dominios el estado se expresa como `no evidenciado en el alcance revisado`.

## 1. Decisión

**NO-GO para declarar el sistema acreditable o listo para producción clínica.**

El frontend contiene controles útiles y esta revisión añade mitigaciones concretas,
pero la acreditación exige cumplimiento documental y funcional completo. Una guarda
visual, un formulario o una prueba unitaria no sustituyen autorización server-side,
registros inmutables, firma digital, auditoría protegida, integración RENHICE ni una
prueba funcional in situ.

Este documento es una evaluación técnica para orientar el cierre de brechas; no es
una certificación ni un dictamen legal del MINSA, OGTI o la Autoridad Nacional de
Protección de Datos Personales.

## 2. Normativa principal y complementaria identificada

- La [RM N.° 164-2025-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/6551375-164-2025-minsa)
  aprueba la **Directiva Administrativa N.° 373-MINSA/OGTI-2025**, que establece el
  proceso de acreditación de los SIHCE. Aunque el nombre físico del PDF entregado
  contiene `2024`, la resolución publicada y el documento firmado corresponden a
  2025.
- La [RM N.° 188-2026-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/7845808-188-2026-minsa)
  amplía **hasta por** doce meses adicionales únicamente los plazos del numeral 5.10
  para iniciar la acreditación y del numeral 8.1 para adecuar historias informatizadas,
  implementar el SIHCE y acreditarlo. No modifica requisitos ni puntajes de los anexos.
- El [DS N.° 020-2025-SA](https://www.gob.pe/institucion/minsa/normas-legales/7479922-020-2025-sa)
  modifica el Reglamento de la Ley N.° 30024 sobre el RENHICE.
- El tratamiento de datos también debe contrastarse con el
  [DS N.° 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus),
  Reglamento de la Ley N.° 29733, y con la
  [RM N.° 688-2020-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/1133776-688-2020-),
  que aprueba la Directiva Administrativa N.° 294-MINSA/2020/OGTI para el tratamiento
  de datos personales relacionados con la salud.

La matriz extraída de los anexos está versionada en
`packages/apps/esm-care-logbook-app/accreditation/requerimientos_acreditacion_SIHCE_MINSA_373-2025.csv`.
Debe mantenerse indexada por los códigos `DV`, `N0.GBL`, `N0INFREG`, `N0AUTE` y
`N0COM`, porque la numeración RBA presenta inconsistencias editoriales internas.

Asuntos que requieren consulta formal a OGTI antes de cerrar la matriz:

- `DV20`/`DV22` mencionan vigencias mínimas de ocho meses desde la solicitud, mientras
  la explicación de firma digital menciona derecho de uso por un año posterior al
  inicio del proceso;
- en el Anexo 10 la fila de inmunización no muestra una `X` visible y aparecen dos
  columnas tituladas “Farmacia”; no deben completarse por inferencia;
- el Anexo 12 puntúa las tres capacidades de firma, aunque otra disposición admite
  temporalmente usuario/contraseña mientras no se implemente firma digital.

## 3. Qué exige la acreditación

1. El Perfil Funcional Global se evalúa antes de los perfiles específicos.
2. La fase documental y la fase funcional deben aprobarse completamente.
3. La verificación incluye ambiente de prueba, comprobación in situ y pruebas contra
   el ambiente controlado del RENHICE; no se acredita con capturas del frontend.
4. El Anexo 9 contiene 17 criterios globales obligatorios con gradación binaria.
5. El Anexo 11 exige el ciclo de vida íntegro de los registros y alcanza aprobación
   solo con 92/92 puntos.
6. El Anexo 12 exige 24/24 puntos para autorizaciones, información sensible e
   intercambio RENHICE.
7. Los formatos aplicables del Anexo 10 deben persistir con autoría, integridad y
   firma digital. Mostrar un formulario no acredita el registro.

## 4. Perfil Funcional Global — estado técnico

Los estados siguientes significan evidencia técnica localizada, no una calificación
oficial. `No evidenciado` no afirma que el control sea imposible; indica que no se
encontró prueba suficiente en código, configuración o ambientes revisados.

| Código | Control obligatorio | Estado | Brecha principal |
| --- | --- | --- | --- |
| `N0.GBL.001` | Resumen de HCE para RENHICE | No evidenciado | No se encontró generación, validación ni transmisión del resumen RENHICE. |
| `N0.GBL.002` | Informes clínicos y administrativos estructurados | Parcial | Existen reportes aislados; falta inventario completo, estructura normativa y evidencia SETI-IPRESS. La firma se evalúa en los documentos HCE aplicables. |
| `N0.GBL.003` | Integración y sincronización temporal | Parcial | Hay REST/FHIR/OpenMRS, pero no evidencia E2E de episodios, relojes sincronizados ni interoperabilidad RENHICE. |
| `N0.GBL.004` | Autenticación robusta | Parcial | OpenMRS autentica usuarios; faltan evidencias de políticas, bloqueo, recuperación segura y certificado digital del profesional de salud. |
| `N0.GBL.005` | Permisos por identidad, rol y/o contexto | Parcial crítico | Hay privilegios frontend, pero no se demostró una política server-side que aplique los contextos definidos por la práctica, política y ley, como tiempo, ubicación, asignación, consentimiento o autorización. |
| `N0.GBL.006` | Aplicación efectiva del control de acceso | Parcial crítico | Las rutas críticas fallan cerradas en frontend; debe demostrarse rechazo equivalente en cada API backend. |
| `N0.GBL.007` | Acceso del paciente o representante | No evidenciado | No se encontró portal o flujo verificable de acceso del titular/representante. |
| `N0.GBL.008` | Firma digital y no repudio | No evidenciado — P0 | Los formularios guardan encuentros ordinarios; no hay documento inmutable, certificado, sello de tiempo ni verificación. |
| `N0.GBL.009` | Intercambio seguro y cifrado | Parcial | HTTPS y cabeceras reducen riesgo; falta evidencia del canal MINSA/RENHICE y su operación controlada. |
| `N0.GBL.010` | Privacidad y confidencialidad | Parcial crítico | Hay RBAC y sanitización; persisten PHI offline, falta autorización contextual y prueba de purga/retención. |
| `N0.GBL.011` | Auditoría protegida | No evidenciado en el alcance revisado — P0 | El cliente casi no instrumentaba eventos y el endpoint propuesto `/ws/rest/v1/sihsalus/audit` respondió 404. Falta demostrar una bitácora protegida, trazable e inalterable frente a actores no autorizados. |
| `N0.GBL.012` | Terminología estándar | Parcial | Se usan CIE/conceptos OpenMRS en algunos módulos; otros guardan texto libre. Falta matriz por perfil. |
| `N0.GBL.013` | Versionado histórico de terminologías | No evidenciado | No se demostró conservación de versión, código original, mapeo y traducción. |
| `N0.GBL.014` | Integración basada en estándares | Parcial | FHIR está presente, pero no se demostró el contrato completo exigido para intercambio. |
| `N0.GBL.015` | Reglas clínicas y administrativas | Parcial crítico | `main` aceptaba valores imposibles en signos vitales; esta rama añade límites frontend, pero faltan reglas server-side equivalentes. |
| `N0.GBL.016` | Respaldo y recuperación total | No evidenciado — P0 | No se aportó prueba de restauración completa a un punto temporal ni ensayo documentado. RPO/RTO deben definirse como controles operativos internos. |
| `N0.GBL.017` | Ayuda contextual configurable | Parcial | Hay ayuda puntual; falta cobertura trazable de todas las funciones acreditadas. |

No se asigna un puntaje global provisional: la Directiva exige evidencia funcional y
documental que este repositorio por sí solo no puede demostrar.

## 5. Brechas transversales de mayor riesgo

### P0 — bloquean acreditación y producción clínica

| Brecha | Evidencia observada | Cierre requerido | Propietario principal |
| --- | --- | --- | --- |
| Auditoría clínica íntegra | Solo se registraban errores no controlados; búsquedas, vistas, escrituras, exportaciones e impresiones no estaban instrumentadas. El endpoint configurado respondió 404. | Catálogo de eventos; instrumentación frontend; endpoint autenticado; bitácora protegida e inalterable con integridad, reloj confiable, retención, consulta restringida y alertas. | Backend + frontend + seguridad |
| Autorización contextual | El privilegio `app:hoja.clinica` habilita el chart, pero no demuestra los contextos asistenciales definidos por la política de la IPRESS. | Decisión server-side para identidad, rol y contextos aplicables. En grave riesgo para vida/salud y si el paciente no puede expresar voluntad, limitar el acceso de emergencia sin autorización a información clínica básica; registrar y auditar el uso. | Backend + gobierno clínico |
| Firma digital/no repudio | Las notas muestran datos del profesional, pero guardan encuentros sin evidencia criptográfica. | Documento inmutable, hash, certificado acreditado, sello de tiempo, validación, revocación y código/URL verificable. Cofirma solo cuando el perfil y rol aplicable la exijan. | Backend + PKI + frontend |
| Enmiendas inmutables | La edición de notas actualiza el encuentro y elimina/recrea diagnósticos; no hay motivo ni comparación de versiones. | Nunca sobrescribir el original; guardar valor previo/nuevo, autor, motivo, tiempos, estado y firma; transacción y control de concurrencia. | Backend + frontend |
| Autoría clínica | Emergencia y odontograma crean registros sin proveedor/rol/ubicación completos; odontograma puede cambiar la fecha original al editar. | Exigir y validar profesional, rol, UPSS, ubicación física, visita, fecha clínica y fecha de registro; preservar autor y origen. | Frontend + backend |
| Valores clínicos imposibles | `main` aceptaba PA sistólica `1000` y SpO₂ `200`; esta rama lo bloquea solo en frontend. | Bloquear únicamente límites fisiológicamente imposibles también en backend; advertir, sin impedir, valores extremos plausibles; prueba por edad cuando corresponda. | Clínica + frontend + backend |
| PHI offline | IndexedDB puede conservar formularios, observaciones, diagnósticos, órdenes y pacientes; logout no prueba purga integral. | Decisión formal de modo offline, cifrado gestionado, segregación por usuario, revalidación al sincronizar, retención mínima, purga y borrado remoto. | Arquitectura + seguridad |
| Consentimiento y RENHICE | No se encontró modelo general versionado de consentimiento/autorización ni flujo RENHICE. | Documento firmado, alcance, finalidad, representante, vigencia/revocación, datos sensibles, respuesta RENHICE y evento de divulgación. | Backend + legal + frontend |
| Continuidad | No hay evidencia reproducible de backup/restauración y conservación legal. | Política, objetivos internos RPO/RTO, copias protegidas, restauración ensayada, legal hold y evidencia firmada. | Infraestructura + seguridad |

### P1 — alto riesgo

- Exportaciones de citas y libro de atención contienen PHI sin privilegio específico,
  minimización ni evento de auditoría.
- Emergencia guarda diagnóstico, tratamiento y exámenes como textos libres y puede
  cerrar cola/visita; faltan CIE, órdenes, evolución y disposición estructuradas.
- El odontograma no adjunta de forma consistente proveedor, rol, ubicación y visita.
- Form Builder y Open Concept Lab requieren guardas administrativas completas o
  exclusión del ensamblado productivo.
- Errores heredados todavía pueden mostrar `error.message` o respuestas técnicas.
- Sticky notes carece de clasificación formal, autoría clínica completa y ciclo de
  corrección/eliminación auditable.
- Falta evidenciar el compromiso de confidencialidad firmado por todas las personas
  usuarias del SIHCE, requerido por `N0.GBL.010`.
- Faltan controles demostrados de concurrencia, versión e idempotencia en escrituras
  clínicas relevantes; `ETag`/`If-Match` son mecanismos recomendados, no tecnologías
  prescritas literalmente por la Directiva.
- La colegiatura se descubre por nombres localizados de atributos; debe resolverse
  por UUID configurado y validarse contra fuente autorizada.
- Cohort Builder permite edades hasta 200 y rangos de nacimiento futuros, antiguos o
  invertidos sin schema de dominio; debe reutilizar el contrato demográfico 0–140.

La captura antigua separada `DD/MM/YYYY` de búsqueda avanzada ya no existe en el
release `2aa7fcc9`. Registro valida fecha civil, futuro y límite de 140 años mediante
la utilidad compartida; citas usa búsqueda compacta y selección para colas usa el
schema compartido. Si DEV/QLTY muestran todavía esos campos, el bundle/import map o
la caché no corresponde al SHA desplegado.

## 6. Mitigaciones implementadas en esta rama

Estas medidas reducen exposición, pero **no convierten el sistema en acreditado**:

1. Se verificó el guard runtime `RequireClinicalChartAccess`, que exige
   `app:hoja.clinica` antes de renderizar el chart. La excepción del validador queda
   documentada porque `PageDefinition` no admite privilegios en runtime; declarar el
   campo solo en `routes.json` daría una falsa sensación de seguridad.
2. La apertura del chart distingue acceso exitoso, carga fallida y acceso denegado.
   Usa el UUID confirmado/validado y descarta el texto libre de la ruta; el logger añade
   usuario, sesión, timestamp y UUID de ubicación de sesión. Esa ubicación no se
   presume UPSS. No se envían nombres ni datos demográficos en el evento.
3. El limitador del logger encola en vez de descartar por tasa y los fallos HTTP se
   reintentan con backoff exponencial, jitter y tope de un minuto. La cola local sigue
   siendo acotada y no sustituye la bitácora server-side.
4. El wrapper legacy de HTML Form Entry valida `origin` y `source` antes de aceptar
   el mensaje que cierra el workspace y limita el referrer a mismo origen.
5. Signos vitales separa rangos clínicos confirmables de límites duros de entrada:
   PA `1000` y SpO₂ `200` ya no pueden guardarse ni con doble confirmación, mientras
   extremos plausibles permanecen registrables con advertencia.
6. Se oculta el filtro avanzado de las listas de colas porque su botón “Aplicar” era
   un no-op y mostraba límites de edad contradictorios. Debe reaparecer solo cuando
   filtre realmente con el contrato 0–140 y valide inicio menor o igual que fin.
7. Las pruebas cubren guard de chart, evento mínimo, ubicación de sesión,
   cola/reintento, cambio de usuario, mensajes de iframe no confiables y límites de
   signos vitales.

Riesgo residual inmediato: hasta que exista el endpoint de auditoría server-side, los
eventos se acumularán localmente y la cola acotada no constituye una bitácora legal.
El desborde ya emite una señal operacional, pero todavía evacua eventos antiguos. La
exclusión mutua funciona por pestaña; el backend debe deduplicar por `event.id` y
validar usuario/sesión contra la petición autenticada para cubrir múltiples pestañas.

## 7. Infraestructura de registros — Anexo 11

El Anexo 11 es el mayor gap estructural. Su cierre necesita como mínimo:

- creación con paciente, autor, módulo, fecha clínica y fecha de registro;
- firma vinculada al contenido estructurado y no estructurado;
- enmienda sin sobrescritura, conservando original y cada revisión;
- auditoría de creación, enmienda, visualización, salida y eliminación; la descripción
  de extracción también exige trazabilidad, aunque la capacidad de extracción es su
  criterio puntuable;
- conservación del código original y de cada traducción/mapeo terminológico;
- fusión lógica de duplicados sin destrucción de entradas;
- retención legal, legal hold e inalterabilidad verificable;
- aviso de estado pendiente o incompleto y timestamps de apertura, actualización,
  firma y cierre oficial; estados adicionales como borrador son una decisión de diseño
  o exigencia de perfiles específicos;
- reglas de completitud y oportunidad configurables.

La instrumentación de apertura añadida en esta rama cubre solo una fracción de la
auditoría de visualización; no cubre el resto del ciclo de vida.

## 8. RENHICE — Anexo 12

No se encontró evidencia suficiente para los doce criterios obligatorios. El cierre
debe demostrar 24/24 puntos e incluir:

- autorización firmada para envío de información;
- autorización firmada para acceso por un profesional;
- capacidades separadas de firma digital, firma electrónica con contraseña RENHICE y
  firma electrónica con contraseña SIHCE; la lectura literal puntúa las tres y la
  tensión con disposiciones transitorias debe consultarse a OGTI;
- envío de la autorización y conservación de la respuesta;
- preferencias y determinación de información sensible por episodio. La información
  sensible producida por la propia IPRESS puede visualizarse sin una nueva autorización
  RENHICE; la generada por otra IPRESS requiere autorización expresa previa;
- auditoría de cada divulgación;
- sincronización del estado y fecha de sensibilidad;
- conexión VPN u otro canal indicado por MINSA;
- transmisión basada en autorización y recepción verificable;
- envío máximo dentro de 24 horas del cierre ambulatorio, de emergencia o cirugía
  ambulatoria, o dentro de 24 horas del egreso hospitalario; no enviar si el paciente
  no está identificado y conservar el historial de actualizaciones posteriores;
- formatos de autorización apropiados para paciente, tutor/padre adoptivo y
  adolescente, incluido asentimiento cuando corresponda.

Una casilla en el frontend no satisface estos criterios si no existe documento
versionado, firmado, trazable y vinculado a la respuesta del RENHICE.

## 9. Plan de cierre y criterios de salida

### Fase 0 — contención frontend

- Integrar las mitigaciones de esta rama con CI verde.
- Replicar en backend los límites de signos vitales y aprobar sus envolventes con
  gobernanza clínica local.
- Instrumentar de forma mínima las exportaciones e impresiones, sin incluir PHI en
  metadata de auditoría.
- Definir privilegios separados para exportar, administrar formularios y ejecutar
  acciones destructivas.

**Salida:** regresiones unitarias, TypeScript, lint, route validator y build verdes.

### Fase 1 — núcleo de seguridad clínica

- Implementar endpoint y almacén de auditoría protegido, trazable e inalterable frente
  a actores no autorizados.
- Implementar autorización contextual server-side y acceso de emergencia.
- Diseñar registro versionado/enmiendas, concurrencia e idempotencia.
- Completar atribución profesional y contextual en todos los encuentros.
- Resolver política y protección de PHI offline.

**Salida:** pruebas negativas por rol/contexto, auditoría consultable e inmutable,
pruebas de concurrencia y amenaza documentadas.

### Fase 2 — validez legal e interoperabilidad

- Integrar firma digital acreditada y verificación documental.
- Implementar consentimiento, información sensible y flujo RENHICE.
- Versionar IEDS, CPMS, CIE, productos DIGEMID/ATC/DCI, UPS y profesionales.
- Documentar modelo por episodio y contratos de interoperabilidad.

**Salida:** documentos firmados verificables, cumplimiento probado de la ventana de
24 horas y pruebas controladas RENHICE.

### Fase 3 — perfiles funcionales

- Cerrar matrices de Admisión, Consulta Externa, Emergencia, Hospitalización,
  Farmacia, Laboratorio, Odontoestomatología y demás perfiles aplicables.
- Garantizar cada formato aplicable del Anexo 10 con persistencia, autoría, estado,
  firma, corrección y recuperación.

**Salida:** 100% de cada perfil aplicable, validado con casos sintéticos y actores por
rol.

### Fase 4 — expediente de acreditación y operación

- Completar RENIPRESS/categorización, bancos de datos, licencias, convenios,
  inventario de equipos, SGSI, compromisos de confidencialidad y manuales.
- Ensayar backup/restauración y rollback.
- Ejecutar E2E autenticado sobre el mismo SHA y digest en QLTY.
- Preparar ambiente réplica, visita in situ y evidencia controlada RENHICE.

**Salida:** expediente documental firmado, restauración demostrada, matriz clínica
aprobada y cero P0 abiertos.

## 10. Regla de promoción

Ningún cambio de esta revisión debe promoverse directamente a producción. El orden
seguro es:

1. CI completo y revisión clínica/seguridad.
2. Imagen inmutable asociada al SHA y digest exactos.
3. Despliegue de solo ese frontend en DEV.
4. Promoción del mismo digest a QLTY.
5. Prueba autenticada con pacientes sintéticos y roles negativos.
6. Aprobación funcional y de seguridad.
7. Promoción controlada a PROD con rollback ensayado.

Hasta cerrar auditoría server-side, autorización contextual, firma, enmiendas,
continuidad y RENHICE, la decisión sigue siendo **NO-GO**.

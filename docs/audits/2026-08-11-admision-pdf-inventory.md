# Inventario trazable del PDF de Admisión

**Fuente:** `SIH-SALUS.usuario Admisión-2.pdf`

**Base revisada originalmente:** `53bef2832582aee5e865db9193863e690d3e9a7c`.

**Cierre técnico:** las correcciones de los PRs #785–#791 forman parte de `main` en
`64b0b8d527e92298a46b2867842eb4b611255049`, publicado y desplegado en
DEV/QLTY. El estado de cada hallazgo sigue requiriendo la ejecución manual
indicada en el reporte; “resuelto en código” no equivale por sí solo a
aceptación funcional en QLTY.

**Total:** 131 hallazgos

Este anexo permite auditar el conteo del [reporte principal](./2026-08-11-admision-pdf-qlty-validation.md). Un comportamiento con resultado independiente se cuenta por separado; por eso en la página 102 el guard de estado/prioridad y la persistencia del comentario son dos hallazgos. Las repeticiones puramente visuales o textuales dentro del mismo flujo se agrupan.

Estados: `R` resuelto en código; `P` parcial; `PE` pendiente; `D` decisión funcional/configuración; `Q` requiere QLTY para concluir. En esta fotografía, `R` puede apoyarse en un PR todavía abierto: no significa que el cambio ya esté fusionado o desplegado.

## Páginas 1–45 — 50 hallazgos

| ID  | Pág.       | Hallazgo                                                     | Estado | Evidencia principal                                                            | Caso QLTY                |
| --- | ---------- | ------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------ | ------------------------ |
| A01 | 2, 5, 29   | Catálogo completo de financiadores/IAFAS                     |   P    | Concept set dinámico en `peru-registration-config.ts`                          | QLTY-02/03               |
| A02 | 2          | Validación SIS/IAFAS en tiempo real                          |   PE   | `sis-lookup.resource.ts` no consulta automáticamente en producción             | QLTY-03                  |
| A03 | 2          | Liquidaciones, reembolsos y cuentas corrientes               |   PE   | No se localizó módulo/servicio frontend                                        | Decisión backend         |
| A04 | 2          | Exoneraciones/descuentos de Trabajo Social                   |   PE   | No se localizó implementación ni permiso                                       | Decisión backend/RBAC    |
| A05 | 3, 7       | DIE mostrado como Cédula de Identidad                        |   R    | `peru-registration-config.ts`; `5322cbc0f`                                     | QLTY-02                  |
| A06 | 3, 6       | Identificador provisional y `Otros` solo en emergencia       |   P    | `identifier-selection-overlay.component.tsx`                                   | QLTY-02                  |
| A07 | 3          | Financiador obligatorio                                      |   PE   | `insuranceType` no tiene validación requerida                                  | QLTY-04/30               |
| A08 | 4, 8, 12   | Capturar financiador/póliza y llevarlos a visita             |   R    | Copia tipada, bundle estado+fecha, saneamiento y reparación de la misma visita | QLTY-16A/C/E/F           |
| A09 | 7, 8, 29   | Etiqueta Financiador, autocompletado y financiamiento propio |   P    | Configuración de registro; autocompletado solo SIS                             | QLTY-02/04               |
| A10 | 10, 22, 25 | Relación UPSS–servicio–consulta–género                       |   R    | `807f24db0`, `6474bab87`, `4c3af9f1b`                                          | QLTY-09                  |
| A11 | 10         | Antecedentes conforme a norma                                |   D    | Falta matriz normativa aprobada                                                | Definir criterio clínico |
| A12 | 12         | Presentación de medicamento determinada por backend          |   PE   | El formulario aún expone selección clínica                                     | Prueba de órdenes QLTY   |
| A13 | 12         | Paridad de financiadores entre Registro y Llegada            |   P    | Catálogos dependen del backend                                                 | QLTY-02/16A/16B/16D      |
| A14 | 14         | Buscar/Agregar paciente en parte superior                    |   D    | Decisión de diseño sin criterio cerrado                                        | Revisión UX QLTY         |
| A15 | 14         | Calendario conserva fecha, servicio y resultados             |   R    | `1a77fa69b`, `44573abc2`                                                       | QLTY-12                  |
| A16 | 15         | Tratamiento de cita no atendida después de un día            |   D    | Acción manual `MISSED`; `00330f742`                                            | QLTY-13                  |
| A17 | 16, 24     | Agendar con otro profesional y valor inicial por rol         |   R    | `appointments-form.workspace.tsx` y tests                                      | QLTY-09                  |
| A18 | 18         | Admisión edita/traslada pacientes en cola                    |   D    | `esm-service-queues-app/src/permissions.ts`                                    | QLTY-33B                 |
| A19 | 20         | Fecha de emisión no editable                                 |   R    | `appointments-form.workspace.tsx`; `78fa69092`                                 | QLTY-10                  |
| A20 | 21         | Impedir padre/madre duplicados                               |   R    | `patient-registration-validation.ts`                                           | QLTY-05                  |
| A21 | 21         | Error desaparece al corregir relaciones                      |   R    | Validaciones reactivas en `relationships-section.component.tsx`                | QLTY-05                  |
| A22 | 22         | Semántica y presentación del número HCE                      |   P    | Visualización separada; generación depende de IdGen                            | QLTY-32                  |
| A23 | 25, 34     | Claridad/resaltado del DNI                                   |   R    | `appointments-table.component.tsx`; `8cd2add2d`                                | QLTY-11/28               |
| A24 | 25         | Nombre no enlaza a HCE sin permiso                           |   R    | Guard en tabla de citas                                                        | QLTY-18A                 |
| A25 | 25         | Diferenciar hora de cita de hora de registro                 |   R    | Tabla usa fecha/hora de la cita                                                | QLTY-11                  |
| A26 | 25         | Edad exacta: años, meses y días                              |   R    | `appointment-details.component.tsx` y test                                     | QLTY-11                  |
| A27 | 27         | Inicio desde cola sin fecha/hora editable                    |   R    | `visit-form.workspace.tsx`                                                     | QLTY-20                  |
| A28 | 28         | Guardado robusto del acompañante                             |   R    | Flujo transaccional de relaciones                                              | QLTY-05/15A/15B          |
| A29 | 29         | Desplegables no seleccionan primer valor                     |   R    | Campos codificados con opción vacía                                            | QLTY-02                  |
| A30 | 29         | Menor requiere responsable adulto                            |   R    | `patient-registration-validation.ts`                                           | QLTY-05                  |
| A31 | 30         | Quitar `Copiar seguro del responsable`                       |   R    | `insurance-section.test.tsx`                                                   | QLTY-05                  |
| A32 | 30         | Advertir datos faltantes del responsable                     |   R    | Validación de registro                                                         | QLTY-05                  |
| A33 | 30         | Buscar por otros tipos de documento                          |   R    | `refine-search.test.tsx`                                                       | QLTY-06/28               |
| A34 | 31         | Cambiar menor→adulto limpia relación exigida                 |   R    | `relationships-section.test.tsx`                                               | QLTY-06                  |
| A35 | 31         | CE/CNE con nacionalidad permite guardar                      |   R    | Campo codificado buscable                                                      | QLTY-06                  |
| A36 | 33, 41     | Tarjeta Familiares sin HCE ni acompañantes                   |   R    | Banner/contactos y `useRelationships`                                          | QLTY-06                  |
| A37 | 33         | Agrandar lista de servicios en Citas                         |   PE   | Sin cambio CSS o prueba específica                                             | QLTY-09 visual           |
| A38 | 34         | `Mostrar más` funciona en selección de paciente              |   Q    | Interacción no concluyente por revisión estática                               | QLTY-07 visual           |
| A39 | 35         | Inicio de admisión responsive                                |   Q    | Requiere viewport y datos reales                                               | QLTY-25 visual           |
| A40 | 35         | Filtros de servicio, espera y estado en Colas                |   R    | Tests de header/tabla; `d797f13f9`, `fe4e77aa0`                                | QLTY-19                  |
| A41 | 36         | Permisos de HCE para Admisión                                |   P    | Dead link corregido; falta granularidad de estado/archivo                      | QLTY-18A/B               |
| A42 | 36         | Casos/transiciones del formulario HCE                        |   D    | Falta matriz aprobada de roles y estados                                       | QLTY-18A                 |
| A43 | 37, 39     | Asteriscos y obligatorios en cita/visita                     |   R    | `RequiredFieldLabel` y schema de Citas                                         | QLTY-10                  |
| A44 | 38         | Error del flujo de creación de citas                         |   Q    | Requiere endpoint/payload/respuesta de QLTY                                    | QLTY-10                  |
| A45 | 40         | Formulario de diagnósticos mal enlazado                      |   Q    | Requiere reproducir ruta/guard exactos                                         | QLTY clínico             |
| A46 | 42         | Resaltar fila que se está editando                           |   R    | `appointments-table.component.tsx`; `b526cc611`                                | QLTY-11 visual           |
| A47 | 43         | Placeholders iguales en ambas búsquedas                      |   R    | Clave `searchForPatient`; `582ee37db`                                          | QLTY-25                  |
| A48 | 45         | Títulos de alergias más grandes                              |   R    | `allergy-form.scss`; `49dd38b13`                                               | QLTY-25 visual           |
| A49 | 45         | Traducir `Off`                                               |   R    | Traducción `Desactivado`                                                       | QLTY-25                  |
| A50 | 45         | Crear Cita informa todos los errores                         |   R    | Zod/getAppointmentValidationMessages y test                                    | QLTY-10                  |

## Páginas 46–92 — 52 hallazgos

| ID  | Pág.       | Hallazgo                                                        | Estado | Evidencia principal                                                         | Caso QLTY              |
| --- | ---------- | --------------------------------------------------------------- | :----: | --------------------------------------------------------------------------- | ---------------------- |
| B01 | 46         | Menor: precargar, buscar/registrar acompañante y volver         |   R    | Preflight de Citas y Colas acepta búsqueda o registro y falla cerrado       | QLTY-15A/B             |
| B02 | 47, 50, 61 | Quitar filtros documentales/fecha y usar edad exacta            |   R    | Patient Search filters y tests                                              | QLTY-07                |
| B03 | 47         | Filtro de consulta activa                                       |   R    | `advanced-patient-search` y tests                                           | QLTY-07                |
| B04 | 47         | Filtro de verificación de identidad                             |   R    | `person-attribute-filter.ts` y tests                                        | QLTY-07                |
| B05 | 48         | Nombre de usuario mayor de 15 caracteres                        |   R    | Navbar, tooltip y test; `c36438068`                                         | QLTY-25 visual         |
| B06 | 49, 73     | Uniformar combobox en Alergias, Problemas y Canasta             |   P    | Componentes comunes; cobertura visual incompleta                            | QLTY-25 visual         |
| B07 | 49, 65     | Problemas: fecha posterior al nacimiento y error descriptivo    |   P    | Valida fecha; aún puede mostrar `error.message`                             | QLTY clínico           |
| B08 | 50         | Estado de identificación en Admisión                            |   R    | Filtros actuales de Patient Search                                          | QLTY-07                |
| B09 | 51         | Doctor CE no cambia UPSS al crear cita                          |   R    | Formulario de citas y tests                                                 | QLTY-09                |
| B10 | 52         | Uniformidad del buscador de tablas de citas                     |   R    | Componente de tabla actual                                                  | QLTY-11/25             |
| B11 | 53         | Admisión ve todos los servicios por defecto                     |   R    | Hook de filtro y métricas                                                   | QLTY-09/12             |
| B12 | 54, 91     | Advertir cuando doctor agenda con otro doctor                   |   R    | Formulario y tests                                                          | QLTY-09                |
| B13 | 54         | Fecha de emisión de cita de solo lectura                        |   R    | Privilegio separado                                                         | QLTY-10                |
| B14 | 54         | Forma/valor de País de nacionalidad                             |   Q    | Depende de atributos y metadatos reales                                     | QLTY-06 visual         |
| B15 | 55         | Nota de cita: límite, contador y error                          |   R    | Límite 255 y tests                                                          | QLTY-10                |
| B16 | 55         | Métricas coherentes con fecha y servicio                        |   R    | Metrics/filter hooks                                                        | QLTY-12                |
| B17 | 56         | Cancelar en menú de tres puntos                                 |   R    | Action menu actual                                                          | QLTY-14A               |
| B18 | 57–58      | Preservar/sincronizar/restablecer filtros y calendario          |   R    | Store/hooks; `40a53a29e`, `1a77fa69b`                                       | QLTY-12                |
| B19 | 59         | Cola visual                                                     |   R    | `visual-queue.component.tsx` y test                                         | QLTY-19                |
| B20 | 60         | Acompañante asociado a consulta, no permanente                  |   R    | Arrival/visit relationship flow                                             | QLTY-15A               |
| B21 | 61         | Título, mensaje y paciente al citar/iniciar                     |   R    | Contextual selection y patient header                                       | QLTY-07/08             |
| B22 | 62         | Banner optimizado y listas sin carga perpetua                   |   R    | Patient banner/contact details y test                                       | QLTY-24                |
| B23 | 62         | Quitar `Estado: Activo`                                         |   R    | Banner actual                                                               | QLTY-24 visual         |
| B24 | 62         | Máximo de caracteres en nota fija                               |   R    | Sticky note modal                                                           | QLTY clínico           |
| B25 | 63         | Campo biométrico inválido en rojo                               |   R    | Biometrics input y tests                                                    | QLTY-22                |
| B26 | 63         | Flecha ascendente para valor anormal alto                       |   R    | Biometrics input y tests                                                    | QLTY-22                |
| B27 | 64         | Máximo de caracteres en notas de signos vitales                 |   R    | Visit notes/vitals schema                                                   | QLTY-22                |
| B28 | 64, 66     | Profesional y consultorio/servicio por defecto                  |   R    | Visit/vitals workspace                                                      | QLTY-22                |
| B29 | 66         | Tamaño/negrita de títulos y checkbox                            |   PE   | Sin prueba o commit específico                                              | QLTY-25 visual         |
| B30 | 67         | Mejorar Alergias según estándar OpenMRS                         |   PE   | No existe criterio de aceptación medible                                    | Definir diseño clínico |
| B31 | 68         | Traducir `Expand All`                                           |   R    | Traducciones; `ee20796e7`                                                   | QLTY-25                |
| B32 | 69         | Ingreso de fecha por teclado                                    |   R    | Date input; `9e554ce3a`                                                     | QLTY-25                |
| B33 | 69         | Traducir opciones de filtros                                    |   R    | Traducciones                                                                | QLTY-25                |
| B34 | 70         | Preservar instrucciones al dispensar                            |   R    | Flujo de dispensación                                                       | QLTY-25                |
| B35 | 71         | Traducir estado `Off`                                           |   R    | Traducciones                                                                | QLTY-25                |
| B36 | 72         | Cita fantasma/fecha 1785                                        |   R    | Normalización/validación de fecha y tests                                   | QLTY-31                |
| B37 | 75         | Proveedores filtrados por especialidad                          |   R    | Scheduling category y tests                                                 | QLTY-09                |
| B38 | 75         | Inicio directo solo para usuario clínico                        |   R    | Preflight por rama: atención directa exige HCE y no hereda permisos de cola | QLTY-14B/C y QLTY-18A  |
| B39 | 76         | Conteo/tabla y `Todas las UPSS`                                 |   R    | Store/header tests                                                          | QLTY-19                |
| B40 | 77         | Crear cita aunque exista consulta activa                        |   R    | Arrival/scheduling tests; `255176f58`                                       | QLTY-17A               |
| B41 | 78–79      | Traducir Scheduled/WalkIn/Virtual                               |   R    | Traducciones de Citas                                                       | QLTY-25                |
| B42 | 80         | Separar financiador SIS de plan SIS                             |   R    | Insurance section y tests; `a85bf3730`                                      | QLTY-03/04             |
| B43 | 81         | Evitar DNI en seguro/procedencia                                |   R    | Insurance/visit resource tests                                              | QLTY-16A/B             |
| B44 | 83–84      | Comentario largo en edición de cola                             |   R    | Queue modal, máximo 600                                                     | QLTY-33A               |
| B45 | 83         | Cambiar UPSS/servicio de entrada de cola                        |   R    | Edit queue entry modal                                                      | QLTY-33A               |
| B46 | 85         | Traducir `Invalid Submission`                                   |   R    | Error utils y traducciones                                                  | QLTY-25                |
| B47 | 86         | Cambio de prioridad                                             |   R    | Queue entry actions                                                         | QLTY-33B               |
| B48 | 87         | Consulta anterior demasiado pequeña                             |   R    | Past visit styles                                                           | QLTY-21                |
| B49 | 88         | Admisión no ve resumen/formularios clínicos                     |   R    | RBAC tests de visita actual                                                 | QLTY-18A               |
| B50 | 89         | Filtrar opciones obstétricas por sexo                           |   R    | Queue fields y test                                                         | QLTY-09                |
| B51 | 91         | Obligatoriedad, vigencia y múltiples financiadores              |   D    | Requiere definición PO/normativa                                            | QLTY-03/04/30          |
| B52 | 91–92      | Roles, vencimiento, seguridad, catálogos, género/edad y códigos |   D    | Requiere matriz funcional/configuración                                     | QLTY-09/13/18A/18B/30  |

## Páginas 93–140 — 29 hallazgos

| ID  | Pág.        | Hallazgo                                                | Estado | Evidencia principal                                                             | Caso QLTY               |
| --- | ----------- | ------------------------------------------------------- | :----: | ------------------------------------------------------------------------------- | ----------------------- |
| C01 | 94, 103     | Acciones y navegación de Admisión/Paciente              |   R    | Sin HCE, tarjeta standalone informativa; selección contextual conservada        | QLTY-18A/B              |
| C02 | 94          | `Maynas`: estado, provincia o distrito                  |   D    | UI conserva `cityVillage/countyDistrict/stateProvince`                          | Definir con UBIGEO      |
| C03 | 94          | Priorizar edad exacta y DNI sobre HCE                   |   R    | `sihsalus-patient-info.component.tsx` y test                                    | QLTY-07/28              |
| C04 | 95          | Financiadores ordenados, correctos y sin duplicados     |   P    | Orden/exclusión frontend; deduplicación depende del catálogo                    | QLTY-02                 |
| C05 | 96          | Autofinanciamiento sin código ni acreditación           |   R    | UI, payload y limpieza persistida conservan solo el financiador                 | QLTY-04/16B             |
| C06 | 97          | Edición del número HCE autogenerado                     |   R    | Autogenerados no editables; actualización manual disponible                     | QLTY-32                 |
| C07 | 98, 111–112 | Se pierde el paciente al abrir Inicio/Cita              |   R    | Selección contextual y patient header; `a79f907e5`                              | QLTY-07/08              |
| C08 | 99, 101     | Financiador ausente o fallo al copiarlo a la consulta   |   R    | Creación, edición y sync son recuperables; bundle SIS completo y UUID canónicos | QLTY-16A–H              |
| C09 | 100         | Especialidades y profesionales configurables por IPRESS |   D    | Filtros frontend; catálogo real es backend                                      | QLTY-09                 |
| C10 | 102         | Trasladar conserva estado y guarda comentario           |   R    | Move queue modal y límite de 600; `9136a2cef`                                   | QLTY-33A                |
| C11 | 102         | Admisión puede cambiar estado/prioridad                 |   D    | No hay decisión RBAC separada aprobada                                          | QLTY-33B                |
| C12 | 104         | Error backend al cancelar consulta activa               |   Q    | DELETE y error genérico; tests no cubren backend real                           | QLTY-29                 |
| C13 | 105         | MUAC solo para 0–59 meses                               |   D    | Actualmente se renderiza para todas las edades                                  | QLTY-22                 |
| C14 | 108         | Error al guardar por Código Prestacional                |   R    | Obs coded obligatoria y tests; `d0e3ec4ea`, `81c1bb6ff`                         | QLTY-23                 |
| C15 | 110         | Registro de diagnósticos pasados                        |   R    | Sección/acción y tests específicos                                              | QLTY clínico            |
| C16 | 116–118     | Expandir biometría y mostrar todos los selectores       |   R    | Overview tests y estilos; `7d9890ca5`                                           | QLTY-22                 |
| C17 | 119         | Banner triaje: cobertura, colores y lista               |   R    | Tag único y guard de lista; `5ec5d9fe8`                                         | QLTY-24                 |
| C18 | 120         | Admisión define urgencia                                |   D    | Prioridad requerida sin regla por rol                                           | QLTY-30/33B             |
| C19 | 123, 139    | Flujo SIS/no seguro, obligatoriedad y Caja              |   P    | Estado SIS existe; no dirige automáticamente a Caja                             | QLTY-03/04/30           |
| C20 | 123         | Error al guardar signos vitales                         |   Q    | Falta validar conceptos/encounter de QLTY                                       | QLTY-29                 |
| C21 | 126         | UPSS permite `Todo` sin quedar fijada                   |   R    | `null` limpia filtros; `fe4e77aa0`                                              | QLTY-19                 |
| C22 | 127         | Paciente desaparece después del triaje                  |   R    | Derivación a cola exacta y tests                                                | QLTY-20                 |
| C23 | 128         | Acción `Realizar triaje` para Enfermería                |   D    | Se muestra por capacidades, no por nombre de rol                                | QLTY-20                 |
| C24 | 129         | Tres citas del día bloqueadas por una consulta          |   P    | Reutiliza solo visita compatible; regla entre especialidades abierta            | QLTY-17A/B              |
| C25 | 131         | Expansión de cola falla/no aporta utilidad              |   P    | Mensaje seguro sin visita; interiores dependen de datos/permisos                | QLTY-21                 |
| C26 | 134         | Pantalla inicial de Consulta Externa                    |   D    | No existe requisito verificable único                                           | Definir landing por rol |
| C27 | 135         | FUA únicamente para SIS activo                          |   P    | Masivo excluye; individual permite override                                     | QLTY-27                 |
| C28 | 140         | Paciente con cita aparece `Sin cita` en cola            |   R    | Vínculo cita-visita reparado y tests                                            | QLTY-17A/20             |
| C29 | 140         | Columna Tipo/Número, no `DNI` fijo                      |   R    | `Documento` traduce tipo, excluye HCE y diferencia carga/error/ausencia         | QLTY-28                 |

## Reconciliación del conteo

| Bloque    |      R |      P |    PE |      D |     Q |   Total |
| --------- | -----: | -----: | ----: | -----: | ----: | ------: |
| A01–A50   |     29 |      6 |     6 |      5 |     4 |      50 |
| B01–B52   |     45 |      2 |     2 |      2 |     1 |      52 |
| C01–C29   |     15 |      5 |     0 |      7 |     2 |      29 |
| **Total** | **89** | **13** | **8** | **14** | **7** | **131** |

# Revisión de observaciones de Admisión y plan de validación QLTY

**Fuente:** `SIH-SALUS.usuario Admisión-2.pdf`

**Fecha de revisión:** 2026-08-11

**Base original de auditoría:** `53bef2832582aee5e865db9193863e690d3e9a7c`

**Baseline histórico desplegado el 2026-08-11:** frontend
`64b0b8d527e92298a46b2867842eb4b611255049`, digest
`sha256:998e02ba38eb03297e6da4b3580c2ba963c35b328ca7eb11571fe0db81d062a5`,
con los PRs #785–#791 fusionados y desplegados en DEV/QLTY. Este SHA registra
el cierre técnico de esa fecha; no identifica necesariamente el despliegue
actual de los ambientes.

**Ambiente a validar:** QLTY

**Alcance del documento fuente:** 140 páginas

## 1. Resultado ejecutivo

El PDF contiene **131 hallazgos, solicitudes o decisiones verificables** después de agrupar repeticiones dentro de cada bloque temático. No todas son fallas de software: también hay reglas clínicas por aprobar, catálogos dependientes del backend, decisiones de roles y observaciones cuya captura no permite identificar una causa. La revisión fue documental y sobre el código local; **en esta auditoría no se ejecutaron pruebas dentro de QLTY**.

El rótulo `CORREGIDAS` del PDF no se tomó como evidencia. Cada punto se contrastó con el código actual, las pruebas automatizadas y, cuando correspondía, el contrato de configuración o privilegios.

Para el conteo, una regla, defecto o pregunta con resultado independiente se consideró un hallazgo. Se agruparon las repeticiones del mismo comportamiento dentro de una pantalla o flujo; se conservaron como hallazgos distintos cuando la misma necesidad aparece en superficies diferentes, por ejemplo Registro, Citas, Llegada y Colas. Portadas, fechas y páginas vacías no se contaron. Los 131 registros, su página, estado, evidencia y prueba asociada están enumerados en el [inventario trazable](./2026-08-11-admision-pdf-inventory.md).

| Páginas   | Hallazgos | Resueltos en código | Parciales | Pendientes | Decisión funcional/configuración | Requieren QLTY para concluir |
| --------- | --------: | ------------------: | --------: | ---------: | -------------------------------: | ---------------------------: |
| 1–45      |        50 |                  29 |         6 |          6 |                                5 |                            4 |
| 46–92     |        52 |                  45 |         2 |          2 |                                2 |                            1 |
| 93–140    |        29 |                  15 |         5 |          0 |                                7 |                            2 |
| **Total** |   **131** |              **89** |    **13** |      **8** |                           **14** |                        **7** |

Interpretación de estados:

- **Resuelto en código:** existe implementación y evidencia automatizada coherente. Todavía debe comprobarse el mismo artefacto en QLTY.
- **Parcial:** una parte fue corregida, pero queda una variante, dependencia o decisión abierta.
- **Pendiente:** el comportamiento solicitado no existe o el código actual lo contradice.
- **Decisión funcional/configuración:** Producto, Clínica, Seguridad o el catálogo de la IPRESS deben definir el resultado esperado.
- **Requiere QLTY:** la captura no permite cerrar el punto con revisión estática; se necesita reproducirlo contra backend y contenido reales.

## 2. Evidencia técnica ejecutada

Se ejecutaron las suites completas de los diez paquetes usados como evidencia. Los conteos corresponden a las ramas reconciliadas de los PRs indicados en la sección 2.1. Después de la integración, el CI del SHA `64b0b8d5…` pasó y el mismo SHA fue publicado y desplegado; esto cierra la trazabilidad técnica del artefacto, pero no sustituye las pruebas funcionales de esta matriz. Además, el PR #789 volvió a ejecutar Citas (334/334) y Colas (292/292) como consumidores del contrato común: junto con sus cuatro paquetes propios, su validación aislada suma 1,160/1,160.

| Paquete                    |         Pruebas |
| -------------------------- | --------------: |
| Citas                      |         360/360 |
| Búsqueda de pacientes      |         181/181 |
| Colas                      |         313/313 |
| Registro de pacientes      |         485/485 |
| Signos vitales y biometría |           84/84 |
| Hoja clínica / consultas   |         234/234 |
| Librería común de paciente |         179/179 |
| Notas clínicas             |           79/79 |
| FUA                        |           61/61 |
| Visitas activas            |           60/60 |
| **Total**                  | **2,036/2,036** |

También pasó TypeScript en los diez paquetes. Lint terminó con código 0 y solo advertencias preexistentes. Esta evidencia confirma el comportamiento unitario del código; **no confirma qué SHA está desplegado ni el contenido, roles o backend de QLTY**.

Comandos reproducibles:

```bash
yarn workspace @sihsalus/esm-appointments-app test --run
yarn workspace @sihsalus/esm-patient-search-app test --run
yarn workspace @sihsalus/esm-service-queues-app test --run
yarn workspace @sihsalus/esm-patient-registration-app test --run
yarn workspace @sihsalus/esm-patient-vitals-app test --run
yarn workspace @sihsalus/esm-patient-chart-app test --run
yarn workspace @openmrs/esm-patient-common-lib test --run
yarn workspace @sihsalus/esm-patient-notes-app test
yarn workspace @sihsalus/esm-fua-app test
yarn workspace @sihsalus/esm-active-visits-app test

yarn workspace @sihsalus/esm-appointments-app typescript
yarn workspace @sihsalus/esm-patient-search-app typescript
yarn workspace @sihsalus/esm-service-queues-app typescript
yarn workspace @sihsalus/esm-patient-registration-app typescript
yarn workspace @sihsalus/esm-patient-vitals-app typescript
yarn workspace @sihsalus/esm-patient-chart-app typescript
yarn workspace @openmrs/esm-patient-common-lib typescript
yarn workspace @sihsalus/esm-patient-notes-app typescript
yarn workspace @sihsalus/esm-fua-app typescript
yarn workspace @sihsalus/esm-active-visits-app typescript
```

### 2.1 Correcciones integradas después de la auditoría

Estas correcciones fueron fusionadas antes de construir el artefacto indicado al
inicio del reporte. El PR #791 añadió el fixture de integración requerido por
el contrato final de cobertura; el CI y Release del SHA integrado terminaron
correctamente.

| PR                                                             | Rama                                             | SHA revisado | Alcance                                             |
| -------------------------------------------------------------- | ------------------------------------------------ | ------------ | --------------------------------------------------- |
| [#785](https://github.com/sihsalus/sihsalus-frontend/pull/785) | `fix/patient-search-contextual-selection-access` | `998227fae`  | Límites de selección contextual y acceso a HCE      |
| [#786](https://github.com/sihsalus/sihsalus-frontend/pull/786) | `fix/service-queues-arrival-preflight`           | `76c440a7e`  | Preflight de alta, acompañantes y permisos en Colas |
| [#787](https://github.com/sihsalus/sihsalus-frontend/pull/787) | `fix/appointments-arrival-access-context`        | `681fa3f83`  | Llegada por rama, identidad y documento en Citas    |
| [#788](https://github.com/sihsalus/sihsalus-frontend/pull/788) | `fix/registration-financing-consistency`         | `b3c934103`  | Consistencia de financiador en Registro             |
| [#789](https://github.com/sihsalus/sihsalus-frontend/pull/789) | `fix/visit-financing-integrity`                  | `f2cb2e355`  | Contrato y recuperación de cobertura por consulta   |
| [#790](https://github.com/sihsalus/sihsalus-frontend/pull/790) | `docs/admission-pdf-audit-report`                | `02ca25314`  | Inventario trazable y matriz de validación QLTY      |
| [#791](https://github.com/sihsalus/sihsalus-frontend/pull/791) | `fix/integrated-visit-insurance-fixture`         | `ce076a408`  | Fixture final del contrato integrado de cobertura    |

| Brecha                                                 | Corrección integrada                                                                                                                                                                                                  | Evidencia                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Menor con permiso exclusivo para registrar acompañante | Citas y Colas aceptan `Get People` **o** `app:opciones.registrarAcompanante` + `Add People`; bloquean de forma segura durante carga, error o fecha de nacimiento inválida.                                           | Citas 360/360 + Colas 313/313; QLTY-15A/B.              |
| Llegada con permisos distintos por rama                | Citas comprueba la rama que realmente se ejecutará: crear consulta, reutilizarla, encolar o ir a atención directa. Las acciones imposibles quedan deshabilitadas con la capacidad faltante y no disparan peticiones. | Suite completa de Citas; QLTY-14B/C.                    |
| Alta dinámica desde Colas                              | La entrada exige permisos base; solo la rama que realmente crea consulta exige además `Add Visits` y `Get Visit Types`. Reutilizar una consulta o usar una cola administrativa no los exige.                         | Colas 313/313; QLTY-26.                                 |
| Tarjeta standalone de búsqueda hacia HCE               | Sin `app:hoja.clinica`, las tarjetas completa y compacta son informativas; la selección contextual de Citas permanece interactiva.                                                                                   | Suite completa de Búsqueda 181/181; QLTY-07 y QLTY-18B. |
| Columna `DNI` para todos los pacientes                 | La tabla usa `Documento`, traduce el tipo y muestra tipo + número; excluye HCE/internos y diferencia carga, ausencia y error con reintento.                                                                          | Citas 360/360; QLTY-28.                                 |
| Autofinanciamiento y cambio de IAFAS                   | Usa `cc72568e…`; cambiar financiador reemplaza la cobertura completa, volver a SIS restaura `No consultada` y las copias SETISIS/responsable preservan su snapshot aunque coincidan los textos.                      | Registro 485/485; QLTY-04 y QLTY-16B/D.                 |
| Contrato de cobertura de la visita                     | SIS exige financiador/número/estado/fecha; otra IAFAS financiador/póliza; Particular solo financiador. Los UUID canónicos se reponen aunque una configuración runtime intente omitirlos.                             | Hoja clínica + librería común; QLTY-16A/B/D/F/G/H.      |
| Fallo, ausencia o conflicto al copiar cobertura        | Número+estado+fecha SIS se validan como un conjunto en Pendientes/FUA. Crear, editar y sincronizar conservan un estado recuperable ante fallos parciales y reintentan sobre la misma visita.                         | Visitas activas + FUA; QLTY-16C/E/F/G/H.                |

## 3. Correcciones con evidencia fuerte que deben confirmarse en QLTY

| Tema                                                                                                           | Páginas del PDF           | Estado actual y evidencia                                                                                                                                          | Prueba QLTY                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Selección de paciente para una cita conserva identidad y no ofrece acciones clínicas ajenas                    | 94, 98, 111–112           | Resuelto por `a79f907e5`: la selección contextual oculta Iniciar/Finalizar/Cancelar consulta y mantiene el paciente; el inicio independiente muestra cabecera.     | QLTY-07 y QLTY-08             |
| Tabla de citas: estado como etiqueta, acción separada, carga de consulta, visita cerrada y paginación filtrada | 34, 55, 57–58, 61         | Resuelto por `02a4afa07`; cubierto por las pruebas de Citas.                                                                                                       | QLTY-11                       |
| Fecha de emisión y fecha de cita protegidas por privilegios separados                                          | 20, 54                    | Resuelto; sin privilegio, cada campo queda de solo lectura.                                                                                                        | QLTY-10                       |
| Profesional buscable, preselección por rol, advertencia al elegir otro y filtrado por especialidad             | 16, 24, 51, 54, 100       | Resuelto en frontend por `b7b5d40c2`, `4862e8e1a` y `4c3af9f1b`; el catálogo real sigue siendo de QLTY.                                                            | QLTY-09                       |
| Relación UPSS → servicio → tipo de consulta y restricciones por sexo                                           | 10, 22, 25, 89            | Implementado y probado; depende de UUID y metadatos desplegados.                                                                                                   | QLTY-09                       |
| Nota de cita limitada a 255 caracteres con contador                                                            | 55                        | Resuelto y probado en el límite y sobre el límite.                                                                                                                 | QLTY-10                       |
| Métricas, tabla, calendario y filtros de Citas sincronizados                                                   | 14, 53, 55, 57–59         | Implementado por `40a53a29e` y `1a77fa69b`.                                                                                                                        | QLTY-12                       |
| Cita vencida se puede marcar como no atendida                                                                  | 15, 91                    | Existe estado real `MISSED`, no solo una etiqueta, por `00330f742`. Automatizarlo sigue siendo decisión de Producto.                                               | QLTY-13                       |
| Una consulta activa compatible ya no impide crear otra cita                                                    | 77                        | Resuelto: se puede crear la cita aunque exista una consulta activa.                                                                                                | QLTY-17A                      |
| Llegada no navega automáticamente a HCE, valida capacidades y cancelación muestra resumen                      | 56, 75, 103               | Implementado por `c47f8ca81` más el preflight por rama integrado en #787; una capacidad opcional no bloquea otra rama y una acción denegada no realiza peticiones. | QLTY-14A/B/C y QLTY-18A/B     |
| Financiador separado del plan SIS y cobertura coherente en persona/visita                                      | 80–81, 95–96, 99–101      | Los PRs #788 y #789 integraron el manejo de SIS/IAFAS/Particular, evitaron documentos civiles y huérfanos, exigieron el bundle completo y repararon sobre la misma visita. | QLTY-03, QLTY-04 y QLTY-16A–H |
| Código prestacional obligatorio y persistido como observación codificada                                       | 108                       | Resuelto por `d0e3ec4ea` y `81c1bb6ff`.                                                                                                                            | QLTY-23                       |
| Filtros de Colas permiten `Todo`, cambio de UPSS/servicio y refresco tras triaje                               | 35, 76, 83, 126–127       | Resuelto por `fe4e77aa0` y flujo de derivación de triaje.                                                                                                          | QLTY-19 y QLTY-20             |
| Expansión de fila sin visita muestra mensaje seguro                                                            | 87, 131                   | Resuelto para la ausencia de visita; los componentes internos todavía necesitan datos/permisos reales.                                                             | QLTY-21                       |
| Banner de triaje con un solo tag de cobertura, colores honestos y lista protegida                              | 119                       | Resuelto por `5ec5d9fe8`.                                                                                                                                          | QLTY-24                       |
| Gráficos de signos y biometría muestran todos los selectores y aprovechan el ancho                             | 116–118                   | Resuelto por `7d9890ca5`.                                                                                                                                          | QLTY-22                       |
| Relaciones de menor, responsable adulto, duplicados y cambio menor→adulto                                      | 21, 28–31, 33, 41, 46, 60 | Validaciones y flujo transaccional implementados; acompañante queda ligado a la consulta.                                                                          | QLTY-05 y QLTY-06             |
| Registro extranjero CE/CNE y nacionalidad                                                                      | 31, 54                    | Cubierto por validación/configuración actual.                                                                                                                      | QLTY-06                       |
| Traducciones y entrada por teclado                                                                             | 68–71, 78, 85             | Correcciones integradas para Expandir, filtros, fechas y mensajes revisados.                                                                                       | QLTY-25                       |
| Fecha extrema no crea una cita fantasma en el año 1785                                                         | 72                        | Resuelto en código mediante normalización y validación de timestamps; existe prueba que rechaza fechas históricas inválidas.                                       | QLTY-31                       |
| Identificador HCE autogenerado no se edita y el manual usa la ruta de actualización                            | 97                        | Resuelto en frontend; duplicados, formato y persistencia deben confirmarse contra el backend real.                                                                 | QLTY-32                       |
| Trasladar una entrada conserva el estado y permite actualizar el comentario                                    | 102                       | Resuelto en código; el comentario admite hasta 600 caracteres y debe persistir al recargar. La autorización para cambiar estado es otra decisión RBAC.             | QLTY-33A/B                    |

## 4. Pendientes y brechas que no deben declararse resueltos

### Prioridad alta

| Brecha                                                                                       | Páginas      | Estado actual                                                                                                                                                                  | Riesgo                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Financiador continúa siendo opcional al registrar                                            | 3, 91, 139   | Pendiente. `insuranceType` no tiene validación requerida.                                                                                                                      | Se puede llegar a cita/triaje sin conocer cobertura.                                                                           |
| No existe consulta IAFAS/SIS real de extremo a extremo en el frontend productivo             | 2, 91, 123   | Pendiente. La verificación disponible no sustituye integración real con IAFAS.                                                                                                 | Vigencia o cobertura pueden estar desactualizadas.                                                                             |
| No existe derivación automática SIS no vigente/sin financiador → Caja en todos los contextos | 123, 139     | Parcial. El triaje ya bloquea SIS incompleto y ofrece `Derivar a Caja` con acceso a Facturación; no existe una regla global/automática equivalente para todos los entrypoints. | Fuera de ese flujo, un paciente puede continuar por una ruta no financiada.                                                    |
| La edición de cobertura de visita no tiene privilegio administrativo exclusivo               | 96, 99–101   | Pendiente de política RBAC. El formulario completo se habilita con privilegios generales de visita; no existe un guard separado para Admisión/Digitador FUA.                   | Un rol clínico con edición de visita puede modificar datos administrativos; validar QLTY-16G/16H y QLTY-18A.                   |
| Prioridad/urgencia asignada por Admisión no tiene decisión aprobada ni privilegio separado   | 86, 102, 120 | Decisión pendiente.                                                                                                                                                            | Admisión podría clasificar clínicamente sin corresponderle.                                                                    |
| FUA “solo SIS activo” no es absoluto                                                         | 135          | Parcial. El flujo masivo excluye no vigentes; el individual permite override con advertencia.                                                                                  | FUA para acreditación no vigente si la contingencia no está aprobada.                                                          |
| Tres citas de especialidades distintas no equivalen a una visita compatible                  | 129          | Parcial. El código reutiliza una visita solo cuando ubicación y tipo son compatibles; Consulta Externa, Rehabilitación y Psicología pueden exigir visitas/triajes diferentes.  | El caso exacto del PDF requiere una regla funcional y pruebas por especialidad; Admisión no debe finalizar consultas clínicas. |
| Cancelar consulta activa y guardar signos vitales no están cerrados contra backend real      | 104, 123     | Requieren QLTY.                                                                                                                                                                | Error REST/configuración clínica puede persistir.                                                                              |
| Reglas de MUAC por edad no coinciden con la solicitud 0–59 meses                             | 105          | Decisión clínica pendiente; el formulario lo muestra también para mayores.                                                                                                     | Captura clínica fuera del protocolo que Producto pretende.                                                                     |

### Otros puntos abiertos o que requieren caracterización

- La uniformidad visual de combobox y pantallas de Alergias/Problemas/Canasta es parcial; además, el formulario de Problemas todavía puede exponer `error.message` sin normalizar, páginas 49, 65 y 73.
- La edición de un identificador HCE válido dispone de ruta frontend, pero la aceptación de duplicados, formatos y permisos depende del backend de QLTY, página 97.
- No existe evidencia específica para el cambio de tamaño/negrita de títulos y estilo de checkbox solicitado en la página 66.
- “Mejorar Alergias según estándares OpenMRS”, página 67, no tiene criterio de aceptación medible; requiere diseño aprobado antes de probarse.
- El valor y la presentación de País de nacionalidad, `Mostrar más`, el tamaño de listas y la responsividad deben caracterizarse visualmente en QLTY, páginas 33–35 y 54.
- Los errores genéricos de Crear Cita y el enlace del formulario de diagnósticos, páginas 38 y 40, no se pueden dar por cerrados sin reproducir el recorrido exacto y guardar la respuesta de red.
- La consulta anterior expandida y las tarjetas clínicas deben revisarse con datos reales y permisos mínimos, páginas 87–88 y 131.

### Alcance fuera del frontend o sin criterio de aceptación

- Liquidaciones/reembolsos automáticos y cuentas corrientes de particulares, página 2.
- Exoneraciones y descuentos de Trabajo Social, página 2.
- Norma exacta para antecedentes, página 10.
- Presentación farmacéutica determinada exclusivamente por backend, página 12.
- Ubicación de acciones Buscar/Agregar y pantalla inicial por rol, páginas 14 y 134.
- Automatización de citas no atendidas, páginas 15 y 91.
- Matriz de quién puede generar citas, iniciar atención, clasificar prioridad y editar estados, páginas 75, 91–92, 102, 120 y 128.
- Catálogos finales por IPRESS: IAFAS, especialidades, servicios, diagnósticos, códigos prestacionales, género y edad, páginas 2, 89, 92, 95 y 100.

## 5. Preparación obligatoria para QLTY

Antes de ejecutar casos funcionales:

1. Confirmar que `build-info.json` mantiene el SHA `64b0b8d527e92298a46b2867842eb4b611255049` (o un descendiente que contenga los PRs #785–#791) y registrar el digest observado. Si no coincide, detener la campaña; no usar solo el nombre de la rama o una caché del import map como evidencia.
2. Usar únicamente pacientes sintéticos. El PDF contiene nombres y documentos aparentes de personas; no deben copiarse al reporte ni a nueva evidencia.
3. Preparar cuentas separadas:
   - Admisión, sin privilegios de HCE/finalización;
   - Enfermería/Triaje, con Colas y Signos Vitales;
   - Médico de Consulta Externa;
   - Gestor de listas;
   - Solo lectura;
   - Administrador solo para contraste de catálogos.
4. Preparar pacientes sintéticos:
   - adulto SIS vigente;
   - adulto SIS no vigente/no consultado;
   - adulto con autofinanciamiento;
   - adulto sin financiador;
   - menor con responsable adulto y menor sin responsable;
   - extranjero con CE y otro con pasaporte;
   - paciente con tres citas compatibles el mismo día;
   - paciente con citas de Consulta Externa, Rehabilitación y Psicología el mismo día;
   - paciente con consulta activa incompatible por UPSS/tipo;
   - paciente con HCE manual editable y otro con HCE autogenerado.
5. Preparar al menos dos UPSS, dos servicios, cola de triaje y dos colas clínicas con rutas inequívocas.
6. Por caso guardar: usuario/rol, hora, SHA, paciente sintético, pasos, resultado, captura antes/después y respuesta de red si hubo error.

## 6. Matriz de pruebas manuales en QLTY

Las pruebas marcadas **Gate** deben pasar antes de declarar resuelto el bloque correspondiente. Las marcadas **Caracterización** pueden confirmar una brecha ya conocida; no deben reinterpretarse como regresión nueva.

Orden recomendado de ejecución:

1. `QLTY-01`: confirmar el artefacto; si el SHA/digest no corresponde, detener la campaña.
2. P0 operativos: `QLTY-07`, `QLTY-14B/C`, `QLTY-15A/B`, `QLTY-17A/B`, `QLTY-20` y `QLTY-26`.
3. Persistencia/backend: `QLTY-03`, `QLTY-16A–H`, `QLTY-23`, `QLTY-27`, `QLTY-29`, `QLTY-31` y `QLTY-32`.
4. RBAC: `QLTY-08`, `QLTY-18A/B` y `QLTY-33B`, siempre con rol mínimo y sin usar administrador como evidencia principal.
5. Después, ejecutar el resto de Gates y cerrar las caracterizaciones/decisiones con Producto, Clínica o Seguridad.

| ID       | Tipo                       | Perfil / datos                                                                        | Pasos principales                                                                                                                                                                                         | Resultado esperado                                                                                                                                                                                                                    |
| -------- | -------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QLTY-01  | Gate técnico               | Cualquier perfil                                                                      | Abrir información de build/import map y registrar SHA/digest.                                                                                                                                             | El artefacto contiene los commits revisados; si no, detener la campaña.                                                                                                                                                               |
| QLTY-02  | Gate                       | Admisión; adulto nuevo                                                                | Abrir Registro y revisar Identidad/Financiador.                                                                                                                                                           | `Cédula de Identidad`; `Otros` solo en contexto autorizado; catálogo sin duplicados visibles y con Autofinanciamiento.                                                                                                                |
| QLTY-03  | Caracterización / blocker  | Admisión; SIS vigente                                                                 | Elegir SIS, intentar verificación real, guardar, cerrar y reabrir; registrar endpoint y fuente de datos.                                                                                                  | Código, estado y fecha deben persistir y nunca usar el DNI como póliza. Si no existe consulta real a SIS/IAFAS, registrar el bloqueo y no certificar acreditación en línea.                                                           |
| QLTY-04  | Gate + caracterización     | Admisión; paciente SIS, autofinanciado y sin financiador                              | Cargar código/acreditación SIS, cambiar a Autofinanciamiento, guardar y reabrir; después caracterizar un alta sin financiador.                                                                            | Para Particular desaparecen código y controles SIS, los `DELETE` limpian valores previos y solo queda `cc72568e…`. El financiador vacío sigue permitido y se registra como decisión pendiente.                                        |
| QLTY-05  | Gate                       | Admisión; menor                                                                       | Probar dos padres, dos madres, responsable menor y ningún responsable; luego agregar adulto.                                                                                                              | Casos inválidos bloqueados con mensaje que desaparece al corregir; adulto válido guarda una sola relación.                                                                                                                            |
| QLTY-06  | Gate                       | Admisión; menor→adulto y CE/CNE                                                       | Cambiar edad después de crear relación automática; crear extranjeros con nacionalidad.                                                                                                                    | No queda relación obsoleta requerida; CE/CNE/nacionalidad guardan y reabren sin error.                                                                                                                                                |
| QLTY-07  | Gate P0                    | Admisión; paciente existente                                                          | Citas → Crear nueva cita → Buscar paciente. Revisar tarjeta y seleccionar.                                                                                                                                | No aparecen Iniciar/Finalizar/Cancelar consulta ni navegación a HCE; al seleccionar se abre la cita con nombre e identificador visibles.                                                                                              |
| QLTY-08  | Gate                       | Médico; búsqueda global                                                               | Buscar paciente sin consulta activa, iniciar consulta, limpiar la búsqueda detrás y continuar.                                                                                                            | El drawer mantiene cabecera del paciente y no pierde contexto.                                                                                                                                                                        |
| QLTY-09  | Gate                       | Médico y Admisión                                                                     | Crear cita, cambiar UPSS/servicio, revisar tipo, sexo y profesionales.                                                                                                                                    | Médico propio preseleccionado y ubicación bloqueada; Admisión inicia sin profesional; solo aparecen servicios/profesionales compatibles.                                                                                              |
| QLTY-10  | Gate                       | Roles con/sin privilegios de fechas                                                   | Abrir crear/editar cita, enviar vacío y escribir 256 caracteres en nota.                                                                                                                                  | Obligatorios visibles, resumen de errores, límite/contador 255; fechas solo editables con el privilegio correspondiente.                                                                                                              |
| QLTY-11  | Gate                       | Admisión; citas en varios estados                                                     | Revisar tabla durante carga, filtrar, paginar y abrir una cita con consulta cerrada.                                                                                                                      | Los estados no son controles interactivos: usan Tag, salvo Cancelada como texto rojo. Atención es columna separada, aparece `Verificando consulta…`, total/página corresponden al filtro y la consulta cerrada no impide reprogramar. |
| QLTY-12  | Gate                       | Admisión                                                                              | Aplicar servicio/fecha, ir al calendario y volver; comparar métricas y filas.                                                                                                                             | Filtros se conservan o restablecen explícitamente, sin filtro invisible; métricas coinciden con tabla.                                                                                                                                |
| QLTY-13  | Decisión                   | Admisión; cita de ayer                                                                | Revisar acciones y marcar no atendida.                                                                                                                                                                    | Acción manual funciona. Producto registra si necesita cierre automático y su plazo.                                                                                                                                                   |
| QLTY-14A | Gate                       | Admisión                                                                              | Cancelar cita desde cada punto disponible.                                                                                                                                                                | Siempre aparece resumen de paciente, servicio, fecha y UPSS antes de confirmar.                                                                                                                                                       |
| QLTY-14B | Gate                       | Admisión                                                                              | Registrar llegada correctamente y completar el flujo permitido.                                                                                                                                           | Permanece en Citas/Colas; no navega automáticamente a HCE ni abre una acción clínica no autorizada.                                                                                                                                   |
| QLTY-14C | Gate RBAC P0               | Admisión; pacientes con y sin consulta activa                                         | Probar por separado crear, reutilizar, encolar y atención directa. Quitar cada permiso requerido y observar Red; repetir sin HCE y sin permisos de cola opcionales.                                       | Solo se deshabilita la rama afectada y se explica el motivo. Sin HCE no abre atención directa; sin cola aún permite la rama directa. Ningún caso bloqueado crea/edita visita ni entrada de cola.                                      |
| QLTY-15A | Gate/negativo              | Admisión/Citas y Colas; menor                                                         | Probar llegada/alta con solo `Get People` y luego sin búsqueda ni registro.                                                                                                                               | Búsqueda permite continuar; sin ninguna capacidad ambos flujos bloquean antes de abrir el formulario de consulta.                                                                                                                     |
| QLTY-15B | Gate P0                    | Admisión/Citas y Colas; menor                                                         | Probar solo `app:opciones.registrarAcompanante` + `Add People`; repetir mientras el paciente carga y ante error de paciente.                                                                              | El permiso exclusivo de registro permite continuar. Durante carga, error o fecha inválida, ambos flujos se bloquean con mensaje claro y nunca fallan abiertos.                                                                        |
| QLTY-16A | Gate                       | Admisión; SIS vigente con código distinto del documento                               | Registrar llegada, iniciar consulta, cerrar y reabrir; inspeccionar atributos de persona y visita.                                                                                                        | La visita conserva financiador, número, estado y `e3a66f60…` fecha/hora SIS; ningún valor se sustituye por DNI/CE/pasaporte.                                                                                                          |
| QLTY-16B | Gate                       | Admisión; SIS que cambia a Autofinanciamiento                                         | Cambiar en Registro y repetir el override dentro de Inicio de consulta; guardar, cerrar y reabrir.                                                                                                        | Persona y visita conservan exclusivamente `cc72568e…`; no quedan afiliación, estado ni fecha SIS.                                                                                                                                     |
| QLTY-16C | Gate de recuperación       | Admisión; SIS vigente; DevTools con bloqueo selectivo                                 | Bloquear por turno cada `POST /visit/{uuid}/attribute` al crear consulta, desbloquear y pulsar `Reintentar cobertura`.                                                                                    | La consulta se crea una sola vez; ninguna falla deja una cobertura que parezca completa. El reintento converge sobre el mismo UUID y los cuatro atributos reaparecen al recargar.                                                     |
| QLTY-16D | Gate                       | Admisión; SIS→EsSalud/EPS y paciente SITEDS existente                                 | Cambiar financiador, ingresar póliza nueva y guardar; en otro paciente SITEDS editar un dato no relacionado sin cambiar IAFAS.                                                                            | El cambio limpia código/estado/fecha anteriores y la visita no recibe campos SIS; la edición sin cambio conserva acreditación genérica SITEDS de la persona.                                                                          |
| QLTY-16E | Gate de durabilidad        | Admisión/FUA; visita SIS incompleta                                                   | Borrar primero solo `e3a66f60…` y luego, en otra visita, solo el número de afiliación; recargar Inicio y revisar FUA individual/masivo; usar `Sincronizar cobertura`.                                     | Cada visita reaparece con la causa exacta (`Sin fecha…` o `Sin número…`), no entra al lote FUA y el individual exige contingencia. Sync actualiza la misma visita y la retira de la lista.                                            |
| QLTY-16F | Gate de integridad/RBAC    | Admisión; visita sin payer o en transición SIS↔otra cobertura                         | Sincronizar con persona SIS/otra IAFAS; bloquear sucesivamente número, fecha, estado y commit de payer; después reintentar.                                                                               | Los huérfanos se eliminan; un fallo nunca oculta la fila como cobertura completa. El payer anterior o el estado faltante dejan una marca recuperable y el retry converge en la misma visita.                                          |
| QLTY-16G | Gate RBAC/configuración    | Admisión con `Add Visits`; matriz de cinco permisos backend                           | Quitar uno por uno `Get People`, `Get Patients`, `Get Visits`, `Edit Visits` y `Get Visit Attribute Types`; crear consulta con cobertura incompleta y completa. Forzar además un 403 real al sincronizar. | La consulta se crea una sola vez. Sin capacidad de copia se deriva a revisión y no ofrece retry imposible; si el payload ya está completo no necesita backfill. Tras 403, Sync desaparece.                                            |
| QLTY-16H | Gate de edición atómica    | Admisión; visita existente SIS y no SIS                                               | Editar SIS→EsSalud/Particular y no-SIS→SIS; bloquear sucesivamente número, fecha, payer y estado, recargar y reintentar.                                                                                  | Si falla la primera escritura, se conserva la cobertura anterior y se muestra el error. Tras comprometer el payer SIS, un fallo parcial queda visible en Pendientes/FUA. El retry converge sin crear otra visita.                     |
| QLTY-17A | Gate P0                    | Admisión y Médico; 3 citas compatibles                                                | Admisión registra las tres llegadas; Médico finaliza una cita.                                                                                                                                            | Una visita compatible puede vincular las tres; cada cita/cola queda correcta y las restantes siguen operativas.                                                                                                                       |
| QLTY-17B | Caracterización / decisión | Admisión, Enfermería y Médico; citas de Consulta Externa, Rehabilitación y Psicología | Registrar las tres llegadas y recorrer triaje/atención según cada servicio.                                                                                                                               | Documentar cuántas visitas y triajes se crean y si existe bloqueo. Producto/Clínica debe aprobar la regla para especialidades incompatibles; Admisión no finaliza consultas.                                                          |
| QLTY-18A | Gate RBAC                  | Admisión y Médico                                                                     | Entrar por URL directa a HCE y revisar acciones de consulta.                                                                                                                                              | Admisión no ejecuta HCE/finalización/cancelación clínica; Médico sí recibe las acciones autorizadas.                                                                                                                                  |
| QLTY-18B | Gate RBAC                  | Admisión; búsqueda standalone                                                         | Buscar paciente e intentar clic, `ArrowDown` + `Enter`; repetir como Médico.                                                                                                                              | Para Admisión la tarjeta es informativa y no navega; para Médico autorizado conserva enlace. El selector contextual de QLTY-07 continúa funcionando sin HCE.                                                                          |
| QLTY-19  | Gate                       | Admisión/Colas                                                                        | Alternar `Todo`, dos UPSS, servicios y estados; recargar.                                                                                                                                                 | No hay filtro oculto, cambio de ubicación funciona y pacientes/contadores son coherentes.                                                                                                                                             |
| QLTY-20  | Gate P0                    | Enfermería; cita en triaje                                                            | Abrir Realizar triaje, guardar y observar derivación.                                                                                                                                                     | Botón visible por capacidades; un solo encuentro; paciente sale de Triaje y aparece una vez en la cola clínica de su cita.                                                                                                            |
| QLTY-21  | Gate                       | Admisión/Colas                                                                        | Expandir fila con visita, sin visita y con visita histórica.                                                                                                                                              | Muestra consulta, historial o mensaje específico; nunca cae la sección completa.                                                                                                                                                      |
| QLTY-22  | Gate clínico               | Enfermería/Médico; distintas edades                                                   | Guardar signos/biometría, abrir tabla y gráficos en escritorio/tablet/móvil.                                                                                                                              | Guardado único, valores y flechas correctos, cinco selectores visibles sin scroll lateral y gráfica amplia. Decidir visibilidad MUAC desde 60 meses.                                                                                  |
| QLTY-23  | Gate clínico               | Médico                                                                                | Guardar resumen con código prestacional; editar; intentar sin código.                                                                                                                                     | Se guarda obs coded y reaparece seleccionada; sin código se bloquea antes de crear encuentro.                                                                                                                                         |
| QLTY-24  | Gate                       | Triaje; tres estados SIS; usuarios con/sin listas                                     | Revisar banner y prioridad, enlace de historia y Agregar a lista.                                                                                                                                         | Un tag: verde vigente, rojo no vigente, gris no consultado; sin duplicar procedencia/número; lista solo con permiso; enlace no es un click muerto.                                                                                    |
| QLTY-25  | Gate UX                    | Todos                                                                                 | Recorrer fechas por teclado, Expandir/Contraer, filtros y mensajes de error en español.                                                                                                                   | No aparecen textos funcionales en inglés ni controles imposibles de usar por teclado.                                                                                                                                                 |
| QLTY-26  | Gate RBAC P0               | Admisión/Colas; pacientes sin visita, con visita activa y cola administrativa         | Sin `Add Visits`/`Get Visit Types`, probar consulta activa y cola sin consulta; luego elegir paciente sin visita. Repetir con set completo y por URL hija.                                                | Consulta activa y cola administrativa continúan con permisos base. Crear consulta sin el set muestra bloqueo antes del hijo y nunca queda en skeleton; con set completo abre; la URL hija sigue protegida.                            |
| QLTY-27  | Caracterización            | FUA; SIS vigente/no vigente/no SIS                                                    | Generar desde la tabla individual, por lote y desde `Finalizar consulta y generar FUA`.                                                                                                                   | Vigente permite; no SIS no permite; documentar cualquier diferencia entre entrypoints y el override individual de no vigente, y obtener decisión formal.                                                                              |
| QLTY-28  | Gate                       | Citas; DNI/CE/pasaporte/HCE y fallo de red                                            | Crear una cita por tipo documental, cambiar idioma y revisar `Documento`; bloquear la carga FHIR de un paciente sin documento en la cita y pulsar Reintentar.                                             | Muestra tipo+número traducido, HCE nunca aparece como documento civil; carga y error no se confunden con ausencia y Reintentar vuelve a consultar.                                                                                    |
| QLTY-29  | Gate backend               | Médico y Enfermería                                                                   | Cancelar consulta autorizada y guardar signos vitales con conceptos reales.                                                                                                                               | Operaciones persisten y refrescan sin duplicar. Ante fallo, adjuntar método/URL, status, respuesta y correlación, sin exponer datos reales.                                                                                           |
| QLTY-30  | Decisión                   | Admisión/Triaje                                                                       | Registrar llegada de SIS vigente, SIS no vigente, autofinanciado y sin financiador.                                                                                                                       | Documentar ruta actual; Producto debe aprobar quién define prioridad y qué estados deben ir a Triaje, Caja o bloqueo.                                                                                                                 |
| QLTY-31  | Gate regresión             | Admisión; paciente sintético                                                          | Crear una cita con fecha válida, recargar Inicio/Citas y repetir tras intentar introducir/manipular una fecha histórica inválida.                                                                         | Fecha y hora se conservan, el conteo aumenta una sola vez y nunca aparece el año 1785 ni una cita duplicada/fantasma.                                                                                                                 |
| QLTY-32  | Gate backend               | Admisión y Archivista; paciente sintético                                             | Editar un identificador HCE manual autorizado, guardar y recargar; repetir con valor duplicado e inválido.                                                                                                | El valor válido persiste según permisos; duplicado/formato inválido se rechazan con mensaje útil y sin corromper el identificador anterior. El HCE autogenerado no es editable.                                                       |
| QLTY-33A | Gate                       | Admisión/Colas                                                                        | Trasladar una entrada sin cambiar estado; guardar comentario de 600 y 601 caracteres, recargar.                                                                                                           | El estado se conserva, 600 caracteres persisten y 601 se bloquean con mensaje claro.                                                                                                                                                  |
| QLTY-33B | Decisión RBAC              | Admisión/Colas                                                                        | Intentar modificar estado y prioridad con el rol mínimo.                                                                                                                                                  | Registrar visibilidad y respuesta actual; Producto/Seguridad debe definir si se oculta o exige un privilegio separado.                                                                                                                |

## 7. Criterios de salida

Un hallazgo marcado `Resuelto en código` puede cerrarse en QLTY solo cuando:

- QLTY ejecuta el SHA/digest revisado;
- el caso Gate asociado pasa con el rol mínimo, no solo con administrador;
- el dato se conserva después de cerrar, recargar y volver a consultar;
- no aparece una acción que su destino luego rechaza;
- el resultado se obtiene con datos sintéticos y queda evidencia trazable.

La campaña no debe declararse completa si solo se prueban pantallas. Los puntos de financiador, llegada, triaje, consulta y FUA requieren verificar también la persistencia backend y el enrutamiento final.

## 8. Formato de evidencia por caso

Copiar esta ficha por cada prueba:

```text
Caso QLTY:
Fecha/hora:
Tester:
SHA/digest:
Rol y privilegios relevantes:
Paciente sintético:
Precondiciones:
Resultado: PASS / FAIL / BLOCKED
Resultado observado:
Evidencia (capturas/HTTP/log seguro):
Defecto o decisión asociada:
```

## 9. Nota de privacidad

El PDF fuente contiene nombres, documentos y capturas aparentes de pacientes/usuarios. Este reporte no los reproduce deliberadamente. Las evidencias nuevas deben anonimizar identificadores, no incluir credenciales y usar registros sintéticos de QLTY.

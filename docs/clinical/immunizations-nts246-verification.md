# Verificación de inmunizaciones frente a NTS 246

Fecha: 21 de octubre de 2026. **Cumplimiento integral no acreditado.**

Esta revisión acota la evidencia disponible para el flujo de vacunación. Es una
verificación técnica; la conformidad clínica y la aceptación del establecimiento
requieren revisión del programa de inmunizaciones. No certifica toda la NTS ni
convierte una prueba unitaria en evidencia de registro oficial.

## Fuentes y alcance

- [RM 561-2026-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/8265031-561-2026-minsa), que aprueba la NTS 246-MINSA/DGIESP-2026.
- [NTS, parte 1](https://cdn.www.gob.pe/uploads/document/file/10154198/8265031-nts-n-246-minsa-digiesp-2026-parte-1.pdf): §5.1, §6.2.2, gestión de información y anexos 1–2.
- [NTS, parte 2](https://cdn.www.gob.pe/uploads/document/file/10154199/8265031-nts-n-246-minsa-digiesp-2026-parte-2.pdf): anexos 10, 13, 18–19.
- Frontend base y desplegado en DEV/QLTY: `bc72757d708ad2a404bfe97e25649f8e53c74f0b`.
- Content inspeccionado localmente: `e0161de781d70d3dded734c63e8c41391ab50bfa`.
  No se supone que todo ese árbol esté desplegado: el Form y los metadatos
  necesarios para el ensayo se verificaron por API en cada entorno.
- PR [#1246](https://github.com/sihsalus/sihsalus-frontend/pull/1246): protección
  del contexto del payload FHIR; PR
  [#1247](https://github.com/sihsalus/sihsalus-frontend/pull/1247): contrato de
  alta REST y serialización de fechas. Ninguno desplegado durante este ensayo.

Las páginas siguientes son las impresas en la norma; cuando se indica página
PDF, se cuenta desde uno. Los estados describen la evidencia de cada caso, no
una certificación legal. Las implicaciones para el software son inferencias
explícitas a partir del requisito y del contrato técnico.

## Matriz de requisitos y brechas

| Requisito y fuente                                                                        | Evidencia y límite                                                                                                                                                                                                                                                                                                                                                                        | Estado / acción pendiente                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal que realiza la vacunación: §5.1, p. 4                                            | El frontend exige profesional de sesión y el alta REST incluye proveedor/rol. El rol funcional no demuestra profesión ni capacitación. El operador autorizado del ensayo tiene privilegios administrativos.                                                                                                                                                                               | BLOCKED: el programa debe validar categoría, capacitación y flujo con rol clínico. No se modificaron permisos.                                                       |
| Esquema infantil regular: §6.2.2, pp. 45–47; anexos 1–2, pp. 79–80                        | Los defaults separan IPV/bOPV, neumococo a 2/4/12 meses y SPR a 12/18 meses. La revisión no acredita todo el curso de vida, campañas, rescate ni elegibilidad especial.                                                                                                                                                                                                                   | BLOCKED: aceptación clínica del calendario institucional y catálogo completo.                                                                                        |
| Transición a hexavalente y condiciones especiales, notas de §6.2.2 / §6.3                 | Se documenta transición por agotamiento coordinado de stock; el frontend no decide ese agotamiento. VRS/Nirsevimab y otras indicaciones especiales no se convierten en reglas universales. Hexavalente/meningococo requieren contenido canónico coordinado.                                                                                                                               | BLOCKED: programa/content deben publicar catálogo y reglas aplicables; no crear UUID alternativos. La existencia y escritura de cada producto especial no se ensayó. |
| Continuidad de dosis en rescate: anexo 2, p. 80                                           | No se reinicia una serie por contar registros ni se renumeran ordinales históricos. Dosis ya registradas generan advertencia.                                                                                                                                                                                                                                                             | NOT RUN: escenarios clínicos de rescate y campañas con rol clínico; los defaults no prueban esa aceptación.                                                          |
| Calidad y oportunidad del registro: gestión de información, pp. 68–70                     | Como requisito técnico derivado, se distingue día de administración de timestamp de registro. DEV/QLTY rechazaron fechas REST `YYYY-MM-DD` con HTTP 400; aceptaron timestamp completo con offset, manteniendo el día. #1247 corrige el mapper y cubre UTC/Lima.                                                                                                                           | PASSED para los casos API sintéticos de fecha y contexto; BLOCKED para aceptación del formulario del PR desplegado.                                                  |
| Identificación del responsable y datos del registro: anexo 10, p. 101 (parte 2, PDF p. 4) | Alta/edición REST conservaron paciente, visita, ubicación, formulario, proveedor y timestamp. Una nota corregida creó su revisión nativa enlazada por `previousVersions`; no se exige UUID activo idéntico.                                                                                                                                                                               | PASSED en DEV y QLTY para estos campos y esa corrección. NOT RUN: anulación y recarga de todos los campos opcionales desde la UI.                                    |
| Registro fiel del evento, derivado de calidad de datos                                    | REST conserva `not-done` sin fecha de administración. FHIR POST con `not-done` seguido de GET devolvió `completed` en ambos entornos. La norma no prescribe esa codificación FHIR; el defecto viola el contrato de representar fielmente el evento.                                                                                                                                       | FAILED: backend debe preservar estado/motivo y no convertir una no aplicación en aplicación acreditada.                                                              |
| Integridad de historia y contexto, derivada de calidad de datos                           | #1246 verifica identidad y conserva contexto del payload. Con una atención posterior en la misma visita, el PUT FHIR devolvió HTTP 500 al intentar cambiar `Obs.encounter`, campo inmutable. No se demostró una reasignación persistida ni un update exitoso.                                                                                                                             | FAILED: corregir selección y actualización del encuentro en backend. Preservación FHIR de contexto, `recorded` y retirada de lote/dosis siguen BLOCKED.              |
| Registro diario / HIS-SIHCE / CPMS: pp. 68–70 y anexo 10                                  | El Form INMU-001 1.1.0 y el payload clínico no prueban exportación completa, interoperabilidad autorizada, entrega diaria ni acuse oficial. Deben verificarse establecimiento/RENIPRESS, identificación, datos demográficos/contacto, CPMS, dosis, lote y responsable según el flujo oficial. La presencia de una columna no define por sí sola una nueva obligatoriedad universal en UI. | BLOCKED: content/backend/programa deben aportar mapping, reporte, envío y recepción oficial, con reconciliación. No imponer campos inventados ni alterar históricos. |
| ESAVI: anexo 13, pp. 104–106 (parte 2, PDF pp. 7–9)                                       | INMU-002 ofrece resumen de vacuna/lote/severidad/descripción/plan. Ese resumen no demuestra el formulario íntegro, notificación, seguimiento ni recepción del reporte ESAVI.                                                                                                                                                                                                              | BLOCKED: validar el circuito y campos del anexo con farmacovigilancia; no declarar resuelto por tener un formulario.                                                 |
| Carnet: anexos 18–19 (parte 2, PDF pp. 34–35)                                             | No se ejecutó emisión y cotejo del carnet oficial completo con la historia persistida.                                                                                                                                                                                                                                                                                                    | NOT RUN: programa debe revisar formato, campos y reconciliación.                                                                                                     |
| Trazabilidad del operador, requisito técnico de control                                   | El módulo de auditoría está iniciado, pero su endpoint de revisión no ofrece filtro por paciente/recurso. No se consultó para evitar acceder a eventos ajenos al fixture. Proveedor clínico y actor de edición son conceptos distintos.                                                                                                                                                   | BLOCKED: verificación de eventos autoritativos mediante acceso acotado al fixture. Un módulo iniciado o telemetry cliente no acredita autoría.                       |

## Ensayo remoto y limpieza

DEV y QLTY se verificaron por separado, mediante HTTPS y sesión autenticada
expresamente autorizada. Se comprobaron cuenta/proveedor activos, ubicación de
sesión, privilegios efectivos, Form publicado y metadatos antes de crear datos.
No se crearon cuentas ni se otorgaron roles. La excepción TLS se acotó a los dos
orígenes de pruebas con certificado propio. No se accedió a producción.

Ambos entornos informaron FHIR2 **4.3.0**, REST **3.5.1-sihsalus.1**, O3Forms
**2.3.1-sihsalus.1** y auditoría **1.0.0** iniciados. El frontend seguía en el SHA
base anterior: el ensayo ejercita contratos API, con payload equivalente al
mapper corregido para las fechas; **no es un ensayo del navegador de los PR**.

Comando privado ejecutado: `python3 <directorio-privado>/run-smoke.py DEV QLTY`.
El runner usa Playwright API, las utilidades existentes `SyntheticFixtures` y
`PrivateFixtureJournal`, y credenciales introducidas sin eco. El harness privado
no se incorpora como una nueva suite mantenida del repositorio.

Resultado final **por entorno**:

- PASSED: separación entre fecha de administración y registro.
- PASSED: conservación de contexto en edición REST.
- PASSED: corrección de nota con revisión nativa trazable.
- PASSED: no aplicación REST sin fecha de administración.
- FAILED: roundtrip FHIR de `not-done` (observado `completed`).
- FAILED: edición FHIR tras crear una atención posterior (HTTP 500).
- BLOCKED: comprobar persistencia de contexto y retirada de lote/dosis tras ese PUT.
- PASSED: limpieza verificada de todos los recursos sintéticos de cada intento,
  incluidos los intentos iniciales fallidos de fecha. Se anularon por el mecanismo
  nativo; no se purgaron datos históricos. Los journals privados se conservaron.

Antes de escribir, se validaron recuperación y limpieza: **578 pruebas** de las
utilidades E2E y **5 pruebas** del wrapper privado de intención/escritura
(ownership, fallo del journal, respuesta perdida, autorización y fallo de
persistencia posterior). Las escrituras no reintentan automáticamente. Cada
operación registra intención antes de enviar y verifica pertenencia al paciente
sintético; la limpieza recorre dependencias paginadas y comprueba la anulación.
No se publican identificadores, credenciales ni respuestas técnicas completas.

La comprobación inicial de edición exigía por error el mismo UUID activo de nota;
se corrigió para respetar la revisión nativa y se repitió en ambos entornos. Su
fallo inicial no se presenta como pérdida de contexto del backend.

## Contrato backend y próximos pasos

El [traductor FHIR2 4.3.0](https://github.com/openmrs/openmrs-module-fhir2/blob/4.3.0/api/src/main/java/org/openmrs/module/fhir2/api/translators/impl/ImmunizationTranslatorImpl.java)
selecciona la última atención de inmunización de la visita, asigna el encuentro a
las observaciones y emite `COMPLETED` al leer. El código inspeccionado tampoco
implementa un roundtrip de `recorded`. La referencia FHIR `Encounter/<visitUuid>`
no identifica el encuentro REST original. Esto explica los riesgos y es
consistente con las respuestas sintéticas; no acredita que todo escenario haya
sido ensayado. El getter REST de
[Obs y sus revisiones](https://github.com/sihsalus/openmrs-module-webservices.rest/blob/9dcfc9f6efd0d296ae1973696324f227b0bcb658/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/resource/openmrs1_8/ObsResource1_8.java)
permite comprobar la cadena `previousVersions`.

1. Backend: corregir estado/motivo y edición histórica FHIR con regresiones
   integradas. No repetir una escritura por REST después del HTTP 500: podría
   haber persistencia parcial. Mantener el fallback limitado al contrato 501.
2. Content/programa: cerrar calendario y productos aplicables, CPMS/registro
   oficial, ESAVI, carnet y categoría profesional con evidencia de recepción.
3. QA/programa: ensayar alta, recarga, edición y anulación desde navegador en el
   artefacto revisado, con rol clínico y casos de ambas rutas. Verificar autoría
   sin consultar eventos ajenos al fixture.
4. Mantenedor: revisar el diff y SHA final. Los PR permanecen en borrador; sus
   controles técnicos y el audit de dependencias se informan por separado.
   Merge, publicación y despliegue requieren sus decisiones correspondientes.

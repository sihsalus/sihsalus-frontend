# Contratos clínicos: signos vitales y triaje de emergencia

**Estado:** implementación coordinada pendiente de aceptación integrada.
**Revisión:** 2026-10-19; sustituye la propuesta del 2026-07-16 contra content 1.18.0.

## Metadata publicada en el repositorio de contenido

Verificado contra `sihsalus-content` `7817849` (candidata 1.25.34) y su
[contrato canónico](https://github.com/sihsalus/sihsalus-content/blob/7817849/docs/contracts/chart-vitals-encounter-contract.md).
La existencia en Git no demuestra que una instalación haya cargado esa versión.

| Uso                      | Tipo de encuentro                      | Rol                                    |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| Signos vitales del chart | `20d4a603-8472-484c-b2bf-b45bdecf6b4f` | `bebe2266-abbb-4f3c-b28b-a5b47406fff5` |
| Triaje de emergencia     | `978deb64-358e-4c78-bbb0-04cea73df805` | `bd16c32b-6784-45e6-9504-df1cfe0b62e5` |
| Tipo mixto histórico     | `67a71486-1a54-468f-ac3e-7091a9a79584` | Se conserva la atribución original     |

El contenido ya declara ambos tipos nuevos, sus privilegios de lectura/edición,
los roles, las dos colas de emergencia (`b1c5bb01-…7cf0` y `ebd44a3d-…3ffe`),
la visita Emergencia y la ubicación UPSS-EMERGENCIA. La propuesta anterior que
los consideraba ausentes corresponde a una versión histórica.

## Escrituras y compatibilidad

Los defaults del chart usan el tipo y rol longitudinales. El perfil
`emergency-triage` usa su rol específico y el consumidor de Emergencia aporta
su tipo de encuentro. Ambos reutilizan el workspace existente. La visita y su
ubicación deben corresponder al paciente; la identidad profesional proviene de
la sesión. Sin proveedor o rol se bloquea la escritura antes de encolarla.

El tipo mixto y sus encuentros permanecen sin reasignaciones. Los lectores por
conceptos conservan la historia, y las intenciones offline ya capturadas
conservan su payload: actualizar defaults no reescribe atribución ni fechas de
la cola pendiente. El rol de encuentro identifica responsabilidad y no otorga
permisos; la autorización efectiva sigue en el backend.

El triaje ambulatorio de agenda/colas aún usa un override del tipo histórico.
Necesita resolver su contrato propio de clasificación y finalización de la
cola; cambiarlo a Emergencia o al tipo longitudinal alteraría su significado.
Esta deuda sigue abierta y requiere revisión clínica/backend/frontend.

## Fundamento y aceptación

La NTS 139-MINSA/2018/DGAIN regula el registro clínico y la NT
042-MINSA/DGSP-V.01 la clasificación y atención de emergencia. La NTS 021
clasifica establecimientos. No se deriva una clasificación completa de los
rangos numéricos ni se cambia prioridad mediante una migración de metadata.

La aceptación requiere smoke sintético en DEV/QLTY: verificar visita,
ubicación, tipo y rol del POST; lectura histórica; sincronización exactamente
una vez; rechazo por permisos; y transiciones de cola por separado. Las pruebas
unitarias y el build no acreditan esa aceptación ni un despliegue.

## Estado de frontend y pendientes

- **Offline del formulario custom**: `Save and close` persiste primero una
  intención con UUID estable y datetime local provisional en la cola del
  usuario. En línea, una lectura fresca `network-only` de la visita confirma su
  identidad y límites y aporta el HTTP `Date`; antes del primer intento solo el
  datetime puede canonicalizarse mediante una transición atómica. Si falta esa
  autoridad o se contradice con la visita, el ítem queda en cola sin POST. La
  escritura inmediata y la sincronización usan checkpoints, guard de paciente
  vivo y reconciliación exacta de cabecera, observaciones y providers. Un
  resultado ambiguo no se reintenta a ciegas. La transición de la cola de
  triaje se difiere hasta que el encounter esté confirmado; si se sincronizó
  después, el operador refresca Colas y usa `Enviar a atención`.
- **Hora capturada offline**: al reconectar se valida el datetime original
  contra una lectura fresca de visita y hora del servidor, pero nunca se
  reemplaza por la hora de reconexión. Si el reloj del dispositivo estaba mal y
  la captura queda fuera de esos límites, el ítem permanece sin intentar y
  requiere reconciliación; no existe una corrección silenciosa segura.
- **Límite offline pendiente**: no hay autosave antes de presionar `Save and
close`, y el gate automatizado de laptop todavía no cubre signos vitales ni
  triaje. No declarar aceptación operacional hasta ejecutar un smoke sintético
  coordinado en DEV/QLTY y ampliar ese gate.
- **Enmienda/anulación clínica**: no existe flujo de editar/corregir/anular un
  encounter de vitales con motivo y auditoría (el guardado es append-only por
  diseño; `updateVitalsAndBiometrics` existe pero no se usa).
- **Hora de medición editable**: el payload ya envía `encounterDatetime`
  explícito (hora del servidor para el guardado en línea o captura original
  validada para el guardado offline); falta un campo de UI para registro
  retrospectivo.
- **E2E verdadero**: el spec de Playwright de vitales
  (`e2e/tests/critical-paths.spec.ts`) puede pasar sin abrir el formulario ni
  emitir POST. Hace falta un E2E que guarde, inspeccione el POST, recargue y
  verifique exactamente un encounter completo contra un backend real.

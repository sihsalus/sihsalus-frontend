# Contratos clínicos: signos vitales vs. triaje de emergencia

**Estado:** propuesta pendiente de provisión en backend (content package).
**Fecha:** 2026-07-16.

## Problema

El chart y el flujo de emergencia comparten hoy el mismo encounter type
`67a71486-1a54-468f-ac3e-7091a9a79584`, que el content package define como
"Triaje" con descripción "clasificación según urgencia". Todo registro de
signos vitales desde la ficha clínica queda persistido como un triaje, aunque
en pantalla los flujos estén separados. La referencia normativa correcta para
el triaje de emergencia es la **NT N.° 042-MINSA/DGSP-V.01** (servicios de
Emergencia); la NTS 021 corresponde a categorías de establecimientos y no debe
citarse para este registro.

## Contrato propuesto

```text
Ficha clínica
  └─ Encounter: Registro de signos vitales y antropometría   (encounter type NUEVO)

Emergencia
  └─ Encounter: Triaje de emergencia                          (encounter type NUEVO)
       └─ prioridad, cola, Glasgow y derivación (NT 042)

Compartido
  └─ conceptos y componentes de captura, NO el contrato del encounter
```

El frontend ya soporta esta separación sin cambios de código:

- `esm-patient-vitals-app` → `vitals.encounterTypeUuid` (config).
- `esm-emergency-app` → `triageEncounter.encounterTypeUuid` (config), que se
  pasa como override al workspace compartido de vitales
  (`patient-vitals-biometrics-form-workspace`, perfil `emergency-triage`).

Basta con provisionar los dos encounter types nuevos en el content package y
apuntar cada config al UUID correspondiente. **No** inventar UUIDs en el
frontend: un default que no existe en el backend rompe el guardado.

## Migración del histórico

El UUID actual (`67a71486-…`) contiene datos mixtos (vitales de chart y
triajes de emergencia). No relabelar el histórico completo:

1. Mantener `67a71486-…` como tipo **legacy** (solo lectura de historial).
2. Crear los dos tipos limpios para nuevas escrituras.
3. Migrar únicamente registros clasificables de forma determinística
   (p. ej., encounters de ese tipo cuya visita es de tipo emergencia y tienen
   obs de prioridad → triaje; el resto → registro de vitales solo si la visita
   no es de emergencia). Lo ambiguo se queda en el tipo legacy.

## Pendientes que exceden este repositorio (backend / content package)

Verificado contra `sihsalus-content` @ 1c3b47a (content 1.18.0, 2026-07-16). Lo que
**sí está alineado**: estados de cola, prioridades I-IV, Glasgow completo (preguntas,
19 respuestas y total), circunferencias, IMC, set de vitales `1114…`, concepto de
urgencia pre-triaje, visit type Emergencia, `visitQueueNumberAttributeUuid`,
ubicación UPSS-EMERGENCIA, encounter role Unknown, encounter type "Atención en
Emergencia", y los identifier types `550e8400-…` (que **sí están provisionados** en
`patientidentifiertypes.csv` — corrige una versión anterior de este documento que
los llamaba placeholders).

| Pendiente | Detalle |
|---|---|
| **Colas de emergencia** | El flujo de dos colas del frontend (triaje `b1c5bb01-…7cf0` + atención `ebd44a3d-…3ffe`) **no existe en el content** (`queues/sihsalus-queues.csv` solo define "Cola de Emergencia" `b8c9d0e1-…` en UPSS-EMERGENCIA y una "Cola de Triaje" genérica `c3d4e5f6-…` en otra ubicación), y `frontend_configuration/config.json` no sobreescribe esos UUIDs. Solo funciona donde las colas se crearon a mano (dev); un despliegue limpio desde content rompe el flujo. Decidir: provisionar ambas colas en content con los UUIDs del frontend, o re-apuntar el frontend a colas del content (creando la cola de atención que falta). |
| Encounter types nuevos | "Registro de signos vitales y antropometría" y "Triaje de emergencia" (ver arriba). Verificado: `encountertypes.csv` sigue con "Triaje" `67a71486-…` citando NTS 021 y con privilegios vacíos. |
| Conceptos faltantes | `emergencyConceptUuid` `b0cdc710-…` (pre-triaje "Emergencia") no existe en los zips OCL — hoy casi código muerto porque la ruta directa usa Prioridad I; limpiar del schema o provisionar. `emergencyServiceUuid` `d62d58e9-…` tampoco existe (el servicio de la cola de emergencia en content es `e5f6a7b8-…7e05`); es config sin consumidores. |
| RBAC de backend | Los privilegios `view/edit` de los encounter types están vacíos en content; ocultar botones en frontend no es autorización. Definirlos y asignarlos a los roles clínicos. |
| Rol de triaje | Existe "Enfermera de Triaje" `bd16c32b-…` en `encounterroles.csv` (NT 042). El default del frontend (`vitals.encounterRoleUuid` = Unknown) es válido pero genérico; configurar el rol de triaje para el perfil de emergencia cuando se separe el contrato. |
| Rangos de referencia | Corregir en content los rangos que describen valores patológicos registrables como imposibles (peso >40 kg a los 12 años, temperatura <35 °C, PC <31 cm en RN, extremos de MUAC). El frontend ya solo advierte (no bloquea). SpO₂: content define `Normal high = Critical high = 100`; el fix de `assessValue` trata 100 % como normal, pero lo limpio es dejar `Critical high` nulo. |
| Vital Signs concept set | Quitar Karnofsky del set (verificado presente en el zip OCL 10) y añadir los conceptos que el frontend usa y faltan. |

## Pendientes de frontend no cubiertos aún

- **Offline real**: el guardado sigue siendo POST directo sin cola de
  reintentos ni reconciliación; no anunciar compatibilidad offline hasta
  implementarla.
- **Enmienda/anulación clínica**: no existe flujo de editar/corregir/anular un
  encounter de vitales con motivo y auditoría (el guardado es append-only por
  diseño; `updateVitalsAndBiometrics` existe pero no se usa).
- **Hora de medición editable**: el payload ya envía `encounterDatetime`
  explícito (= momento del guardado); falta un campo de UI para registro
  retrospectivo.
- **E2E verdadero**: el spec de Playwright de vitales
  (`e2e/tests/critical-paths.spec.ts`) puede pasar sin abrir el formulario ni
  emitir POST. Hace falta un E2E que guarde, inspeccione el POST, recargue y
  verifique exactamente un encounter completo contra un backend real.
- **Privilegio de "Add vitals" desde la visita**: usa el privilegio de editar
  visitas en lugar del de editar signos vitales.

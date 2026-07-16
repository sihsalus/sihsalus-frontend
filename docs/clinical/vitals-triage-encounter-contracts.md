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

| Pendiente | Detalle |
|---|---|
| Encounter types nuevos | "Registro de signos vitales y antropometría" y "Triaje de emergencia" (ver arriba). |
| RBAC de backend | Los privilegios `view/edit` de los encounter types están vacíos en content; ocultar botones en frontend no es autorización. Definirlos y asignarlos a los roles clínicos. |
| Rangos de referencia | Corregir en content los rangos que hoy describen valores patológicos registrables como imposibles (peso >40 kg a los 12 años, temperatura <35 °C, PC <31 cm en RN, extremos de MUAC). El frontend ya solo advierte (no bloquea), pero los rangos deben reflejar límites absolutos reales. SpO₂: `hiCritical=100` junto a `hiNormal=100` ya no marca 100 % como crítico por el fix de frontend, pero lo limpio es dejar `hiCritical` nulo. |
| Vital Signs concept set | Quitar Karnofsky del set y añadir los conceptos que el frontend usa y faltan (circunferencias, Glasgow total). |
| Identifier types placeholder | `550e8400-e29b-41d4-a716-44665544000X` (DNI/CE/Pasaporte/Otros) en `esm-emergency-app/config-schema.ts` son UUIDs de ejemplo; provisionar los reales. |

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

# Emergency Workflow Module

Este módulo implementa el flujo de atención de pacientes en emergencias según la Norma Técnica de Servicios de Emergencias del Perú.

## Estructura

```
emergency-workflow/
├── emergency-workflow-workspace.tsx     # Workspace principal que orquesta los pasos de registro
├── patient-search-registration.*        # Búsqueda / registro de paciente (incluye modo no identificado)
├── components/
│   ├── initial-priority-selector.*      # Selector pre-triaje (Emergencia / Urgencia)
│   └── priority-selector.*              # Selector de prioridad
├── steps/
│   └── confirmation-step.*              # Resumen de confirmación antes de enviar a cola
├── hooks/
│   ├── useEmergencyVisit.ts             # Crea/recupera la visita de emergencia
│   └── usePatientSearchVisibility.tsx
└── utils/
    ├── priority-calculator.ts           # Calcula prioridad I–IV desde signos vitales (NEWS2 + Glasgow)
    └── triage-validator.ts              # Valida que el triaje tenga los signos vitales requeridos
```

## Flujo de Trabajo

El registro de emergencia es un workspace de **dos pasos**:

1. **REGISTRO** — Búsqueda/registro del paciente + clasificación inicial pre-triaje (Emergencia o Urgencia) + envío a la cola correspondiente.
   - Si el paciente no puede comunicarse, se usa el modo `Registrar paciente no identificado / incapaz`.
2. **CONFIRMACIÓN** — Resumen antes de confirmar el envío a la cola.

La **prioridad formal I–IV** se asigna durante el **triaje** (no en el registro): al atender un paciente de la cola de triaje (`serve-patient.modal`), se abre el **workspace compartido de signos vitales** (`esm-patient-vitals-app`, profile `emergency-triage`, con Glasgow Coma Scale) usando el `encounterTypeUuid` de triaje. Con esos signos vitales se calcula/sugiere la prioridad (ver abajo).

## Cálculo de prioridad (NEWS2 → Norma Técnica)

`utils/priority-calculator.ts` deriva la prioridad de triaje a partir de los signos vitales:

- **Base:** National Early Warning Score 2 (NEWS2, Royal College of Physicians, 2017) — umbrales por FR, SpO₂, PAS, FC, temperatura, consciencia (ACVPU) y oxígeno suplementario.
- **Override de consciencia (caso comatoso):** Glasgow ≤ 8 o ACVPU = Unresponsive → **Prioridad I** (vía aérea en riesgo).
- **Mapeo a la Norma Técnica peruana:**
  - Prioridad I — gravedad súbita extrema / resucitación (NEWS2 ≥ 7, o consciencia comprometida)
  - Prioridad II — urgencia mayor (NEWS2 5–6, un parámetro crítico, o consciencia alterada)
  - Prioridad III — urgencia menor (NEWS2 1–4)
  - Prioridad IV — patología aguda común (NEWS2 0)

El cálculo es **asesor**: la enfermera de triaje mantiene la decisión final. La prioridad canónica/persistida debería validarse en backend; el frontend solo sugiere.

`utils/triage-validator.ts` (`validateTriageComplete`) verifica que los signos vitales requeridos (FR, SpO₂, PAS, FC, temperatura) estén capturados antes de asignar prioridad.

## Paciente no identificado / incapaz

Este modo se usa cuando el paciente está inconsciente, comatoso, desorientado, no verbal, es menor sin datos o no puede dar datos confiables.

Campos esperados: estado de identificación (pendiente/parcial/confirmado/fusionado), condición de comunicación, responsable o acompañante, tipo de responsable, parentesco/vínculo cuando se conoce, observaciones administrativas cuando apliquen.

El flujo no exige DNI, teléfono, dirección ni edad exacta para iniciar atención. Esos datos se actualizan después en registro de pacientes cuando el paciente se identifique o aparezca documentación confiable.

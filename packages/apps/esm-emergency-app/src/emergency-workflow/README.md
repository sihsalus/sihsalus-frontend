# Emergency Workflow Module

Este módulo implementa el flujo completo de atención de pacientes en emergencias según la Norma Técnica de Servicios de Emergencias del Perú.

## Estructura

```
emergency-workflow/
├── emergency-workflow-workspace.tsx  # Workspace principal que orquesta todos los pasos
├── steps/                            # Pasos individuales del flujo
│   ├── step-1-patient-search.tsx     # Paso 1: Búsqueda/Registro de paciente
│   ├── step-2-emergency-visit.tsx   # Paso 2: Crear visita de emergencia
│   ├── step-3-triage-form.tsx       # Paso 3: Triaje completo (signos vitales + prioridad)
│   └── step-4-queue-assignment.tsx  # Paso 4: Asignar a cola con prioridad
└── utils/                           # Utilidades
    ├── priority-calculator.ts       # Calcula prioridad según signos vitales
    └── triage-validator.ts          # Valida que el triaje esté completo
```

## Flujo de Trabajo

1. **Búsqueda/Registro de Paciente**: Si el paciente no existe, se registra. Si existe, se busca. Si el paciente no puede comunicarse, se usa el modo `Registrar paciente no identificado / incapaz`.
2. **Crear Visita de Emergencia**: Se crea una visita obligatoria antes de continuar.
3. **Triaje Completo**: 
   - Captura de signos vitales (obligatorio)
   - Asignación de prioridad según Norma Técnica Peruana:
     - Prioridad I: Gravedad súbita extrema
     - Prioridad II: Urgencia mayor
     - Prioridad III: Urgencia menor
     - Prioridad IV: Patología aguda común
4. **Asignación a Cola**: Solo se permite si el triaje está completo. Se asigna con la prioridad determinada.

## Validaciones

- No se puede avanzar al siguiente paso sin completar el anterior
- El triaje debe estar completo antes de asignar a cola
- La visita es obligatoria antes del triaje
- En modo paciente no identificado/incapaz, la condición de comunicación es obligatoria
- En modo paciente no identificado/incapaz, el responsable, institución o autoridad es obligatorio

## Paciente no identificado / incapaz

Este modo se usa cuando el paciente está inconsciente, comatoso, desorientado, no verbal, es menor sin datos o no puede dar datos confiables.

Campos esperados:

- estado de identificación: pendiente, parcial, confirmado o fusionado,
- condición de comunicación,
- responsable o acompañante,
- tipo de responsable,
- parentesco/vínculo cuando se conoce,
- observaciones administrativas cuando apliquen.

El flujo no debe exigir DNI, teléfono, dirección ni edad exacta para iniciar atención. Esos datos se actualizan después en registro de pacientes cuando el paciente se identifique o aparezca documentación confiable.



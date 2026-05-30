# esm-emergency-app

App para flujos de urgencias y triage.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales
- Administra la experiencia operativa del servicio de emergencia.
- Incluye triage, paneles de urgencias, flujos de atención y vistas de seguimiento clínico.
- No gestiona camas de hospitalización ni el ciclo completo de admisión/egreso.
- No sustituye módulos especializados como laboratorio, farmacia o facturación.
- Permite iniciar atención de pacientes no identificados o incapaces de comunicarse sin bloquear por falta de DNI.

## Identidad en emergencia

El flujo de emergencia puede registrar o seleccionar un paciente y luego crear visita/cola. Para pacientes no identificados o incapaces, debe capturar:

- condición de comunicación,
- estado de identificación,
- responsable, institución o autoridad,
- vínculo o tipo de responsable cuando se conoce,
- servicio/ubicación y contexto operativo de ingreso.

La tabla de emergencia debe permitir ubicar al paciente por HCE/código temporal, responsable, estado de identificación, condición de comunicación, servicio, ubicación y estado de cola. No debe depender del DNI como identificador principal.

## Integraciones
- APIs y recursos de urgencias, triage y contexto clínico.
- Componentes de panel, home de emergencia y flujos modales.
- Dependencias compartidas para estado, navegación y errores.
- Registro de pacientes, Patient Search y Libro de Atenciones para continuidad administrativa.

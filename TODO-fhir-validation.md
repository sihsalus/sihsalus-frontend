# TODO — Validación de recursos FHIR R4 generados desde formularios CRED

**Estado**: pendiente
**Prioridad**: alta
**Relacionado**: `sihsalus/TODO-fhir-validation.md` (TODO maestro), `tesis-cred-sih-salus/thesis.html`

## Contexto frontend

El módulo `esm-crecimiento-desarrollo-app` envía datos al backend a través de la API REST/FHIR de OpenMRS. Los formularios Ampath JSON definidos en `sihsalus-content` se transforman en `Encounter`, `Observation` e `Immunization` mediante el motor de formularios y el módulo `fhir2`.

Para sustentar la declaración de conformidad con HL7 FHIR R4 en la tesis y el flujo RENHICE, falta validar **los recursos FHIR que efectivamente se producen al diligenciar formularios CRED desde la UI** (no solo recursos genéricos del backend).

El TODO maestro con los comandos del validador oficial vive en el repo `sihsalus` (`TODO-fhir-validation.md`). Acá se documenta la parte específica del frontend.

## Lo que debe validarse desde flujos CRED

Para cada uno de los 5 paneles, capturar los recursos generados tras guardar un control completo:

| Panel | Formularios Ampath involucrados | Recursos FHIR a validar |
|---|---|---|
| Atención neonatal | RN inmediato, primer control neonatal | Encounter, Observation, Condition |
| Control del niño sano | Antropometría, EEDP/TEPSI/EDI, M-CHAT-R/F | Encounter, Observation (múltiples) |
| Inmunizaciones | Esquema NTS 196 acumulativo | Immunization |
| Estimulación temprana | Plan personalizado, hitos | Encounter, Observation |
| Nutrición infantil | Lactancia, suplementación, anemia | Encounter, Observation |

## Procedimiento sugerido

1. Levantar instancia de desarrollo (`docker-compose up` desde el repo `sihsalus`).
2. Loguearse en la UI y completar un control CRED de extremo a extremo (paciente piloto).
3. Anotar UUIDs del Encounter y Observations generadas (visibles desde el detalle de la visita o desde la BD vía DBeaver).
4. Pasarlos al script de validación del TODO maestro (`sihsalus/TODO-fhir-validation.md`, paso 2 y 3).
5. Documentar warnings/errores y, si hay errores, abrir issue con etiqueta `fhir-conformance`.

## Errores y warnings comunes esperados

- **Códigos OCL sin mapeo a LOINC/SNOMED**: warnings de terminología. Documentar y planificar mapeo gradual en `sihsalus-content` (no bloquea conformidad de FHIR core).
- **Slot `Observation.subject` o `Encounter.subject` ausente**: error grave. Indica problema de transformación en `fhir2` — escalar al backend.
- **Codings sin `system`**: warning. Suele venir de campos free-text de Ampath; mejorar definición del formulario para usar `concept` con UUID OCL.

## Salida esperada

- Tabla de resultados por panel (similar a la del TODO maestro), incorporable como anexo a la tesis.
- Lista de warnings/errores categorizados por causa raíz (terminología vs mapeo vs Ampath).
- Plan de remediación corto para los errores (los warnings se pueden dejar documentados como deuda técnica de terminología).

## Referencias

- TODO maestro: `../../sihsalus/TODO-fhir-validation.md`
- Validador oficial HL7: https://validator.fhir.org/
- OpenMRS fhir2: https://github.com/openmrs/openmrs-module-fhir2
- Documentación de formularios Ampath: https://ampath.github.io/ngx-formentry/

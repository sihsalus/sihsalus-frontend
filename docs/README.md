# Documentación — SIH Salus Frontend

Punto de entrada a la documentación del monorepo. El [`README.md`](../README.md) raíz cubre instalación y arranque; aquí se centraliza el resto.

## Documentos generales

| Documento | Descripción |
|---|---|
| [`app-template.md`](./app-template.md) | Plantilla base y checklist para crear apps `esm-*-app` nuevas |
| [`e2e-testing.md`](./e2e-testing.md) | Cómo correr las suites Playwright (raíz vs modulares) y cómo se normalizan las URLs E2E |
| [`fhir-validation-todo.md`](./fhir-validation-todo.md) | TODO de validación de recursos FHIR R4 generados desde formularios CRED |
| [`../SECURITY.md`](../SECURITY.md) | Política de seguridad y reporte de vulnerabilidades |

## Acreditación y normativa (por paquete)

Documentos de cumplimiento normativo MINSA / NTS que viven junto al paquete que los implementa:

| Documento | Paquete |
|---|---|
| [Validación de admisión SIHCE MINSA 373-2025](../packages/apps/esm-care-logbook-app/accreditation/validacion_admision_SIHCE_MINSA_373-2025.md) | `esm-care-logbook-app` |
| [Análisis de brechas CRED NTS 238](../packages/apps/esm-crecimiento-desarrollo-app/CRED_NTS_238_GAP_ANALYSIS.md) | `esm-crecimiento-desarrollo-app` |
| [Anexo 14 — Programación de turnos](../packages/apps/esm-staff-scheduling-app/accreditation/anexo-14-programacion-turnos.md) | `esm-staff-scheduling-app` |

## Guías de configuración

| Documento | Paquete |
|---|---|
| [Configuración de categorías de formularios](../packages/apps/esm-fast-data-entry-app/docs/configuring-form-categories.md) | `esm-fast-data-entry-app` |

## Documentación por paquete

Cada app y librería bajo [`packages/`](../packages/) mantiene su propio `README.md` con detalles específicos de su dominio.

- **Apps**: `packages/apps/esm-*-app/README.md`
- **Librerías**: `packages/libs/esm-*/README.md`

# Documentación de SIH Salus

[Inicio del repositorio](../README.md) · [Contribuir](../CONTRIBUTING.md)

## Por dónde empezar

| Necesidad                                  | Guía                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preparar el entorno y levantar el SPA      | [Desarrollo local](development/README.md)                                                                                                                                                                  |
| Entender qué bloquea la limpieza actual    | [Estado de configuración](development/tooling-status.md)                                                                                                                                                   |
| Elegir variables, backend y política TLS   | [Configuración](development/configuration.md)                                                                                                                                                              |
| Ejecutar y registrar validaciones          | [Pruebas y calidad](development/testing.md), [E2E](../e2e/README.md)                                                                                                                                       |
| Preparar o recuperar fixtures sintéticos   | [Contrato de fixtures](development/synthetic-fixtures.md)                                                                                                                                                  |
| Entender el monorepo y encontrar un módulo | [Arquitectura](architecture.md), [índice de módulos](modules.md)                                                                                                                                           |
| Cambiar comportamiento clínico o contenido | [Contexto y contratos clínicos](clinical/README.md)                                                                                                                                                        |
| Seguir un flujo de atención                | [Diagramas de flujos](workflows/README.md)                                                                                                                                                                 |
| Revisar imágenes y operación autorizada    | [Imágenes](runbooks/frontend-images.md), [go-live](runbooks/frontend-go-live.md), [aceptación offline](runbooks/offline-laptop-acceptance.md), [importación de pacientes](runbooks/bulk-patient-import.md) |
| Consultar deuda e investigaciones          | [Pendientes](backlog.md), [auditorías fechadas](audits)                                                                                                                                                    |

## Dónde mantener cada documento

- `README.md` presenta el proyecto y dirige a las guías.
- `CONTRIBUTING.md`, `AGENTS.md`, `SECURITY.md` y `CODE_OF_CONDUCT.md`
  permanecen en la raíz como puntos de entrada del repositorio.
- `docs/development/` reúne entorno, configuración y validación compartida.
- `docs/clinical/` conserva contratos y referencias de dominio.
- `docs/runbooks/` contiene procedimientos operativos y sus requisitos.
- `docs/workflows/` reúne diagramas y sus fuentes Mermaid.
- `docs/audits/` conserva evidencia histórica con fecha, alcance y limitaciones.
- Los README de `packages/` y `e2e/` permanecen junto al código que describen;
  este índice enlaza sus guías sin duplicar contratos.

Actualizar los enlaces relativos al trasladar contenido. Mantener separados los
contratos vigentes, los planes pendientes y la evidencia de una ejecución pasada.
Las reglas de seguridad y publicación siguen en
[CONTRIBUTING](../CONTRIBUTING.md); reorganizar documentación no autoriza ejecutar
procedimientos sobre un backend ni desplegar cambios.

<!--
Antes de preparar este PR, lee y aplica /CONTRIBUTING.md.
Conserva todas las secciones. Si algo no aplica, escribe “N/A” y explica por qué.
Abrir o actualizar este PR no autoriza a ningún agente a fusionarlo.
-->

## Resultado y alcance

- Problema o issue:
- Cambio observable:
- Paquetes, rutas o workspaces afectados:
- Fuera de alcance o deuda diferida:

## Impacto

<!--
Completa cada línea. “N/A — <razón>” es válido; dejarla vacía o conservar el
placeholder no. Considera visitas, encounters, órdenes, colas, identidad,
offline/sync, FHIR/OMODs, conceptos/UUIDs, rutas, props, slots, RBAC,
accesibilidad, estados de UI, PHI, logs, sesión, service worker y consumidores.
-->

- Clínico y datos: `<impacto o N/A — razón>`
- Backend, content y configuración: `<impacto o N/A — razón>`
- Workspaces, rutas y permisos: `<impacto o N/A — razón>`
- i18n y UI: `<impacto o N/A — razón>`
- Seguridad y privacidad: `<impacto o N/A — razón>`
- Compatibilidad, migración y consumidores: `<impacto o N/A — razón>`

## Evidencia de validación

<!--
Registra todas las validaciones aplicables. Usa PASÓ únicamente para una
validación ejecutada sobre este diff/SHA; usa NO EJECUTADO o BLOQUEADO para las
pendientes y explica el motivo.
Compilar, inspeccionar visualmente o usar --passWithNoTests sin pruebas
descubiertas no demuestra comportamiento funcional.

Estados permitidos: PASÓ, FALLÓ, NO EJECUTADO, BLOQUEADO.
Elimina la fila de ejemplo y agrega las necesarias.
-->

| Estado     | Comando o caso     | Resultado exacto                      | Alcance, ambiente y SHA        |
| ---------- | ------------------ | ------------------------------------- | ------------------------------ |
| `<ESTADO>` | `<comando o caso>` | `<exit code; N/N; resultado o fallo>` | `<paquete/local/DEV/QLTY/SHA>` |

- Regresión automatizada añadida o actualizada:
- Prueba manual o E2E: rol, datos sintéticos, aserción y limpieza:
- Warnings, flakiness o fallos preexistentes/no relacionados: `<evidencia en origin/main o issue previo; de lo contrario, “no verificado como preexistente”>`

## Riesgo, despliegue y rollback

- Nivel de riesgo: bajo / medio / alto — justificación:
- Condiciones de rollout o coordinación:
- Señal para detener o revertir:
- Procedimiento de rollback, o `N/A` con motivo:

## Checklist final

- [ ] El diff coincide con el alcance y no contiene cambios ajenos ni artefactos accidentales.
- [ ] El comportamiento corregido o nuevo tiene una regresión, o se explica concretamente por qué no.
- [ ] Se validaron los paquetes afectados y consumidores relevantes cuando aplica, no solo el archivo editado.
- [ ] La matriz de impacto y la documentación reflejan los contratos modificados, o explican por qué no aplica.
- [ ] Cada `PASÓ` corresponde al diff/SHA actual y los fallos llamados preexistentes tienen evidencia.
- [ ] No hay secretos, PHI, pacientes reales ni capturas o logs identificables.
- [ ] Si hubo prueba clínica, se hizo fuera de producción con datos sintéticos y se registró su limpieza.
- [ ] Si el cambio clínico es de alto riesgo, se solicitó/ejecutó el gate `e2e` o se registró como `BLOQUEADO` con causa.
- [ ] El PR queda para revisión; no fue fusionado por el agente que lo preparó.

# Backlog — Permisos de visibilidad (RBAC) para CRED / Curso de Vida del Niño

> Objetivo: controlar **qué se ve y qué se puede registrar** en el frontend de CRED /
> Niño Sano mediante privilegios OpenMRS, sin romper la experiencia de usuarios con
> acceso completo.

## Estado actual

- 46 extensiones + 10 workspaces + 1 modal en `esm-crecimiento-desarrollo-app`,
  **ninguna con `privilege`** declarado (todo visible para cualquier usuario autenticado).
- Mecanismos ya disponibles en `@sihsalus/esm-rbac`: `RequirePrivilege`,
  `useRequirePrivilege`, `UnauthorizedState`, `AppErrorBoundary`.

## Modelo de permisos

> **Patrón de referencia del equipo** (ya en uso en `esm-care-logbook-app`, antes
> "admission", por Tommy/`Dolsoc` + el hardening de la base RBAC): privilegio en
> minúscula `app:<area>` declarado en `constants.ts`, y gating con `<RequirePrivilege>`.
> `AppErrorBoundary` quedó como **error boundary puro** (`appName`) — ya **no** recibe
> `privilegesRequired`; el control de acceso va por `RequirePrivilege`.

Dos ejes por área funcional:

| Eje | Privilegio | Qué controla |
|---|---|---|
| **Ver** | `app:cred.<area>` | Que el link del dashboard, sus widgets y el contenido se **muestren** |
| **Registrar/Editar** | `app:cred.<area>.edit` | Que se vean/abran los **workspaces y botones de acción** (formularios) |

### Mecanismos de enforcement (igual que care-logbook)

- **Nav links, widgets y action buttons** → envolver con
  `<RequirePrivilege privilege="app:cred.x" hideUnauthorized>` (se ocultan sin permiso).
- **Páginas/dashboards completos** → `<RequirePrivilege privilege="app:cred.x">`
  (muestra `UnauthorizedState` si falta acceso), dentro de un `<AppErrorBoundary appName=…>`.
- Definir cada privilegio como constante en el `constants.ts` del app (como
  `admissionPrivilege = 'app:adt'`), no hardcodear strings en cada componente.

> Referencia viva: `packages/apps/esm-care-logbook-app/src/root.component.tsx` y
> `src/links/*.component.tsx`.

---

## EPIC 0 — Infraestructura de permisos (habilitador, va primero)

| # | Historia | Criterio de aceptación |
|---|---|---|
| 0.1 | Crear los privilegios en el backend (Liquibase/metadata OMOD) | Los `app:cred.*` y `app:cred.*.edit` existen y son asignables a roles |
| 0.2 | Definir roles MINSA y asignar privilegios | Roles tipo *Enfermera CRED*, *Médico*, *Admisión* mapeados a sus `app:cred.*` |
| 0.3 | `constants.ts` con las constantes de privilegio en CRED | `credWellChildPrivilege = 'app:cred.wellChild'`, etc., reutilizadas por los componentes |
| 0.4 | Definir UX de "sin permiso" | ¿Ocultar (`hideUnauthorized`) o mostrar `UnauthorizedState`? Acordado por superficie |

## EPIC 1 — Curso de Vida del Niño (grupo raíz)

| # | Superficie (extensión / slot) | Privilegio | Nota |
|---|---|---|---|
| 1.1 | `well-child-care-dashboard-group-link` → `patient-chart-dashboard-slot` | `app:cred.cursoVida` | Oculta **toda** la entrada del grupo en el nav del chart |
| 1.2 | Las 5 rutas de grupo (`*-dashboard-route`) | hereda `app:cred.cursoVida` | Que no sean navegables vía URL directa |

## EPIC 2 — Control de Niño Sano (`app:cred.wellChild` / `app:cred.wellChild.edit`)

| # | Superficie | Privilegio |
|---|---|---|
| 2.1 | `well-child-care`, `well-child-care-dashboard`, `well-child-care-dashboard-link`, `…-route` | `app:cred.wellChild` |
| 2.2 | `growth-chart-overview-widget` | `app:cred.wellChild` |
| 2.3 | `cred-checkouts`, `cred-controls-timeline` (cronograma CRED) | `app:cred.wellChild` |
| 2.4 | `cred-matrix`, `anemia-screening-widget`, `supplementation-tracker-widget`, `screening-indicators-widget` | `app:cred.wellChild` |
| 2.5 | `development-overview-widget` | `app:cred.wellChild` |
| 2.6 | Workspaces `wellchild-control-form`, `test-peruano-form` | `app:cred.wellChild.edit` |

## EPIC 3 — Esquema de Vacunación Infantil (`app:cred.immunization` / `app:cred.immunization.edit`)

| # | Superficie | Privilegio |
|---|---|---|
| 3.1 | `child-immunization-schedule`, `…-dashboard`, `…-dashboard-route` | `app:cred.immunization` |
| 3.2 | `vaccination-appointment`, `vaccination-schedule` | `app:cred.immunization` |
| 3.3 | Registro de vacunas / cita (action) | `app:cred.immunization.edit` |

## EPIC 4 — Atención Neonatal (`app:cred.neonatal` / `app:cred.neonatal.edit`)

| # | Superficie | Privilegio |
|---|---|---|
| 4.1 | `neonatal-care-dashboard`, `…-link`, `…-route` | `app:cred.neonatal` |
| 4.2 | `neonatal-attention-chart`, `neonatal-counseling-chart`, `neonatal-alojamiento-conjunto-chart`, `neonatal-evaluation-chart` | `app:cred.neonatal` |
| 4.3 | Perinatal: `prenatal-antecedents-history`, `prenatal-history-widget`, `labour-history-chart`, `detalles-nacimiento-chart`, `pregnancy-details-chart` | `app:cred.neonatal` |
| 4.4 | Vitales RN: `grow-chart`, `newborn-balance-overview-chart`, `newborn-biometrics-base-chart` | `app:cred.neonatal` |
| 4.5 | Workspaces `newborn-anthropometric-form`, `newborn-fluidBalance-form`, `perinatal-register-form`, `maternal-conditions-form-workspace` | `app:cred.neonatal.edit` |

## EPIC 5 — Estimulación Temprana (`app:cred.earlyStim` / `app:cred.earlyStim.edit`)

| # | Superficie | Privilegio |
|---|---|---|
| 5.1 | `early-stimulation-dashboard`, `…-link`, `…-route` | `app:cred.earlyStim` |
| 5.2 | `stimulation-sessions-widget`, `stimulation-followup-widget`, `stimulation-counseling-widget` | `app:cred.earlyStim` |
| 5.3 | Registro de sesiones (workspace/action) | `app:cred.earlyStim.edit` |

## EPIC 6 — Nutrición Infantil (`app:cred.nutrition` / `app:cred.nutrition.edit`)

| # | Superficie | Privilegio |
|---|---|---|
| 6.1 | `child-nutrition-dashboard`, `…-link`, `…-route` | `app:cred.nutrition` |
| 6.2 | `nutritional-assessment-widget`, `feeding-counseling-widget`, `nutrition-followup-widget` | `app:cred.nutrition` |
| 6.3 | Registro evaluación/consejería (workspace/action) | `app:cred.nutrition.edit` |

## EPIC 7 — Transversales

| # | Superficie | Privilegio |
|---|---|---|
| 7.1 | `antecedentes-patologicos-overview` + workspace | `app:cred.antecedentes` / `app:cred.antecedentes.edit` |
| 7.2 | `cred-form-action-button` (`action-menu-items-slot`) | `app:cred.wellChild.edit` (botón global de formularios CRED) |
| 7.3 | Workspaces `adverse-reaction-form-workspace`, `conditions-filter-form-workspace`, `forms-selector-workspace` | `app:cred.*.edit` del área que los lanza |

## EPIC 8 — Verificación

| # | Historia | Criterio |
|---|---|---|
| 8.1 | Unit tests de gating | Render con/sin privilegio oculta/muestra cada widget clave |
| 8.2 | e2e por rol | *Enfermera CRED* ve Niño Sano pero no lo que no le toca; *Admisión* no ve nada clínico |
| 8.3 | Smoke de no-regresión | Usuario con todos los privilegios ve todo igual que hoy |

---

## Resumen de privilegios a crear

**Visibilidad** — `app:cred.cursoVida`, `app:cred.wellChild`, `app:cred.immunization`,
`app:cred.neonatal`, `app:cred.earlyStim`, `app:cred.nutrition`, `app:cred.antecedentes`.

**Registro/Edición** — `app:cred.<area>.edit` por cada área anterior que tenga formularios.

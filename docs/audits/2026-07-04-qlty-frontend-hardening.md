# QLTY frontend hardening audit - 2026-07-04

Target QLTY: `https://gidis-hsc-qlty.inf.pucp.edu.pe/openmrs`

Scope:

- Compared the deployed SPA `frontend.json`, `importmap.json` and `routes.registry.json` with the local `origin/main` route files.
- Ran read-only backend checks with authenticated GET requests. No POST, PUT, DELETE, save smoke, seed restore or deployment action was executed.
- Treated UI save workflows as pending unless a real route/workspace/data-read check was completed.

## Summary

- The priority route registry deployed in QLTY matches the local route files for the audited modules. The missing RBAC guard counts below are therefore source debt, not only a QLTY packaging drift.
- QLTY has the core backend modules needed by several workflows: `fhir2` `4.1.0`, `fua` `1.0.80`, `queue` `3.0.0`, `billing` `2.3.0`, `stockmanagement` `3.1.1`, `o3forms` `2.3.0` and `webservices.rest` `3.5.0.69fa31`.
- The old QLTY note about FHIR2 `Immunization` returning `501` is stale for the checked query. `GET /ws/fhir2/R4/Immunization?patient=<synthetic-empty-uuid>` returned HTTP `200` with an empty FHIR Bundle.
- The old QLTY note about Glasgow concepts returning `404` is stale. The configured eye, verbal, motor and total Glasgow concept UUIDs resolved with HTTP `200`.
- FUA is installed, but `GET /ws/module/fua/estado/list` and `GET /ws/module/fua/solicitudes` returned a backend privilege exception requiring `Read Fua Privilege`. The frontend must not treat OMOD presence as enough for production readiness.
- `GET /ws/rest/v1/sihsalus/audit` returned `404 Unknown resource`, so `@sihsalus/esm-audit-logger` still needs a backend endpoint/content contract before sensitive events can be considered server-side auditable.
- The recommended visit-type endpoint under `/etl-latest/etl/patient/...` returned HTTP `404`. Keep `showRecommendedVisitTypeTab=false` in QLTY unless a real backend/config is added.
- `@sihsalus/esm-indicadores-app` is deployed with `reportesSqlApiPath: "http://127.0.0.1:8000"`, which points normal browsers to their own localhost instead of the QLTY host. Public health checks for reportes-sql also failed (`/services/reportes-sql/health` returned `404`; `/openmrs/services/reportes-sql/health` returned `502`), so the app should be expected to fall back to demo mode until gateway/backend routing is fixed.

## Route RBAC contrast

The counts below are identical in the QLTY `routes.registry.json` and local `packages/apps/*/src/routes.json`.

| Module | Missing `privileges` | Backend dependencies | Status |
| --- | ---: | --- | --- |
| `esm-stock-management-app` | 35/35 | `fhir2`, `webservices.rest` | No route-level RBAC coverage; `stockmanagement` OMOD is used but not declared. |
| `esm-ward-app` | 27/29 | `fhir2`, `webservices.rest`, `emrapi` | Most workspaces/actions are unguarded. |
| `esm-emergency-app` | 20/22 | `fhir2`, `webservices.rest` | Triage/workflow actions need route and button guards. |
| `esm-dispensing-app` | 18/21 | `fhir2`, `webservices.rest` | Sensitive medication flows remain underguarded. |
| `esm-salud-materna-app` | 21/45 | `fhir2`, `webservices.rest` | Mixed coverage; form launchers need role tests. |
| `esm-billing-app` | 11/19 | `billing`, `webservices.rest` | Payment/admin modals still need explicit privileges. |
| `esm-atencion-ambulatoria-app` | 1/8 | `fhir2`, `webservices.rest` | Main clinical encounter extension remains unguarded. |
| `esm-fua-app` | 8/18 | `webservices.rest` | OMOD is present, but backend denies reads without FUA privilege. |
| `esm-service-queues-app` | 9/25 | `fhir2`, `webservices.rest`, `queue` | Queue route coverage is partial. |
| `esm-patient-immunizations-app` | 1/10 | `fhir2`, `webservices.rest` | FHIR2 read is live for the checked empty-patient query. |
| `esm-patient-vitals-app` | 2/9 | `fhir2`, `webservices.rest` | Glasgow concepts now resolve; save smoke remains pending. |
| `esm-indicadores-app` | 2/2 | `webservices.rest` | Both deployed entries lack privileges; backend health is not reachable through the configured path. |

## Hardening checks

- `node packages/tooling/scripts/audit-workspaces.js --report-only` still reports two hard failures: `service-queues-patient-vitals` and `service-queues-visit-note` point to missing workspace group `service-queues`.
- Packages that use FHIR access patterns but do not declare `fhir2` in `routes.json` are `esm-dyaku-app` and `esm-patient-task-list-app`.
- `esm-stock-management-app` calls many `/ws/rest/v1/stockmanagement/*` endpoints and its README requires the stock management backend module, but `routes.json` only declares `fhir2` and `webservices.rest`.
- QLTY imports `esm-psicologia-app`, `esm-tamizajes-app` and `esm-terapia-fisica-app`, but those packages still do not have package-level READMEs documenting limits, backend dependencies, permissions and auditable events.
- The deployed QLTY `frontend.json` only has SIHSALUS-specific overrides for indicadores, vitals BMI and selected CRED concepts/forms. It does not override the broader RBAC, queue, FUA, visit or audit settings.
- `@sihsalus/esm-audit-logger` is present as a library and is used by the RBAC error boundary, but clinical and administrative apps do not yet call `useAuditLogger` directly for patient search, chart open, clinical forms, orders, dispensing, FUA, billing, stock, ward or emergency events.

## Updated TODO interpretation

- Vaccination: do not keep tracking QLTY as a live `501` blocker for FHIR2 `Immunization` reads. Keep the Ampath/REST fallback, but the next validation should be an end-to-end save/read smoke with real content and role permissions.
- Emergency/vitals: Glasgow content is present in QLTY. The remaining risk is save behavior, required encounter/form concepts and translated backend errors.
- FUA: the OMOD exists, but role/content privilege mapping is not complete for the tested user. Add/seed the FUA read/write privileges and align frontend `privileges` before enabling the workflow broadly.
- Visit start: recommended visit type must stay hidden in QLTY while `/etl-latest/etl/patient/...` returns `404`.
- Indicadores: the frontend fallback is expected until `reportesSqlApiPath` points to a reachable backend through the QLTY gateway.
- RBAC doctor: there is no completed role matrix or role-based smoke evidence in the frontend repo. Test doctor/clinical, admission, pharmacy, lab, billing/cashier, admin and read-only users after the backend privilege/content seed is updated.

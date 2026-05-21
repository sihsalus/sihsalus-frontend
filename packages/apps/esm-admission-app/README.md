# SIH Salus Admission / Atenciones App

Microfrontend para concentrar flujos de admision, atencion inicial y reporte operativo por UPS. Cubre evidencia funcional del perfil `N1.ADM` de la acreditacion SIHCE MINSA 373-2025, pero no debe confundirse con hospitalizacion ni con un modulo ERP de admisiones.

Terminologia recomendada en UI:

- Usar `Atenciones por UPS`, `Historial de atenciones` o `Reporte de atenciones por UPS` cuando la pantalla liste visitas/consultas por servicio.
- Reservar `Admision` para el proceso operativo de registro, validacion de identidad, apertura de atencion o ingreso.
- Evitar `Admisiones` como nombre generico si la pantalla muestra consultas ambulatorias, sesiones o visitas finalizadas.

## Funcionalidad

- Reporte de admisiones por UPS/servicio en `/admission`.
- Fusion de historias clinicas duplicadas en `/admission/merge`, delegando al flujo legacy de OpenMRS `mergePatients.form`.
- Programacion de turnos desde `/admission/patient/:uuid`, mostrando turnos proximos y abriendo el workspace real de Appointments para registrar citas con prestadores.
- Resumen de identificacion minima del paciente para pantallas clinicas que consumen `patient-info-slot`.
- Accesos desde menu de aplicaciones, dashboard de inicio y acciones superiores.

## Limites funcionales

- No administra camas ni hospitalizacion; eso pertenece a `esm-ward-app` / bed management.
- No reemplaza citas; solo puede abrir el workspace real de Appointments cuando se agenda un turno.
- No debe guardar datos clinicos fuera de una visita/consulta formal.
- No debe asumir que todos los establecimientos usan las mismas UPS, ubicaciones o tipos de visita.

## Dependencias backend/content

- OpenMRS REST para pacientes, visitas, encounters, identificadores y merge legacy.
- Tipos de visita y encounter configurados para consulta/atencion.
- Ubicaciones/UPS correctamente modeladas en el backend.
- `personattributetypes` y conceptos adicionales cuando se validen campos de admision del content package.
- Appointments instalado/configurado si se habilita programacion de turnos.

## Evidencia MINSA

Los documentos usados para la auditoria de admision viven en `accreditation/`:

- [`accreditation/requerimientos_acreditacion_SIHCE_MINSA_373-2025.csv`](accreditation/requerimientos_acreditacion_SIHCE_MINSA_373-2025.csv): matriz completa extraida de la norma.
- [`accreditation/requerimientos_admision_SIHCE_MINSA_373-2025.csv`](accreditation/requerimientos_admision_SIHCE_MINSA_373-2025.csv): subconjunto del perfil de admision.
- [`accreditation/validacion_admision_SIHCE_MINSA_373-2025.md`](accreditation/validacion_admision_SIHCE_MINSA_373-2025.md): validacion funcional, brechas y puntaje proyectado.

Puntaje proyectado actual: `18/24` al desplegar la app y el content package asociado.

## Desarrollo

```sh
SIHSALUS_DEV_APPS=esm-admission-app,esm-patient-registration-app yarn start
```

## Validacion

```sh
yarn turbo run typescript --filter=@sihsalus/esm-admission-app --concurrency=1
yarn turbo run build --filter=@sihsalus/esm-admission-app --concurrency=1
CI=1 E2E_BASE_URL=http://localhost:8080/openmrs/spa E2E_API_BASE_URL=http://localhost:8080/openmrs yarn playwright test e2e/tests/admission-validation.spec.ts --project=desktop -g "duplicate patient merge|admission report"
```

La prueba completa de campos de admision requiere que el content package este desplegado, porque varios campos dependen de `personattributetypes` y conceptos nuevos.

## Riesgos conocidos

- El nombre del modulo puede inducir a error si se usa para reportes de atenciones por UPS.
- El flujo depende de configuracion real de ubicaciones/UPS; datos demo incompletos producen reportes pobres o confusos.
- Las integraciones con citas deben delegar al workspace de Appointments; duplicar esa logica genera divergencia.

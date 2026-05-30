# SIH Salus Libro de Atenciones App

Microfrontend para el libro operativo de atenciones por UPSS/servicio. El package interno es `esm-care-logbook-app`; la ruta `/admission` se conserva por compatibilidad historica.

Tambien concentra evidencia funcional del perfil `N1.ADM` de la acreditacion SIHCE MINSA 373-2025, donde "admision" aparece como perfil normativo amplio de identificacion, registro, programacion y documentacion inicial.

## Funcionalidad

- Registro/listado de atenciones por UPSS/servicio en `/admission`.
- Fusion de historias clinicas duplicadas en `/admission/merge`, delegando al flujo legacy de OpenMRS `mergePatients.form`.
- Programacion de turnos desde `/admission/patient/:uuid`, mostrando turnos proximos y abriendo el workspace real de Appointments para registrar citas con prestadores.
- Resumen de identificacion minima del paciente para pantallas clinicas que consumen `patient-info-slot`.
- Accesos desde menu de aplicaciones, dashboard de inicio y acciones superiores.

## Terminologia

- UI/menu: `Libro de Atenciones`.
- Titulo de pantalla: `Libro de Atenciones`.
- Nombre anterior: `Registro de Atenciones`; no usar en copy nuevo salvo notas historicas.
- Tabla/historial: atenciones activas y finalizadas por UPSS/servicio.
- Ruta tecnica: `/admission`.
- Package tecnico: `@sihsalus/esm-care-logbook-app`.

Evitar `Admisiones` como label visible general: sugiere hospitalizacion o ingreso administrativo, mientras que esta pantalla lista atenciones/consultas por servicio.

## Evidencia MINSA

Los documentos usados para la auditoria de admision viven en `accreditation/`:

- [`accreditation/requerimientos_acreditacion_SIHCE_MINSA_373-2025.csv`](accreditation/requerimientos_acreditacion_SIHCE_MINSA_373-2025.csv): matriz completa extraida de la norma.
- [`accreditation/requerimientos_admision_SIHCE_MINSA_373-2025.csv`](accreditation/requerimientos_admision_SIHCE_MINSA_373-2025.csv): subconjunto del perfil de admision.
- [`accreditation/validacion_admision_SIHCE_MINSA_373-2025.md`](accreditation/validacion_admision_SIHCE_MINSA_373-2025.md): validacion funcional, brechas y puntaje proyectado.

Puntaje proyectado actual: `18/24` al desplegar la app y el content package asociado.

## Desarrollo

```sh
SIHSALUS_DEV_APPS=esm-care-logbook-app,esm-patient-registration-app yarn start
```

## Validacion

```sh
yarn turbo run typescript --filter=@sihsalus/esm-care-logbook-app --concurrency=1
yarn turbo run build --filter=@sihsalus/esm-care-logbook-app --concurrency=1
CI=1 E2E_BASE_URL=http://localhost:8080/openmrs/spa E2E_API_BASE_URL=http://localhost:8080/openmrs yarn playwright test e2e/tests/admission-validation.spec.ts --project=desktop -g "duplicate patient merge|admission report"
```

La prueba completa de campos de admision requiere que el content package este desplegado, porque varios campos dependen de `personattributetypes` y conceptos nuevos.

## Riesgos conocidos

- La ruta tecnica heredada (`/admission`) puede inducir a error si se expone como `Admisiones`; en UI debe mantenerse `Libro de Atenciones`.
- El flujo depende de configuracion real de ubicaciones/UPS; datos demo incompletos producen reportes pobres o confusos.
- Las integraciones con citas deben delegar al workspace de Appointments; duplicar esa logica genera divergencia.

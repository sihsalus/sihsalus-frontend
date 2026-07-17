# SIH Salus Libro de Atenciones App

Microfrontend para el libro operativo de atenciones por UPSS/servicio. El package interno es `esm-care-logbook-app` y su ruta canónica es `/home/care-logbook`; `/admission` y `/home/admission` solo redirigen para conservar enlaces históricos.

Tambien concentra evidencia funcional del perfil `N1.ADM` de la acreditacion SIHCE MINSA 373-2025, donde "admision" aparece como perfil normativo amplio de identificacion, registro, programacion y documentacion inicial.

## Funcionalidad

- Registro/listado de atenciones por UPSS/servicio en `/home/care-logbook`.
- Fusion de historias clinicas duplicadas en `/home/care-logbook/merge`, delegando al flujo legacy de OpenMRS `findDuplicatePatients.htm`, que luego abre `mergePatients.form` para comparar y fusionar los pacientes seleccionados.
- Programacion de turnos desde `/home/care-logbook/patient/:uuid`, mostrando turnos proximos y abriendo el workspace real de Appointments para registrar citas con prestadores.
- Resumen de identificacion minima del paciente para pantallas clinicas que consumen `patient-info-slot`.
- Accesos desde menu de aplicaciones, dashboard de inicio y acciones superiores.
- Ubicacion de pacientes sin DNI mediante fecha/hora, HCE o codigo temporal, estado de identificacion, responsable, servicio, ubicacion y estado de visita.

## Terminologia

- UI/menu: `Libro de Atenciones`.
- Titulo de pantalla: `Libro de Atenciones`.
- Nombre anterior: `Registro de Atenciones`; no usar en copy nuevo salvo notas historicas.
- Tabla/historial: atenciones activas y finalizadas por UPSS/servicio.
- Ruta tecnica canonica: `/home/care-logbook`.
- Package tecnico: `@sihsalus/esm-care-logbook-app`.

Evitar `Admisiones` como label visible general: sugiere hospitalizacion o ingreso administrativo, mientras que esta pantalla lista atenciones/consultas por servicio.

## Identidad y pacientes sin documento

El Libro de Atenciones no debe depender del DNI como identificador principal. Cada fila debe seguir siendo util cuando el paciente esta no identificado o con datos incompletos.

Columnas/criterios operativos esperados:

- fecha y hora de atencion,
- HCE o codigo temporal,
- documento cuando existe,
- estado de identificacion,
- condicion de comunicacion,
- responsable o acompanante,
- fecha de nacimiento cuando existe,
- paciente,
- direccion cuando existe,
- sexo/edad,
- servicio/UPSS,
- ubicacion,
- estado de visita.

La busqueda interna debe cubrir paciente, HCE/codigo temporal, documento, responsable, servicio y ubicacion. `DNI` es solo un dato mas, no el pivote obligatorio.

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

- Las rutas heredadas `/admission` y `/home/admission` existen únicamente como redirecciones temporales hacia `/home/care-logbook`; no debe montarse ahí una segunda implementación.
- El alias interno de dashboard `admission` se conserva oculto para migrar configuraciones existentes de `defaultDashboardPerRole`; toda navegación visible usa `care-logbook`.
- El flujo depende de configuracion real de ubicaciones/UPS; datos demo incompletos producen reportes pobres o confusos.
- Las integraciones con citas deben delegar al workspace de Appointments; duplicar esa logica genera divergencia.

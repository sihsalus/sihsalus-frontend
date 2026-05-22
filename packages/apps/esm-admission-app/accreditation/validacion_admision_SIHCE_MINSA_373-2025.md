# Validacion inicial - Perfil Admision SIHCE MINSA 373-2025

Fuente de requisitos: [`requerimientos_admision_SIHCE_MINSA_373-2025.csv`](requerimientos_admision_SIHCE_MINSA_373-2025.csv).

## Resumen

- Cumple: 8
- Parcial: 8
- No encontrado: 8

## Cambios implementados para admision

- Se separo `Tipo de sangre` en `Grupo sanguineo` y `Factor Rh`.
- Se agrego seccion `Historia clinica` con `Estado de historia clinica` y `Tipo de archivo de historia clinica`.
- Se agrego acreditacion manual de seguro: `Estado de acreditacion de seguro` y `Fecha/hora de acreditacion`.
- Se agregaron como identificadores visibles por defecto: DNI, CE, pasaporte y documento de identidad extranjero.
- Se agrego `Nacionalidad` como dato de filiacion condicionado a identificadores extranjeros con valor (CE, pasaporte o documento extranjero), para reforzar continuidad manual ante no disponibilidad de consulta a Migraciones.
- Se agrego app separada `@sihsalus/esm-admission-app` para concentrar evidencia funcional de admision.
- Se movio la entrada SPA de fusion de historias duplicadas a `/admission/merge`, usando el flujo legacy de OpenMRS `mergePatients.form`.
- Se agrego vista/reporte `/admission` de admisiones por UPS/servicio con fecha, hora, paciente, HC, ubicacion y estado.
- En `/admission/patient/:uuid` se agrego seccion `Programacion de turnos`: lista turnos proximos del paciente y abre el workspace real `appointments-form-workspace` para consultar disponibilidad, seleccionar cupo y registrar citas con prestadores.
- Se agrego extension de identificacion minima del paciente para pantallas clinicas que exponen `patient-info-slot`: nombre, HC/documento, edad/nacimiento/sexo y servicio/ubicacion activa.
- En el content package se agregaron los `personattributetypes` y conceptos requeridos para los nuevos campos.

## Puntaje estimado tras estos cambios

- Cumple proyectado al desplegar metadata y la app de admision: 18/24.
- Parcial proyectado: 2/24.
- No encontrado proyectado: 5/24.
- Aun no alcanza 20. Para llegar a 20 faltan al menos 2 criterios adicionales, principalmente integraciones externas RENIEC/IAFAS-SIS/RENHICE o evidencia funcional adicional de referencias/codigo estandar MINSA.

## Prueba en ambiente

- Fecha: 2026-05-09.
- Comando: `CI=1 yarn playwright test e2e/tests/admission-validation.spec.ts --project=desktop`.
- Resultado inicial: 1/1 test paso contra `E2E_BASE_URL` y `E2E_API_BASE_URL` del `.env`.
- Alcance probado: login, apertura autenticada de registro de paciente, campos visibles de filiacion, seguro, responsable, identificadores, nacimiento, paciente no identificado, boton de guardado, API de tipos de identificador y ubicacion de sesion.
- Observacion: `E2E_LOGIN_DEFAULT_LOCATION_UUID=44c3efb0-2583-4c80-a79e-1f756a03c0a1` devuelve 404 en QLTY. La prueba uso fallback a una ubicacion activa (`Casita Azul`, UUID `35d2234e-129a-4c40-abb2-1ae0b72c1603`) para poder validar el flujo.
- Validacion tecnica posterior: `yarn turbo run typescript --filter=@sihsalus/esm-admission-app --filter=@sihsalus/esm-patient-registration-app --concurrency=1` paso 22/22 tareas.
- Build posterior: `yarn turbo run build --filter=@sihsalus/esm-admission-app --concurrency=1` paso 23/23 tareas; el paquete `sihsalus-esm-admission-app.js` compilo correctamente.
- Prueba E2E posterior: `CI=1 E2E_BASE_URL=http://localhost:8080/openmrs/spa E2E_API_BASE_URL=http://localhost:8080/openmrs yarn playwright test e2e/tests/admission-validation.spec.ts --project=desktop -g "duplicate patient merge|admission report"` paso 2/2 con `SIHSALUS_DEV_APPS=esm-admission-app,esm-patient-registration-app`.
- La prueba completa con campos nuevos requiere desplegar primero el content package, porque QLTY aun no tiene los nuevos `personattributetypes`.

## Puntaje estimado

- Criterios de admision evaluados: 24.
- Cumple con evidencia suficiente: 8.
- Parcial: 8.
- No encontrado: 8.
- Lectura estricta para acreditacion: 8/24; no alcanza 20.
- Lectura optimista contando cambios proyectados como avance: 18/24; tampoco alcanza 20.

## Matriz

| Codigo | Estado | Evidencia / brecha |
| --- | --- | --- |
| N1.ADM.01.01 | Cumple proyectado | Registro guarda datos estructurados del paciente y atributos configurables. En `/admission/patient/:uuid` se muestra historial de ingresos por UPS/servicio desde visitas, separando evidencia de filiacion e ingresos. |
| N1.ADM.01.02 | Cumple proyectado | Hay campos de seguro en registro (`insuranceType`, `insuranceCode`) y atributos de visita en billing (`insuranceScheme`, `policyNumber`). Se agrego registro manual de estado y fecha/hora de acreditacion de seguro; sigue pendiente integracion automatica IAFAS/SIS para N1.ADM.01.03. |
| N1.ADM.01.03 | No encontrado | No se encontro integracion/consulta a servicios de IAFAS, SIS o aseguradores. |
| N1.ADM.02.01 | Cumple | Colas registran servicio, ubicacion, prioridad, estado y origen/destino mediante `visit-queue-entry`; `queueComingFrom` se conserva al transferir. |
| N1.ADM.02.02 | Cumple | Permite paciente no identificado: toggle de nombre desconocido usa nombres por defecto y atributo `unidentifiedPatientAttributeTypeUuid`. |
| N1.ADM.02.03 | Cumple | Permite multiples identificadores configurables y seleccionables por tipo. |
| N1.ADM.02.04 | Parcial | Hay autogeneracion de identificadores por IdGen. Falta confirmar que el identificador generado sea el codigo estandar MINSA/RENHICE de usuario de salud. |
| N1.ADM.02.05 | Cumple | Identificadores se guardan junto con el paciente y cada visita/cola referencia `patientUuid`; el backend conserva el vinculo con atenciones. |
| N1.ADM.02.06 | Cumple proyectado | Se movio la fusion de historias duplicadas a la app de admision (`/admission/merge`) usando el flujo legacy de OpenMRS (`/admin/patients/mergePatients.form`). OpenMRS core soporta `PatientService.mergePatients`. |
| N1.ADM.02.07 | Cumple | Busqueda y pantallas de cola usan identificadores/UUID de paciente para recuperar partes del registro. |
| N1.ADM.02.08 | Cumple proyectado | Se agrego atributo de persona `Estado de historia clinica` con valores activa, pasiva y eliminada. |
| N1.ADM.03.01 | Parcial | Datos demograficos/personales se guardan en `patient.person`; la separacion fisica respecto a datos clinicos depende del modelo OpenMRS/backend, no esta demostrada en frontend. |
| N1.ADM.03.02 | No encontrado | No se encontro consulta RENIEC para DNI. |
| N1.ADM.03.03 | Cumple | Captura manual de identidad: nombres, genero, fecha de nacimiento, direccion, telefono e identificadores. |
| N1.ADM.03.04 | Cumple proyectado | CE, pasaporte y documento de identidad extranjero quedan como tipos de identificador por defecto junto con DNI. Al registrar un identificador extranjero se habilita `Nacionalidad` como dato discreto de filiacion, cubriendo captura manual ante no disponibilidad de consulta a Migraciones. |
| N1.ADM.03.05 | Cumple | Config Peru agrega filiacion complementaria: lugar de nacimiento, estado civil, etnia, idioma, ocupacion, educacion, religion, grupo sanguineo, seguro y responsable. |
| N1.ADM.03.06 | Cumple proyectado | Se agrego extension `clinicalIdentitySummary` en `patient-info-slot` con nombre, HC/documento, edad/nacimiento/sexo y servicio/ubicacion activa. Falta evidencia visual final en cada pantalla clinica objetivo si alguna no consume ese slot. |
| N1.ADM.03.07 | Cumple | Edad se calcula desde fecha de nacimiento; el formulario tambien calcula fecha a partir de edad estimada. |
| N1.ADM.03.08 | Cumple proyectado | Se separo la captura en `Grupo sanguineo` y `Factor Rh`, respaldados por atributos y conceptos discretos en el content package. |
| N1.ADM.04.01 | Cumple proyectado | Se agrego vista `/admission` de admisiones por UPS/servicio basada en visitas, con fecha, hora, paciente, HC, servicio/UPS, ubicacion y estado. |
| N1.ADM.04.02 | Cumple proyectado | Se agrego atributo de persona `Tipo de archivo de historia clinica` con valores comun y especial. |
| N1.ADM.05.01 | Cumple | La cola/admisión operativa captura ubicacion y servicio/UPS mediante `queueLocation` y `service`. |
| N1.ADM.05.02 | Cumple | Citas, visitas y entradas de cola manejan fecha/hora en campos discretos (`startDateTime`, `startedAt`, `endedAt`). |
| N1.ADM.05.03 | Cumple proyectado | Desde `/admission/patient/:uuid` se listan turnos proximos del paciente y el boton `Programar turno` abre `appointments-form-workspace`. Ese flujo de Appointments consulta servicios/prestadores, disponibilidad/conflictos, selecciona cupo y registra la cita. |

## Brechas principales

1. Integracion externa: RENIEC, IAFAS/SIS y RENHICE no aparecen implementados en frontend. Para Migraciones, la brecha principal queda como evidencia documental/convenio si el servicio externo esta disponible para el sector.
2. Referencias funcionales y codigo estandar MINSA/RENHICE siguen siendo las oportunidades mas cercanas para subir puntaje.
3. Algunos criterios dependen del backend OpenMRS o configuracion de metadata; falta validar contra ambiente real despues de desplegar content package.

# SIH Salus Libro de Atenciones App

Microfrontend para el libro operativo de atenciones por tipo de visita y UPSS. El package interno es `esm-care-logbook-app` y su ruta canónica es `/home/care-logbook`; `/admission` y `/home/admission` solo redirigen para conservar enlaces históricos.

Tambien concentra evidencia funcional del perfil `N1.ADM` de la acreditacion SIHCE MINSA 373-2025, donde "admision" aparece como perfil normativo amplio de identificacion, registro, programacion y documentacion inicial.

## Funcionalidad

- Libro de aperturas: una fila por `visit`, no por encuentro clínico ni por cita futura.
- Vista inicial **Hoy**, según America/Lima; **Histórico** permite rango inclusivo de fechas o todo el histórico.
- Tabla de seis columnas operativas: fecha/hora, paciente con HCE o código temporal, tipo de visita, UPSS, estado de atención y SIS. Cada fila usa la expansión de Carbon para mostrar documento, identificación, responsable, nacimiento, edad, sexo, dirección y comunicación sin perder esos datos de la búsqueda o del CSV. La tabla mantiene desplazamiento horizontal contenido en pantallas pequeñas.
- **Limpiar filtros** restablece búsqueda, tipo, UPSS y estado sin cambiar el periodo consultado.
- Filtros por tipo de atención (`visitType`), UPSS y estado, además de búsqueda libre. Incluye aperturas activas y finalizadas, ordenadas de más reciente a más antigua.
- Se recorren todas las páginas REST del periodo antes de mostrar resultados o permitir exportar. `admissionReportPageSize` controla el lote REST, no el límite del histórico. La tabla se pagina de forma independiente y el CSV incluye todos los resultados filtrados, aunque sus detalles estén cerrados. Conserva las 16 columnas anteriores y agrega al final el estado de atención. El número de orden del CSV es la posición en el reporte filtrado, no un turno de la cola.
- El permiso de consulta sigue siendo `app:home.libroAtenciones`: debe asignarse al rol Admision en el content package. No concede edición, fusión de pacientes ni acceso adicional a la historia clínica. El enlace existente del slot `homepage-dashboard-slot` se muestra al recibir ese permiso; no se duplica ni se altera el orden global.
- Dependencias: REST `visit` con `includeInactive`, `fromStartDate`, `toStartDate`, `startIndex` y enlaces de paginación; privilegios de lectura de visitas, pacientes y relaciones. Una página o lectura de responsables fallida muestra el error del reporte y bloquea la exportación; no se interpreta como ausencia de datos. Las relaciones se consultan una vez por paciente, con un máximo de cinco peticiones simultáneas.

- Registro/listado de atenciones por tipo de visita y UPSS en `/home/care-logbook`.
- Fusion de historias clinicas duplicadas en `/home/care-logbook/merge`, accesible como **Fusionar historias duplicadas** desde el menu de aplicaciones y desde el menu de acciones del paciente. La tarjeta del menu de aplicaciones usa `app-menu-item-slot`, despues de Administracion de camas (`order: 100`), y solo aparece en linea con los permisos `app:home.libroAtenciones`, `app:home.libroAtenciones.editar` y `app:opciones.fusionarPacientes`. Delega al flujo legacy de OpenMRS `findDuplicatePatients.htm`, que luego abre `mergePatients.form` para comparar y fusionar los pacientes seleccionados. No se ofrece como boton en el encabezado del Libro de Atenciones ni como accion independiente de la barra superior.
- Programacion de turnos desde `/home/care-logbook/patient/:uuid`, mostrando turnos proximos y abriendo el workspace real de Appointments para registrar citas con prestadores.
- Resumen de identificacion minima del paciente para pantallas clinicas que consumen `patient-info-slot`.
- Accesos al Libro de Atenciones desde el menu de aplicaciones y el dashboard de inicio.
- Ubicacion de pacientes sin DNI mediante fecha/hora, HCE o codigo temporal, estado de identificacion, responsable, tipo de visita, UPSS y estado de visita.

## Terminologia

- UI/menu: `Libro de Atenciones`.
- Titulo de pantalla: `Libro de Atenciones`.
- Nombre anterior: `Registro de Atenciones`; no usar en copy nuevo salvo notas historicas.
- Tabla/historial: atenciones activas y finalizadas, con tipo de visita y UPSS en columnas independientes.
- Ruta tecnica canonica: `/home/care-logbook`.
- Package tecnico: `@sihsalus/esm-care-logbook-app`.

Evitar `Admisiones` como label visible general: sugiere hospitalizacion o ingreso administrativo, mientras que esta pantalla lista atenciones/consultas por servicio.

## Identidad y pacientes sin documento

El Libro de Atenciones no debe depender del DNI como identificador principal. Cada fila debe seguir siendo util cuando el paciente esta no identificado o con datos incompletos.

Datos operativos disponibles en la fila, su detalle desplegable y la exportación:

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
- tipo de visita,
- UPSS,
- estado de visita.

La busqueda interna debe cubrir paciente, HCE/codigo temporal, documento, responsable, tipo de visita y UPSS. `DNI` es solo un dato mas, no el pivote obligatorio.

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

Las pruebas del módulo cubren 1001 visitas en 21 páginas REST con 51 pacientes y un máximo de cinco lecturas de relaciones simultáneas, además de la exportación filtrada de un conjunto de 2501 visitas con detalles cerrados. Son pruebas sintéticas locales; no acreditan tiempos de respuesta del servidor ni aceptación clínica o por perfiles en QLTY.

## Riesgos conocidos

- Las rutas heredadas `/admission` y `/home/admission` existen únicamente como redirecciones temporales hacia `/home/care-logbook`; no debe montarse ahí una segunda implementación.
- El alias interno de dashboard `admission` se conserva oculto para migrar configuraciones existentes de `defaultDashboardPerRole`; toda navegación visible usa `care-logbook`.
- Todo el histórico sigue cargándose en memoria y requiere una lectura de relaciones por paciente distinto; validar volumen y tiempos con el servidor antes de usarlo como reporte masivo.
- El flujo depende de la correspondencia real entre las Locations legacy y las UPSS; datos incompletos producen reportes pobres o confusos.
- Las integraciones con citas deben delegar al workspace de Appointments; duplicar esa logica genera divergencia.

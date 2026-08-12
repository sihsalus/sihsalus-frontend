# esm-active-visits-app

App encargada de la vista operativa de visitas activas.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Muestra y organiza el estado actual de las consultas activas del paciente.
- Consulta contexto clínico, resúmenes y widgets asociados a la atención en curso.
- No gestiona registro, facturación ni historial longitudinal completo.
- No reemplaza otros módulos clínicos; solo expone la capa operativa de visitas activas.

## Integraciones

- Frontend modular de OpenMRS/SIHSalus.
- APIs de visitas, encuentros y contexto del paciente.
- Componentes compartidos de navegación, estado y UI.

## Acreditaciones SIS pendientes

La acreditación verificada de una visita es un bundle indivisible: número de afiliación
`aac48226-d143-4274-80e0-264db4e368ee`, estado SIS
`5e13e902-2030-4f65-b9d5-9a4810c9a603` y fecha/hora de consulta
`e3a66f60-4abe-4948-b323-7c4935d8eb8a`. Una visita con estado vigente o no
vigente pero sin número o fecha continúa en la lista de pendientes; así, una escritura
parcial no desaparece después de recargar la aplicación.

`Sincronizar cobertura` reemplaza de forma explícita e idempotente los atributos
de esa misma visita con la afiliación actual de la persona y refresca la lista
con el estado persistido. Por eso debe usarse después de revisar la afiliación
cuando la visita conserva un estado pendiente o desactualizado. Los fallos
transitorios dejan la acción disponible para un nuevo intento. Si los datos
fuente siguen ausentes, incompletos o en conflicto, la UI no repite la operación
a ciegas: conserva `Acreditar` y ofrece `Revisar cobertura` únicamente a
usuarios con `app:opciones.registrarPaciente`.
Los tipos de atributo de financiador, número, estado y fecha —tanto de persona
como de visita— forman un contrato canónico compartido por Hoja Clínica,
Visitas Activas y FUA, exportado por `esm-patient-common-lib`. No se admiten
overrides locales de estos ocho UUID porque configurar solo un microfrontend
haría que los demás leyeran otra cobertura. `pendingSisAccreditations` conserva
únicamente la configuración operativa de conceptos SIS, estados pendientes y
tipo de identificador DNI.

La lista sigue siendo legible con `app:home.admision`, pero la mutación
`Sincronizar cobertura` solo aparece con el conjunto backend completo que usa
la operación: `Get People`, `Get Patients`, `Get Visits`, `Edit Visits` y `Get
Visit Attribute Types`. Este conjunto se publica como una capacidad compartida
para que Inicio de Consulta aplique el mismo preflight. `Acreditar` se evalúa por separado con
`app:opciones.registrarPaciente`, evitando que una capacidad implique la otra.
Si el servidor responde 401/403 pese al preflight, la sincronización se oculta durante esa sesión y la UI
deriva a un usuario autorizado; solo los fallos transitorios mantienen el reintento.
El nombre del paciente solo enlaza a la hoja clínica con `app:hoja.clinica`;
para el rol administrativo permanece como texto informativo.

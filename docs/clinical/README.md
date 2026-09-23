# Contexto y contratos clínicos

[Documentación](../README.md) · [Inicio](../../README.md)

SIH Salus es un frontend OpenMRS 3 adaptado al contexto peruano. No es un ERP completo ni un reemplazo del backend OpenMRS: la capa frontend orquesta microfrontends, pantallas, workspaces, validaciones de UI y configuracion clinica; la persistencia clinica sigue dependiendo de OpenMRS, FHIR2, OMODs instalados y paquetes de contenido.

Terminologia practica usada en este repositorio:

- `person`: datos de filiacion, identidad, atributos personales y direccion.
- `patient`: persona registrada como paciente, con identificadores clinicos y administrativos.
- `visit`: episodio/consulta o ingreso operativo. En UI se traduce normalmente como `consulta` o `atencion`, segun contexto.
- `encounter`: atencion clinica registrada dentro de una visita.
- `obs`: dato clinico observado dentro de un encounter.
- `order`: orden medica, laboratorio, radiologia, inmunizacion, interconsulta u otro pedido clinico.
- `appointment`: cita o turno programado.
- `queue entry`: posicion del paciente en cola de atencion.
- `workspace`: panel lateral/modal de OpenMRS 3 usado para crear o editar datos.
- `extension slot`: punto de extension del shell donde otro microfrontend inyecta UI.

## Contrato de identidad del paciente

El flujo de identidad no debe depender solo del DNI. En registro, emergencia, busqueda y Libro de Atenciones, un paciente debe poder ubicarse por identificadores, codigo temporal, nombre, fecha/hora de atencion, visita/cola, responsable, servicio, ubicacion y estado de identificacion.

Reglas transversales:

- `@sihsalus/esm-care-logbook-app` se presenta como `Libro de Atenciones` en `/home/care-logbook`; `/admission` y `/home/admission` solo redirigen por compatibilidad.
- Pacientes no identificados o incapaces de comunicarse pueden registrarse sin DNI, telefono, direccion o fecha exacta de nacimiento.
- Cuando el paciente no puede aportar datos o consentimiento, se debe capturar responsable, institucion o autoridad responsable.
- `zipcode/postcode` y telefono no son filtros avanzados por defecto en Patient Search. Pueden existir como datos demograficos/contacto, pero no como pivotes principales de busqueda.

## Contratos que no deben romperse

- No agregar UUIDs clinicos hardcodeados si pueden vivir en `config-schema`. Conceptos, encounter types, visit types, forms, order types, identifiers y care settings deben ser configurables.
- No mostrar claves crudas de i18n en UI. Si aparece algo como `caseMonitoringEncounters`, el modulo tiene una brecha de traduccion o namespace.
- No registrar workspaces, modales o extension slots con strings sueltos cuando exista una constante reutilizable. Los nombres magicos son una fuente recurrente de pantallas blancas.
- No asumir que FHIR2 soporta un recurso solo porque el endpoint existe. Algunos backends responden `501 Not Implemented` hasta que el OMOD/content este alineado.
- No guardar datos clinicos sin visita/consulta activa salvo que el flujo documente explicitamente otra semantica.
- No mezclar nombres tecnicos de OpenMRS con lenguaje de usuario final. El personal de salud debe ver terminos operativos claros.
- Los titulos de rutas, dashboards y sidebars son contrato de producto: deben usar keys traducibles y estar alineados con el nombre funcional del modulo. Ejemplo: `esm-care-logbook-app` se presenta como `Libro de Atenciones`, no como `Admisiones`, porque lista atenciones/consultas por UPSS y no ingresos hospitalarios.

## Dependencias backend/content

Cada modulo funcional deberia documentar:

- OMODs obligatorios u opcionales.
- Endpoints REST OpenMRS usados.
- Recursos FHIR2 usados.
- Conceptos, formularios, tipos de visita, tipos de encounter y tipos de identificador requeridos.
- Privilegios/permisos esperados.
- Comportamiento cuando una capacidad no existe en backend.

Si una app falla con `501`, `workspace not registered`, `modal not registered`, key i18n visible o pantalla en blanco, normalmente falta uno de esos contratos.

## Zonas de alto riesgo

- `esm-patient-chart-app`: layout principal, left sidebar, right sidebar, banner, visitas, workspaces y extension slots.
- `esm-styleguide`: componentes compartidos y sistemas de workspace; cambios pequenos impactan muchas apps.
- `esm-patient-orders-app`: depende de visita activa, workspaces, conceptos de ordenes, stock/billing/FHIR opcional.
- `esm-patient-immunizations-app`: depende de FHIR2 `Immunization`, conceptos/mappings de inmunizacion y contenido MINSA.
- `esm-service-queues-app`: depende de configuracion de colas, ubicaciones, servicios, rooms y conceptos de prioridad/estado.
- `esm-home-app`: rutas y accesos rapidos; no debe esconder errores de registro de extensiones ni dejar paneles huerfanos.

## Calidad esperada antes de agregar features

Antes de sumar funcionalidad clinica nueva, revisar:

- `config-schema`: campos clinicos configurables, sin UUIDs nuevos escondidos.
- `translations`: keys en `en.json` y `es.json`; ninguna key cruda visible.
- `routes.json`: rutas, extension slots y dependencias de backend declaradas.
- `README.md` del paquete: limite funcional, integraciones, backend/content requerido y QA minimo.
- Smoke manual o Playwright si toca patient chart, workspaces, sidebars, ordenes, colas, vacunacion o flujos de guardado.
- CodeQL/Biome: unused code, useless conditionals y template syntax no son cosmetica; suelen indicar copy-paste o ramas muertas.

## Documentos por dominio

| Área                 | Contratos y referencias                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidad y registro | [Demografía](patient-demographics-validation.md), [ubicación del identificador](patient-identifier-location-contract.md), [nacionalidad](patient-nationality-concepts.md) |
| Antecedentes         | [Contrato de datos](antecedents-data-contract.md), [contenido de historia social](social-history-content-contract.md)                                                     |
| Consulta externa     | [Plan de alineamiento](plan-consulta-externa-minsa.md), [signos vitales, triaje y encounters](vitals-triage-encounter-contracts.md)                                       |
| Seguros              | [Plan de alineamiento SIS](plan-alineamiento-seguros-sis.md)                                                                                                              |
| CRED                 | [Auditoría NTS 238](cred/NTS-238-AUDIT.md), [Test Peruano](test-peruano/README.md)                                                                                        |
| Ubicaciones          | [Santa Clotilde](locations-santa-clotilde/README.md)                                                                                                                      |
| Flujos               | [Citas, consultas, colas e identificación](../workflows/README.md)                                                                                                        |

Los planes y auditorías conservan su fecha y alcance. No sustituyen evidencia
del SHA y ambiente que se pretende aceptar. Los pendientes transversales están
en el [backlog documentado](../backlog.md).

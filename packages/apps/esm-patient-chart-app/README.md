# esm-patient-chart

This microfrontend provides the underlying framework on top of which all the individual widgets are run. It sets up the layout of the patient chart and handles routing between the chart summary and widget dashboards. It also sets up core extensions, the workspace, the side and nav menus, visits functionality as well as offline mode.

## Rol dentro de SIH Salus

`esm-patient-chart-app` es una zona critica. Es el contenedor de historia clinica del paciente y coordina:

- banner del paciente;
- left sidebar del chart;
- right sidebar y acciones contextuales;
- visit/consulta activa;
- workspaces de registro clinico;
- extension slots de otros microfrontends;
- widgets de resumen, resultados, ordenes, FUA, notas, listas, condiciones y datos clinicos.

Un cambio pequeno aqui puede romper multiples apps porque muchas extensiones dependen del mismo layout y del mismo contexto de paciente/visita.

## Contratos funcionales

- No registrar datos clinicos si no existe una visita/consulta activa, salvo flujo explicitamente documentado.
- No cambiar nombres de workspaces, modales o extension slots sin actualizar consumidores.
- No esconder errores de registro: si un workspace o modal no existe, el mensaje debe indicar el nombre faltante y la accion esperada.
- No reemplazar componentes estructurales por `div` salvo que se documente el motivo y se valide el layout.
- El banner del paciente debe ser estable: `Mostrar mas` no debe ocultar el resumen ni romper el layout.
- El left sidebar debe mostrar labels traducidos; keys como `caseMonitoringEncounters` son defectos.
- El right sidebar debe conservar acciones criticas: ordenes, FUA, notas de visita, formularios y listas de pacientes.

## Dependencias compartidas

- `esm-styleguide` para workspaces, action menus y componentes Carbon compartidos.
- `esm-patient-banner-app` para datos visibles del paciente.
- `esm-patient-orders-app`, `esm-fua-app`, `esm-patient-notes-app`, `esm-patient-forms-app`, `esm-patient-list-management-app` y otros módulos que inyectan acciones.
- OpenMRS REST/FHIR segun el widget: visitas, encounters, obs, ordenes, condiciones, alergias, medicamentos, resultados y archivos.

## QA minimo antes de mergear cambios aqui

- Abrir patient summary.
- Expandir y colapsar `Mostrar mas` del banner.
- Abrir left sidebar y verificar traducciones visibles.
- Abrir right sidebar y confirmar acciones principales.
- Iniciar consulta si no hay visita activa.
- Abrir una accion que dependa de visita activa y confirmar que el mensaje sale en el lugar correcto.
- Confirmar que no aparece `Minified React error #130`, pantalla blanca ni `workspace not registered`.

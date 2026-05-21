# esm-seguimiento-casos-app

App orientada al seguimiento clínico de VIH.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 26626, norma peruana vinculada a la atención del VIH y SIDA.

## Límites funcionales
- Soporta flujos especializados de atención y seguimiento de VIH.
- Organiza casos, clínicas especializadas y vistas clínicas relacionadas.
- No gestiona atención general no vinculada al dominio VIH.
- No reemplaza módulos de farmacia, laboratorio o hospitalización.

## Integraciones
- APIs clínicas y recursos de seguimiento especializado.
- Componentes de caso, panel y clínicas especializadas.
- Dependencias compartidas de navegación, estado y configuración.

## Traducciones y navegación
- El nombre visible del módulo debe ser `Monitoreo y seguimiento de casos`.
- En el patient chart, el item relacionado debe mostrarse traducido; keys como `caseMonitoringEncounters` no deben llegar a UI.
- Las rutas internas pueden seguir usando `case-monitoring`, pero el usuario final no debe ver nombres técnicos.

## Dependencias backend/content
- Relaciones/casos modelados en OpenMRS según el flujo clínico de seguimiento.
- Conceptos y forms del programa especializado.
- Permisos para ver, crear, cerrar o modificar seguimientos.
- Integraciones con laboratorio, farmacia o citas sólo si el backend/content correspondiente está instalado.

## Límites y riesgos
- No es un módulo genérico de gestión de casos para todo el hospital; su alcance actual es seguimiento especializado.
- No debe duplicar órdenes, resultados, farmacia ni citas. Debe enlazar o consumir esos módulos.
- Si el content package no tiene conceptos/forms del programa, el módulo debe degradar con mensaje de configuración pendiente.

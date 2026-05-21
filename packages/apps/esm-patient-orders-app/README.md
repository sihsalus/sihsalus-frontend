# esm-patient-orders-app

Provides the order basket for the OpenMRS 3 Patient Chart. It provides a hub for accessing
Medication orders, lab orders, and the like in the Patient Chart Workspace.

## Rol dentro de SIH Salus

Este modulo es el punto de entrada de ordenes clinicas dentro del patient chart. En SIH Salus debe cubrir, como minimo:

- ordenes de medicamentos;
- ordenes de laboratorio;
- ordenes de radiologia;
- ordenes de inmunizacion;
- ordenes de interconsulta.

Las ordenes son datos clinicos y deben asociarse a una visita/consulta activa. Si no hay visita activa, la UI debe bloquear la accion de forma clara y ofrecer iniciar consulta cuando corresponda.

## Contratos de UI

- Todas las tarjetas de orden deben usar el mismo layout visual: titulo, contador, icono, accion `Agregar` y estado deshabilitado si aplica.
- El mensaje `Se requiere una consulta activa para realizar ordenes` debe mostrarse arriba del workspace o cerca de la accion bloqueada, no perdido al final del panel.
- Los iconos deben estar presentes o, si se deshabilitan, debe hacerse de forma consistente para todas las ordenes.
- No debe aparecer `t is not a function`; los helpers y componentes que renderizan mensajes deben recibir `t` o usar `useTranslation` localmente.
- Los nombres de orden deben ser consistentes en plural: `Ordenes de laboratorio`, `Ordenes de radiologia`, etc.

## Dependencias backend/content

- Conceptos/tipos de orden configurados para cada familia de orden.
- Care settings y order types configurables desde `config-schema`.
- Visita activa disponible desde patient chart.
- Laboratorio, farmacia, radiologia, inmunizacion e interconsulta pueden depender de modulos backend distintos.
- Integraciones opcionales con stock/billing/FHIR deben degradar sin romper el workspace.

## TODO backend/permisos/auditoria

- Declarar `fhir2` en `routes.json` si los hooks `useOrderStockInfo` y `useOrderPrice` quedan habilitados con `InventoryItem` y `ChargeItemDefinition`.
- Probar Order Basket contra backend actualizado con medicamentos, laboratorios y ordenes generales reales.
- Validar que los nombres de child workspaces sigan siendo configurables para integraciones externas como Ward y Dispensing.
- Definir privilegios RBAC para ver ordenes, crear orden, modificar orden, descontinuar/cancelar orden y acceder a precio/stock.
- Agregar eventos auditables para crear/modificar/cancelar orden y para consultar precio/stock de insumos.
- Definir fallback cuando `billing`, `stockmanagement` o `fhirproxy` no estén instalados: ocultar extensiones, mostrar dato no disponible o desactivar accion.

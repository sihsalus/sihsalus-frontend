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

Las ordenes son datos clinicos y deben asociarse a una visita/consulta activa y a un proveedor clinico vinculado a la sesion. Si falta cualquiera de los dos, la UI debe bloquear la accion y explicar el requisito sin intentar atribuir la orden a otra persona.

## Contratos de UI

- Todas las tarjetas de orden deben usar el mismo layout visual: titulo, contador, icono, accion `Agregar` y estado deshabilitado si aplica.
- El mensaje `Se requiere una consulta activa para realizar ordenes` debe mostrarse arriba del workspace o cerca de la accion bloqueada, no perdido al final del panel.
- Los iconos deben estar presentes o, si se deshabilitan, debe hacerse de forma consistente para todas las ordenes.
- No debe aparecer `t is not a function`; los helpers y componentes que renderizan mensajes deben recibir `t` o usar `useTranslation` localmente.
- Los nombres de orden deben ser consistentes en plural: `Ordenes de laboratorio`, `Ordenes de radiologia`, etc.
- La tarjeta de interconsultas abre `request-interconsulta-workspace` como child workspace de la canasta. El formulario agrega la solicitud a la canasta; no la publica antes de que el profesional use `Firmar y cerrar`.
- El formulario de interconsulta distingue un consultorio/servicio local de un especialista externo o remoto. La segunda opción sigue siendo una orden de interconsulta y no inicia referencia, contrarreferencia ni traslado.

## Dependencias backend/content

- Conceptos/tipos de orden configurados para cada familia de orden.
- Care settings y order types configurables desde `config-schema`.
- Visita activa disponible desde patient chart.
- Exactamente un Provider activo vinculado a la persona de la cuenta clinica que firma la orden.
- Laboratorio, farmacia, radiologia, inmunizacion e interconsulta pueden depender de modulos backend distintos.
- La interconsulta usa por defecto el concept set `Tipo de Servicio` (`4bf3f465-…`) y el workspace de `esm-interconsultas-app`; ambos siguen siendo configurables.
- Integraciones opcionales con stock/billing/FHIR deben degradar sin romper el workspace.

## Contrato RBAC actual

| Capacidad                                                    | Privilegio frontend                      |
| ------------------------------------------------------------ | ---------------------------------------- |
| Ver el dashboard y el historial de órdenes                   | `app:hoja.clinica.ordenes`               |
| Abrir los workspaces para crear o modificar órdenes          | `app:hoja.clinica.ordenes.editar`        |
| Mostrar y abrir la ventana v2 de la canasta                  | `app:hoja.clinica.canastaOrdenes`        |
| Mostrar la acción Modificar para una orden de medicamento    | `app:hoja.clinica.medicamentos.editar`   |
| Modificar una orden general/laboratorio o cancelar una orden | `app:hoja.clinica.ordenes.editar`        |
| Completar el formulario específico de interconsulta          | `app:hoja.clinica.interconsultas.editar` |

El workspace `test-results-form-workspace` ya no está registrado por este paquete. La captura de resultados no debe documentarse ni asignarse mediante `app:hoja.clinica.resultados.editar` como si fuera una capacidad activa de Patient Orders.

La modificación de medicamentos tiene una brecha de composición: `medicamentos.editar` hace visible la acción, pero esta abre `order-basket`, registrado con `ordenes.editar`. Hasta alinear ambos guards, el rol que complete el flujo necesita los dos privilegios; no debe interpretarse la visibilidad del comando como autorización end-to-end.

Los guards de UI no autorizan la mutación en el backend. Los roles todavía necesitan los privilegios OpenMRS de Orders y la visita/encounter válidos para la operación.

## TODO backend/permisos/auditoria

- Validar `InventoryItem` y `ChargeItemDefinition` contra el `fhir2 >= 1.2` ya declarado cuando los hooks de stock y precio estén habilitados.
- Probar Order Basket contra backend actualizado con medicamentos, laboratorios y ordenes generales reales.
- Validar que los nombres de child workspaces sigan siendo configurables para integraciones externas como Ward y Dispensing.
- Granularizar, si la política lo requiere, creación, modificación y descontinuación/cancelación; actualmente comparten `app:hoja.clinica.ordenes.editar`.
- Alinear el guard de modificación de medicamentos con el privilegio del workspace de canasta y cubrir el flujo completo con una prueba de autorización.
- Proteger explícitamente las extensiones de precio, stock y resultado de laboratorio, y retirar cualquier resto de código del workspace de resultados eliminado.
- Agregar eventos auditables para crear/modificar/cancelar orden y para consultar precio/stock de insumos.
- Definir fallback cuando `billing`, `stockmanagement` o `fhirproxy` no estén instalados: ocultar extensiones, mostrar dato no disponible o desactivar accion.
